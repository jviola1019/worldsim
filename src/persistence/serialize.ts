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
import { validDevices } from './device';
import { validFavorites } from '../sim/favorites';
import type { WorldState } from '../sim/types';
import { TileMap } from '../world/tilemap';
import { TERRAIN } from '../world/terrain';
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

const MAPS = ['civs', 'settlements', 'persons', 'dynasties', 'bands', 'herds', 'subspecies', 'monsters', 'agents', 'armies', 'religions', 'cultures', 'languages', 'diseases', 'wars', 'treaties', 'orgs', 'routes', 'colonies', 'outlets', 'ais', 'leagues'] as const;

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
    popLedger: w.popLedger,
    speciesStatus: w.speciesStatus,
    sports: w.sports,
    album: w.album,
    endings: w.endings,
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

/** Largest world side a save may declare (the biggest preset is 320; headroom for custom sizes). */
export const MAX_MAP_SIDE = 1024;
/** Largest decompressed save accepted (a 512² world is ~7 MB; this guards against gzip bombs). */
export const MAX_SAVE_BYTES = 256 * 1024 * 1024;

const ARR_TYPES: ReadonlySet<string> = new Set(['u8', 'i8', 'u16', 'u32', 'f32']);
const HEX = /^#[0-9a-f]{6}$/i;
const isInt = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min;
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Decode an EPCH world. Every value that sizes an allocation or indexes an array is validated first;
 * any malformed input raises SaveError (never a raw TypeError/RangeError, never a half-valid world).
 */
export function decodeWorld(bytes: Uint8Array): WorldState {
  try {
    return decodeChecked(bytes);
  } catch (e) {
    if (e instanceof SaveError) throw e;
    throw new SaveError(`Save file is malformed (${e instanceof Error ? e.message : String(e)})`);
  }
}

function decodeChecked(bytes: Uint8Array): WorldState {
  if (bytes.length < 8) throw new SaveError('Not an EPOCH world file');
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
  if (!isObj(parsed)) throw new SaveError('Save header is corrupted');
  parsed = migrate(parsed);
  if (!isObj(parsed) || !isObj(parsed.state) || !Array.isArray(parsed.table)) throw new SaveError('Save header is incomplete');
  const st = parsed.state;
  // --- map size bounds every allocation below
  const [W, H] = Array.isArray(st.mapSize) ? st.mapSize : [];
  if (!isInt(W, 1) || !isInt(H, 1) || W > MAX_MAP_SIDE || H > MAX_MAP_SIDE) throw new SaveError('Save declares an invalid world size');
  const n = W * H;
  // --- array table: known keys and types, in-bounds aligned ranges, exact lengths
  const binStart = 8 + hlen + ((4 - ((8 + hlen) % 4)) % 4); // where encodeWorld writes the arrays
  const binLen = bytes.length - binStart;
  if (binLen < 0) throw new SaveError('Save data is truncated');
  const fields = new Set<string>(TileMap.FIELDS as readonly string[]);
  const table: ArrEntry[] = parsed.table;
  const seen = new Set<string>();
  for (const e of table) {
    if (!isObj(e) || typeof e.key !== 'string' || !ARR_TYPES.has(e.type) || !isInt(e.offset) || !isInt(e.length) || e.offset % 4 !== 0) throw new SaveError('Save array table is corrupted');
    const isMap = e.key.startsWith('map.') && fields.has(e.key.slice(4));
    const isKnow = /^know\.\d+$/.test(e.key);
    if (!isMap && !isKnow) throw new SaveError(`Unknown array "${e.key}" in save`);
    if (isMap && e.length !== n) throw new SaveError(`Array ${e.key} does not match the world size`);
    if (isKnow && e.length > n) throw new SaveError('Knowledge array is too large');
    if (e.offset + byteLen(e) > binLen) throw new SaveError('Save data is truncated');
    seen.add(e.key);
  }
  for (const f of fields) if (!seen.has('map.' + f)) throw new SaveError(`Save is missing map layer "${f}"`);
  // --- state shape
  if (!isInt(st.tick) || !Array.isArray(st.rng) || st.rng.length !== 4 || !st.rng.every((v: unknown) => isInt(v))) throw new SaveError('Save clock or random state is invalid');
  if (!isObj(st.meta) || !isObj(st.laws) || !isObj(st.ids) || !isObj(st.climate) || !isObj(st.milestones) || !isObj(st.stats)) throw new SaveError('Save state is incomplete');
  if (!Array.isArray(st.relations) || !Array.isArray(st.events)) throw new SaveError('Save state is incomplete');
  if (!validDevices(st.meta.devices)) throw new SaveError('Save device history is invalid');
  if (!validFavorites(st.meta.favorites)) throw new SaveError('Save favourites are invalid');
  if (typeof st.meta.name !== 'string' || st.meta.name.length > 200 || (st.meta.seed !== undefined && (typeof st.meta.seed !== 'string' || st.meta.seed.length > 200))) throw new SaveError('Save world name is invalid');
  for (const k of MAPS) {
    const list = st[k] ?? [];
    if (!Array.isArray(list) || !list.every((x: unknown) => isObj(x) && isInt(x.id, 1))) throw new SaveError(`Save list "${k}" is corrupted`);
  }
  for (const c of st.civs ?? []) if (!HEX.test(c.color) || (c.emblem && !HEX.test(c.emblem.c2))) throw new SaveError('Save contains an invalid nation colour');
  validateStats(st.stats, W, H);
  if (st.endings !== undefined) validateEndings(st.endings);
  // --- build
  const buf = bytes.buffer.slice(bytes.byteOffset + binStart, bytes.byteOffset + bytes.length) as ArrayBuffer;
  const map = new TileMap(W, H);
  const knowledge = new Map<number, Uint32Array>();
  for (const e of table) {
    const arr = make(e.type, buf, e.offset, e.length);
    if (e.key.startsWith('map.')) (map as any)[e.key.slice(4)] = arr;
    else knowledge.set(Number(e.key.slice(5)), arr as Uint32Array);
  }
  for (let i = 0; i < n; i++) if (map.terrain[i] >= TERRAIN.length) throw new SaveError('Save contains unknown terrain');
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
    popLedger: st.popLedger,
    speciesStatus: st.speciesStatus ?? {},
    album: Array.isArray(st.album) && st.album.length <= 5000 && st.album.every((a: any) => isObj(a) && typeof a.cols === 'string' && a.cols.length <= 4096 && isInt(a.n, 1) && a.n <= 256 && HEX.test(a.color)) ? st.album : undefined,
    sports: isObj(st.sports) && Array.isArray(st.sports.held) && Array.isArray(st.sports.cups) && Number.isFinite(st.sports.next) ? st.sports : undefined,
    endings: isObj(st.endings) ? st.endings : undefined,
    knowledge,
  };
  if (typeof w.laws.horrors !== 'boolean') w.laws.horrors = false; // law added in round 5
  for (const k of MAPS) w[k] = new Map((st[k] ?? []).map((e: any) => [e.id, e]));
  // id counters added after the first release (older saves start them at the highest id in use)
  for (const [k, list] of [['outlet', 'outlets'], ['ai', 'ais'], ['league', 'leagues']] as const) {
    if (!isInt(w.ids[k])) w.ids[k] = Math.max(0, ...[...w[list].keys()].filter((id: unknown) => isInt(id)));
  }
  return w as WorldState;
}

