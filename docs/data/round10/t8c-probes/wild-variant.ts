/**
 * Task 8 Part C probe: a copy of scripts/wild-audit.ts with experiment switches, to find which change lost a prey species
 * (environment): NOSEALS=1 removes every seal herd at the start of both runs; CATNOFOREST=1 takes forest out of the
 * great cat's habitat; NOFISH=1 stops crocodiles fishing; WORLDS_FROM=<k> starts at wild-<k>.
 *
 *   [switches] npx tsx docs/data/round10/t8c-probes/wild-variant.ts [worlds=6] [years=200] [size=128]
 *
 * The original header follows.
 *
 * Task 5 (owner options A + C, 2026-11-25): natural-world check. Do a natural world's wild species, predators and
 * prey, persist for centuries with nobody in it, and is any prey species driven extinct by predation?
 *
 *   npx tsx scripts/wild-audit.ts [worlds=6] [years=200] [size=128]
 *
 * Method: each world is a Realistic world with its natural wildlife and no people (Realistic's default start). It runs
 * twice from the same seed: as generated, and as a control with every predator herd removed at the start. A species
 * counts as present if it has at least one herd at year 0; "lost" lists the species present at year 0 with no herd at
 * the horizon. A prey species lost in the run with predators but kept in the control is the mark of predation driving
 * it extinct; one lost in both runs died out for other reasons (habitat, crowding, climate).
 */
import { defaultConfig, PRESETS } from '../../../../src/config/laws';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { SPECIES_BY_KEY } from '../../../../src/ecology/species';
import type { Simulation } from '../../../../src/sim/simulation';

import { T } from '../../../../src/world/terrain';
if (process.env.CATNOFOREST) SPECIES_BY_KEY.bigcat.biomes = SPECIES_BY_KEY.bigcat.biomes.filter((t) => t !== T.FOREST);
if (process.env.NOFISH) SPECIES_BY_KEY.crocodile.fishes = false;
const WORLDS = Number(process.argv[2] ?? 6);
const YEARS = Number(process.argv[3] ?? 200);
const SIZE = Number(process.argv[4] ?? 128);
const checkpoints = [0, 50, 100, YEARS].filter((y, k, a) => y <= YEARS && a.indexOf(y) === k);

const world = (seed: string, predators: boolean): Simulation => {
  const c = defaultConfig();
  PRESETS.find((p) => p.key === 'realistic')!.apply(c);
  c.name = 'Wild audit';
  c.gen.seed = seed;
  c.gen.width = SIZE;
  c.gen.height = SIZE;
  const sim = createSimulation(c);
  if (!predators) for (const h of [...sim.w.herds.values()]) if (SPECIES_BY_KEY[h.species]?.diet === 'predator') sim.w.herds.delete(h.id);
  if (process.env.NOSEALS) for (const h of [...sim.w.herds.values()]) if (h.species === 'seal') sim.w.herds.delete(h.id);
  return sim;
};
const census = (sim: Simulation) => {
  const t = new Map<string, number>();
  for (const h of sim.w.herds.values()) t.set(h.species, (t.get(h.species) ?? 0) + h.count);
  return t;
};

const out: string[] = [];
let predPresent = 0, predKept = 0, preyPresent = 0, preyKept = 0, preyLostToPredation = 0;
for (let k = Number(process.env.WORLDS_FROM ?? 0); k < WORLDS; k++) {
  const seed = `wild-${k}`;
  const runs = [world(seed, true), world(seed, false)];
  const series = runs.map(() => [] as Map<string, number>[]);
  let y = 0;
  for (const cp of checkpoints) {
    for (const s of runs) s.runYears(cp - y);
    y = cp;
    runs.forEach((s, j) => series[j].push(census(s)));
  }
  const [withP, control] = series;
  const start = withP[0], end = withP[withP.length - 1], endC = control[control.length - 1];
  out.push(`${seed}: ${runs[0].w.herds.size} herds at year ${YEARS} (limit ${Math.floor(runs[0].w.map.n / 30)})`);
  for (const [key, n0] of [...start.entries()].sort()) {
    const sp = SPECIES_BY_KEY[key];
    const pred = sp.diet === 'predator';
    const kept = (end.get(key) ?? 0) >= 1;
    const keptC = pred || (endC.get(key) ?? 0) >= 1;
    if (pred) { predPresent++; if (kept) predKept++; } else if (sp.diet === 'herbivore') { preyPresent++; if (kept) preyKept++; if (!kept && keptC) preyLostToPredation++; }
    const row = withP.map((c) => String(Math.round(c.get(key) ?? 0)).padStart(6)).join('');
    const ctl = pred ? '' : `   control ${String(Math.round(endC.get(key) ?? 0)).padStart(6)}`;
    out.push(`  ${(pred ? 'predator' : sp.diet).padEnd(9)} ${key.padEnd(10)}${row}  ${kept ? 'persists' : 'LOST    '}${ctl}${!kept && keptC && !pred ? '  LOST TO PREDATION' : ''}`);
    void n0;
  }
}
console.log(`wild audit · ${WORLDS} natural Realistic worlds (no people) · ${YEARS} years · ${SIZE}² · totals at years ${checkpoints.join(', ')}`);
console.log(out.join('\n'));
console.log(`\npredator species persisting: ${predKept}/${predPresent} · herbivore species persisting: ${preyKept}/${preyPresent} · herbivore species lost to predation (kept in the predator-free control): ${preyLostToPredation}`);
