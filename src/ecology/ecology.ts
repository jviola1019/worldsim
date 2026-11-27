/**
 * Ecosystems: vegetation regrowth, animal herds (movement, grazing, logistic
 * growth limited by local vegetation, predation, starvation, climate stress),
 * human hunting, extinction, slow evolution into subspecies, and optional
 * fantasy monsters.
 */
import { realWorld } from '../powers/powerSet';
import { flow } from '../population/ledger';
import type { Sim } from '../sim/context';
import type { Herd, Monster, Settlement, Subspecies } from '../sim/types';
import { SPECIES, SPECIES_BY_KEY, MONSTERS, type SpeciesDef } from './species';
import { TERRAIN, isWaterTerrain } from '../world/terrain';
import { vegCapacity } from '../world/worldgen';
import { BALANCE } from '../config/balance';
import { clamp, clamp01, DX8, DY8 } from '../core/math';
import { TICKS_PER_MONTH } from '../core/time';
import { logEvent } from '../history/events';
import { B } from '../civilizations/buildingTypes';
import { markTile, setVeg } from '../sim/context';
import { emitFx, STATE_FX } from '../sim/conceptFx';
import { removePeople } from '../population/demography';
import { addPressure, globalCooling } from '../civilizations/endings';

const GRID = 16;

/** Spatial hash of herds, rebuilt at most once per tick on demand. */
function herdGrid(sim: Sim): Map<number, Herd[]> {
  const c = sim.cache.herdGrid as { tick: number; cells: Map<number, Herd[]> } | undefined;
  if (c && c.tick === sim.w.tick) return c.cells;
  const cells = new Map<number, Herd[]>();
  const gx = Math.ceil(sim.w.map.w / GRID);
  for (const h of sim.w.herds.values()) {
    const k = ((h.y / GRID) | 0) * gx + ((h.x / GRID) | 0);
    let arr = cells.get(k);
    if (!arr) cells.set(k, (arr = []));
    arr.push(h);
  }
  sim.cache.herdGrid = { tick: sim.w.tick, cells };
  return cells;
}

export function herdsNear(sim: Sim, x: number, y: number, r: number): Herd[] {
  const cells = herdGrid(sim);
  const gx = Math.ceil(sim.w.map.w / GRID);
  const out: Herd[] = [];
  const x0 = Math.max(0, ((x - r) / GRID) | 0);
  const x1 = ((x + r) / GRID) | 0;
  const y0 = Math.max(0, ((y - r) / GRID) | 0);
  const y1 = ((y + r) / GRID) | 0;
  const r2 = r * r;
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) {
      const arr = cells.get(cy * gx + cx);
      if (!arr) continue;
      for (const h of arr) if ((h.x - x) ** 2 + (h.y - y) ** 2 <= r2) out.push(h);
    }
  return out;
}

export function countSpeciesNear(sim: Sim, x: number, y: number, r: number, species: string, exclude?: Herd): number {
  const cells = herdGrid(sim);
  const gx = Math.ceil(sim.w.map.w / GRID);
  let n = 0;
  const r2 = r * r;
  const x0 = Math.max(0, ((x - r) / GRID) | 0);
  const x1 = ((x + r) / GRID) | 0;
  const y0 = Math.max(0, ((y - r) / GRID) | 0);
  const y1 = ((y + r) / GRID) | 0;
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) {
      const arr = cells.get(cy * gx + cx);
      if (!arr) continue;
      for (const h of arr) if (h !== exclude && h.species === species && (h.x - x) ** 2 + (h.y - y) ** 2 <= r2) n++;
    }
  return n;
}

export function habitat(sim: Sim, sp: SpeciesDef, i: number): number {
  const m = sim.w.map;
  const t = m.terrain[i];
  const water = isWaterTerrain(t);
  // round 10 addendum (life audit): sea animals follow the land rule (a quarter outside their home waters, scaled by
  // temperature) instead of all-or-nothing: whales crossing shallow coastal water bled out at 4% a month, and
  // seals ignored water temperature entirely
  if (sp.aquatic && !water) return 0;
  if (water && !sp.flying && !sp.aquatic) return 0;
  const temp = m.temp[i] + localHeat(sim, i);
  let s = sp.biomes.includes(t) ? 1 : 0.25;
  if (temp < sp.temp[0] - 6 || temp > sp.temp[1] + 6) s *= 0.1;
  else if (temp < sp.temp[0] || temp > sp.temp[1]) s *= 0.5;
  if (m.bld[i] && m.bld[i] !== B.PASTURE) s *= 0.35; // habitat loss to settlement
  return s;
}

/** Regional temperature anomaly (climate change + regional variability). */
export function localHeat(sim: Sim, i: number): number {
  const c = sim.w.climate;
  const m = sim.w.map;
  const cx = ((i % m.w) / c.cellSize) | 0;
  const cy = (((i / m.w) | 0) / c.cellSize) | 0;
  return c.anomaly + (c.heat[cy * c.cellsX + cx] ?? 0) - globalCooling(c);
}

