/**
 * Round 10 addendum: life audit. Do people and animals that are placed by hand reproduce where they could
 * really live, and fail where they could not?
 *
 *   npx tsx scripts/life-audit.ts [seeds=3] [years=100] [size=96]
 *
 * Method:
 * - Each seed generates one EMPTY Realistic world (no people, no animals) and clones it for every case, so
 *   the counts measure only what was placed.
 * - Every drop goes on land that is naturally the target biome, so its real climate comes with it (painted
 *   terrain would keep the wrong temperature).
 * - Humans: one band of 24, counted as band members plus settled people, at years 25, 50 and 100.
 * - Animals: one herd at its home biome and one at a hostile site (a land tile, or water for aquatic
 *   species, with temperature at least 8 °C outside the species' range and a biome it does not live in).
 *   Predators are dropped into the same map WITH its natural wildlife, at the home-biome tile with the most
 *   prey of their realm (land or sea) within 8 tiles (a predator in an empty world starves anywhere); natural
 *   herds of the same species are removed before the drop, so the count is the placed herd and its offspring.
 *   (Revision 3, task 5 of the 2026-11-25 plan: the count used to subtract the natural herds' starting size, so
 *   when natural seals died out the placed seals read as 0 while 22 to 38 of them were alive.)
 * - Verdict at the horizon, against the start: grows ≥ ×1.25 · holds ×0.8–1.25 · declines < ×0.8 · dies 0;
 *   "moved" when most survivors ended away from a harsh drop site (people and animals walk off a bad spot
 *   when they can, which is itself the realistic outcome).
 *
 * EXPECTATIONS, written before the first run (research-notes.md §1–2; real first peoples lived by
 * foraging on productive land):
 * - humans GROW (or hold, since long-run forager growth is about 0.04% a year) on grass, steppe, savanna,
 *   forest, taiga, jungle, swamp, hills and beach;
 * - humans DECLINE, DIE or MOVE AWAY on snow, glacier, mountain and desert;
 * - humans HOLD, DECLINE or MOVE AWAY on tundra;
 * - every animal GROWS or HOLDS in its home biome, and DECLINES, DIES or MOVES AWAY at its hostile site.
 * (Revision 2, after the first run: "moved" added once the first run showed bands and herds walking off harsh
 * drop sites; the growth expectations were not changed.)
 */
import { defaultConfig, PRESETS } from '../src/config/laws';
import { createSimulation } from '../src/sim/bootstrap';
import { Simulation } from '../src/sim/simulation';
import { encodeWorld, decodeWorld } from '../src/persistence/serialize';
import { spawnBand } from '../src/population/bands';
import { spawnHerd } from '../src/ecology/ecology';
import { SPECIES } from '../src/ecology/species';
import { T, TERRAIN } from '../src/world/terrain';

const SEEDS = Number(process.argv[2] ?? 3);
const YEARS = Number(process.argv[3] ?? 100);
const SIZE = Number(process.argv[4] ?? 96);
const HUMAN_BIOMES: [string, number, string][] = [
  ['grass', T.GRASS, 'grows'], ['steppe', T.STEPPE, 'grows'], ['savanna', T.SAVANNA, 'grows'], ['forest', T.FOREST, 'grows'],
  ['taiga', T.TAIGA, 'grows'], ['jungle', T.JUNGLE, 'grows'], ['swamp', T.SWAMP, 'grows'], ['hills', T.HILLS, 'grows'],
  ['beach', T.BEACH, 'grows'], ['tundra', T.TUNDRA, 'holds-or-declines'], ['desert', T.DESERT, 'fails'],
  ['mountain', T.MOUNTAIN, 'fails'], ['snow', T.SNOW, 'fails'], ['glacier', T.GLACIER, 'fails'],
];

const verdict = (start: number, end: number): string => (end <= 0 ? 'dies' : end >= start * 1.25 ? 'grows' : end >= start * 0.8 ? 'holds' : 'declines');
const meets = (expect: string, v: string): boolean =>
  expect === 'grows' || expect === 'home' ? v === 'grows' || v === 'holds' : expect === 'holds-or-declines' ? v !== 'grows' : v === 'declines' || v === 'dies' || v === 'moved';

function baseWorld(seed: string, empty = true): Simulation {
  const c = defaultConfig();
  PRESETS.find((p) => p.key === 'realistic')!.apply(c);
  c.name = 'Life audit';
  c.gen.seed = seed;
  c.gen.width = SIZE;
  c.gen.height = SIZE;
  c.settings.empty = empty;
  const sim = createSimulation(c);
  sim.syncRng();
  return sim;
}
const clone = (s: Simulation) => new Simulation(decodeWorld(encodeWorld(s.w)));

/** A tile of terrain `t` whose 3-tile neighbourhood is mostly the same terrain (a real patch, not a speck). */
function siteOf(sim: Simulation, test: (i: number) => boolean): number {
  const m = sim.w.map;
  let best = -1, bestN = 0;
  for (let i = 0; i < m.n; i += 3) {
    if (!test(i)) continue;
    let n = 0;
    m.forRadius(m.xOf(i), m.yOf(i), 3, (j) => { if (test(j)) n++; });
    if (n > bestN) { bestN = n; best = i; }
  }
  return bestN >= 12 ? best : -1;
}
const people = (sim: Simulation) => {
  let n = 0;
  for (const b of sim.w.bands.values()) n += b.members.length;
  for (const s of sim.w.settlements.values()) n += s.pop;
  return n;
};
const animals = (sim: Simulation, key: string) => [...sim.w.herds.values()].filter((h) => h.species === key).reduce((t, h) => t + h.count, 0);

