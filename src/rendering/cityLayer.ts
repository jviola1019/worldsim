/**
 * Close-up city layer (round 6). At close zoom each city district tile is redrawn as a 32×32 block
 * (streets, plots, yards, amenities, trees: see cityBlocks.ts) into cached 8×8-tile detail chunks,
 * drawn over the map at world size. Same pattern as TerrainLayer: chunks are invalidated by the
 * simulation's dirty flags (mapped from 16-tile map chunks), redrawn a few per frame nearest first,
 * and evicted least-recently-used. A chunk that is not ready is simply skipped, so the normal map
 * shows through (never a blank). Block looks only change when something real changes: a yearly
 * signature check catches settlement size bands and ethos changes that set no dirty flag.
 */
import type { Sim } from '../sim/context';
import { CHUNK } from '../sim/context';
import { TILE } from './camera';
import type { Atlas } from './atlas';
import { BLDF } from '../world/tilemap';
import { BUILDINGS } from '../civilizations/buildings';
import { blockContext, composeBlock, blockSignature, isDetailTile, streetColor, STREET_COLORS, BLOCK, type BlockPlan, type Feature } from './cityBlocks';
import { hash3 } from '../core/rng';

/** Detail pixels per map art pixel. */
export const DETAIL = 4;
/** Tiles per detail chunk side. */
export const DCHUNK = 8;
/** Overhang padding above each detail chunk, in detail px (tall towers). */
export const DPAD = 32;

export function detailAlpha(tilePx: number): number {
  if (tilePx <= 20) return 0;
  if (tilePx >= 26) return 1;
  return (tilePx - 20) / 6;
}

/** The detail chunks inside map chunk k (2×2, fewer on a ragged right or bottom edge). */
export function detailChunksOf(k: number, mapW: number, mapH = Infinity): number[] {
  const cxMap = Math.ceil(mapW / CHUNK);
  const cxD = Math.ceil(mapW / DCHUNK);
  const cyD = Math.ceil(mapH / DCHUNK);
  const mx = k % cxMap, my = Math.floor(k / cxMap);
  const out: number[] = [];
  const per = CHUNK / DCHUNK;
  for (let dy = 0; dy < per; dy++)
    for (let dx = 0; dx < per; dx++) {
      const x = mx * per + dx, y = my * per + dy;
      if (x < cxD && y < cyD) out.push(y * cxD + x);
    }
  return out;
}

/** Least-recently-used cache with a hard cap. */
export class DetailCache<V> {
  private m = new Map<number, V>();
  evicted: number[] = [];
  constructor(private max: number) {}
  has(k: number): boolean {
    return this.m.has(k);
  }
  get(k: number): V | undefined {
    return this.m.get(k);
  }
  want(k: number): void {
    const v = this.m.get(k);
    if (v === undefined) return;
    this.m.delete(k);
    this.m.set(k, v);
  }
  put(k: number, v: V): void {
    this.m.delete(k);
    this.m.set(k, v);
    while (this.m.size > this.max) {
      const oldest = this.m.keys().next().value as number;
      this.m.delete(oldest);
      this.evicted.push(oldest);
    }
  }
  /** Take a value for reuse from the evicted pool (canvas recycling). */
  size(): number {
    return this.m.size;
  }
}

const YARD: Record<string, string> = { grass: '#7aa456', dirt: '#957f58', paved: '#9b9892', garden: '#88a05c' };

export class CityLayer {
  private cache = new DetailCache<HTMLCanvasElement>(48);
  private spare: HTMLCanvasElement[] = [];
  dirty: Uint8Array;
  private sig: Uint32Array;
  readonly cx: number;
  readonly cy: number;

  constructor(private sim: Sim, private atlas: Atlas, private spriteIdFor: (i: number) => string | undefined) {
    const m = sim.w.map;
    this.cx = Math.ceil(m.w / DCHUNK);
    this.cy = Math.ceil(m.h / DCHUNK);
    this.dirty = new Uint8Array(this.cx * this.cy).fill(1);
    this.sig = new Uint32Array(m.n);
  }

  /** A map chunk changed: its detail chunks need redrawing. */
  markMapChunk(k: number): void {
    const m = this.sim.w.map;
    for (const d of detailChunksOf(k, m.w, m.h)) this.dirty[d] = 1;
  }

  invalidateAll(): void {
    this.dirty.fill(1);
  }