export function newGenes(sim: Sim): number[] {
  const r = sim.rng;
  return [r.range(0.4, 0.6), r.range(0.4, 0.6), r.range(0.4, 0.6), r.range(0.4, 0.6), r.range(0.4, 0.6)];
}

export function spawnHerd(sim: Sim, key: string, x: number, y: number, count?: number, genes?: number[], subspeciesId = 0): Herd | null {
  const sp = SPECIES_BY_KEY[key];
  const w = sim.w;
  if (!sp || !w.map.inBounds(x | 0, y | 0)) return null;
  const n = count ?? sim.rng.int(sp.start[0], sp.start[1]);
  const h: Herd = {
    id: ++w.ids.herd,
    species: key,
    x: x + 0.5,
    y: y + 0.5,
    tx: x + 0.5,
    ty: y + 0.5,
    count: n,
    hunger: 0,
    genes: genes ? genes.slice() : newGenes(sim),
    subspeciesId,
    owner: 0,
  };
  w.herds.set(h.id, h);
  const st = (w.speciesStatus[key] ??= { count: 0 });
  st.count += n;
  if (st.extinct !== undefined) {
    st.extinct = undefined;
    st.introduced = sim.year;
  }
  return h;
}

/** Carrying capacity of a herd where it stands: room for its species, less for each rival herd of it within 5 tiles. */
export function herdCapacity(sim: Sim, h: Herd, sp: SpeciesDef = SPECIES_BY_KEY[h.species]): number {
  const rivals = countSpeciesNear(sim, h.x, h.y, 5, h.species, h);
  return (sp.maxHerd * 1.3) / (1 + rivals * 0.5);
}

/**
 * What predators may take from a prey herd in a month (task 5, owner option C): tied to what the herd can replace. A
 * herd above half its capacity yields its growth at half capacity (the most it can replace), so it is cropped down
 * towards half; below half it yields only part of its growth, the less the scarcer it is (scarce prey is harder to
 * find), so it grows back towards half; and it is never hunted below the refuge share of its capacity. Prey outside its
 * own habitat is not growing, so it yields nothing.
 */
export function preyReplaceable(sim: Sim, p: Herd): number {
  const q = SPECIES_BY_KEY[p.species];
  if (!q) return 0;
  const m = sim.w.map;
  const hab = habitat(sim, q, Math.floor(p.y) * m.w + Math.floor(p.x));
  if (hab <= 0.2) return 0;
  const K = herdCapacity(sim, p, q);
  const n = Math.min(p.count, K / 2);
  const surplus = ((n * q.growth * (0.6 + 0.8 * p.genes[4]) * hab * (1 - n / K)) / 12) * Math.min(1, (2 * p.count) / K);
  return Math.max(0, Math.min(surplus, p.count - K * BALANCE.predationRefuge));
}

/**
 * Whether hunter `sp` can hunt prey species `q`: herbivores of its own realm (review fix: wolves lived off fish shoals
 * and seals took deer from beaches), not birds; and fish shoals for a land predator that fishes (task 8 part C:
 * crocodiles).
 */
export function hunts(sp: SpeciesDef, q: SpeciesDef | undefined): boolean {
  if (!q || q.diet !== 'herbivore' || q.flying) return false;
  return !!q.aquatic === !!sp.aquatic || (!!sp.fishes && q.key === 'fish');
}

/**
 * Task 5: prey a hunter needs in a month: predators all of their food (cold-blooded ones far less, their `upkeep`),
 * omnivores the meat part of theirs.
 */
export function huntNeed(h: Herd, sp: SpeciesDef = SPECIES_BY_KEY[h.species]): number {
  return Math.max(0.5, h.count * BALANCE.preyPerPredator) * (sp.diet === 'omnivore' ? BALANCE.omnivoreMeat : 1) * (sp.upkeep ?? 1);
}

/**
 * Task 5: what the hunters whose ranges cover a prey herd need in all (predators of its realm within their hunting
 * territory, omnivores within their 2.5-tile reach). They share what the herd can replace in proportion to need, so
 * overlapping territories do not each take it all, and a pack gains nothing by splitting.
 */
export function huntDemand(sim: Sim, p: Herd): number {
  const q = SPECIES_BY_KEY[p.species];
  let n = 0;
  for (const o of herdsNear(sim, p.x, p.y, BALANCE.huntReach)) {
    const s = SPECIES_BY_KEY[o.species];
    if (!s || o.owner !== 0) continue;
    if (s.diet === 'predator' && hunts(s, q)) n += huntNeed(o, s);
    else if (s.diet === 'omnivore' && !q?.aquatic && (o.x - p.x) ** 2 + (o.y - p.y) ** 2 <= 2.5 * 2.5) n += huntNeed(o, s);
  }
  return n;
}

