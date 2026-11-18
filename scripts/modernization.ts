/**
 * Natural-history run with NO god powers: does civilization modernize on its own, and do natural
 * hazards happen during ordinary ticks?
 *   npx tsx scripts/modernization.ts [seed=modern-1] [years=1000] [size=128] [preset=default|realistic]
 * Prints the year the leading nation first reaches each era, modernization indicators of the most
 * advanced nation every 100 years, and natural-hazard counts.
 */
import { defaultConfig, PRESETS } from '../src/config/laws';
import { createSimulation } from '../src/sim/bootstrap';
import { ERA_NAMES } from '../src/technology/techData';
import { SECTOR } from '../src/civilizations/buildings';
import { boundaryPopulation } from '../src/population/ledger';

const seed = process.argv[2] ?? 'modern-1';
const YEARS = Number(process.argv[3] ?? 1000);
const SIZE = Number(process.argv[4] ?? 128);
const preset = process.argv[5] ?? 'default';
const cfg = defaultConfig();
if (preset !== 'default') PRESETS.find((p) => p.key === preset)?.apply(cfg);
cfg.gen.seed = seed;
cfg.gen.width = SIZE;
cfg.gen.height = SIZE;
const sim = createSimulation(cfg);
const firstEra = new Map<number, number>();
const lines: string[] = [];
let droughtCellYears = 0;
const t0 = performance.now();
for (let y = 1; y <= YEARS; y++) {
  sim.runYears(1);
  const alive = [...sim.w.civs.values()].filter((c) => c.alive && c.settlements.length);
  const top = alive.sort((a, b) => b.era - a.era || b.population - a.population)[0];
  if (top) for (let e = 1; e <= top.era; e++) if (!firstEra.has(e)) firstEra.set(e, sim.year);
  droughtCellYears += sim.w.climate.rain.filter((r) => r < -0.5).length;
  if (top && y % 100 === 0) {
    let pop = 0, urban = 0, emp = new Array(7).fill(0), life = 0;
    for (const sid of top.settlements) {
      const s = sim.w.settlements.get(sid);
      if (!s) continue;
      pop += s.pop;
      if (s.pop >= 20000) urban += s.pop;
      s.employment.forEach((v, k) => (emp[k] += v));
      life += s.health * s.pop;
    }
    const wf = emp.reduce((a, b) => a + b, 0) || 1;
    lines.push(`  year ${String(sim.year).padStart(4)} · ${ERA_NAMES[top.era].padEnd(26)} pop ${String(Math.round(pop)).padStart(9)} · urban ${(100 * urban / Math.max(1, pop)).toFixed(0).padStart(3)}% · literacy ${top.caps.literacy.toFixed(2)} · electrification ${top.caps.electrification.toFixed(2)} · life-exp index ${(life / Math.max(1, pop)).toFixed(2)} · agri ${(100 * emp[SECTOR.FOOD] / wf).toFixed(0)}% industry ${(100 * emp[SECTOR.INDUSTRY] / wf).toFixed(0)}% services ${(100 * emp[SECTOR.SERVICES] / wf).toFixed(0)}% unemployed ${(100 * emp[SECTOR.UNEMPLOYED] / wf).toFixed(0)}% · GDP/cap ${top.econ.gdpPerCapita.toFixed(2)}`);
  }
}
const ev = sim.w.events;
const natural = ev.filter((e) => e.type === 'disaster' && !e.causes?.length);
const byKind: Record<string, number> = {};
for (const e of natural) { const k = e.title.split(' ').slice(0, 3).join(' '); byKind[k] = (byKind[k] ?? 0) + 1; }
const divine = sim.w.interventions.length;
console.log(`seed ${seed} · ${SIZE}² · preset ${preset} · ${YEARS} years · ${((performance.now() - t0) / 1000).toFixed(0)} s · world population ${Math.round(boundaryPopulation(sim)).toLocaleString('en-US')} · god-power interventions: ${divine}`);
console.log('first year the leading nation reached each era:');
console.log('  ' + [...firstEra.entries()].map(([e, y]) => `${ERA_NAMES[e]} ${y}`).join(' → '));
console.log('most advanced nation, every 100 years:');
console.log(lines.join('\n'));
console.log(`natural hazards (no intervention): ${natural.length} logged disasters ${JSON.stringify(byKind)}; ${Math.round(sim.w.popLedger?.disaster ?? 0).toLocaleString('en-US')} disaster deaths; ${ev.filter((e) => e.type === 'epidemic').length} deadly epidemics; ${droughtCellYears} drought cell-years; ${ev.filter((e) => e.type === 'sea_level').length} sea-level events; climate anomaly ${sim.w.climate.anomaly.toFixed(2)}°C`);
