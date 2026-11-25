/**
 * Round 10 addendum (life audit): predators coexist with their prey. Two root causes were found:
 * - land predators were weighted 0.25 at seeding but needed a weight above 0.3, so none was ever seeded;
 * - one pack could remove 18% of a prey herd every month (about 90% a year), so packs ate their prey and then starved.
 */
import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/sim/simulation';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
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
        // edible prey of its own realm: not birds (almost no food), not sea animals for a land predator (review fix)
        const prey = [...sim.w.herds.values()].some((o) => { const q = SPECIES_BY_KEY[o.species]; return q.diet === 'herbivore' && !q.flying && q.meat >= 0.01 && !!q.aquatic === !!sp.aquatic && Math.hypot(o.x - h.x, o.y - h.y) <= 12; });
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
    // a deer herd standing on the cold mountain, within the cat's 12-tile search, and a farther one at home. (Task 5: with
    // no home prey at all a hungry cat now ranges for the cold herd, so the test needs one at home to show the preference.)
    const homeDeer = spawnHerd(sim, 'deer', m.xOf(warm), m.yOf(warm), 30)!;
    homeDeer.x = cat.x - 9; homeDeer.y = cat.y; homeDeer.tx = homeDeer.x; homeDeer.ty = homeDeer.y;
    const homeTile = Math.floor(homeDeer.y) * m.w + Math.floor(homeDeer.x);
    m.terrain[homeTile] = T.SAVANNA; m.temp[homeTile] = 25;
    const deer = spawnHerd(sim, 'deer', m.xOf(cold), m.yOf(cold), 30)!;
    deer.x = cat.x + 6; deer.y = cat.y; deer.tx = deer.x; deer.ty = deer.y;
    const coldTile = Math.floor(deer.y) * m.w + Math.floor(deer.x);
    m.terrain[coldTile] = T.MOUNTAIN; m.temp[coldTile] = -10;
    pickTarget(sim, cat);
    expect(Math.hypot(cat.tx - deer.x, cat.ty - deer.y)).toBeGreaterThan(0.5);
  });
});

describe('predators hunt in their own realm (review fix)', () => {
  it('wolves on a coast do not eat fish, and seals do not take deer from the beach', () => {
    const base = world('pred-realm', true);
    const m = base.w.map;
    const coast = site(base, (j) => !m.isWater(j) && m.isCoastal(j) && m.temp[j] > 0 && m.temp[j] < 15);
    let sea = -1;
    m.forRadius(m.xOf(coast), m.yOf(coast), 2, (j) => { if (sea < 0 && m.isWater(j)) sea = j; });
    const far = site(base, (j) => !m.isWater(j) && Math.hypot(m.xOf(j) - m.xOf(coast), m.yOf(j) - m.yOf(coast)) > 30);
    let farSea = -1;
    for (let j = 0; j < m.n && farSea < 0; j++) if (m.isWater(j) && Math.hypot(m.xOf(j) - m.xOf(coast), m.yOf(j) - m.yOf(coast)) > 30) farSea = j;
    const run = (near: boolean) => {
      base.syncRng();
      const sim = new Simulation(decodeWorld(encodeWorld(base.w)));
      const fish = spawnHerd(sim, 'fish', m.xOf(sea), m.yOf(sea), 200)!;
      const deer = spawnHerd(sim, 'deer', m.xOf(coast), m.yOf(coast), 30)!;
      // the same predators, with the same random draws: beside the prey, or far away (the control)
      spawnHerd(sim, 'wolf', near ? m.xOf(coast) : m.xOf(far), near ? m.yOf(coast) : m.yOf(far), 8);
      spawnHerd(sim, 'seal', near ? m.xOf(sea) : m.xOf(farSea), near ? m.yOf(sea) : m.yOf(farSea), 16);
      sim.runTicks(10);
      return { fish: sim.w.herds.get(fish.id)?.count ?? 0, deer: sim.w.herds.get(deer.id)?.count ?? 0 };
    };
    const control = run(false), hunted = run(true);
    // each prey herd loses at most one hunter's monthly cap (plus that month's growth on it): seals take fish, wolves
    // take deer, nobody crosses over (before the fix wolves also took fish: about twice the loss)
    expect(control.fish - hunted.fish).toBeLessThanOrEqual(200 * BALANCE.predationCap * (1 + SPECIES_BY_KEY.fish.growth / 12));
    expect(control.deer - hunted.deer).toBeLessThanOrEqual(30 * BALANCE.predationCap * (1 + SPECIES_BY_KEY.deer.growth / 12));
  });
});