/** Task 5: the part of what a prey herd can replace that hunter `h` gets: shared with the other hunters there by need. */
export function preyShare(sim: Sim, p: Herd, h: Herd): number {
  const r = preyReplaceable(sim, p);
  if (r <= 0) return 0;
  const sp = SPECIES_BY_KEY[h.species];
  const need = sp ? huntNeed(h, sp) : Math.max(0.5, h.count * BALANCE.preyPerPredator);
  const reach = sp?.diet === 'omnivore' ? 2.5 : BALANCE.huntReach;
  const counted = !!sp && h.owner === 0 && (p.x - h.x) ** 2 + (p.y - h.y) ** 2 <= reach * reach;
  return (r * need) / Math.max(need, huntDemand(sim, p) + (counted ? 0 : need));
}

/** Tiles a predator searches for prey standing in its habitat, and for a way home (design 6.3). */
const HOME_SEARCH = 12;
/** Tiles a predator ranges for any prey of its realm once home has none (design 6.3). */
const RANGE_SEARCH = 24;

/** Task 5: whether prey of its realm that can feed it grazes anywhere in the predator's hunting territory. */
function preyInTerritory(sim: Sim, h: Herd, sp: SpeciesDef): boolean {
  return herdsNear(sim, h.x, h.y, BALANCE.huntReach).some((o) => {
    const q = SPECIES_BY_KEY[o.species];
    return o.owner === 0 && hunts(sp, q) && preyReplaceable(sim, o) > 0;
  });
}

/** Choose where a herd heads next (exported for tests). */
export function pickTarget(sim: Sim, h: Herd, sp: SpeciesDef = SPECIES_BY_KEY[h.species]): void {
  const m = sim.w.map;
  const rng = sim.rng;
  if (sp.diet === 'predator') {
    // design 6.3: a pack that has just eaten, stranded outside its habitat, goes back to the best home tile near it
    // (it followed prey into country it cannot live in; staying there costs 4% a month)
    if (h.hunger === 0 && habitat(sim, sp, Math.floor(h.y) * m.w + Math.floor(h.x)) < 0.2) {
      let home = -1;
      let hs = 0;
      const r = HOME_SEARCH;
      for (let y = Math.max(0, Math.floor(h.y) - r); y <= Math.min(m.h - 1, Math.floor(h.y) + r); y++)
        for (let x = Math.max(0, Math.floor(h.x) - r); x <= Math.min(m.w - 1, Math.floor(h.x) + r); x++) {
          const d = Math.hypot(x + 0.5 - h.x, y + 0.5 - h.y);
          if (d > r) continue;
          const i = y * m.w + x;
          const hab = habitat(sim, sp, i);
          if (hab < 0.2) continue;
          const score = hab * (sp.aquatic || sp.flying ? 1 : 0.3 + m.veg[i] / 255) - d * 0.02;
          if (score > hs) { hs = score; home = i; }
        }
      if (home >= 0) {
        h.tx = m.xOf(home) + 0.5;
        h.ty = m.yOf(home) + 0.5;
        return;
      }
    }
    const here = habitat(sim, sp, Math.floor(h.y) * m.w + Math.floor(h.x));
    // task 5 (owner option C): a fed pack on good home ground with prey in its territory holds its range (wandering
    // between prey herds led cats and crocodiles across poor and hostile land)
    if (h.hunger === 0 && here >= 0.5 && preyInTerritory(sim, h, sp)) {
      h.tx = h.x;
      h.ty = h.y;
      return;
    }
    // task 5: a pack hungry for months keeps heading for prey outside its territory (it is not pulled back to a home
    // that cannot feed it)
    if (h.hunger >= BALANCE.predatorDisperseAfter) {
      const to = dispersalTarget(sim, h, sp);
      if (to) {
        h.tx = to.x;
        h.ty = to.y;
        return;
      }
    }
    // step 1, home first (round 10 addendum): only prey standing in country the predator can live in (great cats
    // followed deer up into cold mountains and died there; life audit)
    // task 8 part C: prey it can eat (herbivores of its realm, as the monthly feeding takes them), not omnivores: wolves
    // and great cats set off after boar and bears they never eat
    const edible = (o: Herd) => {
      const q = SPECIES_BY_KEY[o.species];
      return o !== h && hunts(sp, q) && q!.meat >= 0.01;
    };
    // task 5: and only prey that can feed it (a herd below the refuge, or out of its own habitat, yields nothing)
    const prey = herdsNear(sim, h.x, h.y, HOME_SEARCH).filter((o) => edible(o)
      && habitat(sim, sp, Math.floor(o.y) * m.w + Math.floor(o.x)) >= 0.2 && preyReplaceable(sim, o) > 0);
    // task 5 (owner option C): prey grazing within its territory, wherever it stands, is hunted from home: a pack on home
    // ground with such prey has found prey and stays (crocodiles walked out after deer on cold ground and, at their
    // pace, never got back)
    if (!prey.length && here >= 0.2 && preyInTerritory(sim, h, sp)) {
      h.tx = h.x;
      h.ty = h.y;
      return;
    }
    // step 2 (design 6.3): home has none, so range for prey anywhere it can stand, in its own realm
    // (the realm rule the monthly feeding uses: same water or land, not flying, a herbivore)
    const ranged = prey.length ? prey : herdsNear(sim, h.x, h.y, RANGE_SEARCH).filter((o) => {
      const q = SPECIES_BY_KEY[o.species];
      return edible(o) && o.owner === 0 && q?.diet === 'herbivore' && !q.flying && !!q.aquatic === !!sp.aquatic
        && m.isWater(Math.floor(o.y) * m.w + Math.floor(o.x)) === !!sp.aquatic;
    });
    if (ranged.length) {
      // round 10 addendum: head for the richest prey nearby, not merely the nearest herd (chasing small, straying
      // herds led packs away from their prey base until they starved; life audit). Task 5: richest in what this pack
      // would get of what it replaces each month (shared with the hunters already there), then in numbers (prey out of
      // its own habitat replaces nothing but may still be all there is)
      const near = (o: Herd) => 1 + Math.hypot(o.x - h.x, o.y - h.y) / 4;
      const yields = new Map(ranged.map((o) => [o, preyShare(sim, o, h) / near(o)]));
      ranged.sort((a, b) => yields.get(b)! - yields.get(a)! || b.count / near(b) - a.count / near(a) || a.id - b.id);
      const to = ranged[0];
      h.tx = to.x;
      h.ty = to.y;
      // task 5 (owner option C): with prey at home the pack hunts it across its territory, so it beds down on its best
      // ground within half its reach of the prey rather than on the prey's own tile (great cats and crocodiles followed
      // deer into forest and cold grass at a quarter of their growth, paying the hostile-land toll on the way; life audit)
      if (prey.length) {
        const r = BALANCE.huntReach / 2;
        let best = habitat(sim, sp, Math.floor(to.y) * m.w + Math.floor(to.x));
        let bd = 0;
        for (let y = Math.max(0, Math.floor(to.y - r)); y <= Math.min(m.h - 1, Math.floor(to.y + r)); y++)
          for (let x = Math.max(0, Math.floor(to.x - r)); x <= Math.min(m.w - 1, Math.floor(to.x + r)); x++) {
            const d = Math.hypot(x + 0.5 - to.x, y + 0.5 - to.y);
            if (d > r) continue;
            const hb = habitat(sim, sp, y * m.w + x);
            if (hb > best || (hb === best && hb > 0 && d < bd)) { best = hb; bd = d; h.tx = x + 0.5; h.ty = y + 0.5; }
          }
      }
      return;
    }
  }
  let best = -1;
  let bx = h.x;
  let by = h.y;
  for (let k = 0; k < 6; k++) {
    const x = clamp(Math.floor(h.x + rng.range(-8, 8)), 0, m.w - 1);
    const y = clamp(Math.floor(h.y + rng.range(-8, 8)), 0, m.h - 1);
    const i = y * m.w + x;
    const hab = habitat(sim, sp, i);
    if (hab <= 0) continue;
    const score = hab * (sp.aquatic || sp.flying ? 1 : 0.3 + m.veg[i] / 255) + rng.float() * 0.2;
    if (score > best) {
      best = score;
      bx = x + 0.5;
      by = y + 0.5;
    }
  }
  h.tx = bx;
  h.ty = by;
}

