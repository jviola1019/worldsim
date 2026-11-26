/**
 * Task 8d probe: what holds back the first launch in Space Race worlds where rocketry is known from year 1?
 * Every 10 years, per nation: space tier, rocketry adoption, spaceport present, largest city, GDP, the yearly
 * space budget against the launch cost (space.ts), and stocks of the spaceport's inputs.
 *   npx tsx docs/data/round10/t8b-probes/space-gate-probe.ts <seed index> [years=210]
 */
import { configFor } from '../../../../scripts/mode-audit';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { B } from '../../../../src/civilizations/buildingTypes';
import { Good } from '../../../../src/world/resources';

const k = Number(process.argv[2] ?? 1);
const years = Number(process.argv[3] ?? 210);
const sim = createSimulation(configFor('space_race', `audit-space_race-${k}`));
const w = sim.w;
for (let y = 0; y <= years; y++) {
  if (y) sim.runYears(1);
  if (y % 10) continue;
  console.log(`y${y}:`);
  for (const c of w.civs.values()) {
    if (!c.alive) continue;
    const towns = c.settlements.map((id) => w.settlements.get(id)!).filter(Boolean);
    const port = towns.some((s) => s.bld[B.SPACEPORT] > 0);
    const big = towns.reduce((a, s) => (s.pop > a.pop ? s : a), towns[0]);
    const inv = Math.min(1, Math.max(0, 0.002 + c.personality.science * 0.004 + (c.caps.spaceTier >= 4 ? 0.004 : 0)));
    const launchCost = 2000 / (1 + c.caps.orbitalIndustry + (c.techs['reusable_rockets']?.adoption ?? 0) * 4);
    const queued = towns.some((s) => s.construction?.type === B.SPACEPORT);
    console.log(`  ${c.name.padEnd(14)} tier ${c.caps.spaceTier} rocketry ${(c.techs.rocketry?.adoption ?? 0).toFixed(2)} port ${port ? 'yes' : 'no '}${queued ? ' (queued)' : ''} · largest ${Math.round(big?.pop ?? 0)} · gdp ${Math.round(c.econ.gdp)} · budget ${Math.round(c.econ.gdp * inv)} vs launch ${Math.round(launchCost)} · stock metal ${Math.round(c.stock[Good.METAL])} mach ${Math.round(c.stock[Good.MACHINERY])} elec ${Math.round(c.stock[Good.ELECTRONICS])} · launches ${c.space.launches}`);
  }
}
