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

// ---------------------------------------------------------------- final review: cache pressure
import { selectDetailChunks, chunkHasDetail, motionTime } from '../../src/rendering/cityLayer';
import { TileMap } from '../../src/world/tilemap';
import { B } from '../../src/civilizations/buildingTypes';

describe('close-up under cache pressure (review finding: thrash at 1920×1080, 26 px/tile)', () => {
  it('draws only the nearest chunks that fit the cache, skipping chunks with no city in them', () => {
    const wanted = Array.from({ length: 100 }, (_, k) => k); // sorted nearest first
    const empty = (k: number) => k % 3 === 0; // a third of the view is countryside or sea
    const sel = selectDetailChunks(wanted, empty, 48);
    expect(sel.length).toBe(48);
    expect(sel.every((k) => !empty(k))).toBe(true);
    expect(sel).toEqual(wanted.filter((k) => !empty(k)).slice(0, 48)); // the nearest ones
  });
  it('knows which detail chunks hold no city district (no canvas is spent on them)', () => {
    const m = new TileMap(32, 32); // 4×4 detail chunks of 8 tiles
    expect(chunkHasDetail(m, 0, 4)).toBe(false);
    const i = m.idx(10, 3); // detail chunk (1, 0)
    m.bld[i] = B.HOUSE; m.settle[i] = 1;
    expect(chunkHasDetail(m, 1, 4)).toBe(true);
    expect(chunkHasDetail(m, 0, 4)).toBe(false);
  });
  it('the cache hands back evicted canvases for reuse', () => {
    const c = new DetailCache<{ id: number }>(2);
    expect(c.put(1, { id: 1 })).toEqual([]);
    c.put(2, { id: 2 });
    expect(c.put(3, { id: 3 })).toEqual([{ id: 1 }]);
  });
});

describe('reduce motion (review finding: weather kept animating)', () => {
  it('motion time steps once a second under reduce motion and runs smoothly otherwise', () => {
    expect(motionTime(12.7, true)).toBe(12);
    expect(motionTime(12.7, false)).toBe(12.7);
  });
});

describe('the close-up converges instead of thrashing (review finding, frame simulation)', () => {
  /** Frames of: select what to show, redraw up to 2 missing chunks, cache them. Returns redraws in the last 10 frames. */
  const redrawsAtTheEnd = (cap: number, wantedCount: number) => {
    const cache = new DetailCache<number>(48);
    const wanted = Array.from({ length: wantedCount }, (_, k) => k);
    let late = 0;
    for (let frame = 0; frame < 100; frame++) {
      const shown = selectDetailChunks(wanted, () => false, cap);
      let budget = 2;
      for (const k of shown) {
        if (cache.has(k)) { cache.want(k); continue; }
        if (budget-- <= 0) break;
        cache.put(k, k);
        if (frame >= 90) late++;
      }
    }
    return late;
  };
  it('with the cap, 88 wanted chunks settle: no redraws once the view is still', () => {
    expect(redrawsAtTheEnd(48, 88)).toBe(0);
  });
  it('without the cap (the old behaviour) the same view redraws forever', () => {
    expect(redrawsAtTheEnd(9999, 88)).toBeGreaterThan(0);
  });
});
