/**
 * World serialization (save format v1).
 *
 * Layout: magic "EPCH" | u32 header length | header JSON | binary section.
 *  - header JSON: { format, engineVersion, saveVersion, meta summary, state JSON
 *    (entities as arrays), array table [{field, type, offset, length}] }
 *  - binary: the TileMap typed arrays and knowledge bitsets, 4-byte aligned.
 * The whole payload is gzip-compressed with CompressionStream when available.
 * A CRC32 checksum of the uncompressed payload is stored in the outer frame
 * so corrupted or truncated saves are detected instead of loaded.
 */
import type { WorldState } from '../sim/types';
import { TileMap } from '../world/tilemap';
import { SAVE_VERSION } from '../config/laws';
import { migrate } from './migrations';

const MAGIC = 'EPCH';

type ArrType = 'f32' | 'u8' | 'i8' | 'u16' | 'u32';
interface ArrEntry {
  key: string;
  type: ArrType;
  offset: number;
  length: number;
}

function typeOf(a: ArrayLike<number>): ArrType {
  if (a instanceof Float32Array) return 'f32';
  if (a instanceof Int8Array) return 'i8';
  if (a instanceof Uint16Array) return 'u16';
  if (a instanceof Uint32Array) return 'u32';
  return 'u8';
}

function make(type: ArrType, buf: ArrayBuffer, offset: number, length: number) {
  switch (type) {
    case 'f32':
      return new Float32Array(buf.slice(offset, offset + length * 4));
    case 'i8':
      return new Int8Array(buf.slice(offset, offset + length));
    case 'u16':
      return new Uint16Array(buf.slice(offset, offset + length * 2));
    case 'u32':
      return new Uint32Array(buf.slice(offset, offset + length * 4));
    default:
      return new Uint8Array(buf.slice(offset, offset + length));
  }
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const MAPS = ['civs', 'settlements', 'persons', 'dynasties', 'bands', 'herds', 'subspecies', 'monsters', 'agents', 'armies', 'religions', 'cultures', 'languages', 'diseases', 'wars', 'treaties', 'orgs', 'routes', 'colonies'] as const;

export class SaveError extends Error {}

/** Serialize to an uncompressed payload. */
export function encodeWorld(w: WorldState): Uint8Array {
  const arrays: { key: string; arr: ArrayLike<number> & { buffer: ArrayBufferLike; byteLength: number } }[] = [];
  for (const f of TileMap.FIELDS) arrays.push({ key: 'map.' + f, arr: w.map[f] as any });
  for (const [civId, bits] of w.knowledge) arrays.push({ key: 'know.' + civId, arr: bits as any });
  const table: ArrEntry[] = [];
  let offset = 0;
  for (const a of arrays) {
    table.push({ key: a.key, type: typeOf(a.arr), offset, length: a.arr.length });
    offset += Math.ceil(a.arr.byteLength / 4) * 4;
  }
  const state: Record<string, unknown> = {
    meta: w.meta,
    laws: w.laws,
    tick: w.tick,
    rng: w.rng,
    mapSize: [w.map.w, w.map.h],
    ids: w.ids,
    relations: [...w.relations.values()],
    events: w.events,
    stats: w.stats,
    climate: w.climate,
    milestones: w.milestones,
    interventions: w.interventions,
    speciesStatus: w.speciesStatus,
  };
  for (const k of MAPS) state[k] = [...(w[k] as Map<number, unknown>).values()];
  const header = JSON.stringify({ format: 'epoch-world', saveVersion: SAVE_VERSION, engineVersion: w.meta.engineVersion, state, table });
  const hbytes = new TextEncoder().encode(header);
  const total = 8 + hbytes.length + ((4 - ((8 + hbytes.length) % 4)) % 4) + offset;
  const out = new Uint8Array(total);
  out.set(new TextEncoder().encode(MAGIC), 0);
  new DataView(out.buffer).setUint32(4, hbytes.length, true);
  out.set(hbytes, 8);
  const binStart = total - offset;
  for (let k = 0; k < arrays.length; k++) {
    const a = arrays[k].arr;
    out.set(new Uint8Array(a.buffer as ArrayBuffer, (a as any).byteOffset ?? 0, a.byteLength), binStart + table[k].offset);
  }
  return out;
}

export function decodeWorld(bytes: Uint8Array): WorldState {
  const magic = new TextDecoder().decode(bytes.subarray(0, 4));
  if (magic !== MAGIC) throw new SaveError('Not an EPOCH world file');
  const hlen = new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true);
  if (8 + hlen > bytes.length) throw new SaveError('Save file is truncated');
  let parsed: any;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + hlen)));
  } catch {
    throw new SaveError('Save header is corrupted');
  }
  parsed = migrate(parsed);
  const table: ArrEntry[] = parsed.table;
  const binBytes = table.reduce((a, e) => Math.max(a, e.offset + Math.ceil(byteLen(e) / 4) * 4), 0);
  const binStart = bytes.length - binBytes;
  if (binStart < 8 + hlen) throw new SaveError('Save data is truncated');
  const buf = bytes.buffer.slice(bytes.byteOffset + binStart, bytes.byteOffset + bytes.length) as ArrayBuffer;
  const st = parsed.state;
  const map = new TileMap(st.mapSize[0], st.mapSize[1]);
  const knowledge = new Map<number, Uint32Array>();
  for (const e of table) {
    const arr = make(e.type, buf, e.offset, e.length);
    if (e.key.startsWith('map.')) (map as any)[e.key.slice(4)] = arr;
    else if (e.key.startsWith('know.')) knowledge.set(Number(e.key.slice(5)), arr as Uint32Array);
  }
  const w: any = {
    meta: st.meta,
    laws: st.laws,
    tick: st.tick,
    rng: st.rng,
    map,
    ids: st.ids,
    relations: new Map(st.relations.map((r: any) => [r.a < r.b ? `${r.a}-${r.b}` : `${r.b}-${r.a}`, r])),
    events: st.events,
    stats: st.stats,
    climate: st.climate,
    milestones: st.milestones,
    interventions: st.interventions ?? [],
    speciesStatus: st.speciesStatus ?? {},
    knowledge,
  };
  for (const k of MAPS) w[k] = new Map((st[k] ?? []).map((e: any) => [e.id, e]));
  return w as WorldState;
}

