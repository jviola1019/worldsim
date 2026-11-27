/**
 * Task 8 Part C: who holds the herd slots. The world allows one herd per 30 tiles (m.n / 30) for every species together;
 * this prints, for wild-audit worlds at the given years, the land and sea herds against the land and sea shares of that
 * limit, and the seal herds.
 *
 *   npx tsx docs/data/round10/t8c-probes/slots.ts [worlds=2] [years=100] [size=128] [from=2]
 */
import { defaultConfig, PRESETS } from '../../../../src/config/laws';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { SPECIES_BY_KEY } from '../../../../src/ecology/species';
const worlds = Number(process.argv[2] ?? 2), years = Number(process.argv[3] ?? 100), size = Number(process.argv[4] ?? 128), from = Number(process.argv[5] ?? 2);
for (let k = from; k < from + worlds; k++) {
  const c = defaultConfig(); PRESETS.find((p) => p.key === 'realistic')!.apply(c);
  c.gen.seed = `wild-${k}`; c.gen.width = size; c.gen.height = size;
  const sim = createSimulation(c); const m = sim.w.map;
  let land = 0; for (let i = 0; i < m.n; i++) if (m.isLand(i)) land++;
  const limit = Math.floor(m.n / 30);
  for (const y of [0, 25, 50, years]) {
    if (y) sim.runYears(y - (y === 25 ? 0 : y === 50 ? 25 : 50));
    const hs = [...sim.w.herds.values()];
    const sea = hs.filter((h) => SPECIES_BY_KEY[h.species]?.aquatic);
    const seals = hs.filter((h) => h.species === 'seal');
    console.log(`wild-${k} year ${y}: herds ${hs.length}/${limit} · land ${hs.length - sea.length} (share ${Math.round(limit * land / m.n)}) · sea ${sea.length} (share ${Math.round(limit * (m.n - land) / m.n)}), of which seals ${seals.length} (${Math.round(seals.reduce((t, h) => t + h.count, 0))} seals)`);
  }
}
