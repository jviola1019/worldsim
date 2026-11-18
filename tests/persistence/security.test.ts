/**
 * Hostile and broken save files (security audit V1–V5, S1) and storage failures (V6, plan:
 * unavailableStorage, migrationFromV0, quota exhaustion / interrupted writes).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { encodeWorld, decodeWorld, packWorld, unpackWorld, gunzipCapped, SaveError } from '../../src/persistence/serialize';
import { SaveStore, importBytes } from '../../src/persistence/saves';
import { Simulation } from '../../src/sim/simulation';

const sim = makeSim('sec-1', 48);
sim.runYears(20);
sim.syncRng();
const good = encodeWorld(sim.w);

/** Split a raw EPCH file into its header object and binary section, and rebuild after edits. */
function split(b: Uint8Array) {
  const hlen = new DataView(b.buffer, b.byteOffset).getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(b.subarray(8, 8 + hlen)));
  const binStart = 8 + hlen + ((4 - ((8 + hlen) % 4)) % 4);
  return { header, bin: b.slice(binStart) };
}
function build(header: unknown, bin: Uint8Array): Uint8Array {
  const h = new TextEncoder().encode(JSON.stringify(header));
  const pad = (4 - ((8 + h.length) % 4)) % 4;
  const out = new Uint8Array(8 + h.length + pad + bin.length);
  out.set(new TextEncoder().encode('EPCH'), 0);
  new DataView(out.buffer).setUint32(4, h.length, true);
  out.set(h, 8);
  out.set(bin, 8 + h.length + pad);
  return out;
}
function mutate(fn: (h: any, bin: Uint8Array) => void): Uint8Array {
  const { header, bin } = split(good);
  fn(header, bin);
  return build(header, bin);
}
const rejects = (b: Uint8Array) => expect(() => decodeWorld(b)).toThrow(SaveError);

