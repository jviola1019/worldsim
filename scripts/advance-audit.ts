/**
 * Round 10 second addendum (Task 8f): do developed starts advance? Runs a start (god | realistic) from a start era
 * for its horizon (150 years at Standard pace, 300 at Slow) and reports the first year the leading nation passes
 * its start era, the share of nations that gain an era, and where research stands every 50 years.
 *   npx tsx scripts/advance-audit.ts <god|realistic> <era> [worlds=6] [size=128] [years=horizon]
 * CHECKPOINT=<dir> saves every 50 years and resumes after a restart (identical history).
 */
import { defaultConfig, presetByKey, eraPeopleDefault } from '../src/config/laws';
import { createSimulation } from '../src/sim/bootstrap';
import { TECHS, TECH_BY_ID, ERA_NAMES } from '../src/technology/techData';
import { effCost, techAvailable } from '../src/technology/research';
import { Good, type GoodKey } from '../src/world/resources';
import { boundaryPopulation } from '../src/population/ledger';
import type { Simulation } from '../src/sim/simulation';
import type { Civ } from '../src/sim/types';
import { saveCheckpoint, loadCheckpoint, checkpointPath } from './lib/checkpoint';

const start = (process.argv[2] ?? 'god') as 'god' | 'realistic';
const ERA = Number(process.argv[3] ?? 4);
const WORLDS = Number(process.argv[4] ?? 6);
const SIZE = Number(process.argv[5] ?? 128);

const eraTotal = new Array(16).fill(0);
for (const t of TECHS) eraTotal[t.era]++;
const need = (e: number) => Math.max(2, Math.ceil(eraTotal[e] * 0.35));

function blockers(civ: Civ, era: number): string {
  // techs of `era` that are known but not adopted to 0.5, and why (missing resource access)
  const out: string[] = [];
  for (const t of TECHS) {
    if (t.era !== era) continue;
    const st = civ.techs[t.id];
    if (!st?.known || st.adoption >= 0.5) continue;
    const r = t.requires;
    const miss = [...(r?.resources ?? []).filter((g) => (civ.access[Good[g as GoodKey]] ?? 0) < 0.3), ...(r?.anyResources?.length && !r.anyResources.some((g) => (civ.access[Good[g as GoodKey]] ?? 0) >= 0.3) ? [r.anyResources.join('|')] : [])];
    out.push(`${t.id}@${st.adoption.toFixed(2)}${miss.length ? `(no ${miss.join(',')})` : ''}`);
  }
  return out.join(' ');
}

function line(sim: Simulation): string {
  const alive = [...sim.w.civs.values()].filter((c) => c.alive && c.settlements.length);
  const top = alive.sort((a, b) => b.era - a.era || b.techScore - a.techScore)[0];
  if (!top) return `  y${sim.year}: no nation`;
  const nx = top.era + 1;
  let known = 0, adopted = 0;
  for (const t of TECHS) if (t.era === nx) { const st = top.techs[t.id]; if (st?.known) { known++; if (st.adoption >= 0.5) adopted++; } }
  const avail = TECHS.filter((t) => techAvailable(sim, top, t));
  const availNx = avail.filter((t) => t.era === nx).map((t) => t.id);
  const tgt = top.researchTarget ? TECH_BY_ID.get(top.researchTarget) : undefined;
  const prog = tgt ? `${top.researchTarget}(e${tgt.era}) ${Math.round(top.techs[tgt.id]?.progress ?? 0)}/${Math.round(effCost(tgt))}` : 'none';
  const pop = Math.round(top.population);
  return `  y${String(sim.year).padStart(3)} world ${Math.round(boundaryPopulation(sim)).toLocaleString('en-US').padStart(10)} · leader era ${top.era} pop ${pop.toLocaleString('en-US')} rp ${top.researchRate.toFixed(1)} · era ${nx}: ${known} known, ${adopted} adopted of ${need(nx)} needed (${eraTotal[nx]}) · available ${avail.length} (next-era ${availNx.length}: ${availNx.join(',')}) · target ${prog} · unadopted e${nx}: ${blockers(top, nx)} · unadopted e${top.era}: ${blockers(top, top.era)}`
}

type Acc = { y: number; gain: number; lines: string[]; startIds: number[]; gainedIds: number[]; pop0: number };
const results: string[] = [];
for (let k = 0; k < WORLDS; k++) {
  const c = defaultConfig();
  presetByKey(start)!.apply(c);
  c.settings.startEra = ERA;
  c.settings.startCivs = eraPeopleDefault(start, ERA);
  c.name = 'Advance';
  c.gen.seed = `advance-${start}-${ERA}-${k}`;
  c.gen.width = SIZE;
  c.gen.height = SIZE;
  const HORIZON = Number(process.argv[6] ?? (c.settings.pace === 'slow' ? 300 : 150));
  const ckPath = process.env.CHECKPOINT ? checkpointPath(process.env.CHECKPOINT, 'advance', [start, ERA, k, SIZE, `${HORIZON}y`]) : '';
  const ck = ckPath ? loadCheckpoint<Acc>(ckPath) : null;
  const sim = ck ? ck.sim : createSimulation(c);
  const startEra = Math.max(0, ...[...sim.w.civs.values()].filter((x) => x.alive).map((x) => x.era));
  const acc: Acc = ck?.extra ?? { y: 0, gain: -1, lines: [line(sim)], startIds: [...sim.w.civs.values()].filter((x) => x.alive).map((x) => x.id), gainedIds: [], pop0: boundaryPopulation(sim) };
  const startEraOf = new Map<number, number>([...sim.w.civs.values()].map((x) => [x.id, ERA]));
  if (ck) console.error(`resumed ${c.gen.seed} at year ${acc.y}`);
  for (let y = acc.y + 1; y <= HORIZON; y++) {
    sim.runYears(1);
    for (const civ of sim.w.civs.values()) {
      if (!civ.alive) continue;
      if (civ.era > (startEraOf.get(civ.id) ?? ERA) && acc.startIds.includes(civ.id) && !acc.gainedIds.includes(civ.id)) acc.gainedIds.push(civ.id);
      if (acc.gain < 0 && civ.era > startEra) acc.gain = sim.year;
    }
    if (y % 50 === 0) acc.lines.push(line(sim));
    acc.y = y;
    if (ckPath && y % 50 === 0 && y < HORIZON) saveCheckpoint(ckPath, sim, acc);
  }
  const alive = [...sim.w.civs.values()].filter((x) => x.alive && x.settlements.length);
  const res = `world ${k} (${c.gen.seed}, pace ${c.settings.pace}, ${HORIZON} y): start era ${startEra} (${ERA_NAMES[startEra]}), leader gains an era ${acc.gain >= 0 ? `in year ${acc.gain}` : 'NEVER'} · final max era ${Math.max(0, ...alive.map((x) => x.era))} · starting nations that gained an era ${acc.gainedIds.length}/${acc.startIds.length} · nations alive ${alive.length} · world pop ${Math.round(acc.pop0).toLocaleString('en-US')} → ${Math.round(boundaryPopulation(sim)).toLocaleString('en-US')} · pandemics logged ${sim.w.events.filter((e) => e.type === 'pandemic').length}`;
  results.push(res);
  console.log(res);
  console.log(acc.lines.join('\n'));
}
console.log(`\nsummary ${start} era ${ERA}: ${results.filter((r) => !r.includes('NEVER')).length}/${WORLDS} worlds gain an era within the horizon`);
