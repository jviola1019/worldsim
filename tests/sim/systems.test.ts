import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { POWERS, applyPower } from '../../src/powers/powers';

describe('long-run invariants (stress)', () => {
  const sim = makeSim('stress-1', 96);
  sim.runYears(300);

  it('population, entities and logs stay bounded and finite', () => {
    let pop = 0;
    for (const s of sim.w.settlements.values()) {
      expect(Number.isFinite(s.pop)).toBe(true);
      expect(s.pop).toBeGreaterThanOrEqual(0);
      pop += s.pop;
    }
    expect(pop).toBeLessThan(5e7);
    expect(sim.w.herds.size).toBeLessThan(2000);
    expect(sim.w.persons.size).toBeLessThan(50000);
  });

  it('civilizations formed and history was recorded', () => {
    expect(sim.w.civs.size).toBeGreaterThan(0);
    expect(sim.w.events.length).toBeGreaterThan(10);
  });

  it('GDP equals C + I + G + NX (expenditure identity)', () => {
    for (const c of sim.w.civs.values()) {
      if (!c.alive || c.econ.gdp === 0) continue;
      const e = c.econ;
      const sum = e.consumption + e.investment + e.government + e.exports - e.imports;
      expect(Math.abs(sum - e.gdp)).toBeLessThan(1e-6 * Math.max(1, Math.abs(e.gdp)) + 1e-6);
    }
  });

  it('tiles owned by a civ belong to a living civ or are cleared', () => {
    const m = sim.w.map;
    let bad = 0;
    for (let i = 0; i < m.n; i++) {
      const o = m.owner[i];
      if (o && !sim.w.civs.get(o)?.alive) bad++;
    }
    expect(bad).toBe(0);
  });
}, 180000);

describe('god powers', () => {
  it('every power applies to a land tile without throwing', () => {
    const sim = makeSim('powers-1');
    const m = sim.w.map;
    let land = 0;
    for (let i = 0; i < m.n; i++) if (m.isLand(i)) { land = i; break; }
    const civ = [...sim.w.civs.values()][0];
    for (const p of POWERS) {
      expect(() => applyPower(sim, p.id, m.xOf(land), m.yOf(land), 2, { selectedCiv: civ?.id ?? 0 })).not.toThrow();
    }
    expect(() => sim.runYears(2)).not.toThrow();
  }, 60000);
});

import { decodeTerritory, TERRITORY_EVERY } from '../../src/history/stats';
describe('historical territory snapshots', () => {
  it('are recorded every 25 years, decode to the owner map, and stay bounded', () => {
    const sim = makeSim('terr-1', 64);
    sim.runYears(TERRITORY_EVERY * 3 + 1);
    const list = sim.w.stats.territory ?? [];
    expect(list.length).toBeGreaterThanOrEqual(3);
    for (const t of list) expect(t.year % TERRITORY_EVERY).toBe(0);
    const last = list[list.length - 1];
    const grid = decodeTerritory(last);
    expect(grid.length).toBe(last.w * last.h);
    expect(last.rle.filter((_, k) => k % 2 === 1).reduce((a, b) => a + b, 0)).toBe(last.w * last.h);
  }, 60000);
});

import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
describe('national accounts: price changes are not inventory investment (review finding)', () => {
  it('ΔInventories values quantity changes only: inflating last year\'s prices does not change it', () => {
    const base = makeSim('gdp-1', 64);
    base.runYears(40);
    base.syncRng();
    const A = new Simulation(decodeWorld(encodeWorld(base.w)));
    const B = new Simulation(decodeWorld(encodeWorld(base.w)));
    const id = [...A.w.civs.values()].find((c) => c.alive && c.prevStock)!.id;
    // in B, prices were 3x higher at the last accounting; quantities are identical
    const cb = B.w.civs.get(id)!;
    cb.prevStockValue = (cb.prevStockValue ?? 0) * 3;
    const ca = A.w.civs.get(id)!;
    // advance both to just past this civ's next yearly accounting
    for (let k = 0; k < 120; k++) { A.step(); B.step(); }
    expect(cb.econ.investment).toBeCloseTo(ca.econ.investment, 6);
    expect(cb.econ.gdp).toBeCloseTo(ca.econ.gdp, 6);
  }, 60000);
});
