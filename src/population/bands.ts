/**
 * Nomadic bands (individual-level hunter-gatherer groups).
 *
 * Bands wander toward richer foraging grounds, hunt real herds, grow or
 * starve, split when large (daughter bands either stay in the tribe or found
 * a new one), and settle — becoming villages — with a probability that rises
 * with local richness (fish, rivers, game) and sharply once agriculture is
 * known. This is how civilizations spread across an empty planet.
 */
import type { Sim } from '../sim/context';
import type { Band, Civ, SpeciesKey } from '../sim/types';
import { BALANCE } from '../config/balance';
import { clamp, clamp01 } from '../core/math';
import { forageCapacity } from '../economy/production';
import { huntHerds } from '../ecology/ecology';
import { createPerson, phonOfCulture } from './persons';
import { emptyFlows, healthIndices, individualMonth, mortalitySchedule, tfrFor } from './demography';
import { createCiv } from '../civilizations/civ';
import { foundSettlement } from '../civilizations/settlement';
import { revealAround } from '../civilizations/knowledge';
import { logEvent } from '../history/events';
import { TERRAIN, isWaterTerrain } from '../world/terrain';
import { createLeader, crown } from '../politics/succession';
import { createCulture } from '../civilizations/civ';
import { TICKS_PER_MONTH } from '../core/time';

export function spawnBand(sim: Sim, x: number, y: number, species: SpeciesKey, size: number, civ?: Civ, quiet = false): Band | null {
  const w = sim.w;
  const m = w.map;
  if (!m.inBounds(x, y) || m.isWater(m.idx(x, y))) return null;
  const c = civ ?? createCiv(sim, { species, x, y, quiet, cause: 'A band of people gathered here' });
  const b: Band = {
    id: ++w.ids.band,
    civId: c.id,
    species,
    x: x + 0.5,
    y: y + 0.5,
    tx: x + 0.5,
    ty: y + 0.5,
    members: [],
    food: size * 0.4,
    cultureId: c.cultureId,
    languageId: c.languageId,
    religionId: 0,
    think: 0,
    founded: sim.year,
  };
  w.bands.set(b.id, b);
  c.bands.push(b.id);
  const adults: number[] = [];
  for (let k = 0; k < size; k++) {
    const age = k < size * 0.35 ? sim.rng.int(0, 14) : sim.rng.int(15, 45);
    const p = createPerson(sim, { born: sim.year - age, species, civId: c.id, bandId: b.id, cultureId: c.cultureId, religionId: 0, job: age < 10 ? 'child' : 'forager' });
    b.members.push(p.id);
    if (age >= 16) adults.push(p.id);
  }
  // pair up some adults
  const F = adults.map((id) => w.persons.get(id)!).filter((p) => p.female);
  const M = adults.map((id) => w.persons.get(id)!).filter((p) => !p.female);
  for (let k = 0; k < Math.min(F.length, M.length); k++) {
    F[k].spouseId = M[k].id;
    M[k].spouseId = F[k].id;
  }
  if (!c.rulerId) {
    const elder = adults.map((id) => w.persons.get(id)!).sort((a, b2) => a.born - b2.born)[0];
    if (elder) crown(sim, c, elder, 'founded');
  }
  revealAround(sim, c, x, y, 8);
  return b;
}

/** Per-tick wandering. */
export function bandsTick(sim: Sim): void {
  const m = sim.w.map;
  for (const b of sim.w.bands.values()) {
    const dx = b.tx - b.x;
    const dy = b.ty - b.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.2) continue;
    const i = Math.floor(b.y) * m.w + Math.floor(b.x);
    const cost = Math.max(1, m.landMoveCost(i));
    const step = Math.min(d, 0.05 / cost);
    const nx = b.x + (dx / d) * step;
    const ny = b.y + (dy / d) * step;
    const ni = Math.floor(ny) * m.w + Math.floor(nx);
    if (m.isWater(ni)) {
      b.tx = b.x;
      b.ty = b.y;
      continue;
    }
    b.x = nx;
    b.y = ny;
  }
}

function chooseCamp(sim: Sim, b: Band): void {
  const m = sim.w.map;
  const rng = sim.rng;
  let best = -1;
  let bx = b.x;
  let by = b.y;
  for (let k = 0; k < 8; k++) {
    const x = clamp(Math.floor(b.x + rng.range(-9, 9)), 1, m.w - 2);
    const y = clamp(Math.floor(b.y + rng.range(-9, 9)), 1, m.h - 2);
    const i = m.idx(x, y);
    if (m.isWater(i) || m.owner[i] && m.owner[i] !== b.civId) continue;
    let score = forageCapacity(sim, x, y, 3) + (m.hasFreshWater(i) ? 10 : 0) - crowding(sim, b, x, y) * 15 + rng.float() * 3;
    score *= TERRAIN[m.terrain[i]].habitability + 0.2;
    if (score > best) {
      best = score;
      bx = x + 0.5;
      by = y + 0.5;
    }
  }
  b.tx = bx;
  b.ty = by;
}

function crowding(sim: Sim, b: Band, x: number, y: number): number {
  let c = 0;
  for (const o of sim.w.bands.values()) if (o !== b && (o.x - x) ** 2 + (o.y - y) ** 2 < 36) c++;
  for (const s of sim.w.settlements.values()) if ((s.x - x) ** 2 + (s.y - y) ** 2 < 25) c += 2;
  return c;
}

const qScratch = new Float64Array(17);

