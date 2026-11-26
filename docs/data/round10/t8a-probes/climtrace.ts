// era-10 Observer world population decomposition per 50 years (Task 8f investigation)
import { defaultConfig, presetByKey, eraPeopleDefault } from '../../../../src/config/laws';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { boundaryPopulation } from '../../../../src/population/ledger';
import { saveCheckpoint, loadCheckpoint, checkpointPath } from '../../../../scripts/lib/checkpoint';
import { tfrFor, mortalitySchedule, healthIndices } from '../../../../src/population/demography';
const k = Number(process.argv[2] ?? 1), YEARS = Number(process.argv[3] ?? 600), SIZE = Number(process.argv[4] ?? 96);
const start = process.argv[5] ?? 'observer';
const ckp = process.env.CHECKPOINT ? checkpointPath(process.env.CHECKPOINT, 'climtrace', [start, k, SIZE, `${YEARS}y`]) : '';
type Acc = { y: number; last: Record<string, number>; lines: string[] };
const ck = ckp ? loadCheckpoint<Acc>(ckp) : null;
let sim;
if (ck) sim = ck.sim; else {
  const c = defaultConfig(); presetByKey(start)!.apply(c); c.gen.seed = `disease-${k}`; c.gen.width = SIZE; c.gen.height = SIZE;
  c.settings.startEra = 10; c.settings.startCivs = eraPeopleDefault(start as 'observer', 10); sim = createSimulation(c);
}
const acc: Acc = ck?.extra ?? { y: 0, last: {}, lines: [] };
const snap = () => {
  const L = { ...(sim.w.popLedger ?? {}) } as Record<string, number>;
  const d: Record<string, number> = {};
  for (const key of ['births', 'deaths', 'famine', 'disease', 'war', 'disaster', 'destroyed', 'lost', 'resolution']) d[key] = Math.round((L[key] ?? 0) - (acc.last[key] ?? 0));
  acc.last = L;
  let pop = 0, old = 0, wTfr = 0, women = 0, foodShort = 0, foodNeed = 0, coh = 0;
  for (const s of sim.w.settlements.values()) {
    pop += s.pop;
    if (s.mode === 'cohort') { coh += s.pop; old += s.cohorts.slice(13).reduce((a: number, b: number) => a + b, 0); }
    const civ = sim.w.civs.get(s.civId);
    const q = mortalitySchedule(healthIndices(civ!, s.prosperity), s.species, new Float64Array(17));
    const t = tfrFor(civ, s, q[0], 1, s.species);
    wTfr += t * s.pop; women += s.pop;
  }
  for (const c of sim.w.civs.values()) if (c.alive) { foodShort += c.acc.foodShort; foodNeed += c.acc.foodNeed; }
  const eras = [...sim.w.civs.values()].filter((c) => c.alive && c.settlements.length).map((c) => c.era);
  let fp = 0; for (const s of sim.w.settlements.values()) fp += s.sites?.farmPot ?? 0;
  return `y${String(sim.year).padStart(3)} anomaly ${sim.w.climate.anomaly.toFixed(2)} co2 ${Math.round(sim.w.climate.co2)} farmPot ${fp.toFixed(0)} pop ${Math.round(boundaryPopulation(sim)).toLocaleString('en-US').padStart(10)} settl ${sim.w.settlements.size} nations ${eras.length} eras ${Math.min(...eras)}-${Math.max(...eras)} · 65+ ${(100 * old / Math.max(1, coh)).toFixed(0)}% · pop-weighted TFR(fed) ${(wTfr / Math.max(1, women)).toFixed(2)} · food short ${(100 * foodShort / Math.max(1, foodNeed)).toFixed(1)}% · last 50y ${JSON.stringify(d)}`;
};
if (!ck) acc.lines.push(snap());
for (let y = acc.y + 1; y <= YEARS; y++) {
  sim.runYears(1); acc.y = y;
  if (y % 50 === 0) { acc.lines.push(snap()); console.error(acc.lines[acc.lines.length - 1]); }
  if (ckp && y % 100 === 0 && y < YEARS) saveCheckpoint(ckp, sim, acc);
}
console.log(acc.lines.join('\n'));