/** Statistics drive allocations and loops in the UI and sampler: bound them. */
function validateStats(stats: any, W: number, H: number): void {
  const series = (s: any) => {
    if (!isObj(s) || !Array.isArray(s.years) || !isObj(s.data) || s.years.length > 1000) throw new SaveError('Save statistics are corrupted');
    for (const k of Object.keys(s.data)) if (!Array.isArray(s.data[k]) || s.data[k].length !== s.years.length) throw new SaveError('Save statistics are corrupted');
  };
  series(stats.global);
  if (!isObj(stats.civs)) throw new SaveError('Save statistics are corrupted');
  for (const k of Object.keys(stats.civs)) series(stats.civs[k]);
  if (stats.territory !== undefined) {
    if (!Array.isArray(stats.territory) || stats.territory.length > 200) throw new SaveError('Save territory history is corrupted');
    const tw = Math.ceil(W / 2), th = Math.ceil(H / 2);
    for (const t of stats.territory) {
      if (!isObj(t) || t.w !== tw || t.h !== th || !Array.isArray(t.rle)) throw new SaveError('Save territory history is corrupted');
      let sum = 0;
      for (let k = 1; k < t.rle.length; k += 2) sum += isInt(t.rle[k], 1) ? t.rle[k] : NaN;
      if (sum !== tw * th) throw new SaveError('Save territory history is corrupted');
    }
  }
}

/** War/catastrophe state (round 5): bounded lists of finite numbers. */
function validateEndings(e: any): void {
  const bad = () => { throw new SaveError('Save catastrophe state is corrupted'); };
  const fin = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (!isObj(e) || !isObj(e.techLead) || !Array.isArray(e.techLead.history) || e.techLead.history.length > 2000 || !e.techLead.history.every(fin)) bad();
  if (!Array.isArray(e.log) || e.log.length > 1000 || !e.log.every((x: any) => isObj(x) && fin(x.year) && fin(x.x) && fin(x.y) && typeof x.type === 'string' && x.type.length <= 40)) bad();
  if (!Array.isArray(e.goo) || e.goo.length > 100 || !e.goo.every((g: any) => isObj(g) && fin(g.x) && fin(g.y) && fin(g.r) && g.r >= 0 && g.r < MAX_MAP_SIDE)) bad();
  if (!isObj(e.cure) || Object.keys(e.cure).length > 10000 || !Object.values(e.cure).every((v) => fin(v) && (v as number) >= 0 && (v as number) <= 1)) bad();
  if (e.coolingSource !== undefined && (typeof e.coolingSource !== 'string' || e.coolingSource.length > 40)) bad();
  if (!fin(e.uv) || !fin(e.chemBan) || !fin(e.lastNuclearUse)) bad();
}

function byteLen(e: ArrEntry): number {
  return e.type === 'f32' || e.type === 'u32' ? e.length * 4 : e.type === 'u16' ? e.length * 2 : e.length;
}

/** Gunzip with an output cap (throws SaveError past `limit` bytes; guards against decompression bombs). */
export function gunzipCapped(bytes: Uint8Array, limit: number): Promise<Uint8Array> {
  return pipe(bytes, new DecompressionStream('gzip'), limit);
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, limit = Infinity): Promise<Uint8Array> {
  const reader = (new Blob([bytes as BlobPart]).stream().pipeThrough(stream as any) as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new SaveError('Save is too large to load');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
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
      body = await gunzipCapped(body, MAX_SAVE_BYTES);
    } catch (e) {
      if (e instanceof SaveError) throw e;
      throw new SaveError('Save data is corrupted (decompression failed)');
    }
  }
  if (crc32(body) !== crc) throw new SaveError('Save data failed its integrity check');
  return decodeWorld(body);
}