/** Monthly band life (staggered by band id). */
export function bandMonthly(sim: Sim, b: Band): void {
  const w = sim.w;
  const civ = w.civs.get(b.civId);
  if (!civ) return;
  const size = b.members.length;
  if (size === 0) {
    removeBand(sim, b);
    return;
  }
  // foraging & hunting
  const caps = civ.caps;
  const need = (size * BALANCE.foodNeedPerCapita) / 12;
  const cap = forageCapacity(sim, b.x, b.y, 4) * (1 + caps.forage * 0.5);
  const workers = size * 0.55;
  const labour = (workers * BALANCE.foragerProductivity * (1 + caps.forage)) / 12;
  const plants = Math.min(cap / 12, labour * 0.65);
  const meat = huntHerds(sim, b.x, b.y, 7, labour * 0.35, 1 + caps.forage);
  b.food += plants + meat;
  const eaten = Math.min(b.food, need);
  b.food = Math.max(0, b.food - eaten) * 0.97;
  const adequacy = need > 0 ? eaten / need : 1;
  // demography
  const q = mortalitySchedule(healthIndices(civ, 1), b.species, qScratch);
  const flows = emptyFlows();
  individualMonth(sim, b.members, { q, tfr: tfrFor(civ, { education: 0, prosperity: 1, pop: size }, q[0], adequacy, b.species), adequacy }, { settlementId: 0, bandId: b.id, civId: civ.id, cultureId: b.cultureId, religionId: b.religionId, species: b.species }, flows);
  // move on when local food runs thin
  if (adequacy < 0.9 || sim.rng.chance(0.08)) chooseCamp(sim, b);
  // yearly decisions on the band's own month slot
  if ((w.tick / TICKS_PER_MONTH | 0) % 12 === b.id % 12) bandYearly(sim, b, civ, cap, size);
}

function bandYearly(sim: Sim, b: Band, civ: Civ, cap: number, size: number): void {
  const w = sim.w;
  const m = w.map;
  const rng = sim.rng;
  revealAround(sim, civ, b.x, b.y, 7);
  const i = m.idx(Math.floor(b.x), Math.floor(b.y));
  const richness = clamp01(cap / Math.max(1, size * 1.4) / 3) + (m.hasFreshWater(i) ? 0.15 : 0) + (m.isCoastal(i) ? 0.1 : 0);
  // settle
  const pSettle = 0.03 + 0.15 * richness + (civ.caps.farming > 0 ? 0.5 : 0);
  if (size >= 12 && !m.settle[i] && !isWaterTerrain(m.terrain[i]) && TERRAIN[m.terrain[i]].buildable && rng.float() < pSettle) {
    const s = foundSettlement(sim, civ, Math.floor(b.x), Math.floor(b.y), { members: b.members, species: b.species, cultureId: b.cultureId, religionId: b.religionId, cause: civ.caps.farming > 0 ? 'Agriculture made permanent settlement possible' : 'Rich foraging grounds encouraged a permanent camp' });
    s.food = b.food;
    b.members = [];
    removeBand(sim, b);
    return;
  }
  // split when large
  if (size > BALANCE.bandSplitSize) {
    const leaving = b.members.slice(Math.floor(size * 0.55));
    b.members = b.members.slice(0, Math.floor(size * 0.55));
    const ang = rng.range(0, Math.PI * 2);
    const dist = rng.range(12, 22);
    const tx = clamp(Math.floor(b.x + Math.cos(ang) * dist), 1, m.w - 2);
    const ty = clamp(Math.floor(b.y + Math.sin(ang) * dist), 1, m.h - 2);
    const nearOwn = civ.settlements.some((sid) => {
      const s = w.settlements.get(sid);
      return s && Math.hypot(s.x - tx, s.y - ty) < 25;
    });
    let target = civ;
    if (!nearOwn && rng.chance(0.6)) {
      // a new tribe: daughter culture and language
      const culture = createCulture(sim, { parentId: b.cultureId, originCiv: 0 });
      target = createCiv(sim, { species: b.species, x: Math.floor(b.x), y: Math.floor(b.y), cultureId: culture.id, parentId: civ.id, inheritFrom: civ, cause: `Split from the ${civ.adjective} people` });
      culture.originCiv = target.id;
    }
    const nb: Band = { ...b, id: ++w.ids.band, civId: target.id, members: leaving, food: b.food * 0.4, tx: tx + 0.5, ty: ty + 0.5, cultureId: target.cultureId, languageId: target.languageId, founded: sim.year };
    b.food *= 0.6;
    w.bands.set(nb.id, nb);
    target.bands.push(nb.id);
    for (const id of leaving) {
      const p = w.persons.get(id);
      if (p) {
        p.bandId = nb.id;
        p.civId = target.id;
        p.cultureId = target.cultureId;
      }
    }
    if (target !== civ && !target.rulerId) {
      const leader = createLeader(sim, target);
      crown(sim, target, leader, 'founded');
    }
  }
}

export function removeBand(sim: Sim, b: Band): void {
  const w = sim.w;
  for (const id of b.members) {
    const p = w.persons.get(id);
    if (p && !p.notable) w.persons.delete(id);
  }
  w.bands.delete(b.id);
  const civ = w.civs.get(b.civId);
  if (civ) civ.bands = civ.bands.filter((x) => x !== b.id);
}

export function bandsMonthly(sim: Sim): void {
  const slot = sim.w.tick % TICKS_PER_MONTH;
  for (const b of [...sim.w.bands.values()]) if (b.id % TICKS_PER_MONTH === slot) bandMonthly(sim, b);
}

export { phonOfCulture };
void logEvent;
