/**
 * Map shapes: world-generation presets that steer where land forms.
 *
 * A shape works in two ways, both feeding the normal pipeline in worldgen.ts
 * (plates, noise, rain shadows, rivers, biomes, deposits):
 *  - a LAND MASK: a smooth target field in centred map coordinates
 *    (+1 = land wanted, -1 = sea wanted). It replaces most of the random
 *    plate base, so plate boundaries, ridges and noise still shape the coast
 *    and relief inside the outline;
 *  - KNOBS and terrain modifiers: ocean coverage, temperature, moisture,
 *    extra relief, basin evaporation and riparian greening.
 *
 * Masks are evaluated on domain-warped coordinates so outlines get organic,
 * fractal coasts instead of geometric edges. Everything random comes from a
 * shape-specific seeded Rng and seeded noise: same seed + shape = same world.
 */
import { Rng } from '../core/rng';
import { Simplex2 } from '../core/noise';
import { clamp, smoothstep } from '../core/math';
import type { WorldGenParams } from './worldgen';

export type MapShape =
  | 'natural'
  | 'circle'
  | 'square'
  | 'donut'
  | 'crescent'
  | 'highlands'
  | 'arid'
  | 'waterworld'
  | 'frozen'
  | 'shards'
  | 'spiral'
  | 'mirrored'
  | 'checkerboard'
  | 'pangaea'
  | 'twin'
  | 'many'
  | 'rift';

export type MapShapeFamily = 'natural' | 'shapes' | 'extreme' | 'chaos' | 'earthlike';

export const SHAPE_FAMILY_LABELS: Record<MapShapeFamily, string> = {
  natural: 'Natural',
  shapes: 'Shapes',
  extreme: 'Extreme terrain',
  chaos: 'Structured chaos',
  earthlike: 'Earth-like variety',
};

/** Land target in centred coordinates u, v in -1..1. Returns -1 (sea) .. +1 (land). */
export type MaskFn = (u: number, v: number) => number;

export interface MapShapeDef {
  key: MapShape;
  name: string;
  family: MapShapeFamily;
  description: string;
  /** Geography knobs the shape sets when chosen; the player can still adjust them. */
  knobs: Partial<Omit<WorldGenParams, 'seed' | 'width' | 'height' | 'shape'>>;
  /** Builds the land mask; the Rng supplies the shape's random layout. */
  makeMask?: (rng: Rng) => MaskFn;
  /** Copy the west half onto the east half (mirror-symmetric world). */
  mirror?: boolean;
  /** Extra ridged uplift (raw elevation units) for mountainous worlds. */
  relief?: number;
  /** Land-elevation percentile mapped to the top of the scale; lower = more high ground. */
  peakQuantile?: number;
  /**
   * Exponent of the land elevation curve (default 1.1). Above 1 widens the
   * lowlands (old, eroded plains); below 1 lifts the land into uplands.
   */
  reliefCurve?: number;
  /** Mean basin moisture (0..255) needed for rain to keep a lake against evaporation. */
  lakeMinMoist?: number;
  /** Minimum moisture (0..255) next to rivers and lakes: groundwater-fed floodplains. */
  riparianMoisture?: number;
}

/** 1 inside `edge`, -1 outside, with a smooth shoreline band of half-width `soft`. */
function inside(d: number, edge: number, soft: number): number {
  return 1 - 2 * smoothstep(edge - soft, edge + soft, d);
}

/**
 * A rounded landmass whose radius wobbles with direction (low-frequency
 * angular noise), so continents are not perfect ellipses.
 */
function blob(cx: number, cy: number, radius: number, rng: Rng): MaskFn {
  const k1 = rng.range(0, Math.PI * 2);
  const k2 = rng.range(0, Math.PI * 2);
  const a1 = rng.range(0.1, 0.2);
  const a2 = rng.range(0.05, 0.12);
  return (u, v) => {
    const th = Math.atan2(v - cy, u - cx);
    const edge = radius * (1 + a1 * Math.sin(2 * th + k1) + a2 * Math.sin(3 * th + k2));
    return inside(Math.hypot(u - cx, v - cy), edge, 0.08);
  };
}

/** Union of land masks (land wherever any of them wants land). */
const union = (masks: MaskFn[]): MaskFn => (u, v) => {
  let best = -1;
  for (const m of masks) best = Math.max(best, m(u, v));
  return best;
};