/**
 * Task 5 (owner option C): where a hungry predator herd disperses to: the prey herd outside its hunting territory but
 * within its 24-tile range that can feed it best (its share of what the herd replaces, after the hunters already
 * there, so hungry packs do not all converge on one place), standing in country it can live in and reached through
 * such country. Null when there is none.
 */
export function dispersalTarget(sim: Sim, h: Herd, sp: SpeciesDef = SPECIES_BY_KEY[h.species]): Herd | null {
  const m = sim.w.map;
  // herds walk straight lines: the way must be country it can live in all along (they stop at the shore, and a slow
  // crocodile sent across cold hills died there before it arrived; life audit)
  const clear = (o: Herd) => {
    const d = Math.hypot(o.x - h.x, o.y - h.y);
    for (let s = 0.5; s < d; s += 0.5) {
      const i = Math.floor(h.y + ((o.y - h.y) * s) / d) * m.w + Math.floor(h.x + ((o.x - h.x) * s) / d);
      if (habitat(sim, sp, i) < 0.2) return false;
    }
    return true;
  };
  const cands = herdsNear(sim, h.x, h.y, RANGE_SEARCH).filter((o) => {
    const q = SPECIES_BY_KEY[o.species];
    return o !== h && o.owner === 0 && q?.diet === 'herbivore' && !q.flying && !!q.aquatic === !!sp.aquatic
      && Math.hypot(o.x - h.x, o.y - h.y) > BALANCE.huntReach
      && m.isWater(Math.floor(o.y) * m.w + Math.floor(o.x)) === !!sp.aquatic;
  });
  const score = new Map(cands.map((o) => [o, preyShare(sim, o, h) / (1 + Math.hypot(o.x - h.x, o.y - h.y) / 4)]));
  // home only (design 6.3: it leaves home only when no prey can be found, and then pickTarget ranges for it)
  const pool = cands.filter((o) => score.get(o)! > 0 && habitat(sim, sp, Math.floor(o.y) * m.w + Math.floor(o.x)) >= 0.2 && clear(o));
  if (!pool.length) return null;
  pool.sort((a, b) => score.get(b)! - score.get(a)! || a.id - b.id);
  return pool[0];
}

