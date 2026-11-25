/**
 * Round 10: pace calibration. One band of 24 humans placed next to fresh water on an empty 128² world;
 * prints when the first village, town (2,000 people) and city (10,000 people) appear.
 *   npx tsx scripts/pace-calibrate.ts [years=1600] [pace=slow|standard] [seeds=pace-a,pace-b,pace-c,pace-d,pace-e]
 * CHECKPOINT=<dir> saves every 100 years and resumes after a restart; append the output (>>) when resuming.
 */
import { defaultConfig } from '../src/config/laws';
import { createSimulation } from '../src/sim/bootstrap';
import { spawnBand } from '../src/population/bands';
import { saveCheckpoint, loadCheckpoint } from './lib/checkpoint';

const years = Number(process.argv[2] ?? 1600);
const pace = (process.argv[3] ?? 'slow') as 'slow' | 'standard';
const seeds = (process.argv[4] ?? 'pace-a,pace-b,pace-c,pace-d,pace-e').split(',');
for (const seed of seeds) {
  const cfg = defaultConfig();
  cfg.name = 'Test'; cfg.gen.seed = seed; cfg.gen.width = 128; cfg.gen.height = 128;
  cfg.settings.startCivs = 0; cfg.settings.startEra = 1; cfg.settings.pace = pace;
  const ckPath = process.env.CHECKPOINT ? `${process.env.CHECKPOINT}/pace-${seed}-${pace}.bin` : '';
  const ck = ckPath ? loadCheckpoint<{ y: number; ms: Record<string, number> }>(ckPath) : null;
  const sim = ck ? ck.sim : createSimulation(cfg);
  if (!ck) {
    const m = sim.w.map;
    for (let i = 0; i < m.n; i += 7) {
      const x = i % m.w, y = (i / m.w) | 0;
      if (m.hasFreshWater(i) && !m.isWater(i) && x > 20 && y > 20 && x < m.w - 20 && spawnBand(sim, x, y, 'human', 24)) break;
    }
  } else console.error(`resumed ${seed} at year ${ck.extra.y}`);
  const ms: Record<string, number> = ck?.extra.ms ?? {};
  let died = -1;
  for (let y = (ck?.extra.y ?? 0) + 1; y <= years; y++) {
    sim.runYears(1);
    const ss = [...sim.w.settlements.values()];
    const maxPop = Math.max(0, ...ss.map((s) => s.pop));
    if (ss.length && ms.village === undefined) { ms.village = y; console.log(`${seed}\tvillage at ${y}`); }
    if (maxPop >= 2000 && ms.town === undefined) { ms.town = y; console.log(`${seed}\ttown at ${y}`); }
    if (y % 100 === 0) console.log(`${seed}\tyear ${y}: largest settlement ${Math.round(maxPop)}`); // progress survives an interrupted run
    if (maxPop >= 10000 && ms.city === undefined) { ms.city = y; break; }
    if (!sim.w.bands.size && !ss.length) { died = y; break; }
    if (ckPath && y % 100 === 0) saveCheckpoint(ckPath, sim, { y, ms });
  }
  const era = Math.max(1, ...[...sim.w.civs.values()].filter((c) => c.alive).map((c) => c.era));
  console.log(`${seed}\t${pace}\tvillage ${ms.village ?? '-'}\ttown ${ms.town ?? '-'}\tcity ${ms.city ?? '-'}\tdied ${died < 0 ? '-' : died}\tera ${era}\tyear ${sim.year}`);
}
