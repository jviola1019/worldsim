/**
 * Round 6: a light planning rule. New city buildings keep access to open land (so cities breathe),
 * large cities get parks, and the reward for being boxed in on all sides is gone.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { isOpenTile, keepsAccess, findSite } from '../../src/civilizations/urban';
import { B } from '../../src/civilizations/buildingTypes';
import { BUILDINGS } from '../../src/civilizations/buildings';
import { BALANCE } from '../../src/config/balance';
import { T } from '../../src/world/terrain';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import type { Sim } from '../../src/sim/context';

const clone = (s: Simulation) => { s.syncRng(); return new Simulation(decodeWorld(encodeWorld(s.w))); };
const CITY = new Set(['residential', 'commerce', 'civic', 'industry', 'energy']);
const RESIDENTIAL = [B.HUT, B.HOUSE, B.TOWNHOUSE, B.TENEMENT, B.APARTMENT, B.SUBURB, B.TOWER, B.ARCOLOGY];

/** Share of the city buildings in big settlements that are boxed in (no open 4-neighbour). */
function enclosedShare(sim: Sim, minPop: number): number {
  const m = sim.w.map;
  let boxed = 0, all = 0;
  const big = new Set([...sim.w.settlements.values()].filter((s) => s.pop >= minPop).map((s) => s.id));
  for (let i = 0; i < m.n; i++) {
    if (!big.has(m.settle[i]) || !m.bld[i] || !CITY.has(BUILDINGS[m.bld[i]].category)) continue;
    all++;
    const x = m.xOf(i), y = m.yOf(i);
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !m.inBounds(x + dx, y + dy) || isOpenTile(m, m.idx(x + dx, y + dy)));
    if (!open) boxed++;
  }
  return all ? boxed / all : NaN;
}

describe('what counts as open land', () => {
  it('unbuilt land, water, parks and fields are open; homes, factories and walls are not', () => {
    const sim = makeSim('plan-open', 32);
    const m = sim.w.map;
    const i = m.idx(10, 10);
    m.terrain[i] = T.GRASS; m.bld[i] = 0;
    expect(isOpenTile(m, i)).toBe(true);
    m.terrain[i] = T.LAKE;
    expect(isOpenTile(m, i)).toBe(true);
    m.terrain[i] = T.GRASS;
    for (const b of [B.PARK, B.FARM, B.PASTURE]) { m.bld[i] = b; expect(isOpenTile(m, i), String(b)).toBe(true); }
    for (const b of [B.HOUSE, B.FACTORY, B.WALL]) { m.bld[i] = b; expect(isOpenTile(m, i), String(b)).toBe(false); }
  });

  it('keepsAccess refuses a site that would box in itself or a neighbour, and allows one beside open land', () => {
    const sim = makeSim('plan-access', 32);
    const m = sim.w.map;
    for (let y = 8; y <= 12; y++) for (let x = 8; x <= 12; x++) { const j = m.idx(x, y); m.terrain[j] = T.GRASS; m.bld[j] = 0; }
    const c = m.idx(10, 10);
    // all four neighbours built: placing at the centre would enclose it
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) m.bld[m.idx(10 + dx, 10 + dy)] = B.HOUSE;
    expect(keepsAccess(sim, c)).toBe(false);
    // open the east side again: the centre keeps access, and so does every built neighbour (each touches open corners)
    m.bld[m.idx(11, 10)] = 0;
    expect(keepsAccess(sim, c)).toBe(true);
    // a neighbour whose only open side is the candidate tile would be enclosed
    const n = m.idx(10, 9);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]]) m.bld[m.idx(10 + dx, 9 + dy)] = B.HOUSE;
    expect(keepsAccess(sim, c)).toBe(false);
    expect(n).toBeGreaterThan(0);
  });

  it('the map edge counts as open', () => {
    const sim = makeSim('plan-edge', 32);
    const m = sim.w.map;
    const c = m.idx(0, 5);
    for (const [x, y] of [[1, 5], [0, 4], [0, 6]]) m.bld[m.idx(x, y)] = B.HOUSE;
    m.bld[c] = 0;
    expect(keepsAccess(sim, c)).toBe(true);
  });
});

describe('the planner follows the rule', () => {
  it('every site findSite chooses for a city building keeps access to open land', () => {
    const sim = makeSim('plan-1', 96, (c) => { c.settings.startEra = 6; });
    sim.runYears(40);
    let checked = 0;
    for (const s of sim.w.settlements.values()) {
      if (s.pop < 2000) continue;
      // industry and energy are exempt (their yards give access); homes, shops and civic buildings follow the rule
      for (const b of [B.HOUSE, B.APARTMENT, B.MARKET, B.SCHOOL, B.TEMPLE, B.HOSPITAL]) {
        const def = BUILDINGS[b];
        const tile = findSite(sim, s, def);
        if (tile === null) continue;
        checked++;
        expect(keepsAccess(sim, tile), `${def.key} at ${tile}`).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(5);
  }, 120000);

  it('large cities have parks', () => {
    const sim = makeSim('plan-parks', 96, (c) => { c.settings.startEra = 6; });
    sim.runYears(60);
    let big = 0;
    for (const s of sim.w.settlements.values()) {
      const res = RESIDENTIAL.reduce((a, b) => a + (s.bld[b] ?? 0), 0);
      if (s.pop <= BALANCE.parkMinPop || res < BALANCE.parkPerResidential) continue;
      big++;
      expect(s.bld[B.PARK], `${s.name}: ${res} residential districts`).toBeGreaterThanOrEqual(1);
    }
    expect(big).toBeGreaterThan(0);
  }, 180000);

  it('cities grown under the rule box in fewer of their buildings than identical twins without it (counterfactual)', () => {
    const base = makeSim('plan-cf', 96, (c) => { c.settings.startEra = 4; });
    base.runYears(5);
    const on = clone(base), off = clone(base);
    const prev = BALANCE.streetAccess;
    try {
      BALANCE.streetAccess = true;
      on.runYears(150);
      BALANCE.streetAccess = false;
      off.runYears(150);
    } finally {
      BALANCE.streetAccess = prev;
    }
    const a = enclosedShare(on, 5000), b = enclosedShare(off, 5000);
    expect(a).toBeLessThan(b);
  }, 600000);

  it('a single gap surrounded by homes has no access, so only a housing crisis may fill it', () => {
    const sim = makeSim('plan-infill', 32);
    const m = sim.w.map;
    for (let y = 8; y <= 12; y++) for (let x = 8; x <= 12; x++) { const j = m.idx(x, y); m.terrain[j] = T.GRASS; m.bld[j] = B.HOUSE; }
    const hole = m.idx(10, 10);
    m.bld[hole] = 0; // a single gap surrounded by homes
    expect(keepsAccess(sim, hole)).toBe(false);
    expect(BALANCE.infillPressure).toBeGreaterThan(1);
  });

  it('a city that is already boxed in still develops: upgrades in place go ahead and nothing throws', () => {
    const sim = makeSim('plan-boxed', 64, (c) => { c.settings.startEra = 6; });
    sim.runYears(2);
    const s = [...sim.w.settlements.values()].sort((a, b) => b.pop - a.pop)[0];
    const m = sim.w.map;
    for (let i = 0; i < m.n; i++) if (m.settle[i] === s.id && m.isLand(i) && !m.bld[i]) m.bld[i] = B.HOUSE;
    let started = 0;
    for (let y = 0; y < 5 * 12; y++) {
      sim.runTicks(10); // one month
      if (s.construction) started++;
    }
    expect(started).toBeGreaterThan(0);
  }, 120000);
});