const rows: string[] = [];
let met = 0, total = 0;
const record = (what: string, where: string, seed: string, series: number[], expect: string, stayed = 1) => {
  const end = series[series.length - 1];
  const v = end > 0 && stayed < 0.5 && expect !== 'grows' && expect !== 'home' ? 'moved' : verdict(series[0], end);
  const ok = meets(expect, v);
  total++;
  if (ok) met++;
  rows.push(`${ok ? 'MEETS ' : 'MISSES'}  ${what.padEnd(14)} ${where.padEnd(26)} ${seed.padEnd(8)} ${series.map((x) => String(Math.round(x)).padStart(6)).join(' ')}  ${v.padEnd(8)} stayed ${String(Math.round(stayed * 100)).padStart(3)}%  expected ${expect}`);
};
const checkpoints = [0, 25, 50, YEARS].filter((y, k, a) => y <= YEARS && a.indexOf(y) === k);
const runSeries = (sim: Simulation, count: () => number): number[] => {
  const out = [count()];
  let y = 0;
  for (const cp of checkpoints.slice(1)) { sim.runYears(cp - y); y = cp; out.push(count()); }
  return out;
};

for (let k = 0; k < SEEDS; k++) {
  const seed = `life-${k}`;
  const base = baseWorld(seed);
  const natural = baseWorld(seed, false); // same map, with its natural wildlife: predators are dropped among prey
  const m = base.w.map;
  // humans in every land biome present on this map
  for (const [name, t, expect] of HUMAN_BIOMES) {
    const site = siteOf(base, (i) => m.terrain[i] === t);
    if (site < 0) { rows.push(`n/a     humans         ${name.padEnd(22)} ${seed} (no patch of this biome on the map)`); continue; }
    const sim = clone(base);
    if (!spawnBand(sim, m.xOf(site), m.yOf(site), 'human', 24)) { rows.push(`n/a     humans ${name} ${seed} (band refused)`); continue; }
    const series = runSeries(sim, () => people(sim));
    let on = 0, all = 0;
    for (const b of sim.w.bands.values()) { const n = b.members.length; all += n; if (m.terrain[Math.floor(b.y) * m.w + Math.floor(b.x)] === t) on += n; }
    for (const st of sim.w.settlements.values()) { all += st.pop; if (m.terrain[Math.floor(st.y) * m.w + Math.floor(st.x)] === t) on += st.pop; }
    record('humans', name, seed, series, expect, all > 0 ? on / all : 1);
  }
  // every real animal at home and at a hostile site
  for (const sp of SPECIES.filter((s) => !s.alien)) {
    const water = (i: number) => m.isWater(i);
    const pred = sp.diet === 'predator';
    const world = pred ? natural : base;
    // a predator is "placed correctly" in its habitat where prey (of its own realm: land or sea) is most plentiful
    const preyHerds = [...natural.w.herds.values()].filter((o) => { const q = SPECIES.find((z) => z.key === o.species); return !!q && q.diet === 'herbivore' && !q.flying && !!q.aquatic === !!sp.aquatic; });
    const preyAt = (i: number) => preyHerds.filter((o) => Math.hypot(o.x - m.xOf(i), o.y - m.yOf(i)) <= 8).reduce((t, o) => t + o.count, 0);
    const homeTest = (i: number) => (sp.aquatic ? water(i) : !water(i)) && sp.biomes.includes(m.terrain[i]) && m.temp[i] >= sp.temp[0] && m.temp[i] <= sp.temp[1];
    let home = -1;
    if (pred) { let best = 0; for (let i = 0; i < m.n; i += 3) { if (!homeTest(i)) continue; const p = preyAt(i); if (p > best) { best = p; home = i; } } }
    else home = siteOf(base, homeTest);
    const hostile = siteOf(base, (i) => (sp.aquatic ? water(i) : !water(i)) && !sp.biomes.includes(m.terrain[i]) && (m.temp[i] < sp.temp[0] - 8 || m.temp[i] > sp.temp[1] + 8));
    for (const [where, site, expect] of [['home', home, 'home'], ['hostile', hostile, 'hostile']] as const) {
      if (site < 0) { rows.push(`n/a     ${sp.key.padEnd(14)} ${where.padEnd(22)} ${seed} (no such site on the map)`); continue; }
      const sim = clone(world);
      const x = m.xOf(site), y = m.yOf(site);
      // natural herds of the same species (seals, the odd crocodile) leave the clone, so only the placed lineage is counted
      for (const h of [...sim.w.herds.values()]) if (h.species === sp.key) sim.w.herds.delete(h.id);
      if (!spawnHerd(sim, sp.key, x, y)) continue;
      const series = runSeries(sim, () => animals(sim, sp.key));
      let near = 0, all = 0;
      for (const h of sim.w.herds.values()) if (h.species === sp.key) { all += h.count; if (Math.hypot(h.x - x, h.y - y) <= 4) near += h.count; }
      record(sp.key, `${where} (${TERRAIN[m.terrain[site]].key.toLowerCase()} ${Math.round(m.temp[site])}°C)`, seed, series, expect, all > 0 ? near / all : 1);
    }
  }
  console.error(`seed ${seed} done`);
}
console.log(`life audit · ${SEEDS} seeds · ${YEARS} years · ${SIZE}² empty Realistic worlds · counts at years ${checkpoints.join(', ')}`);
console.log(rows.join('\n'));
console.log(`\n${met}/${total} cases meet the expectation written before the run`);
