// Task 8 Part A fix round 1: how much of the Slow birth lever each start era keeps (Realistic, 128², after 1 year).
//   npx tsx docs/data/round10/t8a-probes/lever-by-era.ts
import { defaultConfig, presetByKey, eraPeopleDefault } from '../../../../src/config/laws';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { fertilityTransition, healthIndices, mortalitySchedule } from '../../../../src/population/demography';
import { birthPaceMult } from '../../../../src/sim/pace';
for (const era of [3, 4, 5, 6, 7, 8, 9, 10]) {
  const c = defaultConfig(); c.name = 'Test'; c.gen.seed = 'advance-realistic-x'; c.gen.width = 128; c.gen.height = 128;
  presetByKey('realistic')!.apply(c); c.settings.startEra = era; c.settings.startCivs = eraPeopleDefault('realistic', era);
  const sim = createSimulation(c);
  sim.runYears(1);
  let n = 0, pos = 0, lever = 0, tr = 0;
  for (const s of sim.w.settlements.values()) { const civ = sim.w.civs.get(s.civId)!; const q = mortalitySchedule(healthIndices(civ, s.prosperity), s.species); const t = fertilityTransition(civ, s, q[0]); n += s.pop; if (t > 0) pos += s.pop; tr += t * s.pop; lever += birthPaceMult(sim.w.meta.settings, t) * s.pop; }
  console.log(`ERA ${era}: share of people in towns with transition>0 ${(100 * pos / n).toFixed(0)}% · mean transition ${(tr / n).toFixed(3)} · mean birth lever ${(lever / n).toFixed(3)} (full lever 0.65)`);
}
