/**
 * Task 8d probe: electronics supply in Space Race world <k> (default 1) every 5 years for 40 years: chip fabs, electronics
 * made/used/wanted, stocks, rare metals, space tier and any spaceport project.
 *   npx tsx docs/data/round10/t8b-probes/electronics-probe.ts [seed index=1]
 */
import { configFor } from '../../../../scripts/mode-audit';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { B } from '../../../../src/civilizations/buildingTypes';
import { Good } from '../../../../src/world/resources';
const k = Number(process.argv[2] ?? 1);
const sim = createSimulation(configFor('space_race', `audit-space_race-${k}`));
const w = sim.w;
for (let y = 1; y <= 40; y++) {
  sim.runYears(1);
  if (y % 5) continue;
  console.log(`y${y}`);
  for (const c of w.civs.values()) {
    if (!c.alive) continue;
    const towns = c.settlements.map((id) => w.settlements.get(id)!).filter(Boolean);
    const fabs = towns.reduce((a, s) => a + s.bld[B.CHIP_FAB], 0);
    const cons = towns.filter((s) => s.construction).map((s) => s.construction!.type);
    const portJob = towns.find((s) => s.construction?.type === B.SPACEPORT)?.construction;
    console.log(`  ${c.name.padEnd(24)} pop ${Math.round(c.population)} computing ${c.caps.computing.toFixed(2)} fabs ${fabs} elec prod ${Math.round(c.acc.prod[Good.ELECTRONICS])} use ${Math.round(c.acc.use[Good.ELECTRONICS])} want ${Math.round(c.acc.want[Good.ELECTRONICS])} stock ${Math.round(c.stock[Good.ELECTRONICS])} rare ${Math.round(c.stock[Good.RARE])} access rare ${c.access[Good.RARE].toFixed(2)} · tier ${c.caps.spaceTier} port job ${portJob ? `elec need ${Math.round(portJob.need[Good.ELECTRONICS])} labor ${Math.round(portJob.labor)}` : '-'} · projects ${cons.length}`);
  }
}
