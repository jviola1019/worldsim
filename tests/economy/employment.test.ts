import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import { getSites } from '../../src/economy/production';
import { civEconomyYearly } from '../../src/economy/market';
import { BALANCE } from '../../src/config/balance';
import { SECTOR } from '../../src/civilizations/buildings';

const clone = (s: Simulation) => { s.syncRng(); return new Simulation(decodeWorld(encodeWorld(s.w))); };

describe('employment and national accounts (round-2 economy fixes)', () => {
  it('market-service demand rises with goods income (counterfactual): more service jobs, less unemployment', () => {
    const base = makeSim('emp-1', 96, (c) => { c.settings.startEra = 10; });
    base.runYears(2);
    const A = clone(base), B = clone(base);
    for (const s of B.w.settlements.values()) s.goodsPerCap = 12; // richer households buy more services
    for (const s of A.w.settlements.values()) s.goodsPerCap = 0.5;
    A.runTicks(10); B.runTicks(10); // one monthly cycle for every settlement
    let sa = 0, sb = 0, ua = 0, ub = 0;
    for (const s of A.w.settlements.values()) { sa += s.employment[SECTOR.SERVICES]; ua += s.employment[SECTOR.UNEMPLOYED]; }
    for (const s of B.w.settlements.values()) { sb += s.employment[SECTOR.SERVICES]; ub += s.employment[SECTOR.UNEMPLOYED]; }
    expect(sb).toBeGreaterThan(sa);
    expect(ub).toBeLessThanOrEqual(ua);
  }, 120000);

  it('developed starts are sized to and laid out with the farmland that feeds them', () => {
    let fed = 0, total = 0;
    for (const seed of ['fed-1', 'fed-2']) {
      const sim = makeSim(seed, 96, (c) => { c.settings.startEra = 10; });
      for (const c of sim.w.civs.values()) {
        if (!c.settlements.length) continue;
        const bonus = Math.max(0, c.caps.farming - 1) + c.caps.biotech * 0.4 + c.caps.irrigation * 0.15;
        let cap = 0, pop = 0;
        for (const sid of c.settlements) { const s = sim.w.settlements.get(sid)!; const st = getSites(sim, s); cap += st.farmPot * BALANCE.farmYield * (1 + bonus) + st.forage; pop += s.pop; }
        total++;
        if (cap >= pop * BALANCE.foodNeedPerCapita * 0.95) fed++;
      }
    }
    // most nations start fed; a few on infertile land legitimately cannot be
    expect(fed / total).toBeGreaterThanOrEqual(0.7);
  }, 120000);

  it('storage losses are not counted as (negative) inventory investment', () => {
    const sim = makeSim('emp-3', 64, (c) => { c.settings.startEra = 10; });
    const civ = [...sim.w.civs.values()].find((c) => c.alive && c.settlements.length)!;
    // no production or use this "year": only spoilage changes the stock
    for (const k of ['prod', 'use', 'want'] as const) civ.acc[k].fill(0);
    civ.acc.cons = 0; civ.acc.inv = 0; civ.acc.services = 0;
    civ.prevStock = civ.stock.slice();
    const food0 = civ.stock[0];
    civEconomyYearly(sim, civ, 0, 0);
    expect(civ.stock[0]).toBeLessThan(food0); // spoilage happened
    expect(Math.abs(civ.econ.investment)).toBeLessThan(1e-6); // but ΔInventories excludes it
    expect(civ.econ.gdp).toBeGreaterThan(-1e-6);
  });
});
