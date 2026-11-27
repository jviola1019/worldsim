/**
 * Task 8 Part C: for each crocodile drop site of preds.ts (pred-<k>), the fish shoals and fish within the 8-tile
 * territory at year 0, and the land prey, so drops that fail can be told apart by whether fish were in reach.
 *
 *   npx tsx docs/data/round10/t8c-probes/crocfish.ts [seeds=30] [prefix=pred]
 */
import { defaultConfig, PRESETS } from '../../../../src/config/laws';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { SPECIES_BY_KEY } from '../../../../src/ecology/species';
const seeds = Number(process.argv[2] ?? 30), pref = process.argv[3] ?? 'pred';
const sp = SPECIES_BY_KEY.crocodile;
for (let k = 0; k < seeds; k++) {
  const c = defaultConfig(); PRESETS.find((p) => p.key === 'realistic')!.apply(c);
  c.name = 'Life audit'; c.gen.seed = `${pref}-${k}`; c.gen.width = 96; c.gen.height = 96; c.settings.empty = false;
  const nat = createSimulation(c); const m = nat.w.map;
  const herds = [...nat.w.herds.values()];
  const land = herds.filter((o) => { const q = SPECIES_BY_KEY[o.species]; return q.diet === 'herbivore' && !q.flying && !q.aquatic; });
  const preyAt = (i: number) => land.filter((o) => Math.hypot(o.x - m.xOf(i), o.y - m.yOf(i)) <= 8).reduce((t, o) => t + o.count, 0);
  const homeTest = (i: number) => !m.isWater(i) && sp.biomes.includes(m.terrain[i]) && m.temp[i] >= sp.temp[0] && m.temp[i] <= sp.temp[1];
  let home = -1, best = 0; for (let i = 0; i < m.n; i += 3) { if (!homeTest(i)) continue; const p = preyAt(i); if (p > best) { best = p; home = i; } }
  if (home < 0) { console.log(`${pref}-${k} no site`); continue; }
  const fish = herds.filter((o) => o.species === 'fish' && Math.hypot(o.x - m.xOf(home), o.y - m.yOf(home)) <= 8);
  console.log(`${pref}-${k}: fish shoals within 8 ${fish.length} (${fish.reduce((t, o) => t + o.count, 0).toFixed(0)} fish) · land prey within 8 ${best.toFixed(0)}`);
}
