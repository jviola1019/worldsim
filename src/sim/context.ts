/**
 * Sim: the runtime context passed to every system function. It wraps the
 * serializable WorldState with a live RNG and non-serialized caches/hooks.
 * Caches can always be rebuilt from WorldState (rebuildCaches), so saving and
 * loading never changes future results.
 */
import type { Rng } from '../core/rng';
import type { HistoryEvent, WorldState } from './types';

export const CHUNK = 16; // tiles per render chunk side

export interface Sim {
  w: WorldState;
  rng: Rng;
  /** Current calendar year (cached, updated each tick). */
  year: number;
  /** Render invalidation flags per chunk (1 = needs redraw). */
  chunkDirty: Uint8Array;
  chunksX: number;
  chunksY: number;
  /** Ownership/overlay invalidation per chunk. */
  overlayDirty: Uint8Array;
  /** Settlement center tile -> settlement id. */
  centers: Map<number, number>;
  /** Event listeners (UI toasts, newspaper). */
  listeners: ((e: HistoryEvent) => void)[];
  /** Short-lived visual effects requested by systems (renderer consumes). */
  fx: VisualFx[];
  /** Settlements whose territory must be recomputed. */
  territoryDirty: Set<number>;
  /** Monotonic counter bumped whenever map hydrology/terrain changes globally. */
  terrainVersion: number;
  /** Module-private derived caches (rebuildable from WorldState; never serialized). */
  cache: Record<string, any>;
}

export interface VisualFx {
  kind: string;
  x: number;
  y: number;
  t: number; // remaining seconds
  dur: number;
  data?: number;
  /** Radius in tiles of the area ring drawn around the effect (0 or absent: none). */
  ring?: number;
  /** Played at the same place when this one ends (meteor, then explosion, then smoke). */
  then?: FxSpec;
  /** A brief screen tint (never under Reduce motion). */
  flash?: FxFlash;
  /** Round 10 addendum: the sprite an effect carries (the placing hand drops it). */
  sprite?: string;
}

/** Screen tints: 'sick' is the pale green-grey of the sickness pall (a world pandemic). */
export type FxFlash = 'white' | 'red' | 'green' | 'sick';

/** What a concept shows on the map (see sim/conceptFx.ts). */
export interface FxSpec {
  kind: string;
  dur: number;
  /** Draw an area ring sized to the power or event radius. */
  area?: boolean;
  then?: FxSpec;
  /** Events only: skip below this importance (default 2). */
  minImportance?: number;
  flash?: FxFlash;
  /** Round 10 second addendum: drawn across the whole view, not at a place (the aurora). Placeless events play it too. */
  world?: boolean;
  /** Fixed ring radius in tiles (events carry no radius). */
  radius?: number;
  /** At most this many of the same effect alive within 2 tiles (default 3). */
  cap?: number;
  /** Round 10 addendum: a sprite the effect carries (the placing hand drops the placed people or animals). */
  sprite?: string;
}

/**
 * A drawn field of tile i changed. Its chunk is redrawn, and so is the chunk next door when i sits on a
 * chunk edge: neighbours read this tile too (road joins, shorelines, relief shading).
 */
export function markTile(sim: Sim, i: number): void {
  const x = i % sim.w.map.w;
  const y = (i / sim.w.map.w) | 0;
  const cx = (x / CHUNK) | 0, cy = (y / CHUNK) | 0;
  const lx = x - cx * CHUNK, ly = y - cy * CHUNK;
  sim.chunkDirty[cy * sim.chunksX + cx] = 1;
  if (lx !== 0 && lx !== CHUNK - 1 && ly !== 0 && ly !== CHUNK - 1) return;
  const x0 = lx === 0 && cx > 0 ? cx - 1 : cx, x1 = lx === CHUNK - 1 && cx < sim.chunksX - 1 ? cx + 1 : cx;
  const y0 = ly === 0 && cy > 0 ? cy - 1 : cy, y1 = ly === CHUNK - 1 && cy < sim.chunksY - 1 ? cy + 1 : cy;
  for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) sim.chunkDirty[yy * sim.chunksX + xx] = 1;
}

/** How the maps draw vegetation: none, flowers (> 40), a tree (> 70), dense on the overview (> 150), two trees (> 200). */
export const vegLook = (v: number): number => (v > 200 ? 4 : v > 150 ? 3 : v > 70 ? 2 : v > 40 ? 1 : 0);
/** How the map draws pollution: smog from 40, in steps of 0.05 opacity up to 0.45. */
export const pollutionLook = (p: number): number => (p > 40 ? Math.min(9, Math.ceil((p / 400) * 20)) : 0);

/** Set a tile's vegetation; the map is redrawn there only when its drawn look changes. */
export function setVeg(sim: Sim, i: number, v: number): void {
  const m = sim.w.map;
  const old = m.veg[i];
  m.veg[i] = v;
  if (vegLook(old) !== vegLook(m.veg[i])) markTile(sim, i);
}

/** Set a tile's pollution; the map is redrawn there only when its drawn smog changes. */
export function setPollution(sim: Sim, i: number, p: number): void {
  const m = sim.w.map;
  const old = m.pollution[i];
  m.pollution[i] = p;
  if (pollutionLook(old) !== pollutionLook(m.pollution[i])) markTile(sim, i);
}

export function markOverlay(sim: Sim, i: number): void {
  const x = i % sim.w.map.w;
  const y = (i / sim.w.map.w) | 0;
  sim.overlayDirty[((y / CHUNK) | 0) * sim.chunksX + ((x / CHUNK) | 0)] = 1;
}

export function markAllDirty(sim: Sim): void {
  sim.chunkDirty.fill(1);
  sim.overlayDirty.fill(1);
}

/** Low-level effect push. Systems call emitFx (sim/conceptFx.ts) instead, so the registry stays the one source. */
export function addFx(sim: Sim, kind: string, x: number, y: number, dur = 1, data?: number, extra?: Pick<VisualFx, 'ring' | 'then' | 'flash' | 'sprite'>): void {
  if (sim.fx.length > 400) return;
  sim.fx.push({ kind, x, y, t: dur, dur, data, ...extra });
}
