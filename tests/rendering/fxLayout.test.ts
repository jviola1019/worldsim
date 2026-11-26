/**
 * Round 10 second addendum, fix round 1 (owner: full size, depth, spacing). An effect's body fills the area it
 * affects with crisp whole-number scaling or tiled copies; things in the air cast a soft down-right ground shadow;
 * tall effects fade the name labels they cover; symbols keep clear of labels; duplicates spread apart.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { EFFECT_SPRITES } from '../../src/rendering/art/effects';
import { fxLayout, fxShadow, labelFade, sickMarkerY, spreadOffset, AIR_FX, coverage } from '../../src/rendering/fxLayout';

const TILE = 8;
const dims = (id: string) => [EFFECT_SPRITES[id].w, EFFECT_SPRITES[id].h] as const;
const AREA = ['fx.hurricane', 'fx.squall', 'fx.eruption', 'fx.flood', 'fx.heat', 'fx.blizzard', 'fx.quake', 'fx.wave', 'fx.pall'];

describe('full size: the body fills the ring', () => {
  it('every area effect covers most of its ring (width at least 60% of the diameter) at radius 5', () => {
    for (const id of AREA) {
      const [w, h] = dims(id);
      const c = coverage(fxLayout(id, 5, w, h), w);
      expect(c / (2 * 5 * TILE), id).toBeGreaterThanOrEqual(0.6);
    }
  });

  it('the drawn size grows with the radius (larger scale or more copies)', () => {
    for (const id of AREA) {
      const [w, h] = dims(id);
      const small = coverage(fxLayout(id, 2, w, h), w);
      const big = coverage(fxLayout(id, 8, w, h), w);
      expect(big, id).toBeGreaterThan(small);
    }
  });

  it('scaling stays crisp: every scale is a whole number, and copies stay inside the ring', () => {
    for (const id of AREA)
      for (const r of [2, 3, 5, 6, 8, 10]) {
        const [w, h] = dims(id);
        for (const p of fxLayout(id, r, w, h)) {
          expect(Number.isInteger(p.scale) && p.scale >= 1, `${id} r${r}`).toBe(true);
          expect(Math.hypot(p.dx, p.dy), `${id} r${r}`).toBeLessThanOrEqual(r * TILE);
        }
      }
  });

  it('a hurricane is one large spiral; an eruption plume is taller than a town (3+ tiles) and taller for bigger eruptions', () => {
    const [hw, hh] = dims('fx.hurricane');
    expect(fxLayout('fx.hurricane', 5, hw, hh)).toHaveLength(1);
    const [ew, eh] = dims('fx.eruption');
    const plume = (r: number) => fxLayout('fx.eruption', r, ew, eh)[0].scale * eh;
    expect(plume(3)).toBeGreaterThanOrEqual(3 * TILE);
    expect(plume(8)).toBeGreaterThan(plume(3));
  });

  it('tiled copies are not a wallpaper: positions are jittered and ground copies mirrored, deterministically', () => {
    const [w, h] = dims('fx.flood');
    const a = fxLayout('fx.flood', 5, w, h);
    expect(a).toEqual(fxLayout('fx.flood', 5, w, h)); // no randomness: the same every frame
    const rows = new Map<number, number[]>();
    for (const p of a) rows.set(p.dy, [...(rows.get(p.dy) ?? []), p.dx]);
    expect(rows.size).toBeGreaterThan(3); // rows are broken up, not a few straight lines
    expect(a.some((p) => p.flip) && a.some((p) => !p.flip)).toBe(true);
    // wind-driven weather keeps one wind direction
    const [sw, sh] = dims('fx.squall');
    expect(fxLayout('fx.squall', 6, sw, sh).every((p) => !p.flip)).toBe(true);
  });

  it('a tsunami is one curved wave front across its ring, not scattered crests', () => {
    const [w, h] = dims('fx.wave');
    const l = fxLayout('fx.wave', 6, w, h);
    expect(l.length).toBeGreaterThan(2);
    const ys = l.map((p) => p.dy);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(h * 1.5); // one band, gently curved
  });

  it('effects without an area keep their one sprite at scale 1 (blasts, sparkles, the hand)', () => {
    expect(fxLayout('fx.explosion', 0, 12, 12)).toEqual([{ dx: 0, dy: 0, scale: 1, frame: 0 }]);
    expect(fxLayout('fx.sparkle', 0, 5, 5)).toEqual([{ dx: 0, dy: 0, scale: 1, frame: 0 }]);
  });
});

describe('depth: things in the air cast a ground shadow', () => {
  it('cloud-type effects get a soft shadow offset down-right (light from the top-left); ground effects get none', () => {
    for (const id of ['fx.squall', 'fx.hurricane', 'fx.eruption', 'fx.smoke', 'fx.smoke_dark', 'fx.airburst', 'fx.blizzard']) {
      expect(AIR_FX.has(id), id).toBe(true);
      const s = fxShadow(id, 2, ...dims(id))!;
      expect(s, id).not.toBeNull();
      expect(s.dx, id).toBeGreaterThan(0);
      expect(s.dy, id).toBeGreaterThanOrEqual(0);
      expect(s.alpha, id).toBeGreaterThan(0);
      expect(s.alpha, id).toBeLessThanOrEqual(0.3);
    }
    for (const id of ['fx.quake', 'fx.flood', 'fx.heat', 'fx.pall', 'fx.wave']) expect(fxShadow(id, 1, ...dims(id)), id).toBeNull();
  });

  it('the shadow scales with the sprite', () => {
    const a = fxShadow('fx.hurricane', 1, ...dims('fx.hurricane'))!;
    const b = fxShadow('fx.hurricane', 3, ...dims('fx.hurricane'))!;
    expect(b.rx).toBeGreaterThan(a.rx);
  });

  it('the airburst fireball sits in the sky, above its ground ring', () => {
    const f = EFFECT_SPRITES['fx.airburst'].frames[1];
    const rowsWith = (keys: string) => f.map((r, y) => ([...r].some((c) => keys.includes(c)) ? y : -1)).filter((y) => y >= 0);
    const fire = rowsWith('fFO'); // the fireball
    const ring = rowsWith('6'); // the shock ring on the ground
    expect(Math.max(...fire)).toBeLessThan(Math.min(...ring.filter((y) => y > Math.max(...fire) - 1)));
    expect(Math.max(...ring)).toBeGreaterThan(Math.max(...fire) + 6);
  });

  it('the renderer draws the shadows before the sprites and fades labels under tall effects', () => {
    const r = readFileSync('src/rendering/renderer.ts', 'utf8');
    expect(r).toContain('fxShadow(');
    expect(r).toContain('fxLayout(');
    expect(r).toContain('labelFade(');
  });
});

describe('spacing', () => {
  it('a label covered by a tall effect fades; one clear of it does not', () => {
    const covers = [{ x0: 100, y0: 50, x1: 160, y1: 140 }];
    expect(labelFade({ x0: 110, y0: 60, x1: 200, y1: 75 }, covers)).toBeLessThan(0.5);
    expect(labelFade({ x0: 300, y0: 60, x1: 380, y1: 75 }, covers)).toBe(1);
  });

  it('the sick-town marker sits below the name label at every zoom', () => {
    for (const zoom of [0.3, 0.5, 1, 2, 4, 8]) {
      const k = Math.max(1, 11 / (7 * zoom));
      const ty = 20;
      const bottom = sickMarkerY(ty, k, zoom);
      const top = bottom - 7 * k; // the sickbed is 8 px tall, anchored on its bottom row
      const labelBottom = ty * TILE - 10; // drawLabels: the label's bottom edge
      expect(top, `zoom ${zoom}`).toBeGreaterThanOrEqual(labelBottom);
    }
  });

  it('duplicates of one effect in one place spread apart instead of stacking into a blob', () => {
    expect(spreadOffset(0)).toEqual([0, 0]);
    const a = spreadOffset(1), b = spreadOffset(2);
    expect(Math.hypot(...a)).toBeGreaterThanOrEqual(5);
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThanOrEqual(5);
  });
});
