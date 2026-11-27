/**
 * Integration scenarios #3, #5, #8 and #10 from the original specification ("Integration tests":
 * 3 education → technology, 5 electricity → dependent industries, 8 trade interruption → dependent
 * cities, 10 advanced technology gated by prerequisites / credible transfer). Counterfactual method:
 * identical clones (asserted identical), one intervention, compare.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { BALANCE } from '../../src/config/balance';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import { makeTreaty } from '../../src/politics/diplomacy';
import { GOODS, Good } from '../../src/world/resources';
import { TECHS, TECH_BY_ID } from '../../src/technology/techData';
import { grantTech, researchYearly } from '../../src/technology/research';
import type { Civ } from '../../src/sim/types';
import { BUILDINGS } from '../../src/civilizations/buildings';

const clone = (s: Simulation) => { s.syncRng(); return new Simulation(decodeWorld(encodeWorld(s.w))); };


/**
 * Round 10 addendum: power plants draw fuel AFTER this month's mining. They used to draw it before (production.ts ran
 * energy, then extraction), so industries running after the mines took every new tonne of coal and a nation could own
 * dozens of idle fossil plants while mining coal every month (found when #5 below failed after the round's history
 * changes: 49-77 plants, zero energy for over a year).
 */
describe('fuel order', () => {
  it('a nation that mines coal runs the fossil plants it owns', () => {
    // task 5 (mature ecosystems) changed every world's history: on 'int-elec' the chosen nation now has 44 fossil plants
    // but no coal in reach (a scenario precondition, not the fuel order). Re-measured over four worlds: every nation that
    // mines coal and owns plants must make energy, and at least two of the four must meet both preconditions.
    // task 8 part C (seal seeding changed every natural world's history): 1 of those four met both preconditions, so the
    // check now runs eight worlds (4 of 8 met them when re-measured; docs/data/round10/t8c-probes/fuel.ts)
    let met = 0;
    for (const seed of ['int-elec', 'int-elec-1', 'int-elec-2', 'int-elec-3', 'int-elec-4', 'int-elec-5', 'int-elec-6', 'int-elec-7']) {
      const base = makeSim(seed, 96, (c) => { c.settings.startEra = 7; });
      base.runYears(2);
      const civ = [...base.w.civs.values()].find((c) => c.alive && c.settlements.length && c.caps.electrification === 0 && !c.techs.electric_power?.known);
      if (!civ) continue;
      const need = (t: string): void => { for (const p of TECH_BY_ID.get(t)!.prereqs) need(p); if (!civ.techs[t]?.known) grantTech(base, civ, t, 'god'); };
      need('electric_power');
      base.runYears(13);
      let plants = 0, coal = 0, energy = 0;
      for (let mo = 0; mo < 12; mo++) {
        base.runTicks(10);
        coal += civ.acc.prod[Good.COAL] ?? 0;
        energy += civ.acc.prod[Good.ENERGY] ?? 0;
      }
      for (const sid of civ.settlements) plants += base.w.settlements.get(sid)?.bld[BUILDINGS.findIndex((b) => b?.key === 'POWER_FOSSIL')] ?? 0;
      if (plants <= 0 || coal <= 0) continue;
      met++;
      expect(energy, seed).toBeGreaterThan(0);
    }
    expect(met, 'worlds with a coal-mining nation that owns fossil plants').toBeGreaterThanOrEqual(2);
  }, 900000);
});
