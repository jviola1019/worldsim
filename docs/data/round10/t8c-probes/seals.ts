/**
 * Task 8 Part C: natural seal seeding. For each wild-audit world (Realistic, natural wildlife, 128²): seal herds and
 * seals at year 0, fish shoals and fish, cold coastal water (seal habitat >= 0.5), and for the best seal spot the
 * marine prey biomass within 12 tiles (count x meat) against what the 1:100 rule needs for a founding group of seals.
 *
 *   npx tsx docs/data/round10/t8c-probes/seals.ts [worlds=6] [size=128] [prefix=wild]
 */
import { defaultConfig, PRESETS } from '../../../../src/config/laws';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { habitat } from '../../../../src/ecology/ecology';
import { SPECIES_BY_KEY } from '../../../../src/ecology/species';
import { BALANCE } from '../../../../src/config/balance';

const worlds = Number(process.argv[2] ?? 6), size = Number(process.argv[3] ?? 128), pref = process.argv[4] ?? 'wild';
const seal = SPECIES_BY_KEY.seal;
let withSeals = 0, withCoast = 0;
for (let k = 0; k < worlds; k++) {
  const c = defaultConfig(); PRESETS.find((p) => p.key === 'realistic')!.apply(c);
  c.name = 'Wild audit'; c.gen.seed = `${pref}-${k}`; c.gen.width = size; c.gen.height = size;
  const sim = createSimulation(c); const m = sim.w.map;
  const herds = [...sim.w.herds.values()];
  const seals = herds.filter((h) => h.species === 'seal');
  const fish = herds.filter((h) => h.species === 'fish');
  let sealWater = 0, bestBio = 0, bestFish = 0;
  for (let y = 2; y < m.h; y += 4) for (let x = 2; x < m.w; x += 4) {
    const i = y * m.w + x;
    if (!m.isWater(i) || habitat(sim, seal, i) < 0.5) continue;
    sealWater++;
    const near = fish.filter((o) => Math.hypot(o.x - x - 0.5, o.y - y - 0.5) <= 12);
    const bio = near.reduce((t, o) => t + o.count * SPECIES_BY_KEY[o.species].meat, 0);
    if (bio > bestBio) { bestBio = bio; bestFish = near.length; }
  }
  const coastFish = sealWater > 0 && fish.length > 0;
  if (coastFish) withCoast++;
  if (seals.length) withSeals++;
  const needBio = (seal.start[0] * seal.meat) / BALANCE.predatorPreyBiomass;
  console.log(`${pref}-${k}: seal herds ${seals.length} (${seals.reduce((t, h) => t + h.count, 0).toFixed(0)} seals) | fish shoals ${fish.length} (${fish.reduce((t, h) => t + h.count, 0).toFixed(0)}) | seal-habitat grid spots ${sealWater} | best spot: ${bestFish} shoals, fish biomass ${bestBio.toFixed(2)} vs ${needBio.toFixed(0)} needed for ${seal.start[0]} seals at 1:100`);
}
console.log(`worlds with seals at year 0: ${withSeals}/${worlds}; worlds with cold seal water and fish: ${withCoast}/${worlds}`);
