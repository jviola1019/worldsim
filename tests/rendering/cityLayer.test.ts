/**
 * Round 6: close-up city layer, the parts that need no DOM (fade curve, chunk mapping, cache).
 */
import { describe, it, expect } from 'vitest';
import { detailAlpha, detailChunksOf, DetailCache, DCHUNK } from '../../src/rendering/cityLayer';
import { CHUNK } from '../../src/sim/context';

describe('close-up layer fade', () => {
  it('is off below 20 px per tile, fades in to 26, then stays on', () => {
    expect(detailAlpha(19)).toBe(0);
    expect(detailAlpha(20)).toBe(0);
    expect(detailAlpha(23)).toBeCloseTo(0.5, 10);
    expect(detailAlpha(26)).toBe(1);
    expect(detailAlpha(60)).toBe(1);
  });
});

describe('detail chunks', () => {
  it('one map chunk covers 2×2 detail chunks, and only those are invalidated with it', () => {
    expect(CHUNK / DCHUNK).toBe(2);
    const mapW = 64; // 4 map chunks across, 8 detail chunks across
    expect(detailChunksOf(0, mapW).sort((a, b) => a - b)).toEqual([0, 1, 8, 9]);
    expect(detailChunksOf(5, mapW).sort((a, b) => a - b)).toEqual([18, 19, 26, 27]); // map chunk (1,1)
  });
  it('a map chunk on a ragged right edge maps only to detail chunks that exist', () => {
    const mapW = 40; // map chunks across: 3 (last one 8 wide); detail chunks across: 5
    const ks = detailChunksOf(2, mapW);
    expect(ks.sort((a, b) => a - b)).toEqual([4, 9]);
  });
});

describe('detail cache', () => {
  it('never holds more than its cap, keeping the most recently used chunks', () => {
    const c = new DetailCache<number>(48);
    for (let k = 0; k < 100; k++) c.put(k, k);
    let held = 0;
    for (let k = 0; k < 100; k++) if (c.has(k)) held++;
    expect(held).toBe(48);
    for (let k = 52; k < 100; k++) expect(c.has(k)).toBe(true);
    // touching an old survivor keeps it through the next evictions
    c.want(52);
    for (let k = 100; k < 120; k++) c.put(k, k);
    expect(c.has(52)).toBe(true);
    expect(c.has(53)).toBe(false);
    expect(c.evicted.length).toBeGreaterThan(0);
  });
});
