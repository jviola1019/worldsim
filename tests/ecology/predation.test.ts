/**
 * Round 10 addendum (life audit): predators coexist with their prey. Two root causes were found:
 * - land predators were weighted 0.25 at seeding but needed a weight above 0.3, so none was ever seeded;
 * - one pack could remove 18% of a prey herd every month (about 90% a year), so packs ate their prey and then starved.
 */
import { describe, it, expect } from 'vitest';
import { defaultConfig, PRESETS } from '../../src/config/laws';
import { createSimulation } from '../../src/sim/bootstrap';
import { spawnHerd, habitat, pickTarget } from '../../src/ecology/ecology';
import { SPECIES_BY_KEY } from '../../src/ecology/species';
import { BALANCE } from '../../src/config/balance';
import { T } from '../../src/world/terrain';

const world = (seed: string, empty: boolean) => {
  const c = defaultConfig();
  PRESETS.find((p) => p.key === 'realistic')!.apply(c);
  c.gen.seed = seed; c.gen.width = 96; c.gen.height = 96; c.settings.empty = empty;
  return createSimulation(c);
};
const count = (sim: ReturnType<typeof world>, key: string) => [...sim.w.herds.values()].filter((h) => h.species === key).reduce((t, h) => t + h.count, 0);
/** The tile whose 3-tile neighbourhood holds the most tiles that pass `ok` (the middle of a real patch). */
const site = (sim: ReturnType<typeof world>, ok: (i: number) => boolean) => {
  const m = sim.w.map;
  let best = -1, bestN = 0;
  for (let i = 0; i < m.n; i++) {
    if (!ok(i)) continue;
    let n = 0;
    m.forRadius(m.xOf(i), m.yOf(i), 3, (j) => { if (ok(j)) n++; });
    if (n > bestN) { bestN = n; best = i; }
  }
  if (best < 0) throw new Error('no site');
  return best;
};

describe('predators', () => {
  it('land predators are seeded in natural worlds', () => {
    let predators = 0;
    for (const seed of ['eco-0', 'eco-1', 'eco-2']) {
      const sim = world(seed, false);
      predators += [...sim.w.herds.values()].filter((h) => SPECIES_BY_KEY[h.species]?.diet === 'predator' && !SPECIES_BY_KEY[h.species]?.aquatic).length;
    }
    expect(predators).toBeGreaterThan(0);
  });

  it('every predator in a natural world starts within reach of prey (12 tiles), in country it can live in', () => {
    for (const seed of ['eco-0', 'eco-1', 'eco-2', 'eco-3']) {
      const sim = world(seed, false);
      const m = sim.w.map;
      for (const h of sim.w.herds.values()) {
        const sp = SPECIES_BY_KEY[h.species];
        if (sp.diet !== 'predator') continue;
        const prey = [...sim.w.herds.values()].some((o) => SPECIES_BY_KEY[o.species].diet === 'herbivore' && Math.hypot(o.x - h.x, o.y - h.y) <= 12);
        expect(prey, `${seed} ${h.species}`).toBe(true);
        expect(habitat(sim, sp, Math.floor(h.y) * m.w + Math.floor(h.x)), `${seed} ${h.species}`).toBeGreaterThanOrEqual(0.2);
      }
    }
  });

  it('one month of predation takes at most the cap from a prey herd', () => {
    const sim = world('pred-cap', true);
    const m = sim.w.map;
    const i = site(sim, (j) => m.terrain[j] === T.FOREST && m.temp[j] > 0 && m.temp[j] < 20);
    const deer = spawnHerd(sim, 'deer', m.xOf(i), m.yOf(i), 30)!;
    spawnHerd(sim, 'wolf', m.xOf(i), m.yOf(i), 14);
    sim.runTicks(10); // one month: every herd's monthly update runs once
    expect(sim.w.herds.get(deer.id)!.count).toBeGreaterThanOrEqual(30 * (1 - BALANCE.predationCap) - 0.01);
  });

  it('predators never take more of a slow-breeding herd in a month than it can regrow (buffalo grow 12% a year)', () => {
    const sim = world('pred-slow', true);
    const m = sim.w.map;
    const i = site(sim, (j) => (m.terrain[j] === T.JUNGLE || m.terrain[j] === T.SWAMP) && m.temp[j] >= 18);
    const buffalo = spawnHerd(sim, 'buffalo', m.xOf(i), m.yOf(i), 30)!;
    spawnHerd(sim, 'crocodile', m.xOf(i), m.yOf(i), 10);
    sim.runTicks(10);
    expect(sim.w.herds.get(buffalo.id)!.count).toBeGreaterThanOrEqual(30 * (1 - SPECIES_BY_KEY.buffalo.growth / 12) - 0.01);
  });

  it('a wolf pack among plentiful deer persists for 50 years, and so do the deer', () => {
    const sim = world('pred-wolf', true);
    const m = sim.w.map;
    const i = site(sim, (j) => m.terrain[j] === T.FOREST && m.temp[j] >= 5 && m.temp[j] <= 18);
    for (let k = 0; k < 6; k++) spawnHerd(sim, 'deer', m.xOf(i) + (k % 3) * 2, m.yOf(i) + Math.floor(k / 3) * 2, 30);
    spawnHerd(sim, 'wolf', m.xOf(i), m.yOf(i), 6);
    sim.runYears(50);
    expect(count(sim, 'wolf')).toBeGreaterThan(0);
    expect(count(sim, 'deer')).toBeGreaterThan(0);
  }, 120000);

  it('seals among fish shoals persist for 50 years', () => {
    const sim = world('pred-seal', true);
    const m = sim.w.map;
    const i = site(sim, (j) => m.terrain[j] === T.OCEAN && m.temp[j] < 6);
    // fish are everywhere in a natural ocean: a colony beside one lone shoal followed it into warm water and starved
    for (let q = 0; q < 4; q++) spawnHerd(sim, 'fish', m.xOf(i) + (q % 2) * 3, m.yOf(i) + Math.floor(q / 2) * 3, 200);
    spawnHerd(sim, 'seal', m.xOf(i), m.yOf(i), 16);
    sim.runYears(50);
    expect(count(sim, 'seal')).toBeGreaterThan(0);
  }, 120000);
});

