/**
 * Headless simulation runner: prints a world summary every N years.
 *   npx tsx scripts/run-sim.ts [seed] [years] [size] [startEra] [civs]
 */
import { createSimulation } from '../src/sim/bootstrap';
import { defaultConfig } from '../src/config/laws';
import { ERA_NAMES } from '../src/technology/techData';

const seed = process.argv[2] ?? 'run1';
const years = Number(process.argv[3] ?? 300);
const size = Number(process.argv[4] ?? 128);
const era = Number(process.argv[5] ?? 1);
const civs = Number(process.argv[6] ?? 5);
const cfg = defaultConfig();
cfg.name = 'Headless';
cfg.gen.seed = seed;
cfg.gen.width = size;
cfg.gen.height = size;
cfg.settings.startEra = era;
cfg.settings.startCivs = civs;
const t0 = performance.now();
const sim = createSimulation(cfg);
console.log(`created in ${(performance.now() - t0).toFixed(0)}ms`);
const every = Number(process.env.EVERY ?? 25);
let tPrev = performance.now();
for (let y = 0; y < years; y += every) {
  sim.runYears(every);
  const w = sim.w;
  const alive = [...w.civs.values()].filter((c) => c.alive);
  const pop = alive.reduce((a, c) => a + c.population, 0) + [...w.bands.values()].reduce((a, b) => a + b.members.length, 0);
  const maxEra = Math.max(0, ...alive.map((c) => c.era));
  const wars = [...w.wars.values()].filter((x) => !x.end).length;
  const dt = performance.now() - tPrev;
  tPrev = performance.now();
  console.log(`y${sim.year} pop=${Math.round(pop)} civs=${alive.length} settle=${w.settlements.size} bands=${w.bands.size} herds=${w.herds.size} persons=${w.persons.size} maxEra=${maxEra}(${ERA_NAMES[maxEra]}) wars=${wars} rel=${w.religions.size} events=${w.events.length} ${(dt / every).toFixed(1)}ms/yr`);
  if (process.env.CIVS) for (const c of alive.slice(0, 8)) console.log(`   ${c.name} pop=${Math.round(c.population)} s=${c.settlements.length} era=${c.era} tech=${c.techScore.toFixed(1)} rp=${c.researchRate.toFixed(1)} gdp=${c.econ.gdp.toFixed(0)} ls=${c.econ.livingStandard.toFixed(2)} gov=${c.govForm} stab=${c.stability.toFixed(2)} target=${c.researchTarget}`);
}
if (process.env.EVENTS) for (const e of sim.w.events.filter((e) => e.importance >= Number(process.env.EVENTS)).slice(-60)) console.log(`  [${e.year}] ${e.title}`);