/** Per-tick herd movement. */
export function herdsTick(sim: Sim): void {
  const m = sim.w.map;
  const tick = sim.w.tick;
  const parity = tick & 1;
  for (const h of sim.w.herds.values()) {
    if ((h.id & 1) !== parity) continue; // half the herds move each tick, at double step
    const sp = SPECIES_BY_KEY[h.species];
    if (!sp) continue;
    const dx = h.tx - h.x;
    const dy = h.ty - h.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.3 || (tick + h.id) % 60 === 0) {
      pickTarget(sim, h, sp);
      continue;
    }
    const step = 2 * sp.speed * (0.7 + 0.6 * h.genes[1]);
    const nx = h.x + (dx / d) * Math.min(step, d);
    const ny = h.y + (dy / d) * Math.min(step, d);
    const i = Math.floor(ny) * m.w + Math.floor(nx);
    if (i < 0 || i >= m.n) continue;
    const water = m.isWater(i);
    if (sp.aquatic ? !water : water && !sp.flying) {
      pickTarget(sim, h, sp);
      continue;
    }
    h.x = nx;
    h.y = ny;
  }
}

/** Monthly herd dynamics, staggered: herd.id % TICKS_PER_MONTH === tick % TICKS_PER_MONTH. */
export function herdsMonthly(sim: Sim): void {
  const w = sim.w;
  const m = w.map;
  const rng = sim.rng;
  const slot = w.tick % TICKS_PER_MONTH;
  const remove: number[] = [];
  const spawn: Herd[] = [];
  for (const h of w.herds.values()) {
    if (h.id % TICKS_PER_MONTH !== slot) continue;
    const sp = SPECIES_BY_KEY[h.species];
    if (!sp) {
      remove.push(h.id);
      continue;
    }
    const before = h.count;
    const i = Math.floor(h.y) * m.w + Math.floor(h.x);
    const hab = habitat(sim, sp, i);
    let fed = 1;
    if (sp.diet === 'predator' || sp.diet === 'omnivore') {
      // prey of the hunter's own realm (review fix: wolves lived off fish shoals and seals took deer from beaches), not
      // birds; crocodiles also fish (task 8 part C)
      const prey = herdsNear(sim, h.x, h.y, sp.diet === 'predator' ? BALANCE.huntReach : 2.5).filter((o) => o !== h && o.owner === 0 && hunts(sp, SPECIES_BY_KEY[o.species]));
      if (prey.length) {
        // round 10 addendum: a pack hunts every prey herd in reach; task 5: taking at most what each herd can replace
        // (a flat 2% a month was above most prey's real growth, so herds and packs ratcheted down together)
        const need = huntNeed(h, sp);
        let kills = 0;
        for (const p of prey) {
          if (kills >= need) break;
          const k = Math.min(preyShare(sim, p, h), need - kills);
          p.count -= k;
          kills += k;
        }
        fed = Math.min(1, kills / need);
        // design 6.3: only a real meal resets hunger (a token herd in reach used to wipe it)
        h.hunger = sp.diet !== 'predator' || fed >= 0.5 ? 0 : h.hunger + 1;
        // task 5: body reserves carry a pack through a short lean spell, as when no prey is in reach at all (a little
        // prey must not be worse than none: one lean month took 12% of a pack, a year of a crocodile's growth)
        if (sp.diet === 'predator' && fed < 0.5) fed = Math.max(fed, h.hunger > 3 ? 0.2 : 0.6);
      } else if (sp.diet === 'predator') {
        h.hunger++;
        fed = h.hunger > 3 ? 0.2 : 0.6;
      }
      // task 5 (owner option C): a pack hungry for months disperses towards prey instead of starving in place
      if (sp.diet === 'predator' && h.hunger >= BALANCE.predatorDisperseAfter) {
        const to = dispersalTarget(sim, h, sp);
        if (to && h.count >= 2 * sp.start[0] && w.herds.size + spawn.length < m.n / 30) {
          h.count /= 2;
          spawn.push({ id: 0, species: h.species, x: h.x, y: h.y, tx: to.x, ty: to.y, count: h.count, hunger: h.hunger, genes: h.genes.slice(), subspeciesId: h.subspeciesId, owner: h.owner });
        } else if (to) {
          h.tx = to.x;
          h.ty = to.y;
        }
      }
    }
    if (sp.diet !== 'predator' && sp.graze > 0 && !sp.aquatic) {
      // graze the tile and its neighbors
      let demand = h.count * sp.graze;
      let got = 0;
      const x0 = Math.floor(h.x);
      const y0 = Math.floor(h.y);
      for (let d = -1; d < 8 && demand > 0; d++) {
        const x = d < 0 ? x0 : x0 + DX8[d];
        const y = d < 0 ? y0 : y0 + DY8[d];
        if (!m.inBounds(x, y)) continue;
        const j = y * m.w + x;
        const take = Math.min(m.veg[j] * 0.08, demand);
        setVeg(sim, j, Math.max(0, m.veg[j] - take));
        got += take;
        demand -= take;
      }
      const herbFed = h.count * sp.graze > 0 ? got / (h.count * sp.graze) : 1;
      fed = sp.diet === 'omnivore' ? Math.max(fed * 0.5, herbFed) : herbFed;
    }
    // logistic growth vs starvation and climate stress
    const capacity = herdCapacity(sim, h, sp);
    if (fed >= 0.75 && hab > 0.2) h.count += (h.count * sp.growth * (0.6 + 0.8 * h.genes[4]) * hab * (1 - h.count / capacity)) / 12;
    else if (fed < 0.5) h.count -= h.count * (0.5 - fed) * 0.25;
    if (hab < 0.2) h.count -= h.count * 0.04;
    // split only where the range is not already crowded with the same species
    if (h.count > sp.maxHerd && rng.chance(0.3) && w.herds.size < (m.n / 30) && countSpeciesNear(sim, h.x, h.y, 8, h.species) < 3) {
      const half = h.count / 2;
      h.count = half;
      const g = h.genes.map((v) => clamp01(v + rng.normal() * 0.01));
      const nh: Herd = {
        id: 0,
        species: h.species,
        x: h.x,
        y: h.y,
        tx: clamp(h.x + rng.range(-12, 12), 0, m.w - 1),
        ty: clamp(h.y + rng.range(-12, 12), 0, m.h - 1),
        count: half,
        hunger: 0,
        genes: g,
        subspeciesId: h.subspeciesId,
        owner: h.owner,
      };
      spawn.push(nh);
    }
    if (h.count < 1) remove.push(h.id);
    const st = w.speciesStatus[h.species];
    if (st) st.count += h.count - before;
  }
  for (const id of remove) w.herds.delete(id);
  for (const nh of spawn) {
    nh.id = ++w.ids.herd;
    w.herds.set(nh.id, nh);
  }
}