function byteLen(e: ArrEntry): number {
  return e.type === 'f32' || e.type === 'u32' ? e.length * 4 : e.type === 'u16' ? e.length * 2 : e.length;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const blob = new Blob([bytes as BlobPart]);
  const res = new Response(blob.stream().pipeThrough(stream as any));
  return new Uint8Array(await res.arrayBuffer());
}

/** Outer frame: "EPZ1" | u32 crc | u8 compressed? | payload. */
export async function packWorld(w: WorldState): Promise<Uint8Array> {
  const raw = encodeWorld(w);
  const crc = crc32(raw);
  let body = raw;
  let compressed = 0;
  if (typeof CompressionStream !== 'undefined') {
    try {
      body = await pipe(raw, new CompressionStream('gzip'));
      compressed = 1;
    } catch {
      body = raw;
    }
  }
  const out = new Uint8Array(9 + body.length);
  out.set(new TextEncoder().encode('EPZ1'), 0);
  new DataView(out.buffer).setUint32(4, crc, true);
  out[8] = compressed;
  out.set(body, 9);
  return out;
}

export async function unpackWorld(bytes: Uint8Array): Promise<WorldState> {
  if (bytes.length < 9 || new TextDecoder().decode(bytes.subarray(0, 4)) !== 'EPZ1') {
    // allow raw (uncompressed, unframed) files too
    return decodeWorld(bytes);
  }
  const crc = new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true);
  let body = bytes.subarray(9);
  if (bytes[8] === 1) {
    if (typeof DecompressionStream === 'undefined') throw new SaveError('This browser cannot read compressed saves');
    try {
      body = await pipe(body, new DecompressionStream('gzip'));
    } catch {
      throw new SaveError('Save data is corrupted (decompression failed)');
    }
  }
  if (crc32(body) !== crc) throw new SaveError('Save data failed its integrity check');
  return decodeWorld(body);
}
