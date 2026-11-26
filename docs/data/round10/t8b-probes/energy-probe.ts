/**
 * Task 8d probe: electricity in Space Race world 1, sampled mid-year at years 9.5, 19.5 and 29.5: energy made, used and
 * wanted per nation, chip fabs and their output, rare metals and machinery.
 *   npx tsx docs/data/round10/t8b-probes/energy-probe.ts
 */
import { configFor } from '../../../../scripts/mode-audit';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { B } from '../../../../src/civilizations/buildingTypes';
import { Good } from '../../../../src/world/resources';
const sim = createSimulation(configFor('space_race', 'audit-space_race-1'));
const w = sim.w;
for (let y = 1; y <= 30; y++) {
  // sample mid-year accumulators: step half a year
  sim.runTicks(60);
  if (y % 10 === 0) {
    console.log(`y${y - 0.5}`);
    for (const c of w.civs.values()) {
      if (!c.alive) continue;
      const towns = c.settlements.map((id) => w.settlements.get(id)!).filter(Boolean);
      const fabs = towns.reduce((a, s) => a + s.bld[B.CHIP_FAB], 0);
      const fabJobs = towns.reduce((a, s) => a + (s.bld[B.CHIP_FAB] > 0 ? 1 : 0), 0);
      console.log(`  ${c.name.padEnd(24)} fabs ${fabs} in ${fabJobs} towns · energy prod ${Math.round(c.acc.prod[Good.ENERGY])} use ${Math.round(c.acc.use[Good.ENERGY])} want ${Math.round(c.acc.want[Good.ENERGY])} · elec prod ${Math.round(c.acc.prod[Good.ELECTRONICS])} want ${Math.round(c.acc.want[Good.ELECTRONICS])} · rare ${Math.round(c.stock[Good.RARE])} mach ${Math.round(c.stock[Good.MACHINERY])} · electrification ${c.caps.electrification.toFixed(2)}`);
    }
  }
  sim.runTicks(60);
}