/**
 * Settlements and bands hunt nearby wild herds. Returns meat (person-years)
 * obtained. Dangerous animals occasionally kill hunters.
 */
export function huntHerds(sim: Sim, x: number, y: number, r: number, demand: number, skill = 1): number {
  if (demand <= 0) return 0;
  let got = 0;
  const herds = herdsNear(sim, x, y, r);
  for (const h of herds) {
    if (got >= demand) break;
    const sp = SPECIES_BY_KEY[h.species];
    if (!sp || sp.aquatic || sp.flying || h.owner) continue;
    const want = (demand - got) / sp.meat;
    // type-III functional response: scarce prey is hard to find, so hunting pressure collapses as a herd
    // dwindles (refuge populations survive and can recover). Without it, foragers wiped out every
    // domesticable species before domestication was discovered, locking 146 of 207 technologies.
    const findable = (h.count * h.count) / (h.count * h.count + 225);
    const take = Math.min(want, h.count * 0.12 * skill * findable);
    if (take <= 0) continue;
    const before = h.count;
    h.count -= take;
    got += take * sp.meat;
    const st = sim.w.speciesStatus[h.species];
    if (st) st.count += h.count - before;
  }
  return got;
}

/** Dangerous wildlife attacks near a settlement (returns deaths). */
export function wildlifeDanger(sim: Sim, x: number, y: number, r: number): number {
  let risk = 0;
  for (const h of herdsNear(sim, x, y, r)) {
    const sp = SPECIES_BY_KEY[h.species];
    if (sp && sp.danger > 0 && !h.owner) risk += sp.danger * Math.min(10, h.count) * 0.01;
  }
  return risk;
}

