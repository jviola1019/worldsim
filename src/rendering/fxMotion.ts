/**
 * Round 10 second addendum (Task 7): how effects move, kept apart from the renderer so it can be tested.
 *
 * Most effects play their frames once over their life (a blast, a wave). Weather and sickness loop while they
 * last (rain falls, a hurricane turns, a pall drifts). Under Reduce motion every effect shows one still frame:
 * the new ones pick the frame that reads best (the full ash column, the rain without the lightning flash).
 * Presentation only: nothing here touches the world or its random numbers.
 */
import type { Settlement } from '../sim/types';
import { infectedShare } from '../population/disease';

/** Effects that loop while they last, with their frame rate. */
export const LOOP_FPS: Record<string, number> = {
  'fx.fire': 8, 'fx.clash': 8,
  'fx.squall': 6, 'fx.hurricane': 5, 'fx.blizzard': 6, 'fx.heat': 4, 'fx.pall': 3, 'fx.aurora': 3,
};

/** The still frame shown under Reduce motion (effects not listed show their middle frame). */
export const STILL_FRAME: Record<string, number> = {
  'fx.squall': 1, // rain falling, no lightning (a flash is not a still)
  'fx.hurricane': 0,
  'fx.eruption': 2, // the full ash column with lava at the vent
  'fx.pall': 0,
  'fx.aurora': 0,
  'fx.airburst': 1, // the fireball inside its shock ring
  'fx.sick': 0,
  'fx.heat': 0,
  'fx.blizzard': 0,
};

/**
 * Reduce motion turns a sequence (meteor, then blast, then smoke) into one still. The still is the first step
 * that names its own still frame (the eruption's ash column, the airburst's fireball), else the last step.
 */
export function stillKind(spec: { kind: string; then?: { kind: string; then?: unknown } }): string {
  let s: { kind: string; then?: unknown } | undefined = spec;
  let last = spec.kind;
  while (s) {
    if (s.kind in STILL_FRAME) return s.kind;
    last = s.kind;
    s = s.then as { kind: string; then?: unknown } | undefined;
  }
  return last;
}

/** The frame of an effect `progress` (0-1) through its life at renderer time `time` (seconds). */
export function fxFrame(kind: string, frames: number, progress: number, time: number, reduce: boolean): number {
  if (frames <= 1) return 0;
  if (reduce) return Math.min(frames - 1, STILL_FRAME[kind] ?? Math.floor((frames - 1) / 2));
  const fps = LOOP_FPS[kind];
  if (fps) return Math.floor(time * fps);
  return Math.min(frames - 1, Math.floor(progress * frames));
}

/** A town is marked sick while more than this share of its people are infected. */
export const SICK_SHARE = 0.01;

/** The sick-town marker: shown while more than 1% are infected; a slow pulse (one every 2 s), still under Reduce motion. */
export function sickMarker(s: Settlement, time: number, reduce: boolean): { alpha: number } | null {
  if (infectedShare(s) <= SICK_SHARE) return null;
  if (reduce) return { alpha: 0.9 };
  return { alpha: 0.75 + 0.2 * Math.sin(time * Math.PI) };
}

/**
 * Whether a sickness pall at (x, y) shows the sickbed symbol itself. Not where a town within 2 tiles already carries
 * the sick-town marker (one symbol per sick town, not two). An epidemic is logged as it ends, so its town has often
 * recovered: then the pall shows the symbol.
 */
export function pallShowsSymbol(settlements: Iterable<Settlement>, x: number, y: number): boolean {
  for (const s of settlements) if ((s.x - x) ** 2 + (s.y - y) ** 2 <= 4 && infectedShare(s) > SICK_SHARE) return false;
  return true;
}

/** The aurora band's opacity: fades in over the first 15% of its life and out over the last 25%; fixed (at full) under Reduce motion. */
export function auroraAlpha(progress: number, reduce: boolean): number {
  if (reduce) return 0.9;
  const p = Math.max(0, Math.min(1, progress));
  return 0.9 * Math.min(1, p / 0.15, (1 - p) / 0.25);
}
