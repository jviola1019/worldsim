/**
 * Task 8 Part C: does the home search send packs after prey they never eat? In each natural world (Realistic, 96²,
 * after 25 years so packs are spread out) every wild land predator herd is made hungry (hunger 1) and pickTarget runs
 * once; a target on an omnivore herd (boar or bear: the monthly feeding takes herbivores only) counts as a wrong pick.
 *
 *   npx tsx docs/data/round10/t8c-probes/omni.ts [worlds=30] [prefix=pred] [root=../../../..]
 */
const worlds = Number(process.argv[2] ?? 30), pref = process.argv[3] ?? 'pred', root = process.argv[4] ?? '../../../..';
const base = new URL(`${root}/src/`, import.meta.url).href;
const { defaultConfig, PRESETS } = await import(`${base}config/laws.ts`);
const { createSimulation } = await import(`${base}sim/bootstrap.ts`);
const { pickTarget } = await import(`${base}ecology/ecology.ts`);
const { SPECIES_BY_KEY } = await import(`${base}ecology/species.ts`);
let picks = 0, wrong = 0;
for (let k = 0; k < worlds; k++) {
  const c = defaultConfig(); PRESETS.find((p: { key: string }) => p.key === 'realistic')!.apply(c);
  c.gen.seed = `${pref}-${k}`; c.gen.width = 96; c.gen.height = 96;
  const sim = createSimulation(c); sim.runYears(25);
  const herds = [...sim.w.herds.values()];
  for (const h of herds) {
    const sp = SPECIES_BY_KEY[h.species];
    if (sp?.diet !== 'predator' || sp.aquatic) continue;
    h.hunger = 1;
    pickTarget(sim, h, sp);
    picks++;
    const on = herds.find((o) => o !== h && Math.hypot(o.x - h.tx, o.y - h.ty) < 1e-6);
    if (on && SPECIES_BY_KEY[on.species]?.diet === 'omnivore') wrong++;
  }
}
console.log(`${wrong}/${picks} hungry land-predator target picks were omnivore herds (boar, bear) over ${worlds} worlds at year 25`);
