/**
 * Round 10 second addendum, fix round 1 (owner: "depth, design, full size and spacing"): where and how big an
 * effect is drawn. Kept apart from the renderer so it can be tested. Presentation only.
 *
 * Full size: an area effect's body fills the ground it affects. A single big thing (a hurricane, an eruption
 * plume, an airburst) is drawn at a whole-number scale, so pixels stay crisp; spread-out weather and ground effects
 * (a squall line, floodwater, cracked ground, fissures, snow, a pall over a town) are tiled as copies at their own
 * pixel scale, so they keep the world's pixel density. The ring then only marks the edge.
 * Depth: things in the air cast a soft ground shadow down and to the right (the art is lit from the top-left).
 * Spacing: tall effects fade the name labels they cover; the sick-town marker sits below its label; duplicates of
 * one effect in one place spread apart.
 */
import { TILE } from './camera';

export interface Placement {
  /** Offset from the effect's anchor, in world px. */
  dx: number;
  dy: number;
  /** Whole-number pixel scale. */
  scale: number;
  /** Frame offset, so copies do not move in lockstep. */
  frame: number;
  /** Mirrored (ground copies alternate, so a tiled area does not read as a wallpaper). */
  flip?: boolean;
}

/** One big body at a whole-number scale: `cover` is the share of the ring's diameter it spans; `max` caps the scale. */
const SINGLE: Record<string, { cover: number; max: number }> = {
  'fx.hurricane': { cover: 0.95, max: 6 },
  'fx.airburst': { cover: 0.8, max: 4 },
};
/** Copies tiled over the ring: `gap` scales the spacing between copies (1 = just touching), `cap` limits the count. */
const TILED: Record<string, { gap: number; cap: number }> = {
  'fx.squall': { gap: 1, cap: 14 },
  'fx.blizzard': { gap: 1, cap: 14 },
  'fx.flood': { gap: 0.8, cap: 14 },
  'fx.heat': { gap: 1.5, cap: 7 },
  'fx.quake': { gap: 1.25, cap: 8 },
  'fx.wave': { gap: 0.9, cap: 7 }, // one curved front (see fxLayout)
  'fx.pall': { gap: 0.8, cap: 7 },
  'fx.smoke': { gap: 1.4, cap: 6 },
  'fx.smoke_dark': { gap: 1.4, cap: 6 },
};

/** Wind-driven weather keeps one wind direction: never mirrored. */
const NO_FLIP = new Set(['fx.squall', 'fx.blizzard', 'fx.wave']);

/** Does this effect fill its ring with its own body (so the ring is drawn faint)? */
export const fillsRing = (kind: string): boolean => kind in SINGLE || kind in TILED || kind === 'fx.eruption';

const ONE: Placement[] = [{ dx: 0, dy: 0, scale: 1, frame: 0 }];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Where to draw an effect of `ringTiles` radius whose sprite is w x h: one placement per copy, back to front.
 * No area (radius 0): one sprite at scale 1, as before.
 */
export function fxLayout(kind: string, ringTiles: number, w: number, h: number): Placement[] {
  if (!(ringTiles > 0)) return ONE;
  const D = 2 * ringTiles * TILE;
  if (kind === 'fx.eruption') {
    // a plume taller than the town: scale with the eruption's reach (VEI-7 and supervolcano plumes tower)
    return [{ dx: 0, dy: 0, scale: clamp(Math.round(ringTiles / 2), 2, 4), frame: 0 }];
  }
  const single = SINGLE[kind];
  if (single) return [{ dx: 0, dy: 0, scale: clamp(Math.round((D * single.cover) / w), 1, single.max), frame: 0 }];
  const tiled = TILED[kind];
  if (!tiled) return ONE;
  const s = ringTiles >= 8 ? 2 : 1;
  const bw = w * s, bh = h * s;
  if (kind === 'fx.wave') {
    // a tsunami is one front: crests side by side across the ring, its ends bending back
    const R = Math.max(0, ringTiles * TILE - bw * 0.5);
    const n = clamp(Math.floor((2 * R) / (bw * tiled.gap)) + 1, 1, tiled.cap);
    const step = n > 1 ? (2 * R) / (n - 1) : 0;
    return Array.from({ length: n }, (_, i) => {
      const dx = n > 1 ? -R + i * step : 0;
      return { dx: Math.round(dx), dy: Math.round((R ? (dx / R) ** 2 : 0) * bh), scale: s, frame: 0 };
    }).sort((a, b) => a.dy - b.dy || a.dx - b.dx);
  }
  // copy centres stay inside the ring, less a third of a body, so bodies end near the edge
  const R = Math.max(0, ringTiles * TILE - bw * 0.35);
  // a staggered grid; when it holds more copies than the cap, widen it (the copies spread out rather than bunch)
  let out: Placement[] = [];
  for (let grow = 1; grow < 8; grow *= 1.15) {
    const stepX = Math.max(4, bw * tiled.gap * grow);
    const stepY = Math.max(4, Math.max(bh * 0.7, bw * 0.45) * tiled.gap * grow);
    out = [];
    const rows = Math.floor(R / stepY);
    const cols = Math.floor(R / stepX) + 1;
    for (let j = -rows; j <= rows; j++)
      for (let i = -cols; i <= cols; i++) {
        const dx = (i + (Math.abs(j) % 2 === 1 ? 0.5 : 0)) * stepX;
        const dy = j * stepY;
        if (Math.hypot(dx, dy) <= R) out.push({ dx: Math.round(dx), dy: Math.round(dy), scale: s, frame: 0 });
      }
    if (out.length <= tiled.cap) break;
  }
  // break the grid: a fixed jitter per copy (no randomness, so it is the same every frame) and mirrored ground copies
  out.forEach((p, k) => {
    p.frame = k;
    if (k > 0) {
      p.dx += Math.round(((((k * 7919) % 11) - 5) / 5) * bw * 0.15);
      p.dy += Math.round(((((k * 104729) % 7) - 3) / 3) * bh * 0.12);
    }
    if (!NO_FLIP.has(kind) && k % 2 === 1) p.flip = true;
  });
  // back to front: higher on screen first, so lower copies overlap them
  return out.sort((a, b) => a.dy - b.dy || a.dx - b.dx);
}

