/**
 * Map shape presets (src/world/mapShapes.ts): every shape at two sizes and two
 * seeds must generate, hit its land range, show its signature geometry and let
 * civilizations start. Ranges come from measured runs of these exact seeds
 * (recorded in docs/VALIDATION.md), with margin.
 */
import { describe, expect, it } from 'vitest';
import { generateWorld, DEFAULT_GEN } from '../../src/world/worldgen';
import { MAP_SHAPES, buildShapeField, mapShape, type MapShape } from '../../src/world/mapShapes';
import { applyMapShape, defaultConfig } from '../../src/config/laws';
import { createSimulation } from '../../src/sim/bootstrap';
import { T } from '../../src/world/terrain';
import type { TileMap } from '../../src/world/tilemap';
import {
  COLD,
  centreSeaEnclosed,
  components,
  isHabitable,
  landComponents,
  landFraction,
  landShareIn,
  mirrorAgreement,
  ringSwitches,
  sectorLand,
  shapedWorld,
  shareOfLandIn,
  sunkenInterior,
  terrainShareOfLand,
} from './shapeMetrics';

const SIZES = [96, 128];
const SEEDS = ['m1', 'm2'];
const SHAPES = MAP_SHAPES.filter((s) => s.key !== 'natural').map((s) => s.key);
const CASES = SHAPES.flatMap((shape) => SIZES.flatMap((size) => SEEDS.map((seed) => ({ shape, size, seed }))));

/** Land fraction per shape: measured 0.12-0.87 across shapes; each range brackets its own measurements. */
const LAND_RANGE: Record<Exclude<MapShape, 'natural'>, [number, number]> = {
  circle: [0.25, 0.34],
  square: [0.34, 0.43],
  donut: [0.3, 0.39],
  crescent: [0.22, 0.33],
  highlands: [0.47, 0.58],
  arid: [0.8, 0.92],
  waterworld: [0.08, 0.2],
  frozen: [0.38, 0.49],
  shards: [0.27, 0.36],
  spiral: [0.26, 0.35],
  mirrored: [0.34, 0.45],
  checkerboard: [0.2, 0.28],
  pangaea: [0.29, 0.39],
  twin: [0.21, 0.3],
  many: [0.2, 0.28],
  rift: [0.31, 0.4],
};

const cache = new Map<string, TileMap>();
function world(shape: MapShape, size: number, seed: string): TileMap {
  const k = `${shape}:${size}:${seed}`;
  if (!cache.has(k)) cache.set(k, shapedWorld(shape, size, seed));
  return cache.get(k)!;
}

const islandsAtLeast = (m: TileMap, share: number) => landComponents(m).filter((c) => c >= share).length;

describe('map shapes: every preset', () => {
  it.each(CASES)('$shape $size $seed generates with land in range', ({ shape, size, seed }) => {
    const m = world(shape, size, seed);
    const [lo, hi] = LAND_RANGE[shape as Exclude<MapShape, 'natural'>];
    const land = landFraction(m);
    expect(land).toBeGreaterThan(lo);
    expect(land).toBeLessThan(hi);
    for (let i = 0; i < m.n; i++) expect(Number.isFinite(m.elev[i])).toBe(true);
  });

  it.each(CASES.filter((c) => mapShape(c.shape).makeMask))('$shape $size $seed: land follows the shape mask', ({ shape, size, seed }) => {
    const m = world(shape, size, seed);
    const field = buildShapeField(mapShape(shape), size, size, seed)!;
    let land = 0;
    let landInMask = 0;
    let core = 0;
    let coreLand = 0;
    for (let i = 0; i < m.n; i++) {
      if (m.isLand(i)) {
        land++;
        if (field[i] > 0) landInMask++;
      }
      if (field[i] > 0.5) {
        core++;
        if (m.isLand(i)) coreLand++;
      }
    }
    // measured: land inside the mask 0.57-0.96 (waterworld lowest: hotspot islets), mask core that is land 0.81-0.99
    expect(landInMask / land).toBeGreaterThan(shape === 'waterworld' ? 0.5 : 0.8);
    expect(coreLand / core).toBeGreaterThan(0.75);
  });

  it.each(CASES)('$shape $size $seed: civilizations can start (developed era, 3 years)', ({ shape, size, seed }) => {
    const cfg = defaultConfig();
    cfg.gen.seed = seed;
    cfg.gen.width = size;
    cfg.gen.height = size;
    applyMapShape(cfg.gen, shape);
    cfg.settings.startEra = 4;
    const sim = createSimulation(cfg);
    sim.runYears(3);
    const settled = [...sim.w.civs.values()].filter((c) => c.settlements.length > 0);
    expect(settled.length).toBeGreaterThanOrEqual(1);
    // at least one capital sits on or beside water (sea, lake or river)
    const m = sim.w.map;
    const nearWater = settled.some((c) => {
      const cap = sim.w.settlements.get(c.capital);
      let near = false;
      if (cap) m.forRadius(cap.x, cap.y, 2, (j) => (near ||= m.isWater(j) || m.river[j] > 0));
      return near;
    });
    expect(nearWater).toBe(true);
  });

  it.each(SHAPES)('%s is deterministic (same seed and shape -> identical terrain)', (shape) => {
    const gen = () => generateWorld(applyMapShape({ ...DEFAULT_GEN, seed: 'det', width: 96, height: 96 }, shape)).map;
    const a = gen();
    const b = gen();
    expect(Array.from(a.elev)).toEqual(Array.from(b.elev));
    expect(Array.from(a.terrain)).toEqual(Array.from(b.terrain));
    expect(Array.from(a.river)).toEqual(Array.from(b.river));
    expect(Array.from(a.dep)).toEqual(Array.from(b.dep));
  });
});