describe('sea animals (life audit)', () => {
  it('a whale in shallow coastal water is out of its range but not starving, and a seal in warm water is stressed', () => {
    const sim = world('sea-hab', true);
    const m = sim.w.map;
    const shallowCold = site(sim, (j) => m.terrain[j] === T.SHALLOW && m.temp[j] > -2 && m.temp[j] < 10);
    expect(habitat(sim, SPECIES_BY_KEY.whale, shallowCold)).toBeGreaterThanOrEqual(0.2);
    const warm = site(sim, (j) => m.isWater(j) && m.temp[j] > 26);
    expect(habitat(sim, SPECIES_BY_KEY.seal, warm)).toBeLessThan(0.2);
    const land = site(sim, (j) => !m.isWater(j));
    expect(habitat(sim, SPECIES_BY_KEY.whale, land)).toBe(0);
  });
});

describe('predators stay in country they can live in (life audit)', () => {
  it('a great cat does not chase prey up into a cold mountain', () => {
    const sim = world('pred-range', true);
    const m = sim.w.map;
    const cold = site(sim, (j) => m.terrain[j] === T.MOUNTAIN && m.temp[j] < 0);
    const warm = site(sim, (j) => m.terrain[j] === T.SAVANNA || (m.terrain[j] === T.GRASS && m.temp[j] > 18));
    const cat = spawnHerd(sim, 'bigcat', m.xOf(warm), m.yOf(warm), 3)!;
    // the only prey: a deer herd standing on the cold mountain, within the cat's 12-tile search
    const deer = spawnHerd(sim, 'deer', m.xOf(cold), m.yOf(cold), 30)!;
    deer.x = cat.x + 6; deer.y = cat.y; deer.tx = deer.x; deer.ty = deer.y;
    const coldTile = Math.floor(deer.y) * m.w + Math.floor(deer.x);
    m.terrain[coldTile] = T.MOUNTAIN; m.temp[coldTile] = -10;
    pickTarget(sim, cat);
    expect(Math.hypot(cat.tx - deer.x, cat.ty - deer.y)).toBeGreaterThan(0.5);
  });
});