/** Width in world px that a layout spans (for tests and the label fade). */
export function coverage(ps: Placement[], w: number): number {
  let x0 = Infinity, x1 = -Infinity;
  for (const p of ps) {
    x0 = Math.min(x0, p.dx - (w * p.scale) / 2);
    x1 = Math.max(x1, p.dx + (w * p.scale) / 2);
  }
  return x1 - x0;
}

/** Tall effects: name labels they cover fade while they play. */
export const TALL_FX = new Set(['fx.eruption', 'fx.airburst', 'fx.hurricane', 'fx.squall', 'fx.blizzard']);

/** Effects in the air: they cast a ground shadow. */
export const AIR_FX = new Set(['fx.squall', 'fx.hurricane', 'fx.eruption', 'fx.smoke', 'fx.smoke_dark', 'fx.airburst', 'fx.blizzard']);

/**
 * The soft ground shadow of an effect in the air, relative to its anchor (world px): an ellipse offset down-right.
 * Clouds with rain or snow stand on the ground (their anchor), a hurricane is centred on its anchor and floats.
 */
export function fxShadow(kind: string, scale: number, w: number, h: number): { dx: number; dy: number; rx: number; ry: number; alpha: number } | null {
  if (!AIR_FX.has(kind)) return null;
  const k = scale;
  switch (kind) {
    case 'fx.hurricane':
      return { dx: 3 * k, dy: 4 * k, rx: w * 0.42 * k, ry: h * 0.34 * k, alpha: 0.16 };
    case 'fx.eruption':
      return { dx: 6 * k, dy: 1, rx: w * 0.45 * k, ry: 2.5 * k, alpha: 0.2 }; // the umbrella cloud's shadow
    case 'fx.airburst':
      return { dx: 3 * k, dy: 0, rx: 4 * k, ry: 1.5 * k, alpha: 0.22 }; // the fireball's, on the ground below it
    case 'fx.squall':
    case 'fx.blizzard':
      return { dx: 3 * k, dy: 1, rx: w * 0.4 * k, ry: 2 * k, alpha: 0.18 };
    default: // smoke
      return { dx: 2 * k, dy: 1, rx: w * 0.4 * k, ry: 1.2 * k, alpha: 0.14 };
  }
}

export interface Rect { x0: number; y0: number; x1: number; y1: number }

/** A name label's opacity: faded while a tall effect covers it (so an ash column or a fireball stays visible). */
export function labelFade(label: Rect, covers: Rect[]): number {
  for (const c of covers) if (label.x0 < c.x1 && label.x1 > c.x0 && label.y0 < c.y1 && label.y1 > c.y0) return 0.3;
  return 1;
}

/**
 * The sick-town marker's bottom (world px) for a town on tile row `ty`, drawn at scale `k`: just below the town's
 * centre, and never above the name label's bottom edge (`ty * TILE - 10`, see drawLabels) plus a 2 px gap.
 */
export function sickMarkerY(ty: number, k: number, zoom: number): number {
  return Math.max((ty + 0.5) * TILE + 2 * k, ty * TILE - 10 + 2 / zoom + 7 * k);
}

/** The n-th duplicate of one effect in one place, offset on a spiral (world px) so copies do not stack. */
export function spreadOffset(n: number): [number, number] {
  if (n <= 0) return [0, 0];
  const a = n * 2.4; // the golden angle, in radians: even spacing round the spiral
  const r = 6 * Math.sqrt(n);
  return [Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)];
}