/**
 * Choose exactly `count` of `total` items at random. A fixed count keeps the
 * shape's land area steady from seed to seed, so the ocean-coverage knob
 * matches the outline.
 */
function chooseExactly(rng: Rng, total: number, count: number): boolean[] {
  const order = rng.shuffle(Array.from({ length: total }, (_, k) => k));
  const chosen = new Array<boolean>(total).fill(false);
  for (let k = 0; k < count; k++) chosen[order[k]] = true;
  return chosen;
}

/** Jittered grid of points inside the unit square, one per cell. */
function jitteredGrid(rng: Rng, cells: number, extent: number, jitter: number): [number, number][] {
  const pts: [number, number][] = [];
  const step = (2 * extent) / cells;
  for (let gy = 0; gy < cells; gy++)
    for (let gx = 0; gx < cells; gx++)
      pts.push([-extent + (gx + 0.5 + rng.range(-jitter, jitter)) * step, -extent + (gy + 0.5 + rng.range(-jitter, jitter)) * step]);
  return pts;
}

// ---------- masks ----------

/** A continent cut along a seeded Voronoi network: seas flood the fracture lines between shards. */
function shardsMask(rng: Rng): MaskFn {
  const pts = jitteredGrid(rng, 5, 0.8, 0.4);
  const raised = chooseExactly(rng, pts.length, 21);
  return (u, v) => {
    let d1 = Infinity;
    let d2 = Infinity;
    let k1 = 0;
    for (let k = 0; k < pts.length; k++) {
      const d = Math.hypot(u - pts[k][0], v - pts[k][1]);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        k1 = k;
      } else if (d < d2) d2 = d;
    }
    // d2 - d1 is about twice the distance to the nearest fracture line
    const shard = raised[k1] ? 2 * smoothstep(0.03, 0.09, d2 - d1) - 1 : -1;
    return Math.min(shard, inside(Math.hypot(u, v), 0.86, 0.06));
  };
}

/** Land arms winding out from a central hub along logarithmic spirals. */
function spiralMask(rng: Rng): MaskFn {
  const arms = rng.int(2, 4);
  const twist = rng.range(2.2, 3.2) * (rng.chance(0.5) ? 1 : -1);
  const rot = rng.range(0, Math.PI * 2);
  return (u, v) => {
    const r = Math.hypot(u, v);
    const th = Math.atan2(v, u);
    const arm = Math.cos(arms * (th - twist * Math.log(r + 0.05)) + rot);
    const armLand = clamp((arm - 0.15) * 3, -1, 1);
    const hub = inside(r, 0.2, 0.05);
    return Math.min(Math.max(hub, armLand), inside(r, 0.88, 0.06));
  };
}

/** Alternating land and sea squares, like a flooded grid of fault blocks. */
function checkerboardMask(rng: Rng): MaskFn {
  const cells = rng.int(3, 4); // squares per half-axis -> 6x6 or 8x8 board
  const flip = rng.chance(0.5) ? 1 : -1;
  return (u, v) => {
    const s = flip * Math.sin(Math.PI * cells * u) * Math.sin(Math.PI * cells * v);
    return Math.min(clamp((s - 0.25) * 4, -1, 1), inside(Math.max(Math.abs(u), Math.abs(v)), 0.86, 0.04));
  };
}

/** A big disc with a smaller disc bitten out of one side. */
function crescentMask(rng: Rng): MaskFn {
  const a = rng.range(0, Math.PI * 2);
  const bx = Math.cos(a) * 0.36;
  const by = Math.sin(a) * 0.36;
  return (u, v) => Math.min(inside(Math.hypot(u, v), 0.8, 0.08), -inside(Math.hypot(u - bx, v - by), 0.56, 0.08));
}

/** Two continents separated by an open ocean running north-south. */
function twinMask(rng: Rng): MaskFn {
  const dy = rng.range(-0.15, 0.15);
  const pair = union([blob(-0.48, dy, 0.4, rng), blob(0.48, -dy, 0.4, rng)]);
  // the dividing ocean: no land within a band around the meridian
  return (u, v) => Math.min(pair(u, v), 2 * smoothstep(0.06, 0.14, Math.abs(u)) - 1);
}