describe.each(SIZES.flatMap((size) => SEEDS.map((seed) => ({ size, seed }))))('map shape geometry at $size, seed $seed', ({ size, seed }) => {
  const w = (shape: MapShape) => world(shape, size, seed);

  it('circle: one round island, no land in the corners', () => {
    const m = w('circle');
    expect(landShareIn(m, (p) => p.r < 0.4)).toBeGreaterThan(0.7); // measured 0.79-0.87
    expect(shareOfLandIn(m, (p) => p.r > 0.85)).toBeLessThan(0.02); // measured 0
    expect(landShareIn(m, (p) => p.cheb < 0.58 && p.r > 0.74)).toBeLessThan(0.05); // measured 0
    expect(landComponents(m)[0]).toBeGreaterThan(0.95);
  });

  it('square: land fills the square, corners included', () => {
    const m = w('square');
    expect(landShareIn(m, (p) => p.cheb < 0.4)).toBeGreaterThan(0.7); // measured 0.80-0.87
    expect(shareOfLandIn(m, (p) => p.cheb > 0.85)).toBeLessThan(0.02); // measured 0
    expect(landShareIn(m, (p) => p.cheb < 0.58 && p.r > 0.74)).toBeGreaterThan(0.75); // measured 0.89-0.99
  });

  it('donut: an inner sea enclosed by a continuous ring of land', () => {
    const m = w('donut');
    expect(landShareIn(m, (p) => p.r < 0.25)).toBeLessThan(0.05); // measured 0: centre is water
    expect(centreSeaEnclosed(m)).toBe(true);
    expect(landShareIn(m, (p) => p.r > 0.45 && p.r < 0.67)).toBeGreaterThan(0.8); // measured 0.88-0.91
    expect(Math.min(...sectorLand(m, 0.42, 0.7, 12))).toBeGreaterThan(0.5); // measured 0.74-0.85: land all the way round
  });

  it('crescent: a curved land open on one side (a bay, not a ring)', () => {
    const m = w('crescent');
    const sectors = sectorLand(m, 0.5, 0.75, 12);
    expect(landShareIn(m, (p) => p.r < 0.15)).toBeLessThan(0.05); // measured 0
    expect(Math.min(...sectors)).toBeLessThan(0.1); // measured 0: the bay mouth
    expect(sectors.filter((s) => s > 0.5).length).toBeGreaterThanOrEqual(5); // measured 6-8: the horns
    expect(centreSeaEnclosed(m)).toBe(false);
  });

  it('highlands: far more mountains than the natural generator', () => {
    const high = terrainShareOfLand(w('highlands'), [T.MOUNTAIN]);
    const nat = terrainShareOfLand(w('natural'), [T.MOUNTAIN]);
    expect(high).toBeGreaterThan(0.45); // measured 0.55-0.59
    expect(high).toBeGreaterThan(1.8 * nat); // natural measured 0.19-0.29
  });

  it('arid: little water, more desert, yet habitable land beside fresh water', () => {
    const m = w('arid');
    let water = 0;
    let habitableFresh = 0;
    for (let i = 0; i < m.n; i++) {
      if (m.isWater(i)) water++;
      if (isHabitable(m, i) && m.hasFreshWater(i)) habitableFresh++;
    }
    expect(water / m.n).toBeLessThan(0.2); // measured 0.13-0.15 (natural ~0.61)
    expect(terrainShareOfLand(m, [T.DESERT])).toBeGreaterThan(0.1); // measured 0.13-0.25 (natural 0.01-0.04)
    expect(habitableFresh).toBeGreaterThan(300); // measured 787-1762
  });

  it('arid: river banks and lake shores stay green (groundwater-fed floodplains)', () => {
    const m = w('arid');
    for (let i = 0; i < m.n; i++) if (m.isLand(i) && m.hasFreshWater(i)) expect(m.moist[i]).toBeGreaterThanOrEqual(mapShape('arid').riparianMoisture!);
  });

  it('arid: dry basins become flats, but small deep spring-fed pools (oases) remain', () => {
    const m = w('arid');
    const lakes = components(m, (i) => m.terrain[i] === T.LAKE);
    expect(lakes.filter((s) => s <= 30).length).toBeGreaterThanOrEqual(8); // measured 15-25 small lakes
    expect(lakes.reduce((a, b) => a + b, 0) / m.n).toBeLessThan(0.05); // measured lake share 0.012-0.032
  });

  it('waterworld: mostly ocean with many separate islands', () => {
    const m = w('waterworld');
    expect(landFraction(m)).toBeLessThan(0.25);
    expect(islandsAtLeast(m, 0.01)).toBeGreaterThanOrEqual(10); // measured 14-21
    expect(landComponents(m)[0]).toBeLessThan(0.4); // measured 0.18-0.26
  });

  it('frozen: cold biomes dominate; habitable land lies near the equator', () => {
    const m = w('frozen');
    expect(terrainShareOfLand(m, COLD)).toBeGreaterThan(0.55); // measured 0.65-0.74 (natural 0.19-0.29)
    let hab = 0;
    let habLat = 0;
    let land = 0;
    let landLat = 0;
    for (let i = 0; i < m.n; i++) {
      if (!m.isLand(i)) continue;
      const lat = Math.abs(m.yOf(i) / m.h - 0.5);
      land++;
      landLat += lat;
      if (isHabitable(m, i)) {
        hab++;
        habLat += lat;
      }
    }
    expect(hab).toBeGreaterThan(100); // measured 163-532
    expect(habLat / hab).toBeLessThan(0.6 * (landLat / land)); // measured ratio 0.32-0.42
  });

  it('shards: many separate fragments, none dominant', () => {
    const m = w('shards');
    expect(islandsAtLeast(m, 0.01)).toBeGreaterThanOrEqual(12); // measured 18-20
    expect(landComponents(m)[0]).toBeLessThan(0.2); // measured 0.10-0.11
  });

  it('spiral: a central hub with arms crossing every ring', () => {
    const m = w('spiral');
    expect(landShareIn(m, (p) => p.r < 0.12)).toBeGreaterThan(0.8); // measured 0.94-0.99
    expect(ringSwitches(m, 0.45)).toBeGreaterThanOrEqual(4); // measured 8-10 (2-4 arms, in and out)
    expect(ringSwitches(m, 0.6)).toBeGreaterThanOrEqual(4); // measured 6-8
    expect(landComponents(m)[0]).toBeGreaterThan(0.9); // arms join at the hub
  });

  it('mirrored: east mirrors west', () => {
    expect(mirrorAgreement(w('mirrored'))).toBeGreaterThan(0.99); // measured 1.000
    expect(mirrorAgreement(w('natural'))).toBeLessThan(0.9); // natural measured 0.53-0.75
  });

  it('checkerboard: a grid of separate square islands', () => {
    const m = w('checkerboard');
    expect(islandsAtLeast(m, 0.02)).toBeGreaterThanOrEqual(16); // measured 22-26
    expect(landComponents(m)[0]).toBeLessThan(0.12); // measured 0.05-0.07
  });

  it('pangaea: nearly all land in one continent', () => {
    expect(landComponents(w('pangaea'))[0]).toBeGreaterThan(0.95); // measured 0.997-0.998
  });

  it('twin: two continents of similar size across an open strait', () => {
    const m = w('twin');
    const [a, b] = landComponents(m);
    expect(a).toBeLessThan(0.6); // measured 0.50-0.53
    expect(b).toBeGreaterThan(0.4); // measured 0.47-0.50
    expect(landShareIn(m, (p) => Math.abs(p.u) < 0.05)).toBeLessThan(0.02); // measured 0
  });

  it('many: several mid-sized continents', () => {
    const m = w('many');
    expect(islandsAtLeast(m, 0.05)).toBeGreaterThanOrEqual(6); // measured 7
    expect(landComponents(m)[0]).toBeLessThan(0.25); // measured 0.16-0.17
  });

  it('rift: a sunken, water-filled valley through the continent', () => {
    const m = w('rift');
    const r = sunkenInterior(m, buildShapeField(mapShape('rift'), size, size, seed)!);
    expect(r.tiles).toBeGreaterThan(size); // measured 265-525
    expect(r.water).toBeGreaterThan(0.5); // measured 0.65-0.96
    expect(r.elev).toBeLessThan(r.restElev - 0.3); // measured trough -0.13..0.00 vs rest 0.57-0.65
  });
});

describe('start sites (round 10 addendum)', () => {
  it('every starting people begins beside fresh water or the sea when the map has such land', () => {
    for (const seed of ['m2', 'sites-1', 'sites-2']) {
      const cfg = defaultConfig();
      cfg.gen.seed = seed;
      cfg.gen.width = 128;
      cfg.gen.height = 128;
      applyMapShape(cfg.gen, 'many' as MapShape);
      cfg.settings.startEra = 4;
      const sim = createSimulation(cfg);
      const m = sim.w.map;
      for (const c of sim.w.civs.values()) {
        const cap = sim.w.settlements.get(c.capital)!;
        let near = false;
        m.forRadius(cap.x, cap.y, 2, (j) => (near ||= m.isWater(j) || m.river[j] > 0));
        expect(near, `${seed} ${c.name}`).toBe(true);
      }
    }
  });
});