  /** Once a simulated year: redraw cached chunks whose block signatures changed (size band, ethos). */
  yearlyCheck(): void {
    const m = this.sim.w.map;
    for (let k = 0; k < this.dirty.length; k++) {
      if (!this.cache.has(k) || this.dirty[k]) continue;
      const x0 = (k % this.cx) * DCHUNK, y0 = Math.floor(k / this.cx) * DCHUNK;
      outer: for (let y = y0; y < Math.min(m.h, y0 + DCHUNK); y++)
        for (let x = x0; x < Math.min(m.w, x0 + DCHUNK); x++) {
          const i = y * m.w + x;
          const c = blockContext(this.sim, i);
          const s = c ? blockSignature(c) || 1 : 0;
          if (s !== this.sig[i]) {
            this.dirty[k] = 1;
            break outer;
          }
        }
    }
  }

  refresh(wanted: number[], budget: number): void {
    let n = 0;
    for (const k of wanted) {
      if (n >= budget) break;
      if (this.dirty[k] || !this.cache.has(k)) {
        this.drawChunk(k);
        this.dirty[k] = 0;
        n++;
      }
    }
  }

  get(k: number): HTMLCanvasElement | null {
    const c = this.cache.get(k);
    if (c) this.cache.want(k);
    return c ?? null;
  }

  /** True when any tile of detail chunk k is a city block (empty chunks are skipped cheaply). */
  private alloc(k: number): HTMLCanvasElement {
    let c = this.cache.get(k);
    if (c) return c;
    c = this.spare.pop() ?? document.createElement('canvas');
    c.width = DCHUNK * TILE * DETAIL;
    c.height = DCHUNK * TILE * DETAIL + DPAD;
    this.cache.put(k, c);
    for (const e of this.cache.evicted.splice(0)) {
      this.dirty[e] = 1;
      // the evicted canvas object is gone from the map; recycle a fresh one later
    }
    return c;
  }