/** Monthly vegetation regrowth & soil recovery for one slice of map rows. */
export function vegetationSlice(sim: Sim, slice: number): void {
  const m = sim.w.map;
  const rate = BALANCE.vegRegrowth;
  for (let y = slice; y < m.h; y += TICKS_PER_MONTH) {
    for (let x = 0; x < m.w; x++) {
      const i = y * m.w + x;
      const t = m.terrain[i];
      if (isWaterTerrain(t)) continue;
      let target = vegCapacity(m, i);
      const b = m.bld[i];
      if (b) target = b === B.FARM || b === B.PASTURE || b === B.PLANTATION ? 30 : b === B.LUMBER ? target * 0.5 : b === B.PARK ? 120 : 8;
      if (m.pollution[i] > 0) target *= 1 - m.pollution[i] / 400;
      if (m.fire[i]) continue;
      const v = m.veg[i];
      const diff = target - v;
      if (Math.abs(diff) < 1) continue;
      const r = diff > 0 ? rate * (0.5 + m.moist[i] / 255) : 0.08;
      const nv = v + diff * r;
      setVeg(sim, i, clamp(Math.round(nv + (diff > 0 ? 0.5 : -0.5)), 0, 255));
      // fertility recovery on unfarmed land
      if (b !== B.FARM && m.fert[i] < TERRAIN[t].fertility && (x + y + sim.w.tick) % 7 === 0) m.fert[i]++;
    }
  }
}

/** Yearly gene drift + selection; new subspecies emerge only after long divergence. */
export function evolutionYearly(sim: Sim): void {
  const w = sim.w;
  if (!w.laws.evolution) return;
  const rng = sim.rng;
  const m = w.map;
  for (const h of w.herds.values()) {
    const i = Math.floor(h.y) * m.w + Math.floor(h.x);
    if (i < 0 || i >= m.n) continue;
    const temp = m.temp[i] + localHeat(sim, i);
    const coldTarget = clamp01((12 - temp) / 40);
    for (let k = 0; k < 5; k++) h.genes[k] = clamp01(h.genes[k] + rng.normal() * 0.006);
    h.genes[2] += (coldTarget - h.genes[2]) * 0.01; // cold tolerance follows climate
    h.genes[0] += (coldTarget * 0.6 + 0.2 - h.genes[0]) * 0.004; // larger bodies in the cold (Bergmann-like)
    // divergence check
    const base = h.subspeciesId ? w.subspecies.get(h.subspeciesId) : undefined;
    const ref = base ? base.genes : [0.5, 0.5, 0.5, 0.5, 0.5];
    const since = base ? sim.year - base.emerged : sim.year - w.meta.startYear;
    let div = 0;
    for (let k = 0; k < 5; k++) div += Math.abs(h.genes[k] - ref[k]);
    const lastKey = `subsp:${h.species}`;
    const last = w.milestones[lastKey] ?? w.meta.startYear;
    if (div > 0.45 && since > 150 && sim.year - last > 120 && rng.chance(0.2)) {
      w.milestones[lastKey] = sim.year;
      const sp = SPECIES_BY_KEY[h.species];
      const name = subspeciesName(h.genes, ref, sp?.name ?? h.species, h.y / m.h);
      const ss: Subspecies = { id: ++w.ids.subspecies, species: h.species, name, parentId: h.subspeciesId, genes: h.genes.slice(), emerged: sim.year };
      w.subspecies.set(ss.id, ss);
      h.subspeciesId = ss.id;
      logEvent(sim, {
        type: 'subspecies',
        cat: 'nature',
        title: `A new subspecies emerged: the ${name}`,
        x: Math.floor(h.x),
        y: Math.floor(h.y),
        importance: 2,
        causes: [{ label: `Local climate selection over ${since} years`, weight: 1 }],
      });
    }
  }
}

function subspeciesName(g: number[], ref: number[], base: string, latFrac: number): string {
  const d = g.map((v, k) => v - ref[k]);
  const idx = d.reduce((bi, v, k) => (Math.abs(v) > Math.abs(d[bi]) ? k : bi), 0);
  const up = d[idx] > 0;
  const words = [up ? 'Giant' : 'Dwarf', up ? 'Swift' : 'Stout', up ? 'Woolly' : 'Sun', up ? 'Fierce' : 'Gentle', up ? 'Prolific' : 'Hardy'];
  const region = latFrac < 0.33 ? 'Northern ' : latFrac > 0.66 ? 'Southern ' : '';
  return `${region}${words[idx]} ${base}`;
}

/** Yearly census: species extinction / recovery events. */
export function speciesCensus(sim: Sim): void {
  const w = sim.w;
  const counts: Record<string, number> = {};
  for (const h of w.herds.values()) counts[h.species] = (counts[h.species] ?? 0) + h.count;
  for (const sp of SPECIES) {
    const st = (w.speciesStatus[sp.key] ??= { count: 0 });
    const c = counts[sp.key] ?? 0;
    if (c < 1 && st.count >= 1 && st.extinct === undefined) {
      st.extinct = sim.year;
      logEvent(sim, {
        type: 'species_extinct',
        cat: 'nature',
        title: `The ${sp.name.toLowerCase()} has gone extinct`,
        importance: sp.megafauna ? 3 : 2,
      });
    }
    st.count = c;
  }
}

// ---------------------------------------------------------------- monsters

