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
import { spawnHerd, habitat, pickTarget, dispersalTarget, preyShare, preyReplaceable, huntNeed } from '../../src/ecology/ecology';
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

  it('one month of predation takes at most what the prey herd can replace (task 5: was a flat 2% cap)', () => {
    const sim = world('pred-cap', true);
    const m = sim.w.map;
    const i = site(sim, (j) => m.terrain[j] === T.FOREST && m.temp[j] > 0 && m.temp[j] < 20);
    const deer = spawnHerd(sim, 'deer', m.xOf(i), m.yOf(i), 30)!;
    spawnHerd(sim, 'wolf', m.xOf(i), m.yOf(i), 14);
    sim.runTicks(10); // one month: every herd's monthly update runs once
    // a lone herd's yield at half capacity with the best genes: r * 1.4 * (K/2) * (1/2) / 12
    const K = SPECIES_BY_KEY.deer.maxHerd * 1.3;
    expect(sim.w.herds.get(deer.id)!.count).toBeGreaterThanOrEqual(30 - (SPECIES_BY_KEY.deer.growth * 1.4 * K * 0.25) / 12 - 0.01);
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
    // the same predators, with the same random draws, each placed beside the prey or far away (fix round 1: one
    // hunter at a time, so a hunter crossing realms shows as a loss the other realm's hunter cannot explain)
    const run = (wolvesNear: boolean, sealsNear: boolean) => {
      base.syncRng();
      const sim = new Simulation(decodeWorld(encodeWorld(base.w)));
      const fish = spawnHerd(sim, 'fish', m.xOf(sea), m.yOf(sea), 200)!;
      const deer = spawnHerd(sim, 'deer', m.xOf(coast), m.yOf(coast), 30)!;
      spawnHerd(sim, 'wolf', wolvesNear ? m.xOf(coast) : m.xOf(far), wolvesNear ? m.yOf(coast) : m.yOf(far), 8);
      spawnHerd(sim, 'seal', sealsNear ? m.xOf(sea) : m.xOf(farSea), sealsNear ? m.yOf(sea) : m.yOf(farSea), 16);
      sim.runTicks(10);
      return { fish: sim.w.herds.get(fish.id)?.count ?? 0, deer: sim.w.herds.get(deer.id)?.count ?? 0 };
    };
    const control = run(false, false), wolves = run(true, false), seals = run(false, true);
    // no hunter eats in the other realm: wolves beside the shoal take no fish, seals beside the deer take no deer (before
    // the review fix wolves took fish; with the realm filter removed this assertion fails, fix round 1)
    expect(Math.abs(control.fish - wolves.fish), 'fish taken by wolves').toBeLessThan(0.05);
    expect(Math.abs(control.deer - seals.deer), 'deer taken by seals').toBeLessThan(0.05);
    // and each does eat in its own (so the zeros above are not just hunters that never hunt)
    expect(control.deer - wolves.deer, 'deer taken by wolves').toBeGreaterThan(0.05);
    expect(control.fish - seals.fish, 'fish taken by seals').toBeGreaterThan(0.5);
  });
});