describe('hostile save files fail safely with SaveError', () => {
  it('the round-trip helper itself is faithful', () => {
    expect(new Simulation(decodeWorld(mutate(() => {}))).digest()).toBe(new Simulation(decodeWorld(good)).digest());
  });

  it.each([
    ['4-byte file', () => new TextEncoder().encode('EPCH')],
    ['header is null', () => build(null, new Uint8Array())],
    ['header is a number', () => build(42, new Uint8Array())],
    ['table is not an array', () => mutate((h) => { h.table = {}; })],
    ['negative array offset', () => mutate((h) => { h.table[0].offset = -4096; })],
    ['huge offset, negative length', () => mutate((h) => { h.table[0].offset = 1e12; h.table[0].length = -1e12; })],
    ['string offset', () => mutate((h) => { h.table[0].offset = 'abc'; })],
    ['short array', () => mutate((h) => { h.table[0].length = 10; })],
    ['map size larger than arrays', () => mutate((h) => { h.state.mapSize = [h.state.mapSize[0] + 1, h.state.mapSize[1]]; })],
    ['map size 1e9 (allocation bomb)', () => mutate((h) => { h.state.mapSize = [1e9, 1e9]; })],
    ['map size 16384', () => mutate((h) => { h.state.mapSize = [16384, 16384]; })],
    ['map size strings', () => mutate((h) => { h.state.mapSize = ['abc', 'def']; })],
    ['table key map.__proto__', () => mutate((h) => { h.table[0].key = 'map.__proto__'; })],
    ['table key map.w', () => mutate((h) => { h.table[0].key = 'map.w'; })],
    ['non-string table key', () => mutate((h) => { h.table[0].key = 7; })],
    ['unknown terrain bytes', () => mutate((h, bin) => { const t = h.table.find((e: any) => e.key === 'map.terrain'); bin.fill(255, t.offset, t.offset + t.length); })],
    ['tick is a string', () => mutate((h) => { h.state.tick = 'abc'; })],
    ['entities without ids', () => mutate((h) => { for (const c of h.state.civs) delete c.id; })],
    ['colour with an off-device URL (tracking beacon)', () => mutate((h) => { h.state.civs[0].color = 'url(https://attacker.example/b.png)'; })],
    ['80k-sample statistics (quadratic padding)', () => mutate((h) => { h.state.stats.global.years = new Array(80000).fill(0); h.state.stats.global.data = { x: [] }; })],
    ['territory snapshot of 30000² (allocation bomb)', () => mutate((h) => { h.state.stats.territory = [{ year: 0, w: 30000, h: 30000, rle: [1, 9e8] }]; })],
    ['missing state', () => mutate((h) => { delete h.state; })],
  ])('%s', (_name, make) => rejects(make()));

  it('a gzip bomb is cut off at the size cap instead of inflating', async () => {
    const zeros = new Uint8Array(8 * 1024 * 1024); // 8 MiB of zeros compresses to a few KB
    const gz = new Uint8Array(await new Response(new Blob([zeros]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    expect(gz.length).toBeLessThan(64 * 1024);
    await expect(gunzipCapped(gz, 1024 * 1024)).rejects.toBeInstanceOf(SaveError);
    expect((await gunzipCapped(gz, 16 * 1024 * 1024)).length).toBe(zeros.length);
  });

  it('truncated and corrupted framed files are rejected; good ones load', async () => {
    const framed = await packWorld(sim.w);
    await expect(unpackWorld(framed.subarray(0, framed.length >> 1))).rejects.toBeInstanceOf(SaveError);
    await expect(unpackWorld(framed.subarray(0, framed.length - 8))).rejects.toBeInstanceOf(SaveError);
    const flipped = framed.slice(); flipped[flipped.length - 30] ^= 0xff;
    await expect(unpackWorld(flipped)).rejects.toBeInstanceOf(SaveError);
    expect(new Simulation(await unpackWorld(framed)).digest()).toBe(new Simulation(decodeWorld(good)).digest());
  });
});

describe('migration from version 0', () => {
  it('a v0 save (no version field, no civ economy accumulators or unlocks) loads and runs', () => {
    const v0 = mutate((h) => { delete h.saveVersion; for (const c of h.state.civs) { delete c.acc; delete c.unlocked; } });
    const s = new Simulation(decodeWorld(v0));
    for (const c of s.w.civs.values()) { expect(Array.isArray(c.unlocked)).toBe(true); expect(c.acc).toBeTruthy(); }
    expect(() => s.runYears(2)).not.toThrow();
  });
  it('a save from a newer version is refused with a clear message', () => {
    expect(() => decodeWorld(mutate((h) => { h.saveVersion = 999; }))).toThrow(/newer/);
  });
});

describe('storage failures', () => {
  it('unavailable storage: the store reports it, and importing a file still works', async () => {
    const saved = (globalThis as any).indexedDB;
    (globalThis as any).indexedDB = undefined;
    try {
      const store = new SaveStore();
      expect(await store.open()).toBe(false);
      expect(store.error).toMatch(/not available/);
      expect(await store.list()).toEqual([]);
      await expect(store.save('x', sim.w)).rejects.toBeInstanceOf(SaveError);
      const w = await importBytes(await packWorld(sim.w));
      expect(new Simulation(w).digest()).toBe(new Simulation(decodeWorld(good)).digest());
    } finally {
      (globalThis as any).indexedDB = saved;
    }
  });

  it('a write that fails mid-transaction (quota) leaves the previous save intact and consistent', async () => {
    const store = new SaveStore();
    expect(await store.open()).toBe(true);
    await store.save('slot-q', sim.w);
    const before = new Simulation(await store.load('slot-q')).digest();
    const later = new Simulation(decodeWorld(good));
    later.runYears(1);
    later.syncRng();
    // the second put of the transaction (slot metadata) throws, like QuotaExceededError
    const proto = (globalThis as any).IDBObjectStore.prototype;
    const put = proto.put;
    let calls = 0;
    proto.put = function (...args: unknown[]) {
      if (++calls === 2) throw new DOMException('quota', 'QuotaExceededError');
      return put.apply(this, args);
    };
    try {
      await expect(store.save('slot-q', later.w)).rejects.toBeInstanceOf(SaveError);
    } finally {
      proto.put = put;
    }
    // neither half of the failed write landed
    expect(new Simulation(await store.load('slot-q')).digest()).toBe(before);
    expect((await store.list()).find((m) => m.slot === 'slot-q')!.year).toBe(sim.year);
    // and a brand-new slot that fails leaves no orphaned data
    calls = 0;
    proto.put = function (...args: unknown[]) {
      if (++calls === 2) throw new DOMException('quota', 'QuotaExceededError');
      return put.apply(this, args);
    };
    try {
      await expect(store.save('slot-new', later.w)).rejects.toBeInstanceOf(SaveError);
    } finally {
      proto.put = put;
    }
    await expect(store.load('slot-new')).rejects.toBeInstanceOf(SaveError);
  });
});
