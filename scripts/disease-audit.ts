/**
 * Round 10 second addendum (Task 4): disease audit. Runs Observer worlds (real-world rules, left to themselves)
 * and measures the local outbreak model and the world pandemic draw per era band, for comparison with history
 * (docs/data/round10/research-notes.md §5: about 4-5 notable pandemics a century since 1918, a 1918-scale
 * event at 0.27-1.9% a year, far fewer world pandemics before rail and steamships).
 *
 *   npx tsx scripts/disease-audit.ts [worlds=6] [years=600] [size=96] [startEra=1]
 *   CHECKPOINT=<dir> saves each world every 100 years and resumes after a restart.
 *
 * Bands follow the leading nation's era: pre-industrial (eras 1-6), industrial (7-9), modern (10+).
 * Per band it reports world-years, outbreaks (new natural pathogens), logged epidemics, pandemics drawn and
 * logged per world-century, disease deaths as a share of the population per century, the largest events, and
 * how nations ended (pandemic endings in particular). A pandemic is credited to the band it emerged in.
 */
import { defaultConfig, presetByKey, eraPeopleDefault } from '../src/config/laws';
import { createSimulation } from '../src/sim/bootstrap';
import { ERA_NAMES } from '../src/technology/techData';
import type { Simulation } from '../src/sim/simulation';
import { saveCheckpoint, loadCheckpoint } from './lib/checkpoint';
import { connectivity } from '../src/population/pandemic';

const WORLDS = Number(process.argv[2] ?? 6);
const YEARS = Number(process.argv[3] ?? 600);
const SIZE = Number(process.argv[4] ?? 96);
const START_ERA = Number(process.argv[5] ?? 1);

type Band = 'pre-industrial' | 'industrial' | 'modern';
const BANDS: Band[] = ['pre-industrial', 'industrial', 'modern'];
const bandOf = (era: number): Band => (era >= 10 ? 'modern' : era >= 7 ? 'industrial' : 'pre-industrial');

interface BandAcc {
  years: number; popYears: number; connYears: number; outbreaks: number; engineered: number; epidemics: number;
  pandemicsDrawn: number; pandemicsLogged: number; localDeaths: number; pandemicDeaths: number; endings: Record<string, number>;
}
interface PandemicRec { id: number; world: string; band: Band; emerged: number; ended: number; deaths: number; share: number; target: number; r0: number; lethality: number; reach: number }
interface Acc {
  y: number; lastId: number; deathsSeen: Record<string, number>; bandOfPandemic: Record<string, Band>; endedSeen: number[]; civsEnded: number[];
  bands: Record<Band, BandAcc>; pandemics: PandemicRec[]; maxEpidemic: { deaths: number; title: string; year: number; band: Band } | null; maxEra: number;
}
const emptyBand = (): BandAcc => ({ years: 0, popYears: 0, connYears: 0, outbreaks: 0, engineered: 0, epidemics: 0, pandemicsDrawn: 0, pandemicsLogged: 0, localDeaths: 0, pandemicDeaths: 0, endings: {} });

const totals: Record<Band, BandAcc> = { 'pre-industrial': emptyBand(), industrial: emptyBand(), modern: emptyBand() };
const allPandemics: PandemicRec[] = [];
const worldLines: string[] = [];
let biggestEpidemic: Acc['maxEpidemic'] = null;

const leadEra = (sim: Simulation) => { let e = 1; for (const c of sim.w.civs.values()) if (c.alive) e = Math.max(e, c.era); return e; };
const worldPop = (sim: Simulation) => { let n = 0; for (const s of sim.w.settlements.values()) n += s.pop; for (const b of sim.w.bands.values()) n += b.members.length; return n; };