/**
 * Several medium continents, one per cell of a 3x3 grid (two cells left as
 * open sea). Each continent is confined to its cell so oceans divide them.
 */
function manyMask(rng: Rng): MaskFn {
  const cells = 3;
  const extent = 0.8;
  const step = (2 * extent) / cells;
  const masks: MaskFn[] = [];
  const chosen = chooseExactly(rng, cells * cells, 7);
  for (let gy = 0; gy < cells; gy++)
    for (let gx = 0; gx < cells; gx++) {
      if (!chosen[gy * cells + gx]) continue;
      const cx = -extent + (gx + 0.5) * step;
      const cy = -extent + (gy + 0.5) * step;
      const land = blob(cx + rng.range(-0.05, 0.05), cy + rng.range(-0.05, 0.05), rng.range(0.2, 0.24), rng);
      masks.push((u, v) => Math.min(land(u, v), inside(Math.max(Math.abs(u - cx), Math.abs(v - cy)), step / 2 - 0.07, 0.03)));
    }
  return union(masks);
}

/** Many small islands scattered over open ocean, like hotspot chains and atolls. */
function islandsMask(rng: Rng): MaskFn {
  const pts = jitteredGrid(rng, 5, 0.78, 0.35);
  const chosen = chooseExactly(rng, pts.length, 20);
  const kept = pts.filter((_, k) => chosen[k]);
  return union(kept.map(([x, y]) => blob(x, y, rng.range(0.05, 0.1), rng)));
}

/**
 * One continent split by a rift: where the crust stretches, a central block
 * drops (graben, filled by lakes and sea arms) and its flanks are uplifted.
 */
function riftMask(rng: Rng): MaskFn {
  const continent = blob(0, 0, 0.7, rng);
  const a = Math.PI / 2 + rng.range(-0.2, 0.2); // roughly north-south
  const nx = Math.cos(a + Math.PI / 2);
  const ny = Math.sin(a + Math.PI / 2);
  const off = rng.range(-0.15, 0.15);
  return (u, v) => {
    const d = Math.abs(u * nx + v * ny - off);
    const trough = 1 - smoothstep(0.04, 0.1, d);
    const shoulder = smoothstep(0.07, 0.12, d) * (1 - smoothstep(0.14, 0.24, d));
    return continent(u, v) - 1.8 * trough + 0.35 * shoulder;
  };
}

