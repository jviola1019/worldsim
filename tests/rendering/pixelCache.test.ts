/**
 * Round 7: WorldBox-style pixel caching. Repainting only the changed chunks must give exactly the
 * pixels of a full rebuild, including relief shading and border lines that cross chunk edges.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { paintOverview, paintOverlay, chunkRect, ChunkSweep, OVERVIEW_GROW, OVERLAY_GROW, OVERLAY_SCALE } from '../../src/rendering/pixelCache';
import { markTile, markOverlay, CHUNK } from '../../src/sim/context';
import { B } from '../../src/civilizations/buildingTypes';
import { T } from '../../src/world/terrain';
import { hash3 } from '../../src/core/rng';

const full = { x0: 0, y0: 0, x1: 0, y1: 0 };

describe('overview pixels (1 px per tile)', () => {
  it('repainting only dirty chunks equals a full rebuild after scattered changes', () => {
    const sim = makeSim('px-ov', 80); // 80 is not a multiple of 16: ragged last chunk
    const m = sim.w.map;
    const all = { ...full, x1: m.w, y1: m.h };
    const cached = new Uint8ClampedArray(m.n * 4);
    paintOverview(m, cached, all);
    sim.chunkDirty.fill(0);
    for (let n = 0; n < 60; n++) {
      const i = hash3(n, 1, 9) % m.n;
      const kind = n % 4;
      if (kind === 0) m.elev[i] = Math.min(1, m.elev[i] + 0.2); // shades the tiles right and below, maybe in the next chunk
      else if (kind === 1) m.terrain[i] = T.DESERT;
      else if (kind === 2 && m.isLand(i)) m.bld[i] = B.FARM;
      else m.veg[i] = 200;
      markTile(sim, i);
    }
    // chunk-edge tiles: a change on the last column and row of a chunk
    for (const [x, y] of [[CHUNK - 1, 5], [5, CHUNK - 1], [CHUNK * 2 - 1, CHUNK * 2 - 1]]) {
      const i = m.idx(x, y);
      m.elev[i] = 0.05;
      markTile(sim, i);
    }
    let repainted = 0;
    for (let k = 0; k < sim.chunkDirty.length; k++) if (sim.chunkDirty[k]) {
      paintOverview(m, cached, chunkRect(m, k, OVERVIEW_GROW));
      repainted++;
    }
    const fresh = new Uint8ClampedArray(m.n * 4);
    paintOverview(m, fresh, all);
    expect(Buffer.from(cached).equals(Buffer.from(fresh))).toBe(true);
    expect(repainted).toBeLessThan(sim.chunkDirty.length); // it really was partial
  });
});

describe('overlay pixels (4 px per tile, with borders)', () => {
  it('repainting only dirty zones equals a full rebuild after ownership changes at chunk edges', () => {
    const sim = makeSim('px-ol', 64);
    const m = sim.w.map;
    const all = { ...full, x1: m.w, y1: m.h };
    const color = (i: number) => (m.owner[i] ? ([m.owner[i] * 40 % 255, 90, 120, 85] as const) : null);
    m.owner.fill(0);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < 30; x++) m.owner[m.idx(x, y)] = 1;
    const size = m.n * OVERLAY_SCALE * OVERLAY_SCALE * 4;
    const cached = new Uint8ClampedArray(size);
    paintOverlay(m, cached, all, color, true);
    sim.overlayDirty.fill(0);
    // a nation takes tiles right on chunk boundaries (x = 15/16, 31/32, y = 15/16), so borders move in the next chunk too
    for (const [x, y] of [[15, 3], [16, 3], [31, 20], [32, 20], [10, 15], [10, 16], [47, 47]]) {
      const i = m.idx(x, y);
      m.owner[i] = 2;
      markOverlay(sim, i);
    }
    for (let k = 0; k < sim.overlayDirty.length; k++) if (sim.overlayDirty[k]) paintOverlay(m, cached, chunkRect(m, k, OVERLAY_GROW), color, true);
    const fresh = new Uint8ClampedArray(size);
    paintOverlay(m, fresh, all, color, true);
    expect(Buffer.from(cached).equals(Buffer.from(fresh))).toBe(true);
  });

  it('without the one-tile margin the border next door would go stale (the margin is needed)', () => {
    const sim = makeSim('px-ol2', 64);
    const m = sim.w.map;
    const all = { ...full, x1: m.w, y1: m.h };
    const color = (i: number) => (m.owner[i] ? ([200, 90, 120, 85] as const) : null);
    m.owner.fill(1);
    const size = m.n * OVERLAY_SCALE * OVERLAY_SCALE * 4;
    const cached = new Uint8ClampedArray(size);
    paintOverlay(m, cached, all, color, true);
    sim.overlayDirty.fill(0);
    const i = m.idx(16, 5); // first column of chunk 1: its west neighbour (15,5) sits in chunk 0
    m.owner[i] = 2;
    markOverlay(sim, i);
    for (let k = 0; k < sim.overlayDirty.length; k++) if (sim.overlayDirty[k]) paintOverlay(m, cached, chunkRect(m, k, { left: 0, top: 0, right: 0, bottom: 0 }), color, true);
    const fresh = new Uint8ClampedArray(size);
    paintOverlay(m, fresh, all, color, true);
    expect(Buffer.from(cached).equals(Buffer.from(fresh))).toBe(false);
  });
});

describe('rolling zone sweep', () => {
  it('returns dirty zones at once and visits every zone within ceil(n / sweep) passes', () => {
    const z = new ChunkSweep(10);
    expect(z.take().length).toBe(10); // starts all dirty
    expect(z.take()).toEqual([]);
    z.mark(7);
    expect(z.take()).toEqual([7]);
    const seen = new Set<number>();
    for (let p = 0; p < 4; p++) for (const k of z.take(3)) seen.add(k);
    expect(seen.size).toBe(10);
  });
});
