/**
 * Task 8 Part C (8h): what an airburst and a geomagnetic storm do, on the code at `root` (default: this checkout), so the
 * same script measures the code before and after the fix.
 *
 *   npx tsx docs/data/round10/t8c-probes/catastrophe.ts [root=../../../..] [worlds=6] [years=300]
 *
 * Part 1, one airburst on identical clones of an era-8 world (96², 6 nations), at the biggest capital and in wild
 * woodland (forest, taiga or jungle with no buildings within 2 tiles): deaths (the population ledger), standing buildings, crater tiles, burning tiles at once and a month later, land tiles whose
 * vegetation fell to 35% or less.
 * Part 2, geomagnetic storms in Realistic worlds that start in the Prehistoric era (64², no electricity for centuries):
 * storms drawn (catastrophe log) against storm events logged (an event is what draws the aurora).
 */
const root = process.argv[2] ?? '../../../..', worlds = Number(process.argv[3] ?? 6), years = Number(process.argv[4] ?? 300);
const base = new URL(`${root}/src/`, import.meta.url).href;
const { defaultConfig, PRESETS } = await import(`${base}config/laws.ts`);
const { createSimulation } = await import(`${base}sim/bootstrap.ts`);
const { Simulation } = await import(`${base}sim/simulation.ts`);
const { encodeWorld, decodeWorld } = await import(`${base}persistence/serialize.ts`);
const { asteroidImpact } = await import(`${base}world/catastrophes.ts`);
const { B } = await import(`${base}civilizations/buildingTypes.ts`);
const { T } = await import(`${base}world/terrain.ts`);

// part 1
const c = defaultConfig(); c.gen.seed = 't8c-airburst'; c.gen.width = 96; c.gen.height = 96; c.settings.startEra = 8;
const world = createSimulation(c); world.runYears(2); world.syncRng();
const save = encodeWorld(world.w);
const m0 = world.w.map;
const capital = [...world.w.civs.values()].filter((v: any) => v.alive).map((v: any) => world.w.settlements.get(v.capital)).filter(Boolean).sort((a: any, b: any) => b.pop - a.pop)[0];
let forest = -1;
for (let i = 0; i < m0.n && forest < 0; i++) {
  if (m0.terrain[i] !== T.FOREST && m0.terrain[i] !== T.TAIGA && m0.terrain[i] !== T.JUNGLE) continue;
  let ok = true;
  m0.forRadius(m0.xOf(i), m0.yOf(i), 2, (j: number) => { if (!m0.isLand(j) || m0.bld[j] || m0.veg[j] < 80) ok = false; });
  if (ok) forest = i;
}
for (const [label, x, y] of [['capital', capital.x, capital.y], ['wild woodland', m0.xOf(forest), m0.yOf(forest)]] as const) {
  const sim = new Simulation(decodeWorld(save));
  const m = sim.w.map;
  const dis0 = sim.w.popLedger?.disaster ?? 0;
  const veg0 = Array.from(m.veg) as number[];
  let bld0 = 0, crater0 = 0;
  m.forRadius(x, y, 4, (j: number) => { if (m.bld[j] && m.bld[j] !== B.RUINS && m.bld[j] !== B.CRATER) bld0++; if (m.bld[j] === B.CRATER) crater0++; });
  asteroidImpact(sim, x, y, 'airburst');
  const deaths = (sim.w.popLedger?.disaster ?? 0) - dis0; // the population ledger's disaster flow
  let bld1 = 0, crater1 = 0, burning = 0, flattened = 0;
  m.forRadius(x, y, 4, (j: number) => { if (m.bld[j] && m.bld[j] !== B.RUINS && m.bld[j] !== B.CRATER) bld1++; if (m.bld[j] === B.CRATER) crater1++; if (m.fire[j]) burning++; if (m.isLand(j) && veg0[j] > 0 && m.veg[j] <= veg0[j] * 0.35) flattened++; });
  sim.runTicks(10);
  let burningMonth = 0, burnedMonth = 0;
  m.forRadius(x, y, 6, (j: number) => { if (m.fire[j]) burningMonth++; if (m.isLand(j) && veg0[j] > 20 && m.veg[j] < veg0[j] * 0.1) burnedMonth++; });
  console.log(`airburst at ${label} (${x},${y}): deaths ${Math.round(deaths)} · standing buildings within 4 tiles ${bld0} -> ${bld1} (craters ${crater0} -> ${crater1}) · burning tiles ${burning}, a month later ${burningMonth} · flattened land tiles ${flattened} · land tiles burned to <10% of their vegetation a month later ${burnedMonth}`);
}

// part 2
let drawn = 0, logged = 0, electrified = 0;
for (let k = 0; k < worlds; k++) {
  const cfg = defaultConfig(); PRESETS.find((p: { key: string }) => p.key === 'realistic')!.apply(cfg);
  cfg.gen.seed = `t8c-storm-${k}`; cfg.gen.width = 64; cfg.gen.height = 64;
  const sim = createSimulation(cfg);
  sim.runYears(years);
  const log = sim.w.endings?.log ?? [];
  const d = log.filter((e: any) => e.type === 'geomagnetic_storm').length;
  const l = sim.w.events.filter((e: any) => e.type === 'geomagnetic_storm').length;
  const lit = [...sim.w.civs.values()].some((v: any) => v.alive && v.caps.electrification > 0);
  drawn += d; logged += l; if (lit) electrified++;
  console.log(`t8c-storm-${k}: ${years} years · storms drawn ${d} · storm events logged ${l} · an electrified nation at the end: ${lit}`);
}
console.log(`geomagnetic storms over ${worlds} worlds × ${years} years: drawn ${drawn}, logged (aurora shown) ${logged}; worlds electrified by the end: ${electrified}/${worlds}`);
