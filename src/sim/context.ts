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
}

export function markTile(sim: Sim, i: number): void {
  const x = i % sim.w.map.w;
  const y = (i / sim.w.map.w) | 0;
  const c = ((y / CHUNK) | 0) * sim.chunksX + ((x / CHUNK) | 0);
  sim.chunkDirty[c] = 1;
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

export function addFx(sim: Sim, kind: string, x: number, y: number, dur = 1, data?: number): void {
  if (sim.fx.length > 400) return;
  sim.fx.push({ kind, x, y, t: dur, dur, data });
}
