/**
 * Statistical multi-seed run: same config, N seeds, Y years. Reports the
 * distribution of outcomes so balance claims rest on many histories, not one.
 *   npx tsx scripts/multi-seed.ts [seeds=8] [years=600] [size=96]
 */
import { defaultConfig } from '../src/config/laws';
import { createSimulation } from '../src/sim/bootstrap';
import { ERA_NAMES } from '../src/technology/techData';
import { boundaryPopulation, ledgerNet, emptyLedger } from '../src/population/ledger';

const N = Number(process.argv[2] ?? 8);
const YEARS = Number(process.argv[3] ?? 600);
const SIZE = Number(process.argv[4] ?? 96);
const rows: Record<string, number>[] = [];
for (let k = 0; k < N; k++) {
  const cfg = defaultConfig();
  cfg.gen.seed = `ms-${k}`;
  cfg.gen.width = SIZE;
  cfg.gen.height = SIZE;
  const sim = createSimulation(cfg);
  const pop0 = boundaryPopulation(sim);
  const led0 = { ...(sim.w.popLedger ?? emptyLedger()) };
  const t0 = performance.now();
  let agriYear = -1;
  for (let y = 0; y < YEARS; y++) {
    sim.runYears(1);
    if (agriYear < 0 && [...sim.w.civs.values()].some((c) => c.alive && c.era >= 2)) agriYear = sim.year;
  }
  const civs = [...sim.w.civs.values()];
  const wars = [...sim.w.wars.values()];
  const ended = wars.filter((w) => w.end !== undefined);
  const annex = sim.w.events.filter((e) => e.type === 'civ_fell' || /annex/i.test(e.title)).length;
  let pop = 0;
  for (const s of sim.w.settlements.values()) pop += s.pop;
  const r = {
    seed: k,
    maxEra: Math.max(0, ...civs.filter((c) => c.alive).map((c) => c.era)),
    agriYear,
    alive: civs.filter((c) => c.alive).length,
    fallen: civs.filter((c) => !c.alive).length,
    wars: wars.length,
    warsEnded: ended.length,
    annexEvents: annex,
    religions: sim.w.religions.size,
    pop: Math.round(pop),
    notables: [...sim.w.persons.values()].filter((p) => p.notable).length,
    msPerYear: +((performance.now() - t0) / YEARS).toFixed(1),
    // invariants (1 = holds)
    ledgerOk: Math.abs(boundaryPopulation(sim) - pop0 - ledgerNet(led0, sim.w.popLedger ?? emptyLedger())) <= 1e-6 * Math.max(1, boundaryPopulation(sim)) ? 1 : 0,
    finiteOk: civs.every((c) => Object.values(c.econ).every((v) => typeof v !== 'number' || Number.isFinite(v)) && c.stock.every((v) => Number.isFinite(v) && v >= -1e-6)) ? 1 : 0,
    gdpOk: civs.filter((c) => c.alive).every((c) => { const e = c.econ; return Math.abs(e.consumption + e.investment + e.government + e.exports - e.imports - e.gdp) <= 1e-6 * Math.max(1, Math.abs(e.gdp)); }) ? 1 : 0,
  };
  rows.push(r);
  console.log(JSON.stringify(r));
}
const keys = Object.keys(rows[0]).filter((k) => k !== 'seed');
console.log('\nmetric          min      median   max');
for (const k of keys) {
  const v = rows.map((r) => r[k]).sort((a, b) => a - b);
  console.log(k.padEnd(14), String(v[0]).padStart(8), String(v[Math.floor(v.length / 2)]).padStart(8), String(v[v.length - 1]).padStart(8));
}
const eras = rows.map((r) => ERA_NAMES[r.maxEra]);
console.log('\nhighest era per seed:', eras.join(', '));