  private drawChunk(k: number): void {
    const m = this.sim.w.map;
    const c = this.alloc(k);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    const x0 = (k % this.cx) * DCHUNK, y0 = Math.floor(k / this.cx) * DCHUNK;
    const x1 = Math.min(m.w, x0 + DCHUNK), y1 = Math.min(m.h, y0 + DCHUNK);
    // grounds and blocks in row order (lower rows overlap upper ones), then 2×2 landmarks
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * m.w + x;
        const ox = (x - x0) * BLOCK, oy = (y - y0) * BLOCK + DPAD;
        if (m.bldFlags[i] & BLDF.PART && m.settle[i]) {
          this.sig[i] = 0;
          const a = this.anchorOf(x, y);
          if (a >= 0 && isDetailTile(m, a)) this.plaza(ctx, ox, oy);
          continue;
        }
        const cx = blockContext(this.sim, i);
        this.sig[i] = cx ? blockSignature(cx) || 1 : 0;
        if (!cx) continue;
        if (BUILDINGS[cx.b].footprint === 2) {
          this.plaza(ctx, ox, oy);
          continue;
        }
        this.drawPlan(ctx, composeBlock(cx), ox, oy, cx.color, cx.tier, x, y, this.spriteIdFor(i));
      }
    // 2×2 landmarks (arcologies, arenas), including ones anchored just outside this chunk
    for (let y = y0 - 1; y < y1; y++)
      for (let x = x0 - 1; x < x1; x++) {
        if (!m.inBounds(x, y)) continue;
        this.drawLandmark(ctx, y * m.w + x, (x - x0) * BLOCK, (y - y0) * BLOCK + DPAD);
      }
  }

  /** Draw a 2×2 landmark anchored on tile i whose block origin is (ox, oy); no-op for other tiles. */
  drawLandmark(ctx: CanvasRenderingContext2D, i: number, ox: number, oy: number): boolean {
    const m = this.sim.w.map;
    if (m.bldFlags[i] & BLDF.PART || !isDetailTile(m, i) || BUILDINGS[m.bld[i]].footprint !== 2) return false;
    const id = this.spriteIdFor(i);
    const spr = id ? this.atlas.get(id, this.ownerColor(i), true) : undefined;
    if (!spr) return false;
    // anchor at the bottom-centre of the 2×2 footprint, scaled ×DETAIL
    const bx = ox + BLOCK, by = oy + 2 * BLOCK;
    ctx.drawImage(spr.canvas, 0, 0, spr.w, spr.h, bx - spr.ax * DETAIL, by - (spr.ay + 1) * DETAIL, spr.w * DETAIL, spr.h * DETAIL);
    return true;
  }

  /** Draw tile i as a close-up block at (ox, oy) (plazas for 2×2 parts); returns true when a block was drawn. */
  drawTileBlock(ctx: CanvasRenderingContext2D, i: number, ox: number, oy: number): boolean {
    const m = this.sim.w.map;
    const x = m.xOf(i), y = m.yOf(i);
    if (m.bldFlags[i] & BLDF.PART && m.settle[i]) {
      const a = this.anchorOf(x, y);
      if (a >= 0 && isDetailTile(m, a)) { this.plaza(ctx, ox, oy); return true; }
      return false;
    }
    const cx = blockContext(this.sim, i);
    if (!cx) return false;
    if (BUILDINGS[cx.b].footprint === 2) { this.plaza(ctx, ox, oy); return true; }
    this.drawPlan(ctx, composeBlock(cx), ox, oy, cx.color, cx.tier, x, y, this.spriteIdFor(i));
    return true;
  }

  private anchorOf(x: number, y: number): number {
    const m = this.sim.w.map;
    for (const [dx, dy] of [[-1, 0], [0, -1], [-1, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (!m.inBounds(xx, yy)) continue;
      const j = yy * m.w + xx;
      if (m.bld[j] === m.bld[y * m.w + x] && !(m.bldFlags[j] & BLDF.PART)) return j;
    }
    return -1;
  }

  private drawFeature(ctx: CanvasRenderingContext2D, f: Feature, ox: number, oy: number, x: number, y: number): void {
    const X = ox + f.x, Y = oy + f.y;
    if (f.kind === 'field') {
      ctx.fillStyle = '#5e9a48';
      ctx.fillRect(X, Y, f.w, f.h);
      ctx.fillStyle = '#e8eee0';
      ctx.fillRect(X + 1, Y + 1, f.w - 2, 1);
      ctx.fillRect(X + 1, Y + f.h - 2, f.w - 2, 1);
      ctx.fillRect(X + 1, Y + 1, 1, f.h - 2);
      ctx.fillRect(X + f.w - 2, Y + 1, 1, f.h - 2);
      ctx.fillRect(X + 1, Y + (f.h >> 1), f.w - 2, 1);
    } else if (f.kind === 'parking') {
      ctx.fillStyle = '#77757a';
      ctx.fillRect(X, Y, f.w, f.h);
      ctx.fillStyle = '#d8d6d0';
      for (let j = Y + 1; j < Y + f.h - 1; j += 4) ctx.fillRect(X + 1, j, f.w - 2, 1);
      for (let j = Y + 2, n = 0; j < Y + f.h - 2; j += 4, n++) if (hash3(x * 7 + n, y, 19) % 3) this.atlas.draw(ctx, `lot.car.h.${n % 3}`, X + 3 + (n % 2) * 4, j + 2);
    } else if (f.kind === 'yard') {
      ctx.fillStyle = '#9a9184';
      ctx.fillRect(X, Y, f.w, f.h);
      ctx.fillStyle = '#5b5348';
      for (let n = 0; n < 3; n++) {
        const hh = hash3(x, y * 5 + n, 23);
        ctx.fillRect(X + 1 + (hh % Math.max(1, f.w - 4)), Y + 1 + ((hh >> 8) % Math.max(1, f.h - 3)), 3, 2);
      }
    } else {
      ctx.fillStyle = '#b9ae98';
      ctx.fillRect(X, Y, f.w, f.h);
      ctx.fillStyle = '#978c7c';
      ctx.fillRect(X, Y, f.w, 1);
      ctx.fillRect(X, Y + f.h - 1, f.w, 1);
    }
  }

  private plaza(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    ctx.fillStyle = YARD.paved;
    ctx.fillRect(ox, oy, BLOCK, BLOCK);
  }

  private ownerColor(i: number): string | undefined {
    const o = this.sim.w.map.owner[i];
    return o ? this.sim.w.civs.get(o)?.color : undefined;
  }

  /** Paint one composed block at (ox, oy) in detail pixels. Also used by the aerial photo. */
  drawPlan(ctx: CanvasRenderingContext2D, plan: BlockPlan, ox: number, oy: number, color: string | undefined, tier: number, x: number, y: number, mapSpriteId?: string): void {
    ctx.fillStyle = plan.ground;
    ctx.fillRect(ox, oy, BLOCK, BLOCK);
    for (const s of plan.streets) {
      ctx.fillStyle = streetColor(s.surface);
      ctx.fillRect(ox + s.x, oy + s.y, s.w, s.h);
      if (s.sidewalk) {
        ctx.fillStyle = STREET_COLORS[3];
        if (s.w < s.h) { ctx.fillRect(ox + s.x, oy + s.y, 1, s.h); ctx.fillRect(ox + s.x + s.w - 1, oy + s.y, 1, s.h); }
        else { ctx.fillRect(ox + s.x, oy + s.y, s.w, 1); ctx.fillRect(ox + s.x, oy + s.y + s.h - 1, s.w, 1); }
        // centre lane marks
        ctx.fillStyle = STREET_COLORS[4];
        if (s.w < s.h) for (let j = 2; j < s.h; j += 6) ctx.fillRect(ox + s.x + (s.w >> 1), oy + s.y + j, 1, 3);
        else for (let j = 2; j < s.w; j += 6) ctx.fillRect(ox + s.x + j, oy + s.y + (s.h >> 1), 3, 1);
      }
    }
    for (const e of plan.edges) {
      if (e.kind === 'quay') {
        ctx.fillStyle = '#978c7c';
        if (e.side === 0) ctx.fillRect(ox + BLOCK - 2, oy, 2, BLOCK);
        else if (e.side === 1) ctx.fillRect(ox, oy + BLOCK - 2, BLOCK, 2);
        else if (e.side === 2) ctx.fillRect(ox, oy, 2, BLOCK);
        else ctx.fillRect(ox, oy, BLOCK, 2);
        continue;
      }
      const horiz = e.side === 1 || e.side === 3;
      const id = `lot.${e.kind === 'hedge' ? 'hedge' : 'fence'}.${horiz ? 'h' : 'v'}`;
      for (let t = 0; t < BLOCK; t += 8) {
        if (horiz) this.atlas.draw(ctx, id, ox + t + 4, oy + (e.side === 1 ? BLOCK - 1 : 1));
        else this.atlas.draw(ctx, id, ox + (e.side === 0 ? BLOCK - 1 : 0), oy + t + 7);
      }
    }
    for (const l of plan.lots) {
      ctx.fillStyle = YARD[l.yard];
      ctx.fillRect(ox + l.x, oy + l.y, l.w, l.h);
    }
    for (const f of plan.features) this.drawFeature(ctx, f, ox, oy, x, y);
    for (const l of plan.lots) {
      if (l.kind === 'park') {
        this.atlas.draw(ctx, l.sprite, ox + l.x + (l.w >> 1), oy + l.y + l.h - 1);
        continue;
      }
      if (l.mapSprite && mapSpriteId) {
        // the district's own map sprite at double size, standing on its grounds
        const spr = this.atlas.get(mapSpriteId, color, true);
        if (spr) {
          const k = Math.max(1, Math.min(2, Math.floor((l.w + 4) / spr.w)));
          ctx.drawImage(spr.canvas, 0, 0, spr.w, spr.h, ox + l.x + (l.w >> 1) - spr.ax * k, oy + l.y + l.h - (spr.ay + 1) * k, spr.w * k, spr.h * k);
          continue;
        }
      }
      this.atlas.draw(ctx, l.sprite, ox + l.x + (l.w >> 1), oy + l.y + l.h - 1, 0, color, false, true);
      // a pool in some modern back yards, a parked car by modern homes
      const h = hash3(x * 32 + l.x, y * 32 + l.y, 7);
      if (l.kind === 'house' && tier >= 6 && h % 4 === 0 && l.w >= 9) this.atlas.draw(ctx, 'lot.pool.0', ox + l.x + 2, oy + l.y + 3);
      if ((l.kind === 'house' || l.kind === 'apartment') && tier >= 5 && h % 3 === 0) this.atlas.draw(ctx, `lot.car.h.${h % 3}`, ox + l.x + l.w - 3, oy + l.y + l.h - 1);
    }
    for (const t of plan.trees) this.atlas.draw(ctx, `lot.tree.${t.size}`, ox + t.x, oy + t.y + 3 + t.size * 2);
    // street furniture on paved streets
    if (tier >= 5) for (const s of plan.streets) if (s.sidewalk) {
      const horiz = s.w > s.h;
      this.atlas.draw(ctx, 'lot.lamp.0', ox + s.x + (horiz ? 12 : 0), oy + s.y + (horiz ? 0 : 14) + 3);
    }
  }
}
