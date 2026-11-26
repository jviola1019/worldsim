/**
 * Round 10: Slow pace. Placed humans take generations to settle and centuries to build cities;
 * Standard pace is untouched (every lever exactly 1).
 */
import { describe, it, expect } from 'vitest';
import { paceMult, birthPaceMult } from '../../src/sim/pace';
import { BALANCE } from '../../src/config/balance';
import { spawnBand, slowSettleFactor, bandYearly } from '../../src/population/bands';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import { makeSim } from '../helpers';
import { presetByKey, eraPeopleDefault } from '../../src/config/laws';
import { foundSettlement, townFertility } from '../../src/civilizations/settlement';
import { residents, boundaryPopulation, emptyLedger, LEDGER_KEYS, LEDGER_SIGN } from '../../src/population/ledger';

/** An empty world with one band of 24 humans placed next to fresh water (as in scripts/pace-calibrate.ts). */
export function placedWorld(seed: string, pace: 'standard' | 'slow', size = 128) {
  const sim = makeSim(seed, size, (c) => { c.settings.startCivs = 0; c.settings.startEra = 1; c.settings.pace = pace; });
  const m = sim.w.map;
  for (let i = 0; i < m.n; i += 7) {
    const x = i % m.w, y = (i / m.w) | 0;
    if (m.hasFreshWater(i) && !m.isWater(i) && x > 20 && y > 20 && x < m.w - 20 && spawnBand(sim, x, y, 'human', 24)) break;
  }
  return sim;
}

describe('pace', () => {
  it('standard pace is exactly 1 for every lever', () => {
    for (const lever of ['settle', 'research', 'build', 'birth'] as const) {
      expect(paceMult({ pace: 'standard' } as never, lever)).toBe(1);
      expect(paceMult({} as never, lever)).toBe(1);
    }
  });

  it('slow pace slows settling', () => {
    expect(paceMult({ pace: 'slow' } as never, 'settle')).toBeLessThan(0.2);
  });

  for (const seed of ['pace-a', 'pace-b']) {
    it(`slow world (${seed}): no village in the first 40 years`, () => {
      const sim = placedWorld(seed, 'slow');
      expect(sim.w.bands.size).toBe(1);
      sim.runYears(40);
      expect(sim.w.settlements.size).toBe(0);
      expect(sim.w.bands.size).toBeGreaterThan(0); // still alive, still wandering
    }, 120000);
  }

  it('a slow world saved and reloaded continues identically', () => {
    const sim = placedWorld('pace-c', 'slow', 64);
    sim.runYears(5);
    sim.syncRng();
    const copy = new Simulation(decodeWorld(encodeWorld(sim.w)));
    sim.runYears(20);
    copy.runYears(20);
    sim.syncRng(); copy.syncRng();
    expect(encodeWorld(copy.w)).toEqual(encodeWorld(sim.w));
  }, 120000);

  // round 10 addendum: daughter bands keep their lineage's arrival year. When each split restarted the 30-year settle
  // delay, bands that split faster than that never settled: pace-c had 1,272 bands and 83,344 individual people by
  // year 400, and its save grew past what JSON can hold (the checkpoint failed with 'Invalid string length')
  it('a band that splits keeps its lineage\'s arrival year, so the Slow settle delay applies once', () => {
    const sim = placedWorld('pace-c', 'slow', 64);
    const first = [...sim.w.bands.values()][0].founded;
    sim.runYears(150);
    expect(sim.w.bands.size + sim.w.settlements.size).toBeGreaterThan(1); // the people grew and split
    for (const b of sim.w.bands.values()) expect(b.founded).toBe(first);
  }, 120000);

  // round 10 addendum: population pressure. In Slow pace the settle chance rises with local crowding (other bands and
  // villages nearby): as foraging land fills, settling becomes the better choice. Without it bands kept splitting and
  // a world could hold hundreds of thousands of individual foragers, more than a save can hold.
  it('Slow pace: crowding raises a band\'s chance to settle; a lone band is unaffected', () => {
    const sim = placedWorld('pace-a', 'slow', 64);
    const b = [...sim.w.bands.values()][0];
    sim.year = b.founded + 200; // past the delay and the ramp
    const alone = slowSettleFactor(sim, b);
    expect(alone).toBeCloseTo(paceMult(sim.w.meta.settings, 'settle'), 10);
    for (let k = 0; k < 4; k++) spawnBand(sim, Math.floor(b.x) + (k % 2), Math.floor(b.y) + 1, 'human', 20);
    expect(slowSettleFactor(sim, b)).toBeGreaterThan(alone * 2);
  });

  // round 10 addendum, second save-size bug: a band may only found a village on unclaimed land, and in Slow pace bands
  // outlived the first villages, wandered onto their land and stayed there for ever, foraging and splitting. At year
  // 600 pace-a had 2,736 bands (96% of them on settled land) and 182,911 individual foragers, and its year-700 save
  // failed ('Invalid string length'); pace-c had 13,420 bands by year 800. Foragers living on a village's land join it.
  it('Slow pace: a band camped on a village\'s land joins the village (people conserved); Standard pace never does', () => {
    for (const pace of ['slow', 'standard'] as const) {
      const sim = placedWorld('pace-a', pace, 64);
      const b0 = [...sim.w.bands.values()][0];
      const civ = sim.w.civs.get(b0.civId)!;
      const x = Math.floor(b0.x), y = Math.floor(b0.y);
      const s = foundSettlement(sim, civ, x, y, { pop: 40, quiet: true });
      const m = sim.w.map;
      let tile = -1;
      for (let i = 0; i < m.n && tile < 0; i++) if (m.settle[i] === s.id && !m.isWater(i) && i !== m.idx(x, y)) tile = i;
      const b = spawnBand(sim, m.xOf(tile), m.yOf(tile), 'human', 30, civ, true)!;
      b.founded = sim.year - 200; // past the Slow delay and ramp
      const before = residents(s), open = boundaryPopulation(sim), lg0 = { ...(sim.w.popLedger ?? emptyLedger()) };
      for (let k = 0; k < 3000 && sim.w.bands.has(b.id); k++) bandYearly(sim, b, civ, 60, b.members.length);
      if (pace === 'standard') { expect(sim.w.bands.has(b.id)).toBe(true); continue; } // Standard: unchanged (no join rule)
      expect(sim.w.bands.has(b.id)).toBe(false);
      expect(residents(s)).toBe(before + 30);
      const lg = sim.w.popLedger ?? emptyLedger();
      let flows = 0;
      for (const k of LEDGER_KEYS) flows += LEDGER_SIGN[k] * (lg[k] - lg0[k]);
      expect(boundaryPopulation(sim) - open).toBeCloseTo(flows, 9);
      expect(lg.destroyed - lg0.destroyed).toBe(0);
    }
  }, 120000);
});

