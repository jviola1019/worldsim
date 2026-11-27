/**
 * Task 8 Part C: monthly trace of one hand-placed predator drop (the life audit's placement, natural conspecifics
 * removed). Per month: the lineage, the first herd's hunger, habitat and temperature, the prey in its 8-tile territory
 * by species (count / what it can replace a month / the share this herd gets), the other hunters there and their need.
 *
 *   [NORIVALS=wolf] npx tsx docs/data/round10/t8c-probes/trace.ts <key> <seed> [months=120] [every=3]
 */
import { defaultConfig, PRESETS } from '../../../../src/config/laws';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { spawnHerd, habitat, herdsNear, preyReplaceable, preyShare, huntNeed, hunts } from '../../../../src/ecology/ecology';
import { SPECIES_BY_KEY } from '../../../../src/ecology/species';
import { BALANCE } from '../../../../src/config/balance';
import { TERRAIN } from '../../../../src/world/terrain';
import type { Herd } from '../../../../src/sim/types';

const key = process.argv[2] ?? 'crocodile', seed = process.argv[3] ?? 'pred-4', months = Number(process.argv[4] ?? 120), every = Number(process.argv[5] ?? 3);
const c = defaultConfig(); PRESETS.find((p) => p.key === 'realistic')!.apply(c);
c.name = 'Life audit'; c.gen.seed = seed; c.gen.width = 96; c.gen.height = 96; c.settings.empty = false;
const sim = createSimulation(c); sim.syncRng();
const m = sim.w.map; const sp = SPECIES_BY_KEY[key];
const isPrey = (o: Herd) => o.owner === 0 && hunts(sp, SPECIES_BY_KEY[o.species]);
const preyHerds = [...sim.w.herds.values()].filter(isPrey);
const preyAt = (i: number) => preyHerds.filter((o) => Math.hypot(o.x - m.xOf(i), o.y - m.yOf(i)) <= 8).reduce((t, o) => t + o.count, 0);
const homeTest = (i: number) => (sp.aquatic ? m.isWater(i) : !m.isWater(i)) && sp.biomes.includes(m.terrain[i]) && m.temp[i] >= sp.temp[0] && m.temp[i] <= sp.temp[1];
let home = -1, best = 0; for (let i = 0; i < m.n; i += 3) { if (!homeTest(i)) continue; const p = preyAt(i); if (p > best) { best = p; home = i; } }
for (const h of [...sim.w.herds.values()]) if (h.species === key) sim.w.herds.delete(h.id);
// NORIVALS=<key,key>: remove those species too (the probe's experiment switch)
for (const h of [...sim.w.herds.values()]) if ((process.env.NORIVALS ?? '').split(',').includes(h.species)) sim.w.herds.delete(h.id);
const hx = m.xOf(home), hy = m.yOf(home);
const maxId = sim.w.ids.herd;
const h0 = spawnHerd(sim, key, hx, hy)!;
console.log(`${key} ${seed} home ${hx},${hy} ${TERRAIN[m.terrain[home]].key} ${m.temp[home].toFixed(0)}C prey within 8: ${best.toFixed(0)}; start ${h0.count}`);
for (let mo = 0; mo <= months; mo++) {
  const mine = [...sim.w.herds.values()].filter((h) => h.species === key && h.id > maxId);
  if (!mine.length) { console.log(`${mo} extinct`); break; }
  if (mo % every === 0) {
    const tot = mine.reduce((t, h) => t + h.count, 0);
    for (const h of mine.slice(0, 2)) {
      const i = Math.floor(h.y) * m.w + Math.floor(h.x);
      const prey = herdsNear(sim, h.x, h.y, BALANCE.huntReach).filter((o) => o !== h && isPrey(o));
      const need = huntNeed(h, sp);
      let get = 0;
      const spc: string[] = [];
      for (const p of prey) { const s = preyShare(sim, p, h); get += s; spc.push(`${p.species}${Math.round(p.count)}/${preyReplaceable(sim, p).toFixed(2)}/${s.toFixed(2)}`); }
      const hunters = herdsNear(sim, h.x, h.y, BALANCE.huntReach).filter((o) => o !== h && o.owner === 0 && ['predator', 'omnivore'].includes(SPECIES_BY_KEY[o.species]?.diet) && !SPECIES_BY_KEY[o.species].aquatic === !sp.aquatic)
        .map((o) => `${o.species}${o.count.toFixed(1)}`);
      console.log(`${String(mo).padStart(3)} tot ${tot.toFixed(1).padStart(5)} herds ${mine.length} | n ${h.count.toFixed(1).padStart(5)} hung ${String(h.hunger).padStart(3)} hab ${habitat(sim, sp, i).toFixed(2)} ${TERRAIN[m.terrain[i]].key} ${m.temp[i].toFixed(0)}C d${Math.hypot(h.x - hx, h.y - hy).toFixed(1)} | need ${need.toFixed(2)} get ${get.toFixed(2)} fed~${Math.min(1, get / need).toFixed(2)} | prey ${spc.join(' ')} | hunters ${hunters.join(' ')}`);
    }
  }
  sim.runTicks(10);
}
