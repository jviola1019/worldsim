/**
 * Task 8 Part C: hand-placed predator drops, the life audit's exact placement (home-biome tile in range with the most
 * realm prey within 8 tiles, natural conspecifics removed, the placed lineage counted). Same method as Task 5's
 * t5-evidence/preds.ts (its 30-seed numbers: wolves 30/30, great cats 18/30, crocodiles 12/30 on pred-0..29), with a
 * seed offset so runs can be split across processes, and the drop site's terrain, temperature and start count printed.
 *
 *   npx tsx docs/data/round10/t8c-probes/preds.ts [keys=wolf,bigcat,crocodile] [seeds=30] [years=100] [prefix=pred] [from=0]
 *
 * Experiment switches (environment): NORIVALS=pred removes every other land predator herd from the clone before the
 * drop, NORIVALS=all also every omnivore (bears, boar), NORIVALS=<key,key> only those species; START=<n> drops n animals instead of the species' random start.
 *
 * Verdict: PERSISTS when the lineage ends at least 0.8 of its start (the life audit's "holds or grows").
 */
import { defaultConfig, PRESETS } from '../../../../src/config/laws';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { Simulation } from '../../../../src/sim/simulation';
import { encodeWorld, decodeWorld } from '../../../../src/persistence/serialize';
import { spawnHerd } from '../../../../src/ecology/ecology';
import { SPECIES_BY_KEY } from '../../../../src/ecology/species';
import { T, TERRAIN } from '../../../../src/world/terrain';
import type { Herd } from '../../../../src/sim/types';

// CATBIOMES=FOREST,HILLS: experiment, add these terrains to the great cat's good habitat for this run only
for (const t of (process.env.CATBIOMES ?? '').split(',').filter(Boolean)) SPECIES_BY_KEY.bigcat.biomes.push((T as Record<string, number>)[t]);
const keys = (process.argv[2] ?? 'wolf,bigcat,crocodile').split(',');
const seeds = Number(process.argv[3] ?? 30);
const years = Number(process.argv[4] ?? 100);
const pref = process.argv[5] ?? 'pred';
const from = Number(process.argv[6] ?? 0);
let persist = 0, n = 0, alive = 0;
const per: Record<string, [number, number]> = {};
for (let k = from; k < from + seeds; k++) {
  const c = defaultConfig(); PRESETS.find((p) => p.key === 'realistic')!.apply(c);
  c.name = 'Life audit'; c.gen.seed = `${pref}-${k}`; c.gen.width = 96; c.gen.height = 96; c.settings.empty = false;
  const nat = createSimulation(c); nat.syncRng(); const m = nat.w.map;
  for (const key of keys) {
    const sp = SPECIES_BY_KEY[key];
    const isPrey = (o: Herd) => { const q = SPECIES_BY_KEY[o.species]; return !!q && q.diet === 'herbivore' && !q.flying && !!q.aquatic === !!sp.aquatic; };
    const preyHerds = [...nat.w.herds.values()].filter(isPrey);
    const preyAt = (i: number) => preyHerds.filter((o) => Math.hypot(o.x - m.xOf(i), o.y - m.yOf(i)) <= 8).reduce((t, o) => t + o.count, 0);
    const homeTest = (i: number) => (sp.aquatic ? m.isWater(i) : !m.isWater(i)) && sp.biomes.includes(m.terrain[i]) && m.temp[i] >= sp.temp[0] && m.temp[i] <= sp.temp[1];
    let home = -1, best = 0; for (let i = 0; i < m.n; i += 3) { if (!homeTest(i)) continue; const p = preyAt(i); if (p > best) { best = p; home = i; } }
    if (home < 0) { console.log(`${key.padEnd(10)} ${pref}-${k} no site`); continue; }
    const sim = new Simulation(decodeWorld(encodeWorld(nat.w)));
    for (const h of [...sim.w.herds.values()]) if (h.species === key) sim.w.herds.delete(h.id);
    const rivals = [...sim.w.herds.values()].filter((o) => SPECIES_BY_KEY[o.species]?.diet === 'predator' && !SPECIES_BY_KEY[o.species].aquatic === !sp.aquatic && Math.hypot(o.x - m.xOf(home), o.y - m.yOf(home)) <= 12).reduce((t, o) => t + o.count, 0);
    const nr = process.env.NORIVALS;
    if (nr) for (const h of [...sim.w.herds.values()]) { const q = SPECIES_BY_KEY[h.species]; if (q && !q.aquatic === !sp.aquatic && (nr === 'pred' || nr === 'all' ? q.diet === 'predator' || (nr === 'all' && q.diet === 'omnivore') : nr.split(',').includes(h.species))) sim.w.herds.delete(h.id); }
    // ACC=1: loss accounting through a temporary instrumentation hook in herdsMonthly (globalThis.__t8acc; apply
    // acc-instrumentation.patch in this folder first, it is not part of the game): months, growth, starvation and
    // hostile-land losses of the lineage, and the need of the other predators hunting its prey
    const acc = { key, maxId: sim.w.ids.herd, months: 0, grow: 0, starve: 0, hostile: 0, hostileM: 0, hungry: 0, short: 0, empty: 0, mid: 0, lastPrey: false, rivals: {} as Record<string, number>, ownNeed: 0 };
    if (process.env.ACC) (globalThis as any).__t8acc = acc;
    spawnHerd(sim, key, m.xOf(home), m.yOf(home), process.env.START ? Number(process.env.START) : undefined);
    const cnt = () => [...sim.w.herds.values()].filter((h) => h.species === key).reduce((t, h) => t + h.count, 0);
    const out = [cnt()]; let y = 0;
    for (const cp of [1, 5, 25, 50, years]) { sim.runYears(cp - y); y = cp; out.push(cnt()); }
    const herds = [...sim.w.herds.values()].filter((h) => h.species === key).length;
    const ok = out[out.length - 1] >= 0.8 * out[0]; n++; if (ok) persist++; if (out[out.length - 1] > 0) alive++;
    const pk = (per[key] ??= [0, 0]); pk[1]++; if (ok) pk[0]++;
    console.log(`${key.padEnd(10)} ${pref}-${k} ${TERRAIN[m.terrain[home]].key.toLowerCase().padEnd(8)} ${String(Math.round(m.temp[home])).padStart(3)}C prey8 ${String(Math.round(best)).padStart(4)} rivalPred12 ${String(Math.round(rivals)).padStart(3)} y0,1,5,25,50,${years}: ${out.map((x) => x.toFixed(1).padStart(5)).join(' ')} herds ${herds} ${ok ? 'PERSISTS' : 'fails'}${process.env.ACC ? ` | herd-months ${acc.months} +${acc.grow.toFixed(1)} starve-${acc.starve.toFixed(1)} hostile-${acc.hostile.toFixed(1)} fed<.5 ${acc.hungry} (prey in reach ${acc.short}, none ${acc.empty}) .5-.75 ${acc.mid} hab<.2 ${acc.hostileM} | own need ${acc.ownNeed.toFixed(0)} rival need at its prey ${Object.entries(acc.rivals).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(' ')}` : ''}`);
  }
}
console.log(`${persist}/${n} hold or grow, ${alive}/${n} alive; ${Object.entries(per).map(([k, [a, b]]) => `${k} ${a}/${b}`).join(', ')}`);