describe('predators hunt at home first, then range, and go back (design 6.3)', () => {
  const cat = (sim: ReturnType<typeof world>) => {
    const m = sim.w.map;
    const i = site(sim, (j) => m.terrain[j] === T.SAVANNA || (m.terrain[j] === T.GRASS && m.temp[j] > 18));
    return { m, i, bigcat: spawnHerd(sim, 'bigcat', m.xOf(i), m.yOf(i), 3)! };
  };
  const tileAt = (sim: ReturnType<typeof world>, x: number, y: number) => Math.floor(y) * sim.w.map.w + Math.floor(x);
  /** Make a tile savanna (home for a great cat) or frozen mountain (hostile) and put a deer herd on it. */
  const prey = (sim: ReturnType<typeof world>, x: number, y: number, home: boolean, n = 30) => {
    const m = sim.w.map;
    const d = spawnHerd(sim, 'deer', Math.floor(x), Math.floor(y), n)!;
    const t = tileAt(sim, d.x, d.y);
    m.terrain[t] = home ? T.SAVANNA : T.MOUNTAIN; m.temp[t] = home ? 25 : -10;
    return d;
  };
  const pin = (sim: ReturnType<typeof world>, h: { x: number; y: number }, hab: boolean) => {
    const m = sim.w.map;
    const t = tileAt(sim, h.x, h.y);
    m.terrain[t] = hab ? T.SAVANNA : T.MOUNTAIN; m.temp[t] = hab ? 25 : -10;
  };

  it('(a) prey 8 tiles off in habitat beats prey 6 tiles off outside habitat', () => {
    const sim = world('hunt-a', true);
    const { bigcat } = cat(sim);
    pin(sim, bigcat, true);
    const far = prey(sim, bigcat.x + 8, bigcat.y, true);
    prey(sim, bigcat.x, bigcat.y + 6, false);
    pickTarget(sim, bigcat);
    expect(bigcat.tx).toBeCloseTo(far.x, 5); expect(bigcat.ty).toBeCloseTo(far.y, 5);
  });

  it('(b) with no home prey within 12, it goes for prey 20 tiles off in hostile land', () => {
    const sim = world('hunt-b', true);
    const { bigcat } = cat(sim);
    pin(sim, bigcat, true);
    const d = prey(sim, bigcat.x + 20, bigcat.y, false);
    pickTarget(sim, bigcat);
    expect(bigcat.tx).toBeCloseTo(d.x, 5); expect(bigcat.ty).toBeCloseTo(d.y, 5);
  });

  it('the second search keeps to the predator realm: a land cat ignores sea fish and a seal ignores deer', () => {
    const sim = world('hunt-realm', true);
    const { m, bigcat } = cat(sim);
    pin(sim, bigcat, true);
    let sea = -1;
    for (let j = 0; j < m.n && sea < 0; j++) if (m.isWater(j) && Math.hypot(m.xOf(j) - bigcat.x, m.yOf(j) - bigcat.y) < 22) sea = j;
    if (sea >= 0) {
      const fish = spawnHerd(sim, 'fish', m.xOf(sea), m.yOf(sea), 200)!;
      pickTarget(sim, bigcat);
      expect(Math.hypot(bigcat.tx - fish.x, bigcat.ty - fish.y)).toBeGreaterThan(0.5);
    }
  });

  it('(c) with no prey within 24 it picks a habitat tile', () => {
    const sim = world('hunt-c', true);
    const { m, bigcat } = cat(sim);
    for (let k = 0; k < 20; k++) {
      pickTarget(sim, bigcat);
      expect(habitat(sim, SPECIES_BY_KEY.bigcat, tileAt(sim, bigcat.tx, bigcat.ty)), `pick ${k}`).toBeGreaterThan(0);
      expect(m.isWater(tileAt(sim, bigcat.tx, bigcat.ty))).toBe(false);
    }
  });

  it('(d) a fed predator stranded in hostile land heads back to habitat', () => {
    const sim = world('hunt-d', true);
    const { m, bigcat } = cat(sim);
    // a small cold patch around the cat, home just outside it
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const t = tileAt(sim, bigcat.x + dx, bigcat.y + dy);
      if (!m.isWater(t)) { m.terrain[t] = T.MOUNTAIN; m.temp[t] = -10; }
    }
    bigcat.hunger = 0;
    expect(habitat(sim, SPECIES_BY_KEY.bigcat, tileAt(sim, bigcat.x, bigcat.y))).toBeLessThan(0.2);
    for (let k = 0; k < 10; k++) {
      pickTarget(sim, bigcat);
      expect(habitat(sim, SPECIES_BY_KEY.bigcat, tileAt(sim, bigcat.tx, bigcat.ty)), `pick ${k}`).toBeGreaterThanOrEqual(0.2);
    }
  });

  it('(e) hunger resets only after a real meal (fed >= 0.5)', () => {
    const month = (preyCount: number) => {
      const sim = world('hunt-e', true);
      const { bigcat } = cat(sim);
      pin(sim, bigcat, true);
      bigcat.count = 8; // needs 2.4 prey a month
      bigcat.hunger = 2;
      prey(sim, bigcat.x + 1, bigcat.y, true, preyCount);
      sim.runTicks(10);
      return sim.w.herds.get(bigcat.id)!.hunger;
    };
    expect(month(2)).toBe(3);  // a token herd: takes far less than half of what the pack needs
    expect(month(400)).toBe(0); // plenty: a full meal
  });

  it('with no prey anywhere a predator stays in its home range and starves slowly (24 months)', () => {
    const sim = world('hunt-none', true);
    const { m, bigcat } = cat(sim);
    const hab = (h: { x: number; y: number }) => habitat(sim, SPECIES_BY_KEY.bigcat, tileAt(sim, h.x, h.y));
    expect(hab(bigcat)).toBeGreaterThanOrEqual(0.2);
    const x0 = bigcat.x, y0 = bigcat.y;
    let maxD = 0, outside = 0, ticks = 0;
    for (let mo = 0; mo < 24; mo++) {
      for (let t = 0; t < 10; t++) {
        sim.runTicks(1); ticks++;
        const h = sim.w.herds.get(bigcat.id);
        if (!h) break;
        maxD = Math.max(maxD, Math.hypot(h.x - x0, h.y - y0));
        if (hab(h) < 0.2) outside++;
      }
    }
    const h = sim.w.herds.get(bigcat.id);
    expect(m.w).toBeGreaterThan(0);
    // 24 months with a 12-tile home search and no prey to chase: never across the map, and almost never out of habitat
    expect(maxD).toBeLessThan(30);
    expect(outside / ticks).toBeLessThan(0.1);
    if (h) expect(h.count).toBeLessThan(3.0001); // it does not grow without food
  }, 120000);
});