export function spawnMonster(sim: Sim, kind: string, x: number, y: number): Monster | null {
  const def = MONSTERS.find((d) => d.kind === kind);
  if (!def) return null;
  const m: Monster = { id: ++sim.w.ids.monster, kind, x: x + 0.5, y: y + 0.5, tx: x + 0.5, ty: y + 0.5, hp: def.hp, rage: 0, name: def.name };
  sim.w.monsters.set(m.id, m);
  return m;
}

export function monstersTick(sim: Sim): void {
  const w = sim.w;
  const map = w.map;
  for (const mo of w.monsters.values()) {
    const def = MONSTERS.find((d) => d.kind === mo.kind);
    if (!def) continue;
    const dx = mo.tx - mo.x;
    const dy = mo.ty - mo.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.4 || (w.tick + mo.id) % 90 === 0) {
      mo.tx = clamp(mo.x + sim.rng.range(-10, 10), 1, map.w - 2);
      mo.ty = clamp(mo.y + sim.rng.range(-10, 10), 1, map.h - 2);
      continue;
    }
    const nx = mo.x + (dx / d) * def.speed;
    const ny = mo.y + (dy / d) * def.speed;
    const i = Math.floor(ny) * map.w + Math.floor(nx);
    const water = map.isWater(i);
    if (!def.flying && (def.aquatic ? !water : water)) {
      mo.tx = mo.x;
      mo.ty = mo.y;
      continue;
    }
    mo.x = nx;
    mo.y = ny;
  }
}

/** Monthly monster attacks on nearby settlements; militaries can slay monsters. */
export function monstersMonthly(sim: Sim): void {
  const w = sim.w;
  if (!w.laws.fantasyCreatures || realWorld(w.meta.settings)) return;
  const dead: number[] = [];
  for (const mo of w.monsters.values()) {
    const def = MONSTERS.find((d) => d.kind === mo.kind);
    if (!def) continue;
    let fought = false;
    let slain = false;
    const atGates = new Set<number>();
    const defenseOf = (s: Settlement) => (s.garrison + s.pop * 0.01) * (1 + (w.civs.get(s.civId)?.caps.landTier ?? 0) * 0.6);
    for (const s of w.settlements.values()) {
      if ((s.x - mo.x) ** 2 + (s.y - mo.y) ** 2 > 9) continue;
      fought = true;
      atGates.add(s.id);
      // round 10: a town of 2,000 wears a giant down in about two years; a hamlet cannot (was ×0.05, less than regrowth)
      mo.hp -= defenseOf(s) * BALANCE.monsterDamage;
      const harm = Math.min(s.pop * 0.05, def.harm * sim.rng.range(0.4, 1));
      if (harm > 0.5) {
        const dead = removePeople(sim, s, harm, 'monster attack');
        flow(sim, s, 'disaster', dead);
        addPressure(sim, s.civId, 'monsters', dead, `Attacks by a ${def.name.toLowerCase()}`);
        emitFx(sim, STATE_FX.monsterAttack, s.x, s.y);
        if (sim.rng.chance(0.15))
          logEvent(sim, { type: 'monster_attack', cat: 'disaster', title: `A ${def.name.toLowerCase()} attacked ${s.name}`, civs: [s.civId], settlements: [s.id], x: s.x, y: s.y, importance: 2 });
      }
      if (mo.hp <= 0) {
        dead.push(mo.id);
        slain = true;
        logEvent(sim, { type: 'monster_slain', cat: 'nature', title: `The people of ${s.name} slew a ${def.name.toLowerCase()}`, civs: [s.civId], settlements: [s.id], x: s.x, y: s.y, importance: 2 });
        break;
      }
    }
    // Task 8b: the strongest town within a few days' march sends a hunting party. Monsters roam wild country, where
    // the towns at their gates were hamlets of ~10 people; a strong town 2,000+ almost never stood within 3 tiles.
    // Threatened communities hunt dangerous beasts down rather than wait at the gate (e.g. man-eater hunts, Corbett 1944).
    if (!slain) {
      const r2 = BALANCE.monsterHuntRadius ** 2;
      let hunter: Settlement | undefined;
      for (const s of w.settlements.values()) if ((s.x - mo.x) ** 2 + (s.y - mo.y) ** 2 <= r2 && (!hunter || s.pop > hunter.pop)) hunter = s;
      if (hunter && !atGates.has(hunter.id)) {
        fought = true;
        mo.hp -= defenseOf(hunter) * BALANCE.monsterDamage;
        if (mo.hp <= 0) {
          dead.push(mo.id);
          logEvent(sim, { type: 'monster_slain', cat: 'nature', title: `Hunters from ${hunter.name} slew a ${def.name.toLowerCase()}`, civs: [hunter.civId], settlements: [hunter.id], x: mo.x, y: mo.y, importance: 2 });
        }
      }
    }
    if (!fought) mo.hp = Math.min(def.hp, mo.hp + def.hp * 0.02); // round 10: wounds heal only away from a fight
  }
  for (const id of dead) w.monsters.delete(id);
}
