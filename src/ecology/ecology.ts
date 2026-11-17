/**
 * Ecosystems: vegetation regrowth, animal herds (movement, grazing, logistic
 * growth limited by local vegetation, predation, starvation, climate stress),
 * human hunting, extinction, slow evolution into subspecies, and optional
 * fantasy monsters.
 */
import { flow } from '../population/ledger';
import type { Sim } from '../sim/context';
import type { Herd, Monster, Subspecies } from '../sim/types';
import { SPECIES, SPECIES_BY_KEY, MONSTERS, type SpeciesDef } from './species';
import { TERRAIN, isWaterTerrain } from '../world/terrain';
import { vegCapacity } from '../world/worldgen';
import { BALANCE } from '../config/balance';
import { clamp, clamp01, DX8, DY8 } from '../core/math';
import { TICKS_PER_MONTH } from '../core/time';
import { logEvent } from '../history/events';
import { B } from '../civilizations/buildingTypes';
import { markTile, addFx } from '../sim/context';
import { removePeople } from '../population/demography';

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
  if (sp.aquatic) return water && sp.biomes.includes(t) ? 1 : 0;
  if (water && !sp.flying) return 0;
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
  return c.anomaly + (c.heat[cy * c.cellsX + cx] ?? 0) - c.aerosol;
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

function pickTarget(sim: Sim, h: Herd, sp: SpeciesDef): void {
  const m = sim.w.map;
  const rng = sim.rng;
  if (sp.diet === 'predator') {
    const prey = herdsNear(sim, h.x, h.y, 12).filter((o) => o !== h && SPECIES_BY_KEY[o.species]?.diet !== 'predator' && SPECIES_BY_KEY[o.species]?.meat >= 0.01);
    if (prey.length) {
      prey.sort((a, b) => (a.x - h.x) ** 2 + (a.y - h.y) ** 2 - ((b.x - h.x) ** 2 + (b.y - h.y) ** 2) || a.id - b.id);
      h.tx = prey[0].x;
      h.ty = prey[0].y;
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
      const prey = herdsNear(sim, h.x, h.y, 2.5).filter((o) => o !== h && SPECIES_BY_KEY[o.species]?.diet === 'herbivore' && o.owner === 0);
      if (prey.length) {
        const p = prey[0];
        const kills = Math.min(p.count * 0.18, h.count * 0.9);
        p.count -= kills;
        fed = Math.min(1, kills / Math.max(0.5, h.count * 0.6));
        h.hunger = 0;
      } else if (sp.diet === 'predator') {
        h.hunger++;
        fed = h.hunger > 3 ? 0.2 : 0.6;
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
        m.veg[j] = Math.max(0, m.veg[j] - take);
        got += take;
        demand -= take;
      }
      const herbFed = h.count * sp.graze > 0 ? got / (h.count * sp.graze) : 1;
      fed = sp.diet === 'omnivore' ? Math.max(fed * 0.5, herbFed) : herbFed;
    }
    // logistic growth vs starvation and climate stress
    const rivals = countSpeciesNear(sim, h.x, h.y, 5, h.species, h);
    const capacity = (sp.maxHerd * 1.3) / (1 + rivals * 0.5);
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
    const take = Math.min(want, h.count * 0.12 * skill);
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
      m.veg[i] = clamp(Math.round(nv + (diff > 0 ? 0.5 : -0.5)), 0, 255);
      if ((v >> 5) !== (m.veg[i] >> 5)) markTile(sim, i);
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
  if (!w.laws.fantasyCreatures) return;
  const dead: number[] = [];
  for (const mo of w.monsters.values()) {
    const def = MONSTERS.find((d) => d.kind === mo.kind);
    if (!def) continue;
    for (const s of w.settlements.values()) {
      if ((s.x - mo.x) ** 2 + (s.y - mo.y) ** 2 > 9) continue;
      const civ = w.civs.get(s.civId);
      const defense = (s.garrison + s.pop * 0.01) * (1 + (civ?.caps.landTier ?? 0) * 0.6);
      mo.hp -= defense * 0.05;
      const harm = Math.min(s.pop * 0.05, def.harm * sim.rng.range(0.4, 1));
      if (harm > 0.5) {
        flow(sim, s, 'disaster', removePeople(sim, s, harm, 'monster attack'));
        addFx(sim, 'fx.fire', s.x, s.y, 2);
        if (sim.rng.chance(0.15))
          logEvent(sim, { type: 'monster_attack', cat: 'disaster', title: `A ${def.name.toLowerCase()} attacked ${s.name}`, civs: [s.civId], settlements: [s.id], x: s.x, y: s.y, importance: 2 });
      }
      if (mo.hp <= 0) {
        dead.push(mo.id);
        logEvent(sim, { type: 'monster_slain', cat: 'nature', title: `The people of ${s.name} slew a ${def.name.toLowerCase()}`, civs: [s.civId], settlements: [s.id], x: s.x, y: s.y, importance: 2 });
        break;
      }
    }
    mo.hp = Math.min(def.hp, mo.hp + def.hp * 0.02);
  }
  for (const id of dead) w.monsters.delete(id);
}
