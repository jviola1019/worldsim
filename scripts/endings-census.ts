/**
 * How often each ending and catastrophe actually happens in natural worlds (no god powers).
 *   npx tsx scripts/endings-census.ts [seeds=10] [years=600] [size=96] [startEra=1]
 * Prints the measured counts; the docs quote these numbers only.
 */
import { makeSim } from '../tests/helpers';
const N = Number(process.argv[2] ?? 10), Y = Number(process.argv[3] ?? 600), SIZE = Number(process.argv[4] ?? 96), ERA = Number(process.argv[5] ?? 1);
const endings: Record<string, number> = {}, cats: Record<string, number> = {};
let fallen = 0, founded = 0, nukes = 0, aiIncidents = 0;
const t0 = performance.now();
for (let k = 0; k < N; k++) {
  const sim = makeSim('census-' + k, SIZE, (c) => { c.settings.startEra = ERA; });
  sim.runYears(Y);
  for (const c of sim.w.civs.values()) {
    founded++;
    if (!c.alive) { fallen++; const t = c.ending?.type ?? 'unrecorded'; endings[t] = (endings[t] ?? 0) + 1; }
  }
  for (const e of sim.w.endings?.log ?? []) cats[e.type] = (cats[e.type] ?? 0) + 1;
  nukes += sim.w.events.filter((e) => /nuclear (strike|exchange)|warheads/i.test(e.title)).length;
  aiIncidents += sim.w.events.filter((e) => e.type === 'ai_incident').length;
}
console.log(`${N} worlds x ${Y} years (${SIZE}², start era ${ERA}) in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
console.log(`nations founded ${founded}, fallen ${fallen}`);
console.log('endings:', JSON.stringify(Object.fromEntries(Object.entries(endings).sort((a, b) => b[1] - a[1]))));
console.log('catastrophes:', JSON.stringify(cats));
console.log(`nuclear-use events ${nukes}, AI incidents ${aiIncidents}`);
