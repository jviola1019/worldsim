/**
 * Round 7: buildings are built up, renovated and redeveloped; new towns start in their era's homes;
 * road networks share trunk lines.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { foundSettlement } from '../../src/civilizations/settlement';
import { renovationTier, worksOf } from '../../src/civilizations/urban';
import { B } from '../../src/civilizations/buildingTypes';
import { BLDF, TileMap } from '../../src/world/tilemap';
import { BUILDINGS } from '../../src/civilizations/buildings';
import { findPath } from '../../src/world/pathfinding';
import { T } from '../../src/world/terrain';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { eraToTier } from '../../src/civilizations/buildingTypes';

describe('new towns start in the homes of their era', () => {
  it('a modern nation founds a town of houses, an early one a camp of huts', () => {
    for (const [era, want] of [[6, B.HOUSE], [1, -1]] as const) {
      const sim = makeSim(`first-${era}`, 48, (c) => { c.settings.startEra = era; });
      const civ = [...sim.w.civs.values()][0];
      const m = sim.w.map;
      let spot = -1;
      for (let i = 0; i < m.n && spot < 0; i++) if (m.isLand(i) && !m.settle[i] && !m.bld[i] && m.terrain[i] !== T.MOUNTAIN) spot = i;
      const s = foundSettlement(sim, civ, m.xOf(spot), m.yOf(spot), { pop: 50, quiet: true });
      const first = m.bld[m.idx(s.x, s.y)];
      if (want > 0) expect(first).toBe(want);
      else expect([B.HUT, B.CAMP]).toContain(first);
    }
  });
});

describe('renovation', () => {
  it('a district is rebuilt in the newest style its type has in this era', () => {
    expect(renovationTier(B.HOUSE, 6)).toBe(4); // houses top out in the early-modern style
    expect(renovationTier(B.HUT, 6)).toBe(1);
    expect(renovationTier(B.TOWER, 6)).toBe(6);
    expect(renovationTier(B.APARTMENT, 3)).toBe(-1); // not buildable yet
  });

  it('modern cities renovate, build up and redevelop, and keep count; renovated homes are up to date', () => {
    const sim = makeSim('works-run', 96, (c) => { c.settings.startEra = 4; });
    sim.runYears(80);
    const sum = { built: 0, builtUp: 0, renovated: 0, redeveloped: 0 };
    for (const s of sim.w.settlements.values()) for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += worksOf(s)[k];
    expect(sum.built).toBeGreaterThan(10);
    expect(sum.builtUp + sum.renovated + sum.redeveloped).toBeGreaterThan(0);
    // no home of a living nation stays three or more style tiers behind what its type can be now, in a city that is not crowded
    const m = sim.w.map;
    let behind = 0, homes = 0;
    for (let i = 0; i < m.n; i++) {
      const b = m.bld[i];
      if (!b || BUILDINGS[b].category !== 'residential' || b === B.CAMP || m.bldFlags[i] & (BLDF.PART | BLDF.HISTORIC)) continue;
      const civ = sim.w.civs.get(m.owner[i]);
      if (!civ) continue;
      homes++;
      if ((m.bldFlags[i] & BLDF.TIER_MASK) <= renovationTier(b, eraToTier(civ.era)) - 3) behind++;
    }
    expect(homes).toBeGreaterThan(10);
    expect(behind / homes).toBeLessThan(0.5);
  }, 300000);

  it('construction counters survive a save', () => {
    const sim = makeSim('works-save', 48, (c) => { c.settings.startEra = 5; });
    sim.runYears(3);
    const s = [...sim.w.settlements.values()][0];
    Object.assign(worksOf(s), { built: 7, builtUp: 3, renovated: 2, redeveloped: 1 });
    sim.syncRng();
    const back = decodeWorld(encodeWorld(sim.w));
    expect(back.settlements.get(s.id)!.works).toEqual({ built: 7, builtUp: 3, renovated: 2, redeveloped: 1 });
  });
});

describe('road networks share trunk lines', () => {
  it('planning a road toward a second town reuses the road already built to the first', () => {
    const m = new TileMap(60, 40);
    m.terrain.fill(T.GRASS);
    const A = m.idx(5, 20), B1 = m.idx(55, 8), C = m.idx(55, 32);
    // an existing road A -> B
    const ab = findPath(m, A, B1, { mode: 'land' })!;
    for (const i of ab) m.setRoad(i, 2);
    const plain = findPath(m, A, C, { mode: 'land' })!;
    const planned = findPath(m, A, C, { mode: 'land', planRoad: true })!;
    const shared = (p: number[]) => p.filter((i) => m.roadTier(i) > 0).length;
    const fresh = (p: number[]) => p.filter((i) => m.roadTier(i) === 0).length;
    expect(shared(planned)).toBeGreaterThan(shared(plain));
    expect(fresh(planned)).toBeLessThan(fresh(plain)); // fewer new road tiles to build
  });
});
