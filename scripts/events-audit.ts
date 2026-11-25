/**
 * Round 10 addendum: events audit. "Realistic mode should include all technically possible scenarios and events"
 * (owner). Runs developed worlds under Realistic rules (the Realistic preset: real world only, every
 * science-based technology, natural disaster rates, Slow pace) and counts every event type, catastrophe and civ
 * ending that happens, so the docs can say which real-world events occur, how often, and which never did.
 *
 *   npx tsx scripts/events-audit.ts [worlds=6] [years=300] [size=96] [startEra=10]
 *   CHECKPOINT=<dir> saves each world every 100 years and resumes after a restart.
 *
 * Rates are per world-year. A world map is a continent-scale region, so natural-disaster counts are compared
 * with whole-Earth figures only as orders of magnitude (docs/data/round10/research-notes.md §3).
 */
import { defaultConfig, PRESETS } from '../src/config/laws';
import { createSimulation } from '../src/sim/bootstrap';
import { ENDINGS } from '../src/civilizations/endings';
import { ERA_NAMES } from '../src/technology/techData';
import type { Simulation } from '../src/sim/simulation';
import { saveCheckpoint, loadCheckpoint } from './lib/checkpoint';

const WORLDS = Number(process.argv[2] ?? 6);
const YEARS = Number(process.argv[3] ?? 300);
const SIZE = Number(process.argv[4] ?? 96);
const START_ERA = Number(process.argv[5] ?? 10);

interface Acc { y: number; events: Record<string, number>; disasters: Record<string, number>; maxEra: number }
const total: Record<string, number> = {};
const disastersTotal: Record<string, number> = {};
const catastrophes: Record<string, number> = {};
const endings: Record<string, number> = {};
const worldLines: string[] = [];

for (let k = 0; k < WORLDS; k++) {
  const seed = `events-${k}`;
  const ckPath = process.env.CHECKPOINT ? `${process.env.CHECKPOINT}/events-${seed}-${SIZE}-${START_ERA}.bin` : '';
  const ck = ckPath ? loadCheckpoint<Acc>(ckPath) : null;
  let sim: Simulation;
  if (ck) { sim = ck.sim; console.error(`resumed ${seed} at year ${ck.extra.y}`); }
  else {
    const c = defaultConfig();
    PRESETS.find((p) => p.key === 'realistic')!.apply(c);
    c.name = 'Events audit';
    c.gen.seed = seed;
    c.gen.width = SIZE;
    c.gen.height = SIZE;
    c.settings.startEra = START_ERA;
    c.settings.startCivs = 6;
    sim = createSimulation(c);
  }
  const acc: Acc = ck?.extra ?? { y: 0, events: {}, disasters: {}, maxEra: START_ERA };
  const off = sim.onEvent((e) => {
    acc.events[e.type] = (acc.events[e.type] ?? 0) + 1;
    if (e.type === 'disaster' && !e.causes?.length) {
      const kind = e.title.split(' ').slice(0, 3).join(' ');
      acc.disasters[kind] = (acc.disasters[kind] ?? 0) + 1;
    }
  });
  for (let y = acc.y + 1; y <= YEARS; y++) {
    sim.runYears(1);
    acc.y = y;
    for (const c of sim.w.civs.values()) if (c.alive) acc.maxEra = Math.max(acc.maxEra, c.era);
    if (ckPath && y % 100 === 0 && y < YEARS) saveCheckpoint(ckPath, sim, acc);
  }
  off();
  for (const [t, n] of Object.entries(acc.events)) total[t] = (total[t] ?? 0) + n;
  for (const [t, n] of Object.entries(acc.disasters)) disastersTotal[t] = (disastersTotal[t] ?? 0) + n;
  for (const l of sim.w.endings?.log ?? []) catastrophes[l.type] = (catastrophes[l.type] ?? 0) + 1;
  for (const c of sim.w.civs.values()) if (c.ending) endings[c.ending.type] = (endings[c.ending.type] ?? 0) + 1;
  const alive = [...sim.w.civs.values()].filter((c) => c.alive && c.settlements.length).length;
  worldLines.push(`  ${seed}: highest era ${ERA_NAMES[acc.maxEra]} · nations alive ${alive} · monsters ${sim.w.monsters.size} · events ${Object.values(acc.events).reduce((a, b) => a + b, 0)}`);
  console.error(`world ${seed} done`);
}

const yrs = WORLDS * YEARS;
const fmt = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([t, n]) => `  ${t.padEnd(28)} ${String(n).padStart(6)}   ${(n / yrs).toFixed(4)} per world-year`).join('\n');
console.log(`events audit · ${WORLDS} worlds × ${YEARS} years · ${SIZE}² · Realistic rules from era ${START_ERA} (${ERA_NAMES[START_ERA]}) with 6 nations`);
console.log(worldLines.join('\n'));
console.log('\nnatural disasters (no human cause), by kind:');
console.log(fmt(disastersTotal) || '  none');
console.log('\ncatastrophes logged (world/endings log; the log keeps the last 200 per world):');
console.log(fmt(catastrophes) || '  none');
console.log('\nhow nations ended:');
console.log(fmt(endings) || '  none');
const fictional = Object.keys(endings).filter((t) => ENDINGS[t as keyof typeof ENDINGS] && !ENDINGS[t as keyof typeof ENDINGS].realistic);
console.log(`\nfictional endings: ${fictional.length ? fictional.join(', ') : 'none'}`);
const never = Object.entries(ENDINGS).filter(([t, e]) => e.realistic && !endings[t] && !catastrophes[t]).map(([t]) => t);
console.log(`realistic endings that did not occur in these worlds (possible, not observed): ${never.join(', ') || 'none'}`);
console.log('\nall event types:');
console.log(fmt(total));