for (let k = 0; k < WORLDS; k++) {
  const seed = `disease-${k}`;
  const ckPath = process.env.CHECKPOINT ? `${process.env.CHECKPOINT}/disease-${seed}-${SIZE}-era${START_ERA}-${YEARS}y.bin` : '';
  const ck = ckPath ? loadCheckpoint<Acc>(ckPath) : null;
  let sim: Simulation;
  if (ck) { sim = ck.sim; console.error(`resumed ${seed} at year ${ck.extra.y}`); }
  else {
    const c = defaultConfig();
    presetByKey('observer')!.apply(c);
    c.name = 'Disease audit';
    c.gen.seed = seed;
    c.gen.width = SIZE;
    c.gen.height = SIZE;
    c.settings.startEra = START_ERA;
    c.settings.startCivs = eraPeopleDefault('observer', START_ERA);
    sim = createSimulation(c);
  }
  const acc: Acc = ck?.extra ?? {
    y: 0, lastId: sim.w.ids.disease, deathsSeen: {}, bandOfPandemic: {}, endedSeen: [], civsEnded: [],
    bands: { 'pre-industrial': emptyBand(), industrial: emptyBand(), modern: emptyBand() }, pandemics: [], maxEpidemic: null, maxEra: START_ERA,
  };
  let band: Band = bandOf(leadEra(sim));
  const off = sim.onEvent((e) => {
    if (e.type === 'epidemic') {
      acc.bands[band].epidemics++;
      const n = Number((/killed ([\d,]+)/.exec(e.title)?.[1] ?? '0').replace(/,/g, ''));
      if (!acc.maxEpidemic || n > acc.maxEpidemic.deaths) acc.maxEpidemic = { deaths: n, title: e.title, year: e.year, band };
    }
    if (e.type === 'pandemic') acc.bands[band].pandemicsLogged++;
  });
  for (let y = acc.y + 1; y <= YEARS; y++) {
    band = bandOf(leadEra(sim));
    sim.runYears(1);
    acc.y = y;
    const b = acc.bands[band];
    b.years++;
    b.popYears += worldPop(sim);
    b.connYears += connectivity(sim);
    acc.maxEra = Math.max(acc.maxEra, leadEra(sim));
    // new pathogens this year
    for (let id = acc.lastId + 1; id <= sim.w.ids.disease; id++) {
      const d = sim.w.diseases.get(id);
      if (!d) continue;
      if (d.pandemic) { b.pandemicsDrawn++; acc.bandOfPandemic[id] = band; }
      else if (d.engineered) b.engineered++;
      else b.outbreaks++;
    }
    acc.lastId = sim.w.ids.disease;
    // deaths this year, by pathogen kind
    for (const d of sim.w.diseases.values()) {
      const prev = acc.deathsSeen[d.id] ?? 0;
      const dd = d.totalDeaths - prev;
      if (dd > 0) { if (d.pandemic) b.pandemicDeaths += dd; else b.localDeaths += dd; acc.deathsSeen[d.id] = d.totalDeaths; }
      if (d.pandemic && d.ended !== undefined && !acc.endedSeen.includes(d.id)) {
        acc.endedSeen.push(d.id);
        acc.pandemics.push({
          id: d.id, world: seed, band: acc.bandOfPandemic[d.id] ?? band, emerged: d.emerged, ended: d.ended, deaths: Math.round(d.totalDeaths),
          share: d.totalDeaths / Math.max(1, d.worldPop ?? 1), target: d.targetShare ?? 0, r0: d.r0, lethality: d.lethality,
          reach: [...sim.w.settlements.values()].filter((s) => s.immunity[d.id] !== undefined).length / Math.max(1, sim.w.settlements.size),
        });
      }
    }
    // keep the bookkeeping small: forget pathogens that are gone
    for (const id of Object.keys(acc.deathsSeen)) if (!sim.w.diseases.has(Number(id))) delete acc.deathsSeen[id];
    for (const c of sim.w.civs.values()) if (c.ending && !acc.civsEnded.includes(c.id)) {
      acc.civsEnded.push(c.id);
      b.endings[c.ending.type] = (b.endings[c.ending.type] ?? 0) + 1;
    }
    if (ckPath && y % 100 === 0 && y < YEARS) saveCheckpoint(ckPath, sim, acc);
  }
  off();
  for (const bd of BANDS) {
    const t = totals[bd], a = acc.bands[bd];
    for (const key of ['years', 'popYears', 'connYears', 'outbreaks', 'engineered', 'epidemics', 'pandemicsDrawn', 'pandemicsLogged', 'localDeaths', 'pandemicDeaths'] as const) t[key] += a[key];
    for (const [e, n] of Object.entries(a.endings)) t.endings[e] = (t.endings[e] ?? 0) + n;
  }
  allPandemics.push(...acc.pandemics);
  if (acc.maxEpidemic && (!biggestEpidemic || acc.maxEpidemic.deaths > biggestEpidemic.deaths)) biggestEpidemic = acc.maxEpidemic;
  const yrs = BANDS.map((bd) => `${bd} ${acc.bands[bd].years}y`).join(', ');
  worldLines.push(`  ${seed}: highest era ${ERA_NAMES[acc.maxEra]} · ${yrs} · pandemics drawn ${BANDS.reduce((a, bd) => a + acc.bands[bd].pandemicsDrawn, 0)} · population now ${Math.round(worldPop(sim)).toLocaleString('en-US')}`);
  console.error(`world ${seed} done`);
}

