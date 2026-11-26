/**
 * Round 10 second addendum (Task 8f): one modern nation beside one pre-industrial nation. World pandemics are
 * normalised by the world's mean protection (Task 4), so an unprotected nation in a modern world can face many times
 * the lethality the draw implies. This forces the same pandemics on the same asymmetric world and reports each
 * nation's pandemic deaths.
 *   npx tsx scripts/pandemic-asymmetry.ts [trials=40] [size=64] [preEra=5]
 * Each trial starts from the same world (an era-10 start with 2 nations; the second is stripped back to the
 * technologies of `preEra` and earlier), draws one severity, seeds it in each nation in turn and runs until it ends.
 */
import { defaultConfig, presetByKey } from '../src/config/laws';
import { createSimulation } from '../src/sim/bootstrap';
import { Simulation } from '../src/sim/simulation';
import { encodeWorld, decodeWorld } from '../src/persistence/serialize';
import { TECH_BY_ID } from '../src/technology/techData';
import { computeCaps } from '../src/technology/research';
import { drawSeverity, worldProtection, finalSize } from '../src/population/pandemic';
import { emergeNovel, infect, transmissionFactor, lethalityFactor } from '../src/population/disease';
import { Rng } from '../src/core/rng';
import type { Civ, Settlement } from '../src/sim/types';

const TRIALS = Number(process.argv[2] ?? 40);
const SIZE = Number(process.argv[3] ?? 64);
const PRE_ERA = Number(process.argv[4] ?? 5);

const c = defaultConfig();
presetByKey('observer')!.apply(c);
c.name = 'Asymmetry';
c.gen.seed = 'asym-0';
c.gen.width = SIZE;
c.gen.height = SIZE;
c.settings.startEra = 10;
c.settings.startCivs = 2;
c.laws.diseases = true;
const base = createSimulation(c);
const [modern, old] = [...base.w.civs.values()].filter((x) => x.alive && x.settlements.length);
if (!modern || !old) throw new Error('need two nations with towns');
for (const id in old.techs) {
  const def = TECH_BY_ID.get(id);
  if (def && def.era > PRE_ERA) { old.techs[id].known = false; old.techs[id].adoption = 0; }
}
computeCaps(old);
// make sure the two nations' towns are linked (a pandemic crosses links), as neighbours that trade would be
const towns = (civ: Civ) => civ.settlements.map((id) => base.w.settlements.get(id)!).filter(Boolean);
const [ma, ob] = [towns(modern).sort((a, b) => b.pop - a.pop)[0], towns(old).sort((a, b) => b.pop - a.pop)[0]];
if (!ma.links.includes(ob.id)) ma.links.push(ob.id);
if (!ob.links.includes(ma.id)) ob.links.push(ma.id);
base.syncRng();
const snapshot = encodeWorld(base.w);

const popOf = (sim: Simulation, civId: number) => towns(sim.w.civs.get(civId)!).reduce((a, s) => a + s.pop, 0);
const prot = (sim: Simulation, civId: number) => {
  const ts = towns(sim.w.civs.get(civId)!);
  const n = ts.reduce((a, s) => a + s.pop, 0) || 1;
  return { trans: ts.reduce((a, s) => a + s.pop * transmissionFactor(s, sim.w.civs.get(civId)!), 0) / n, leth: lethalityFactor(sim.w.civs.get(civId)!) };
};
console.log(`pandemic asymmetry · ${SIZE}² · era-10 world · nation A (era ${modern.era}, pop ${Math.round(popOf(base, modern.id)).toLocaleString('en-US')}) beside nation B stripped to era ${PRE_ERA} (now era ${old.era}, pop ${Math.round(popOf(base, old.id)).toLocaleString('en-US')})`);
const pa = prot(base, modern.id), pb = prot(base, old.id), pw = worldProtection(base);
console.log(`protection (share of transmission / lethality left): A ${pa.trans.toFixed(3)} / ${pa.leth.toFixed(3)} · B ${pb.trans.toFixed(3)} / ${pb.leth.toFixed(3)} · world mean ${pw.trans.toFixed(3)} / ${pw.leth.toFixed(3)}`);
console.log(`lethality multiplier from normalising by the world mean: A ${(pa.leth / pw.leth).toFixed(2)}× · B ${(pb.leth / pw.leth).toFixed(2)}× the drawn lethality (cap 0.9)`);

const rng = new Rng('asymmetry');
type Row = { share: number; r0: number; seed: string; aDead: number; bDead: number; aPop: number; bPop: number };
const rows: Row[] = [];
for (let t = 0; t < TRIALS; t++) {
  const sev = drawSeverity(rng);
  for (const seedIn of ['A', 'B'] as const) {
    const sim = new Simulation(decodeWorld(snapshot));
    const host: Settlement = seedIn === 'A' ? sim.w.settlements.get(ma.id)! : sim.w.settlements.get(ob.id)!;
    const p = worldProtection(sim);
    const d = emergeNovel(sim, host, sim.w.civs.get(host.civId)!, { r0: sev.r0 / Math.max(0.05, p.trans), lethality: Math.min(0.9, sev.lethality / Math.max(0.05, p.leth)), pandemic: true, targetShare: sev.targetShare });
    infect(sim, host, d, 0.002);
    const aPop = popOf(sim, modern.id), bPop = popOf(sim, old.id);
    // deaths by this pathogen, per nation: sum each town's epidemic deaths before it is cleared
    const dead = new Map<number, number>();
    const tally = () => { for (const s of sim.w.settlements.values()) for (const e of s.epidemics) if (e.diseaseId === d.id) dead.set(s.id, Math.max(dead.get(s.id) ?? 0, e.deaths)); };
    for (let m = 0; m < 12 * 20; m++) {
      sim.runTicks(10);
      tally();
      if (m > 12 && ![...sim.w.settlements.values()].some((s) => s.epidemics.some((e) => e.diseaseId === d.id))) break;
    }
    let aDead = 0, bDead = 0;
    for (const [sid, n] of dead) { const s = sim.w.settlements.get(sid); if (!s) continue; if (s.civId === modern.id) aDead += n; else if (s.civId === old.id) bDead += n; }
    rows.push({ share: sev.targetShare, r0: sev.r0, seed: seedIn, aDead, bDead, aPop, bPop });
  }
}
const med = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
for (const seedIn of ['A', 'B']) {
  const r = rows.filter((x) => x.seed === seedIn);
  const a = r.map((x) => x.aDead / x.aPop), b = r.map((x) => x.bDead / x.bPop);
  console.log(`seeded in ${seedIn}: ${r.length} pandemics · deaths as a share of each nation: A mean ${(100 * mean(a)).toFixed(3)}% median ${(100 * med(a)).toFixed(3)}% max ${(100 * Math.max(...a)).toFixed(2)}% · B mean ${(100 * mean(b)).toFixed(3)}% median ${(100 * med(b)).toFixed(3)}% max ${(100 * Math.max(...b)).toFixed(2)}% · drawn share mean ${(100 * mean(r.map((x) => x.share))).toFixed(3)}% · B/A ratio of mean shares ${(mean(b) / Math.max(1e-12, mean(a))).toFixed(1)}`);
}
const big = rows.filter((x) => x.share >= 0.01);
if (big.length) console.log(`drawn ≥ 1% of the world (${big.length} runs): A mean ${(100 * mean(big.map((x) => x.aDead / x.aPop))).toFixed(2)}% · B mean ${(100 * mean(big.map((x) => x.bDead / x.bPop))).toFixed(2)}% (reference: final size at r0 2 is ${(100 * finalSize(2)).toFixed(0)}%)`);