export const MAP_SHAPES: readonly MapShapeDef[] = [
  {
    key: 'natural',
    name: 'Natural',
    family: 'natural',
    description: 'Plate tectonics alone decides where land rises. Uses the geography settings below as they are.',
    knobs: {},
  },
  // ---- shapes ----
  {
    key: 'circle',
    name: 'Circle island',
    family: 'shapes',
    description: 'One round island in an open ocean.',
    knobs: { oceanCoverage: 0.68 },
    makeMask: () => (u, v) => inside(Math.hypot(u, v), 0.62, 0.12),
  },
  {
    key: 'square',
    name: 'Square continent',
    family: 'shapes',
    description: 'A blocky continent with straight-ish coasts.',
    knobs: { oceanCoverage: 0.57 },
    makeMask: () => (u, v) => inside(Math.max(Math.abs(u), Math.abs(v)), 0.64, 0.08),
  },
  {
    key: 'donut',
    name: 'Ring world',
    family: 'shapes',
    description: 'A ring of land around a sheltered inner sea.',
    knobs: { oceanCoverage: 0.64 },
    makeMask: () => (u, v) => inside(Math.abs(Math.hypot(u, v) - 0.56), 0.19, 0.07),
  },
  {
    key: 'crescent',
    name: 'Crescent',
    family: 'shapes',
    description: 'A curved, horn-shaped land wrapped around a bay.',
    knobs: { oceanCoverage: 0.7 },
    makeMask: crescentMask,
  },
  // ---- extreme terrain ----
  {
    key: 'highlands',
    name: 'Towering highlands',
    family: 'extreme',
    description: 'Massive ranges with narrow, river-cut valleys. Settlers crowd the lowlands.',
    knobs: { oceanCoverage: 0.45, mountains: 1, rivers: 0.7 },
    relief: 0.55,
    peakQuantile: 0.8,
    reliefCurve: 0.7,
  },
  {
    key: 'arid',
    name: 'Arid world',
    family: 'extreme',
    description: 'Dry plains and deserts with little open water. Life clings to rivers, oases and coasts.',
    knobs: { oceanCoverage: 0.12, moisture: -2, rivers: 0.5, temperature: 0.6, climateVariation: 0.2 },
    reliefCurve: 2.2,
    lakeMinMoist: 150,
    riparianMoisture: 90,
  },
  {
    key: 'waterworld',
    name: 'Waterworld',
    family: 'extreme',
    description: 'Endless ocean dotted with many small islands.',
    knobs: { oceanCoverage: 0.88, landmass: 'islands', fragmentation: 0.9 },
    makeMask: islandsMask,
  },
  {
    key: 'frozen',
    name: 'Frozen world',
    family: 'extreme',
    description: 'Ice and tundra rule. A narrow temperate belt around the equator holds most life.',
    knobs: { temperature: -1.6, climateVariation: 1, oceanCoverage: 0.55 },
  },
  // ---- structured chaos ----
  {
    key: 'shards',
    name: 'Fractured shards',
    family: 'chaos',
    description: 'A continent shattered into angular shards by flooded fracture lines.',
    knobs: { oceanCoverage: 0.68 },
    makeMask: shardsMask,
  },
  {
    key: 'spiral',
    name: 'Spiral arms',
    family: 'chaos',
    description: 'Arms of land spiral out from a central hub.',
    knobs: { oceanCoverage: 0.69 },
    makeMask: spiralMask,
  },
  {
    key: 'mirrored',
    name: 'Mirrored halves',
    family: 'chaos',
    description: 'East mirrors west: fragmented, random geography with perfect left-right symmetry.',
    knobs: { fragmentation: 0.8 },
    mirror: true,
  },
  {
    key: 'checkerboard',
    name: 'Checkerboard islands',
    family: 'chaos',
    description: 'Square islands alternate with square seas across a grid.',
    knobs: { oceanCoverage: 0.76 },
    makeMask: checkerboardMask,
  },
  // ---- Earth-like variety ----
  {
    key: 'pangaea',
    name: 'Pangaea',
    family: 'earthlike',
    description: 'All land joined in one vast continent with a dry interior.',
    knobs: { oceanCoverage: 0.62 },
    makeMask: (rng) => blob(0, 0, 0.68, rng),
  },
  {
    key: 'twin',
    name: 'Twin continents',
    family: 'earthlike',
    description: 'Two great continents facing each other across an ocean.',
    knobs: { oceanCoverage: 0.73 },
    makeMask: twinMask,
  },
  {
    key: 'many',
    name: 'Many continents',
    family: 'earthlike',
    description: 'Several mid-sized continents, each a cradle for its own peoples.',
    knobs: { oceanCoverage: 0.76 },
    makeMask: manyMask,
  },
  {
    key: 'rift',
    name: 'Rift valley',
    family: 'earthlike',
    description: 'A continent splitting apart: a long valley of lakes between uplifted flanks.',
    knobs: { oceanCoverage: 0.62 },
    makeMask: riftMask,
  },
];

const BY_KEY = new Map(MAP_SHAPES.map((s) => [s.key, s]));

/** Shape definition for a key; unknown or missing keys (older saves) fall back to Natural. */
export function mapShape(key: MapShape | undefined): MapShapeDef {
  return BY_KEY.get(key ?? 'natural') ?? MAP_SHAPES[0];
}

/**
 * Evaluate a shape's land mask on the map grid, or null when the shape has
 * none. Coordinates are domain-warped by seeded noise for organic coasts.
 */
export function buildShapeField(def: MapShapeDef, W: number, H: number, seed: string): Float32Array | null {
  if (!def.makeMask) return null;
  const mask = def.makeMask(new Rng(`shape:${def.key}:${seed}`));
  const warp = new Simplex2(seed + ':shape');
  const field = new Float32Array(W * H);
  const half = Math.max(W, H) / 2;
  const wf = 2.5;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - W / 2) / half;
      const v = (y + 0.5 - H / 2) / half;
      const wu = u + 0.07 * warp.fbm(u * wf, v * wf, 3);
      const wv = v + 0.07 * warp.fbm(u * wf + 17.3, v * wf - 9.1, 3);
      field[y * W + x] = mask(wu, wv);
    }
  return field;
}