const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const pct = (x: number) => `${(x * 100).toFixed(x >= 0.01 ? 2 : 4)}%`;
console.log(`disease audit · ${WORLDS} worlds × ${YEARS} years · ${SIZE}² · Observer rules from era ${START_ERA} (${ERA_NAMES[START_ERA]}) with ${eraPeopleDefault('observer', START_ERA)} peoples`);
console.log(worldLines.join('\n'));
console.log('\nper era band (rates per world-century; death share = disease deaths / mean world population, per century):');
for (const bd of BANDS) {
  const t = totals[bd];
  if (!t.years) { console.log(`  ${bd}: no years in this band`); continue; }
  const c = t.years / 100, meanPop = t.popYears / t.years;
  const ps = allPandemics.filter((p) => p.band === bd);
  const big = ps.slice().sort((a, b) => b.share - a.share)[0];
  console.log(`  ${bd}: ${t.years} world-years, mean world population ${Math.round(meanPop).toLocaleString('en-US')}, mean connectivity ${f(t.connYears / t.years)}`);
  console.log(`    outbreaks (new natural pathogens) ${t.outbreaks} (${f(t.outbreaks / c)} per century); engineered ${t.engineered}`);
  console.log(`    logged epidemics ${t.epidemics} (${f(t.epidemics / c)} per century)`);
  console.log(`    pandemics drawn ${t.pandemicsDrawn} (${f(t.pandemicsDrawn / c)} per century); logged ${t.pandemicsLogged} (${f(t.pandemicsLogged / c)} per century)`);
  console.log(`    deaths per century: local outbreaks ${pct(t.localDeaths / meanPop / c)}, pandemics ${pct(t.pandemicDeaths / meanPop / c)} of the population`);
  console.log(`    largest pandemic: ${big ? `${pct(big.share)} of the world (${big.deaths.toLocaleString('en-US')} dead, drawn target ${pct(big.target)}, ${big.world} year ${big.emerged})` : 'none'}`);
  console.log(`    endings: ${Object.entries(t.endings).sort((a, b) => b[1] - a[1]).map(([e, n]) => `${e} ${n}`).join(', ') || 'none'}; pandemic endings ${t.endings.pandemic ?? 0}`);
}
console.log(`\nlargest logged town epidemic: ${biggestEpidemic ? `${biggestEpidemic.title} (year ${biggestEpidemic.year}, ${biggestEpidemic.band})` : 'none'}`);
const ended = allPandemics;
const severeT = ended.filter((p) => p.target >= 0.01).length, severeR = ended.filter((p) => p.share >= 0.01).length;
const ratios = ended.filter((p) => p.target > 0).map((p) => p.share / p.target).sort((a, b) => a - b);
console.log(`\nrealised vs drawn severity (${ended.length} finished pandemics):`);
console.log(`  drawn to kill >= 1% of the world: ${severeT} (${f(severeT / Math.max(1, ended.length))}); realised >= 1%: ${severeR} (${f(severeR / Math.max(1, ended.length))})`);
console.log(`  realised / drawn share: median ${f(ratios[Math.floor(ratios.length / 2)] ?? NaN, 3)}, quartiles ${f(ratios[Math.floor(ratios.length / 4)] ?? NaN, 3)}-${f(ratios[Math.floor((3 * ratios.length) / 4)] ?? NaN, 3)}`);
console.log('\nevery finished pandemic (world, band, years, r0, lethality, drawn share, realised share, share of towns reached, deaths):');
for (const p of ended) console.log(`  ${p.world} ${p.band.padEnd(14)} ${p.emerged}-${p.ended} r0 ${f(p.r0)} lethality ${f(p.lethality, 4)} drawn ${pct(p.target)} realised ${pct(p.share)} reach ${f(p.reach)} deaths ${p.deaths.toLocaleString('en-US')}`);