// Round 10 second addendum (Task 8f): the Slow birth lever cut every town's fertility by slowBirthMult (0.65), whatever
// its development. A modern town at near-replacement fertility (about 2.1) fell to about 1.4, so Realistic worlds that
// start in a modern era shrank by more than 90% in 300 years and their research stalled with them (advance audit: 1 of
// 6 era-10 Realistic worlds gained an era). Slow pace slows growth; it should not make a modern society shrink.
describe('Slow pace in a developed world', () => {
  const developed = (pace: 'slow' | 'standard') => makeSim('slow-modern', 64, (c) => {
    presetByKey('realistic')!.apply(c);
    c.settings.startEra = 10;
    c.settings.startCivs = eraPeopleDefault('realistic', 10);
    c.settings.pace = pace;
  });

  it('modern towns have nearly as many births at Slow pace as at Standard pace', () => {
    const slow = developed('slow'), standard = developed('standard');
    slow.runYears(3);
    standard.runYears(3);
    const ratio = (slow.w.popLedger?.births ?? 0) / (standard.w.popLedger?.births ?? 1);
    expect(ratio).toBeGreaterThan(0.85);
  }, 120000);

  // Fix round 1: a direct check on the town birth-rate function (no world run, so research and build pace cannot drift
  // the ratio). One fixed modern town and one fixed pre-modern town, each under Slow and Standard pace.
  it('town fertility: a fixed modern town keeps its fertility at Slow pace; a fixed pre-modern town gets the full lever', () => {
    const fixedTown = (era: number, t: { education: number; prosperity: number; pop: number }, q0: number, contraception: number) => {
      const sim = makeSim('fert-town', 48, (c) => { c.settings.startEra = era; c.settings.startCivs = 1; });
      const civ = [...sim.w.civs.values()].find((c) => c.settlements.length)!;
      const s = sim.w.settlements.get(civ.settlements[0])!;
      Object.assign(s, t);
      civ.caps.contraception = contraception; // fixed, so the test does not depend on which techs the start drew
      const at = (pace: 'slow' | 'standard') => { sim.w.meta.settings.pace = pace; return townFertility(sim, s, civ, q0, 1); };
      return { slow: at('slow'), standard: at('standard') };
    };
    // modern: schooled, prosperous city with modern child survival, modern contraception and family planning both fully
    // adopted (0.35 + 0.35, the most the tech tree gives); the lever then takes under 4%
    const modern = fixedTown(10, { education: 0.9, prosperity: 2, pop: 300000 }, 0.004, 0.7);
    expect(modern.standard).toBeLessThan(2.6); // through the transition
    expect(modern.slow / modern.standard).toBeGreaterThan(0.95);
    // pre-modern: unschooled farming village with pre-modern child mortality (era 3)
    const early = fixedTown(3, { education: 0, prosperity: 1, pop: 2000 }, 0.06, 0);
    expect(early.standard).toBeGreaterThan(5); // natural fertility
    expect(early.slow / early.standard).toBeCloseTo(BALANCE.slowBirthMult, 12);
  });

  it('the birth lever keeps its calibrated value before the transition and fades out across it', () => {
    const slow = { pace: 'slow' } as never;
    expect(birthPaceMult(slow, 0)).toBe(BALANCE.slowBirthMult); // early peoples: exactly the calibrated lever
    expect(birthPaceMult(slow, 1)).toBe(1); // fully transitioned: fertility already set by the transition
    expect(birthPaceMult(slow, 0.5)).toBeCloseTo((1 + BALANCE.slowBirthMult) / 2, 12);
    expect(birthPaceMult({ pace: 'standard' } as never, 0)).toBe(1);
  });
});