describe('crocodiles fish (task 8 part C)', () => {
  it('a crocodile on a warm shore lives on the fish shoal beside it, while wolves on the same shore still take no fish', () => {
    const base = world('pred-croc-fish', true);
    const m = base.w.map;
    const shore = site(base, (j) => !m.isWater(j) && m.isCoastal(j) && m.temp[j] >= 19 && m.temp[j] <= 25);
    let sea = -1;
    m.forRadius(m.xOf(shore), m.yOf(shore), 2, (j) => { if (sea < 0 && m.isWater(j)) sea = j; });
    m.forRadius(m.xOf(shore), m.yOf(shore), 1, (j) => { if (!m.isWater(j)) m.terrain[j] = T.SWAMP; }); // crocodile country
    const far = site(base, (j) => !m.isWater(j) && Math.hypot(m.xOf(j) - m.xOf(shore), m.yOf(j) - m.yOf(shore)) > 30);
    base.syncRng();
    // the same hunters with the same draws, beside the shoal or far away; no land prey anywhere
    const run = (crocNear: boolean, wolvesNear: boolean) => {
      const sim = new Simulation(decodeWorld(encodeWorld(base.w)));
      const fish = spawnHerd(sim, 'fish', m.xOf(sea), m.yOf(sea), 200)!;
      const croc = spawnHerd(sim, 'crocodile', crocNear ? m.xOf(shore) : m.xOf(far), crocNear ? m.yOf(shore) : m.yOf(far), 6)!;
      spawnHerd(sim, 'wolf', wolvesNear ? m.xOf(shore) : m.xOf(far) + 1, wolvesNear ? m.yOf(shore) : m.yOf(far), 8);
      sim.runTicks(10);
      return { fish: sim.w.herds.get(fish.id)?.count ?? 0, crocHunger: sim.w.herds.get(croc.id)?.hunger ?? -1 };
    };
    const control = run(false, false), crocs = run(true, false), wolves = run(false, true);
    expect(control.fish - crocs.fish, 'fish taken by crocodiles').toBeGreaterThan(0.1);
    expect(crocs.crocHunger, 'a crocodile beside fish has eaten').toBe(0);
    expect(Math.abs(control.fish - wolves.fish), 'fish taken by wolves').toBeLessThan(0.05);
  });
});

describe('great cats live in forest too (task 8 part C)', () => {
  it('warm forest is home ground for a great cat (tigers, leopards and jaguars are forest cats); steppe and hills are not', () => {
    const sim = world('pred-cat-forest', true);
    const m = sim.w.map;
    const i = site(sim, (j) => !m.isWater(j) && m.temp[j] > 15);
    const cat = SPECIES_BY_KEY.bigcat;
    m.temp[i] = 20;
    m.terrain[i] = T.FOREST;
    expect(habitat(sim, cat, i), 'forest').toBe(1);
    m.terrain[i] = T.STEPPE;
    expect(habitat(sim, cat, i), 'steppe').toBe(0.25);
    m.terrain[i] = T.HILLS;
    expect(habitat(sim, cat, i), 'hills').toBe(0.25);
  });
});

