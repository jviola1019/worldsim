/**
 * Round 7: WorldBox-style pixel caching. The far-zoom overview and the map overlays are kept as
 * pixel buffers and only the chunks ("zones") that changed are rewritten. Before this, any change
 * anywhere rebuilt every pixel of the world.
 *
 * Everything here is pure (plain arrays in, pixels out), so tests can check that an incremental
 * update is byte-for-byte equal to a full rebuild without a DOM.
 */
import type { TileMap } from '../world/tilemap';
import { CHUNK } from '../sim/context';
import { TERRAIN, T, isWaterTerrain } from '../world/terrain';
import { B } from '../civilizations/buildingTypes';
import { hexToRgb } from './art/palette';

export interface Rect { x0: number; y0: number; x1: number; y1: number }

let terrainRgb: [number, number, number][] | null = null;

/** Write the overview colours (1 px per tile) of the tiles in `r` into RGBA `d` (map-sized). */
export function paintOverview(m: TileMap, d: Uint8ClampedArray, r: Rect): void {
  const colors = (terrainRgb ??= TERRAIN.map((t) => hexToRgb(t.color)));
  for (let y = r.y0; y < r.y1; y++)
    for (let x = r.x0; x < r.x1; x++) {
      const i = y * m.w + x;
      let [cr, cg, cb] = colors[m.terrain[i]];
      if (!isWaterTerrain(m.terrain[i])) {
        // relief shade reads the tiles above and to the left, so a change also repaints its right and lower neighbours
        const up = i >= m.w ? m.elev[i - m.w] : m.elev[i];
        const left = x > 0 ? m.elev[i - 1] : m.elev[i];
        const shade = 1 + (m.elev[i] - (up + left) / 2) * 5;
        cr *= shade;
        cg *= shade;
        cb *= shade;
        if (m.veg[i] > 150 && m.terrain[i] !== T.MOUNTAIN) {
          cr *= 0.85;
          cg *= 0.92;
          cb *= 0.85;
        }
        if (m.river[i] > 0) [cr, cg, cb] = [70, 140, 210];
        if (m.bld[i]) [cr, cg, cb] = m.bld[i] === B.FARM ? [196, 178, 92] : [150, 120, 100];
        if (m.fire[i]) [cr, cg, cb] = [240, 120, 40];
      }
      const p = i * 4;
      d[p] = cr;
      d[p + 1] = cg;
      d[p + 2] = cb;
      d[p + 3] = 255;
    }
}

export const OVERLAY_SCALE = 4;
export type OverlayColor = (i: number) => readonly [number, number, number, number] | null;

/**
 * Write the overlay pixels (OVERLAY_SCALE px per tile) of the tiles in `r` into RGBA `d`
 * (map size × scale). With `border`, tile edges that face another owner are drawn opaque.
 */
export function paintOverlay(m: TileMap, d: Uint8ClampedArray, r: Rect, color: OverlayColor, border: boolean): void {
  const S = OVERLAY_SCALE;
  const W = m.w * S;
  for (let y = r.y0; y < r.y1; y++)
    for (let x = r.x0; x < r.x1; x++) {
      const i = y * m.w + x;
      const c = color(i);
      const o = m.owner[i];
      for (let sy = 0; sy < S; sy++) {
        let p = ((y * S + sy) * W + x * S) * 4;
        for (let sx = 0; sx < S; sx++, p += 4) {
          if (!c) {
            d[p] = d[p + 1] = d[p + 2] = d[p + 3] = 0;
            continue;
          }
          let a = c[3];
          if (border && o) {
            const edgeX = sx === 0 ? x - 1 : sx === S - 1 ? x + 1 : -1;
            const edgeY = sy === 0 ? y - 1 : sy === S - 1 ? y + 1 : -1;
            if ((edgeX >= 0 && edgeX < m.w && m.owner[y * m.w + edgeX] !== o) || (edgeY >= 0 && edgeY < m.h && m.owner[edgeY * m.w + x] !== o) || edgeX === m.w || edgeY === m.h) a = 235;
          }
          d[p] = c[0];
          d[p + 1] = c[1];
          d[p + 2] = c[2];
          d[p + 3] = a;
        }
      }
    }
}

/** The tiles of chunk k grown by `grow` tiles on the sides given (clamped to the map). */
export function chunkRect(m: TileMap, k: number, grow: { left: number; top: number; right: number; bottom: number }): Rect {
  const cx = Math.ceil(m.w / CHUNK);
  const x = (k % cx) * CHUNK, y = Math.floor(k / cx) * CHUNK;
  return {
    x0: Math.max(0, x - grow.left), y0: Math.max(0, y - grow.top),
    x1: Math.min(m.w, x + CHUNK + grow.right), y1: Math.min(m.h, y + CHUNK + grow.bottom),
  };
}

/** Overview: a tile's shade depends on its upper and left neighbours, so repaint one extra tile right and down. */
export const OVERVIEW_GROW = { left: 0, top: 0, right: 1, bottom: 1 };
/** Overlay borders depend on all four neighbours, so repaint one extra tile on every side. */
export const OVERLAY_GROW = { left: 1, top: 1, right: 1, bottom: 1 };

/**
 * Per-chunk dirty set with a rolling sweep (WorldBox refreshes its zones a few at a time).
 * `take(sweep)` returns every dirty chunk plus the next `sweep` chunks in rotation, and clears them.
 */
export class ChunkSweep {
  readonly dirty: Uint8Array;
  private cursor = 0;
  constructor(readonly count: number) {
    this.dirty = new Uint8Array(count).fill(1);
  }
  mark(k: number): void {
    this.dirty[k] = 1;
  }
  markAll(): void {
    this.dirty.fill(1);
  }
  any(): boolean {
    for (let k = 0; k < this.count; k++) if (this.dirty[k]) return true;
    return false;
  }
  take(sweep = 0): number[] {
    const out: number[] = [];
    for (let n = 0; n < Math.min(sweep, this.count); n++) {
      this.dirty[this.cursor] = 1;
      this.cursor = (this.cursor + 1) % this.count;
    }
    for (let k = 0; k < this.count; k++) if (this.dirty[k]) {
      out.push(k);
      this.dirty[k] = 0;
    }
    return out;
  }
}
