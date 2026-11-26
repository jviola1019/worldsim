/**
 * Task 8d probe: in Space Race (start era 10 since this plan), when do the station and the colony happen?
 * Runs the mode-audit's own Space Race worlds well past the audit horizon and logs the first year of each space
 * milestone, of the two techs the objectives depend on (space_stations, era 11; offworld_settlement, era 14), and the
 * leading era and world population every 50 years.
 *   npx tsx docs/data/round10/t8b-probes/space-probe.ts [seeds=6] [years=450]
 * CHECKPOINT=<dir> saves every 50 years and resumes after a restart (identical history).
 */
import { configFor } from '../../../../scripts/mode-audit';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { saveCheckpoint, loadCheckpoint, checkpointPath } from '../../../../scripts/lib/checkpoint';
import { boundaryPopulation } from '../../../../src/population/ledger';

const n = Number(process.argv[2] ?? 6);
const years = Number(process.argv[3] ?? 450);
const TECHS = ['rocketry', 'satellites', 'crewed_spaceflight', 'space_stations', 'reusable_rockets', 'orbital_industry', 'closed_ecosystems', 'fusion_power', 'offworld_settlement'];
type Acc = { y: number; first: Record<string, number>; lines: string[] };

for (let k = 0; k < n; k++) {
  const seed = `audit-space_race-${k}`;
  const ckPath = process.env.CHECKPOINT ? checkpointPath(process.env.CHECKPOINT, 'space', [seed, `${years}y`]) : '';
  const ck = ckPath ? loadCheckpoint<Acc>(ckPath) : null;
  const sim = ck ? ck.sim : createSimulation(configFor('space_race', seed));
  const y0 = sim.w.meta.startYear;
  const acc: Acc = ck?.extra ?? { y: 0, first: {}, lines: [] };
  if (ck) console.error(`resumed ${seed} at year ${acc.y}`);
  for (let y = acc.y + 1; y <= years; y++) {
    sim.runYears(1);
    const civs = [...sim.w.civs.values()].filter((c) => c.alive);
    for (const t of TECHS) if (acc.first[t] === undefined && civs.some((c) => c.techs[t]?.known)) acc.first[t] = y;
    for (const [key, yr] of Object.entries(sim.w.milestones)) if (key.startsWith('space:') && acc.first[key] === undefined) acc.first[key] = (yr as number) - y0;
    if (acc.first.colonyObjective === undefined && sim.w.colonies.size > 0) acc.first.colonyObjective = y;
    if (acc.first.stationObjective === undefined && civs.some((c) => c.space.stations > 0)) acc.first.stationObjective = y;
    if (y % 50 === 0) {
      const top = civs.sort((a, b) => b.era - a.era || b.techScore - a.techScore)[0];
      acc.lines.push(`  y${y}: leader era ${top?.era} (${Math.round(top?.population ?? 0).toLocaleString('en-US')} people, rp ${top?.researchRate.toFixed(0)}), world ${Math.round(boundaryPopulation(sim)).toLocaleString('en-US')}, eras ${civs.map((c) => c.era).join(',')}`);
      acc.y = y;
      if (ckPath) saveCheckpoint(ckPath, sim, acc);
    }
  }
  console.log(`seed ${k}:`);
  console.log(`  first year: ${Object.entries(acc.first).sort((a, b) => a[1] - b[1]).map(([key, v]) => `${key} ${v}`).join(' · ')}`);
  for (const l of acc.lines) console.log(l);
}