describe('the home search looks only for prey the pack can eat (task 8 part C)', () => {
  it('a hungry wolf pack passes over a boar sounder beside it for the deer further off (it never eats omnivores)', () => {
    const sim = world('pred-omni', true);
    const m = sim.w.map;
    const i = site(sim, (j) => !m.isWater(j) && m.temp[j] > 0 && m.temp[j] < 20);
    m.forRadius(m.xOf(i), m.yOf(i), 12, (j) => { if (!m.isWater(j)) { m.terrain[j] = T.FOREST; m.temp[j] = 10; } });
    const wolves = spawnHerd(sim, 'wolf', m.xOf(i), m.yOf(i), 6)!;
    wolves.hunger = 1; // hungry: it picks its prey
    const boar = spawnHerd(sim, 'boar', m.xOf(i), m.yOf(i), SPECIES_BY_KEY.boar.maxHerd)!;
    boar.x = boar.tx = wolves.x + 3; boar.y = boar.ty = wolves.y;
    const deer = spawnHerd(sim, 'deer', m.xOf(i), m.yOf(i), SPECIES_BY_KEY.deer.maxHerd)!;
    deer.x = deer.tx = wolves.x - 10; deer.y = deer.ty = wolves.y;
    pickTarget(sim, wolves);
    expect(Math.hypot(wolves.tx - deer.x, wolves.ty - deer.y), 'heads for the deer').toBeLessThanOrEqual(BALANCE.huntReach / 2);
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
    bigcat.hunger = 1; // task 5: a fed pack with prey in its territory holds its range; a hungry one picks its prey
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
      bigcat.count = 1.5; // needs 0.5 prey a month (the floor)
      bigcat.hunger = 2;
      // wild horses on the cat's savanna (their own habitat too, so the herd is growing and can be cropped)
      const h = spawnHerd(sim, 'horse', Math.floor(bigcat.x) + 1, Math.floor(bigcat.y), preyCount)!;
      pin(sim, h, true);
      sim.runTicks(10);
      return sim.w.herds.get(bigcat.id)!.hunger;
    };
    expect(month(2)).toBe(3);  // a token herd: below the refuge, nothing to take (task 5: was a deer herd of 2)
    expect(month(50)).toBe(0); // a full herd: what it replaces in a month is a real meal for one cat (task 5: was 400 deer for 8 cats)
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

describe('territorial hunting: kills are what the prey can replace (task 5, owner option C)', () => {
  /** One month on a forest patch: a deer herd of `deer`, with or without a hungry wolf pack of `wolves` beside it (same draws). */
  const monthLoss = (seed: string, deer: number, wolves: number, packs = 1) => {
    const base = world(seed, true);
    const m = base.w.map;
    const i = site(base, (j) => m.terrain[j] === T.FOREST && m.temp[j] > 2 && m.temp[j] < 18);
    base.syncRng();
    const run = (hunt: boolean) => {
      const sim = new Simulation(decodeWorld(encodeWorld(base.w)));
      const d = spawnHerd(sim, 'deer', m.xOf(i), m.yOf(i), deer)!;
      for (let k = 0; k < packs; k++) spawnHerd(sim, 'wolf', hunt ? m.xOf(i) : 0, hunt ? m.yOf(i) : 0, wolves)!.hunger = 1;
      sim.runTicks(10);
      return sim.w.herds.get(d.id)?.count ?? 0;
    };
    return run(false) - run(true);
  };
  const deer = SPECIES_BY_KEY.deer;
  const K = deer.maxHerd * 1.3; // a lone herd's capacity

  it('a pack takes at most what a full herd can replace in a month (its yield at half capacity)', () => {
    const loss = monthLoss('terr-msy', deer.maxHerd, 14);
    expect(loss).toBeGreaterThan(0); // it does eat
    // logistic yield at K/2 with the best genes (x1.4) and full habitat: r * 1.4 * (K/2) * (1/2) / 12
    expect(loss).toBeLessThanOrEqual((deer.growth * 1.4 * (K / 2) * 0.5) / 12 + 1e-6);
  });

  it('packs whose territories overlap share what a herd can replace: two packs take no more than one', () => {
    const loss = monthLoss('terr-share', deer.maxHerd, 14, 2);
    expect(loss).toBeGreaterThan(0);
    expect(loss).toBeLessThanOrEqual((deer.growth * 1.4 * (K / 2) * 0.5) / 12 + 1e-6);
  });

  it('hunters share a herd by what they need: a pack of 12 gets six times the share of a pair (splitting gains nothing)', () => {
    const sim = world('terr-need', true);
    const m = sim.w.map;
    const i = site(sim, (j) => m.terrain[j] === T.FOREST && m.temp[j] > 2 && m.temp[j] < 18);
    const d = spawnHerd(sim, 'deer', m.xOf(i), m.yOf(i), deer.maxHerd)!;
    const big = spawnHerd(sim, 'wolf', m.xOf(i), m.yOf(i), 12)!;
    const pair = spawnHerd(sim, 'wolf', m.xOf(i), m.yOf(i), 2)!;
    expect(preyShare(sim, d, big) / preyShare(sim, d, pair)).toBeCloseTo(6, 5);
    expect(preyShare(sim, d, big) + preyShare(sim, d, pair)).toBeCloseTo(preyReplaceable(sim, d), 6);
  });

  it('a herd below the refuge (a quarter of its capacity) is not hunted at all', () => {
    expect(monthLoss('terr-refuge', Math.floor(K * BALANCE.predationRefuge) - 1, 14)).toBeCloseTo(0, 6);
  });

  it('a herd cropped below half its capacity grows back while a pack keeps hunting it (it is not pinned there)', () => {
    const sim = world('terr-regrow', true);
    const m = sim.w.map;
    const i = site(sim, (j) => m.terrain[j] === T.FOREST && m.temp[j] > 2 && m.temp[j] < 18);
    spawnHerd(sim, 'deer', m.xOf(i), m.yOf(i), 16);
    const pack = spawnHerd(sim, 'wolf', m.xOf(i), m.yOf(i), 14)!;
    for (let mo = 0; mo < 48; mo++) {
      sim.runTicks(10);
      // the pack never starves, splits or leaves: one pack's full pressure every month
      pack.count = 14; pack.hunger = 0; pack.x = pack.tx = m.xOf(i) + 0.5; pack.y = pack.ty = m.yOf(i) + 0.5; sim.w.herds.set(pack.id, pack);
    }
    expect(count(sim, 'deer')).toBeGreaterThan(18); // growing towards half capacity (26), where it yields most
  }, 120000);

  it('three hungry packs kept at full strength around one lone deer herd do not strip it in 20 years', () => {
    const sim = world('terr-strip', true);
    const m = sim.w.map;
    const i = site(sim, (j) => m.terrain[j] === T.FOREST && m.temp[j] > 2 && m.temp[j] < 18);
    spawnHerd(sim, 'deer', m.xOf(i), m.yOf(i), 30);
    const packs = [0, 1, 2].map(() => spawnHerd(sim, 'wolf', m.xOf(i), m.yOf(i), 10)!);
    for (let mo = 0; mo < 240; mo++) {
      sim.runTicks(10);
      // the packs never starve or leave (as if fed elsewhere): the worst case for the deer
      for (const p of packs) { p.count = 10; p.hunger = 0; p.x = p.tx = m.xOf(i) + 0.5; p.y = p.ty = m.yOf(i) + 0.5; sim.w.herds.set(p.id, p); }
    }
    expect(count(sim, 'deer')).toBeGreaterThanOrEqual(Math.floor(K * BALANCE.predationRefuge));
  }, 120000);
});

describe('territorial hunting: a pack hunts across its territory (task 5, owner option C)', () => {
  it('a pack is fed by prey herds 6.5 tiles away on every side, beyond the old 5-tile reach', () => {
    const sim = world('terr-reach', true);
    const m = sim.w.map;
    const i = site(sim, (j) => m.terrain[j] === T.FOREST && m.temp[j] > 2 && m.temp[j] < 18);
    const wolf = spawnHerd(sim, 'wolf', m.xOf(i), m.yOf(i), 3)!; // needs 0.9 a month
    wolf.hunger = 2;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const d = spawnHerd(sim, 'deer', m.xOf(i), m.yOf(i), SPECIES_BY_KEY.deer.maxHerd)!;
      d.x = d.tx = wolf.x + dx * 6.5; d.y = d.ty = wolf.y + dy * 6.5;
      const t = Math.floor(d.y) * m.w + Math.floor(d.x);
      m.terrain[t] = T.FOREST; m.temp[t] = 10;
    }
    sim.runTicks(10);
    expect(BALANCE.huntReach).toBeGreaterThanOrEqual(6.5 + 1); // the territory covers them even after a month's drift
    expect(sim.w.herds.get(wolf.id)!.hunger).toBe(0); // a real meal
  });
});

describe('territorial hunting: a hungry pack disperses towards prey (task 5, owner option C)', () => {
  /** Wolves on a forest patch with a small deer herd (below the refuge) at home and three full herds 18 tiles east. */
  const scene = (seed: string, wolves: number, hunger: number) => {
    const sim = world(seed, true);
    const m = sim.w.map;
    const i = site(sim, (j) => m.terrain[j] === T.FOREST && m.temp[j] > 2 && m.temp[j] < 18 && m.xOf(j) < m.w - 30 && m.yOf(j) > 10 && m.yOf(j) < m.h - 10);
    const wolf = spawnHerd(sim, 'wolf', m.xOf(i), m.yOf(i), wolves)!;
    wolf.hunger = hunger;
    const forest = (x: number, y: number) => { const t = Math.floor(y) * m.w + Math.floor(x); m.terrain[t] = T.FOREST; m.temp[t] = 10; m.veg[t] = 200; };
    // one forest from the pack to the prey 18 tiles east (no lake or desert in the way)
    for (let y = m.yOf(i) - 9; y <= m.yOf(i) + 9; y++) for (let x = m.xOf(i) - 3; x <= m.xOf(i) + 24; x++) if (m.inBounds(x, y)) forest(x, y);
    spawnHerd(sim, 'deer', m.xOf(i), m.yOf(i), 8);
    const far = { x: wolf.x + 18, y: wolf.y };
    for (let k = 0; k < 3; k++) {
      const d = spawnHerd(sim, 'deer', m.xOf(i), m.yOf(i), SPECIES_BY_KEY.deer.maxHerd)!;
      d.x = d.tx = far.x + (k - 1) * 0.5; d.y = d.ty = far.y + (k - 1) * 6; // six tiles apart: not crowding each other
      forest(d.x, d.y);
    }
    return { sim, wolf, far };
  };
  const wolves = (sim: ReturnType<typeof world>) => [...sim.w.herds.values()].filter((h) => h.species === 'wolf');

  it('a hungry pack big enough to make two splits, and half heads for the prey elsewhere', () => {
    const { sim, far } = scene('disp-split', 12, 3);
    sim.runTicks(10);
    const packs = wolves(sim);
    expect(packs.length).toBe(2);
    expect(Math.min(...packs.map((p) => Math.hypot(p.tx - far.x, p.ty - far.y)))).toBeLessThan(7);
  });

  it('the half that splits off keeps going until it reaches the prey elsewhere (it is not pulled back home)', () => {
    const { sim, far } = scene('disp-keep', 12, 3);
    sim.runTicks(150);
    expect(Math.min(...wolves(sim).map((p) => Math.hypot(p.x - far.x, p.y - far.y)))).toBeLessThanOrEqual(BALANCE.huntReach);
  }, 60000);

  it('a small hungry pack moves as one towards the prey elsewhere', () => {
    const { sim, wolf, far } = scene('disp-move', 5, 3);
    sim.runTicks(10);
    expect(wolves(sim).length).toBe(1);
    expect(Math.hypot(wolf.tx - far.x, wolf.ty - far.y)).toBeLessThan(7);
  });

  it('it heads for prey no other pack is hunting rather than an equal herd that three packs already share', () => {
    const { sim, wolf, far } = scene('disp-claim', 5, 3);
    const m = sim.w.map;
    // the same prey 18 tiles west, on forest too; then three packs settle on the eastern herds
    for (let y = Math.floor(wolf.y) - 9; y <= Math.floor(wolf.y) + 9; y++) for (let x = Math.floor(wolf.x) - 24; x <= Math.floor(wolf.x); x++) if (m.inBounds(x, y)) { const t = y * m.w + x; m.terrain[t] = T.FOREST; m.temp[t] = 10; m.veg[t] = 200; }
    const west = { x: wolf.x - 18, y: wolf.y };
    for (let k = 0; k < 3; k++) {
      const d = spawnHerd(sim, 'deer', Math.floor(west.x), Math.floor(west.y), SPECIES_BY_KEY.deer.maxHerd)!;
      d.x = d.tx = west.x - (k - 1) * 0.5; d.y = d.ty = west.y + (k - 1) * 6;
    }
    for (let k = 0; k < 3; k++) spawnHerd(sim, 'wolf', Math.floor(far.x), Math.floor(far.y), 4)!;
    const to = dispersalTarget(sim, wolf)!;
    expect(Math.hypot(to.x - west.x, to.y - west.y)).toBeLessThan(7);
  });

  it('a hungry pack does not set off for prey across water it cannot cross', () => {
    const { sim, wolf } = scene('disp-water', 5, 3);
    const m = sim.w.map;
    for (let y = 0; y < m.h; y++) { const t = y * m.w + Math.floor(wolf.x) + 6; m.terrain[t] = T.LAKE; }
    expect(dispersalTarget(sim, wolf)).toBeNull();
  });

  it('it disperses only through and into country it can live in: wolves do not set off across a frozen waste', () => {
    const { sim, wolf } = scene('disp-home', 5, 3);
    const m = sim.w.map;
    // a band of glacier between the pack and the prey (too cold even for wolves; not water, so it can be walked)
    for (let y = 0; y < m.h; y++) for (let x = Math.floor(wolf.x) + 6; x <= Math.floor(wolf.x) + 9; x++) { const t = y * m.w + x; m.terrain[t] = T.GLACIER; m.temp[t] = -45; }
    expect(habitat(sim, SPECIES_BY_KEY.wolf, Math.floor(wolf.y) * m.w + Math.floor(wolf.x) + 7)).toBeLessThan(0.2);
    expect(dispersalTarget(sim, wolf)).toBeNull();
  });

  it('a fed pack stays whole', () => {
    const { sim } = scene('disp-fed', 12, 0);
    sim.runTicks(10);
    expect(wolves(sim).length).toBe(1);
  });
});

describe('mature ecosystems: natural worlds start near carrying capacity (task 5, owner option A)', () => {
  const seeds = ['eco-0', 'eco-1', 'eco-2'];
  const biomass = (sim: ReturnType<typeof world>, pred: boolean) => [...sim.w.herds.values()].reduce((t, h) => {
    const q = SPECIES_BY_KEY[h.species];
    return q && !q.aquatic && !q.flying && (q.diet === 'predator') === pred && (pred || q.diet === 'herbivore') ? t + h.count * q.meat : t;
  }, 0);

  it('wild herds fill most of the land share of the herd limit, at more than half their maximum size, on good habitat only', () => {
    for (const seed of seeds) {
      const sim = world(seed, false);
      const m = sim.w.map;
      let land = 0;
      for (let i = 0; i < m.n; i++) if (m.isLand(i)) land++;
      const herds = [...sim.w.herds.values()];
      const onLand = herds.filter((h) => !SPECIES_BY_KEY[h.species].aquatic && SPECIES_BY_KEY[h.species].diet !== 'predator');
      expect(herds.length, seed).toBeLessThanOrEqual(m.n / 30);
      expect(onLand.length, seed).toBeGreaterThanOrEqual(0.8 * BALANCE.wildFill * (m.n / 30) * (land / m.n));
      const fill = onLand.reduce((t, h) => t + h.count / SPECIES_BY_KEY[h.species].maxHerd, 0) / onLand.length;
      expect(fill, seed).toBeGreaterThan(0.5);
      for (const h of herds) expect(habitat(sim, SPECIES_BY_KEY[h.species], Math.floor(h.y) * m.w + Math.floor(h.x)), `${seed} ${h.species}`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('land predators start at about one hundredth of their prey biomass (Carbone & Gittleman 2002)', () => {
    let pred = 0, prey = 0;
    for (const seed of seeds) {
      const sim = world(seed, false);
      pred += biomass(sim, true);
      prey += biomass(sim, false);
    }
    expect(pred).toBeGreaterThan(0);
    expect(pred / prey).toBeGreaterThan(1 / 300);
    expect(pred / prey).toBeLessThanOrEqual(1 / 100 + 1e-9);
  });

  it('seeding is deterministic', () => {
    const a = world('eco-det', false), b = world('eco-det', false);
    expect(JSON.stringify([...a.w.herds.values()])).toBe(JSON.stringify([...b.w.herds.values()]));
  });
});

describe('territorial hunting: a pack keeps to good home ground near its prey (task 5, owner option C)', () => {
  it('a great cat hunting deer that stand in hills beds down on savanna within reach of them, not on the hills tile', () => {
    const sim = world('terr-home', true);
    const m = sim.w.map;
    const i = site(sim, (j) => m.terrain[j] === T.SAVANNA || (m.terrain[j] === T.GRASS && m.temp[j] > 18));
    const cat = spawnHerd(sim, 'bigcat', m.xOf(i), m.yOf(i), 3)!;
    m.forRadius(m.xOf(i), m.yOf(i), 7, (j) => { if (!m.isWater(j)) { m.terrain[j] = T.SAVANNA; m.temp[j] = 25; } });
    const deer = spawnHerd(sim, 'deer', m.xOf(i) + 5, m.yOf(i), SPECIES_BY_KEY.deer.maxHerd)!;
    const t = Math.floor(deer.y) * m.w + Math.floor(deer.x);
    m.terrain[t] = T.HILLS; m.temp[t] = 15; // the deer's own ground: only 0.25 for a cat (task 8 part C: hills, as forest is now cat country)
    expect(habitat(sim, SPECIES_BY_KEY.bigcat, t)).toBeLessThan(0.5);
    cat.hunger = 1; // not fed last month, so it is looking for its prey
    pickTarget(sim, cat);
    const at = Math.floor(cat.ty) * m.w + Math.floor(cat.tx);
    expect(habitat(sim, SPECIES_BY_KEY.bigcat, at)).toBe(1);
    expect(Math.hypot(cat.tx - deer.x, cat.ty - deer.y)).toBeLessThanOrEqual(BALANCE.huntReach / 2);
  });
});

describe('territorial hunting: a fed pack holds its range (task 5, owner option C)', () => {
  it('a fed great cat on good ground with prey in its territory stays where it is', () => {
    const sim = world('terr-hold', true);
    const m = sim.w.map;
    const i = site(sim, (j) => m.terrain[j] === T.SAVANNA || (m.terrain[j] === T.GRASS && m.temp[j] > 18));
    m.forRadius(m.xOf(i), m.yOf(i), 8, (j) => { if (!m.isWater(j)) { m.terrain[j] = T.SAVANNA; m.temp[j] = 25; } });
    const cat = spawnHerd(sim, 'bigcat', m.xOf(i), m.yOf(i), 3)!;
    cat.hunger = 0;
    const horses = spawnHerd(sim, 'horse', m.xOf(i), m.yOf(i), SPECIES_BY_KEY.horse.maxHerd)!;
    horses.x = horses.tx = cat.x + 6; horses.y = horses.ty = cat.y;
    pickTarget(sim, cat);
    expect(Math.hypot(cat.tx - cat.x, cat.ty - cat.y)).toBeLessThanOrEqual(1);
  });
});

describe('territorial hunting: prey in its territory counts as found (task 5, owner option C)', () => {
  it('a hungry crocodile in its swamp hunts deer grazing on cold ground 5 tiles off from where it is, without walking out to them', () => {
    const sim = world('terr-found', true);
    const m = sim.w.map;
    const i = site(sim, (j) => !m.isWater(j) && m.temp[j] > 5);
    m.forRadius(m.xOf(i), m.yOf(i), 2, (j) => { m.terrain[j] = T.SWAMP; m.temp[j] = 26; });
    const croc = spawnHerd(sim, 'crocodile', m.xOf(i), m.yOf(i), 3)!;
    croc.hunger = 1;
    const deer = spawnHerd(sim, 'deer', m.xOf(i) + 5, m.yOf(i), SPECIES_BY_KEY.deer.maxHerd)!;
    const t = Math.floor(deer.y) * m.w + Math.floor(deer.x);
    m.terrain[t] = T.FOREST; m.temp[t] = 10; // deer country, far too cold for a crocodile
    expect(habitat(sim, SPECIES_BY_KEY.crocodile, t)).toBeLessThan(0.2);
    pickTarget(sim, croc);
    expect(habitat(sim, SPECIES_BY_KEY.crocodile, Math.floor(croc.ty) * m.w + Math.floor(croc.tx))).toBeGreaterThanOrEqual(0.2);
  });
});

describe('body reserves: a short lean spell does not kill (task 5, owner option C)', () => {
  const lean = (seed: string, hunger: number) => {
    const sim = world(seed, true);
    const m = sim.w.map;
    const i = site(sim, (j) => m.terrain[j] === T.SAVANNA || (m.terrain[j] === T.GRASS && m.temp[j] > 18));
    const cat = spawnHerd(sim, 'bigcat', m.xOf(i), m.yOf(i), 4)!;
    cat.hunger = hunger;
    spawnHerd(sim, 'deer', m.xOf(i), m.yOf(i), 5); // a token herd: below the refuge, nothing to take
    sim.runTicks(10);
    return sim.w.herds.get(cat.id)?.count ?? 0;
  };
  it('a pack fed last month loses nobody in a month with too little prey (as with no prey at all)', () => {
    expect(lean('lean-1', 0)).toBeCloseTo(4, 6);
  });
  it('after more than three lean months it starves', () => {
    expect(lean('lean-4', 3)).toBeLessThan(4);
  });
});

describe('cold-blooded hunters need far less food (task 5)', () => {
  it('a crocodile herd needs a tenth of the prey a wolf pack of the same size needs (ectotherm)', () => {
    const sim = world('ecto', true);
    const croc = spawnHerd(sim, 'crocodile', 10, 10, 10)!;
    const wolf = spawnHerd(sim, 'wolf', 10, 10, 10)!;
    expect(huntNeed(croc)).toBeCloseTo(huntNeed(wolf) * 0.1, 9);
  });
});

