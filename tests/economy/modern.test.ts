/**
 * Round-4 modern-economy fixes. Each test was confirmed to fail with its fix reverted.
 * Evidence for the combined effect is the natural-history runs in docs/VALIDATION.md §6b.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { famineQ, tfrFor } from '../../src/population/demography';
import { extractDeposits } from '../../src/economy/production';
import { planConstruction, progressConstruction } from '../../src/civilizations/urban';
import { climateYearly } from '../../src/world/environment';
import { BUILDINGS } from '../../src/civilizations/buildings';
import { B } from '../../src/civilizations/buildingTypes';
import { Good, Deposit } from '../../src/world/resources';
import type { Civ, Construction } from '../../src/sim/types';
import type { Simulation } from '../../src/sim/simulation';

const bigCiv = (sim: Simulation): Civ => [...sim.w.civs.values()].filter((c) => c.alive && c.settlements.length).sort((a, b) => b.population - a.population)[0];

describe('round-4 modern economy', () => {
  it('starvation kills a modern population too (famine deaths are additive, not a multiple of near-zero baseline mortality)', () => {
    // modern adult baseline mortality ~0.1%/yr; a 40% calorie shortfall must still kill several percent a year
    expect(famineQ(0.001, 0.4, 0.5)).toBeGreaterThan(0.03);
    // no hunger, no excess deaths
    expect(famineQ(0.001, 0, 0.5)).toBe(0.001);
    // pre-modern famines are never milder than before (the old multiplicative term is a floor)
    expect(famineQ(0.07, 0.5, 2.2)).toBeGreaterThanOrEqual(0.07 * (1 + 6 * 0.5 * 2.2) - 1e-12);
  });

  it('fertility falls with development before modern contraception exists (19th-century transition)', () => {
    const sim = makeSim('m4-tfr', 64, (c) => { c.settings.startEra = 8; });
    const civ = bigCiv(sim);
    civ.caps.contraception = 0;
    const developed = tfrFor(civ, { education: 0.7, prosperity: 1.6, pop: 200000 }, 0.003, 1, 'human');
    const traditional = tfrFor(civ, { education: 0.05, prosperity: 0.4, pop: 2000 }, 0.06, 1, 'human');
    expect(traditional).toBeGreaterThan(5.5); // natural fertility before the transition
    expect(developed).toBeLessThan(4); // was ~5.4 when contraception gated the transition
  });

  it('a built-up city replaces old housing to place a needed factory instead of giving up', () => {
    const sim = makeSim('m4-redev', 96, (c) => { c.settings.startEra = 8; });
    sim.runYears(1);
    const civ = bigCiv(sim);
    const s = [...civ.settlements].map((id) => sim.w.settlements.get(id)!).filter((x) => !x.capital).sort((a, b) => b.pop - a.pop)[0] ?? sim.w.settlements.get(civ.capital)!;
    const m = sim.w.map;
    s.construction = null;
    s.planRetryTick = 0;
    // fill every free buildable tile with low-density housing: the city has no free land
    m.forRadius(s.x, s.y, s.radius + 1, (i) => {
      if (m.settle[i] === s.id && !m.bld[i] && m.isLand(i)) { m.bld[i] = B.HOUSE; m.bldFlags[i] = 0; s.bld[B.HOUSE]++; }
    });
    // uncrowded, out of work, and rich in materials
    s.housing = s.pop * 3;
    s.employment[6] = s.pop * 0.3;
    for (const g of [Good.STONE, Good.WOOD, Good.METAL, Good.MACHINERY, Good.ELECTRONICS, Good.FOOD]) civ.stock[g] = 1e7;
    civ.acc.foodNeed = 1; civ.acc.foodShort = 0;
    planConstruction(sim, s, civ);
    const job = s.construction as Construction | null;
    expect(job).not.toBeNull();
    expect(job!.upgrade).toBe(true);
    const cat = BUILDINGS[job!.type].category;
    expect(cat === 'residential' || cat === 'food').toBe(false);
    expect(BUILDINGS[m.bld[job!.tile]].category).toBe('residential');
  });

  it('industrial construction substitutes concrete for missing steel (up to half) and timber', () => {
    const sim = makeSim('m4-concrete', 64, (c) => { c.settings.startEra = 8; });
    const civ = bigCiv(sim);
    const s = sim.w.settlements.get(civ.capital)!;
    civ.stock[Good.METAL] = 0;
    civ.stock[Good.WOOD] = 0;
    civ.stock[Good.STONE] = 1e6;
    const need = new Array(civ.stock.length).fill(0);
    need[Good.METAL] = 150; need[Good.WOOD] = 40; need[Good.STONE] = 300;
    s.construction = { type: B.FACTORY, tile: sim.w.map.idx(s.x, s.y), progress: 0, need, labor: 300, upgrade: true };
    const job = s.construction!;
    // many partial steps (10% of the remaining work each): a per-step 50% cap would wear the steel need away
    const c = civ.caps;
    const productivity = (1 + c.construction) * (1 + c.robotics * 0.6) * (1 + c.automation * 0.3);
    for (let k = 0; k < 60; k++) {
      s.construction = job;
      job.labor = 1e9;
      progressConstruction(sim, s, civ, (0.1 * 1e9 * 12) / productivity);
    }
    const left = job.need;
    expect(left[Good.WOOD]).toBeLessThan(0.5); // timber fully replaced
    expect(left[Good.METAL]).toBeLessThanOrEqual(75 + 1e-6); // half the steel replaced, half still needed
    expect(left[Good.METAL]).toBeGreaterThan(70);
  });

  it('industrial extraction multiplies output and recoverable reserves alike (depletion time unchanged)', () => {
    const run = (industry: number) => {
      const sim = makeSim('m4-mine', 64, (c) => { c.settings.startEra = 8; });
      const civ = bigCiv(sim);
      const s = sim.w.settlements.get(civ.capital)!;
      const i = sim.w.map.idx(s.x, s.y);
      sim.w.map.dep[i] = Deposit.IRON;
      sim.w.map.depAmt[i] = 30000;
      civ.caps.industry = industry;
      civ.caps.mining = Math.max(1, civ.caps.mining);
      const before = civ.stock[Good.IRON];
      extractDeposits(sim, s, civ, [i], 1, false);
      return { out: civ.stock[Good.IRON] - before, drawn: 30000 - sim.w.map.depAmt[i] };
    };
    const pre = run(0), ind = run(2);
    expect(ind.out / pre.out).toBeCloseTo(11, 0); // 1 + 5 * 2
    expect(ind.drawn).toBeCloseTo(pre.drawn, 6); // same draw on the deposit per month
  });

  it('the same emissions warm a larger map less (the map is the planet; CO2 is normalized by area)', () => {
    const rise = (size: number) => {
      const sim = makeSim('m4-co2', size, (c) => { c.settings.startEra = 8; });
      for (const c of sim.w.civs.values()) c.econ.emissions = 0;
      const civ = bigCiv(sim);
      civ.econ.emissions = 1e7;
      const c0 = sim.w.climate.co2;
      climateYearly(sim);
      return sim.w.climate.co2 - c0;
    };
    const small = rise(64), large = rise(128);
    expect(small).toBeGreaterThan(0);
    expect(small / large).toBeCloseTo(4, 1);
  });
});
