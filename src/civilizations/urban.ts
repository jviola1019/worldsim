/**
 * Urban development. Each settlement runs at most one construction project at
 * a time, chosen by utility from its measured needs (housing pressure, food
 * deficit, material shortages, unworked deposits, energy deficit, services
 * per capita, threats, transport links). Projects consume materials from the
 * national market and labour from local builders; while underway the tile
 * shows scaffolding. Cities evolve piecemeal: individual districts are rebuilt
 * at higher tiers when technology allows, so older districts persist, and old
 * landmarks (temples, walls, monuments, arenas) become protected HISTORIC sites.
 */
import { eachOwnTile, forgetOwnTiles } from './territory';
import { BALANCE } from '../config/balance';
import { ethosBuildMult } from './ethos';
import { missionBuildMult } from './missions';
import type { Sim } from '../sim/context';
import type { Civ, Settlement } from '../sim/types';
import { markTile } from '../sim/context';
import { B, eraToTier, type BuildingId } from './buildingTypes';
import { BUILDINGS, RESIDENTIAL, type BuildingDef } from './buildings';
import { BLDF } from '../world/tilemap';
import { TERRAIN, T, isWaterTerrain } from '../world/terrain';
import { Good, GOOD_COUNT, DEPOSITS, Deposit, type GoodKey } from '../world/resources';
import { clamp, saturate } from '../core/math';
import { cropSuitability, getSites, markSitesDirty } from '../economy/production';
import { addBldTile, removeBldTile } from './territory';
import { hasUnlocked } from '../technology/research';
import { logEvent } from '../history/events';

export function placeBuilding(sim: Sim, s: Settlement, type: number, tile: number, tier: number, historic = false): void {
  const m = sim.w.map;
  const def = BUILDINGS[type];
  const tiles = footprintTiles(sim, tile, def?.footprint ?? 1);
  for (const t of tiles) {
    if (m.bld[t] && m.settle[t] === s.id && !(m.bldFlags[t] & BLDF.PART)) s.bld[m.bld[t]] = Math.max(0, s.bld[m.bld[t]] - 1);
    m.bld[t] = type;
    m.bldFlags[t] = (tier & BLDF.TIER_MASK) | (t !== tile ? BLDF.PART : 0) | (historic ? BLDF.HISTORIC : 0);
    if (m.settle[t] !== s.id && m.settle[t] === 0) {
      m.settle[t] = s.id;
      forgetOwnTiles(sim, s.id);
      m.owner[t] = s.civId;
      s.territory++;
    }
    markTile(sim, t);
    addBldTile(sim, s.id, t);
  }
  s.bld[type]++;
  if (def?.category === 'residential') s.housing += def.housing;
  markSitesDirty(sim, s.id);
}

export function removeBuilding(sim: Sim, tile: number, ruins = false): void {
  const w = sim.w;
  const m = w.map;
  const type = m.bld[tile];
  if (!type) return;
  // find anchor of a multi-tile building
  let anchor = tile;
  if (m.bldFlags[tile] & BLDF.PART) {
    for (const [dx, dy] of [[-1, 0], [0, -1], [-1, -1]]) {
      const x = m.xOf(tile) + dx;
      const y = m.yOf(tile) + dy;
      if (!m.inBounds(x, y)) continue;
      const j = m.idx(x, y);
      if (m.bld[j] === type && !(m.bldFlags[j] & BLDF.PART)) anchor = j;
    }
  }
  const def = BUILDINGS[type];
  const tier = m.bldFlags[anchor] & BLDF.TIER_MASK;
  const s = w.settlements.get(m.settle[anchor]);
  if (s) {
    s.bld[type] = Math.max(0, s.bld[type] - 1);
    if (def?.category === 'residential') s.housing = Math.max(0, s.housing - def.housing);
    markSitesDirty(sim, s.id);
  }
  for (const t of footprintTiles(sim, anchor, def?.footprint ?? 1)) {
    if (m.bld[t] !== type) continue;
    m.bld[t] = 0;
    m.bldFlags[t] = 0;
    if (s) removeBldTile(sim, s.id, t);
    markTile(sim, t);
  }
  if (ruins && type !== B.FARM && type !== B.PASTURE && type !== B.CONSTRUCTION && type !== B.RUINS) {
    m.bld[anchor] = B.RUINS;
    m.bldFlags[anchor] = tier >= 5 ? 5 : 0;
    if (s) {
      s.bld[B.RUINS]++;
      addBldTile(sim, s.id, anchor);
    }
  }
}

function footprintTiles(sim: Sim, tile: number, fp: number): number[] {
  if (fp <= 1) return [tile];
  const m = sim.w.map;
  const x = m.xOf(tile);
  const y = m.yOf(tile);
  const out: number[] = [];
  for (let dy = 0; dy < fp; dy++) for (let dx = 0; dx < fp; dx++) if (m.inBounds(x + dx, y + dy)) out.push(m.idx(x + dx, y + dy));
  return out;
}

/** Recompute housing from building counts (after loads or conquest). */
export function recomputeHousing(s: Settlement): void {
  let h = 0;
  for (const def of RESIDENTIAL) h += s.bld[def.id] * def.housing;
  s.housing = h;
}

// ------------------------------------------------------------------ planning

interface Project {
  type: number;
  tile: number;
  upgrade: boolean;
  score: number;
}

/**
 * Concrete substitution: once a civ is industrial, masonry/concrete (STONE) can replace timber
 * entirely and up to half of the structural metal in construction, at CONCRETE_RATIO stone per unit.
 */
const CONCRETE_RATIO = 2;
export function concreteShare(civ: Civ, g: number): number {
  if (civ.caps.industry <= 0) return 0;
  return g === Good.WOOD ? 1 : g === Good.METAL ? 0.5 : 0;
}

function canAfford(civ: Civ, def: BuildingDef, frac = 0.25): boolean {
  let stoneLeft = civ.stock[Good.STONE] - ((def.cost.STONE ?? 0) as number) * frac;
  for (const [g, amt] of Object.entries(def.cost)) {
    const gi = Good[g as GoodKey];
    const want = (amt as number) * frac;
    const have = civ.stock[gi];
    if (have >= want) continue;
    const sub = Math.min(want * concreteShare(civ, gi), want - have);
    if (have + sub < want - 1e-9 || stoneLeft < sub * CONCRETE_RATIO) return false;
    stoneLeft -= sub * CONCRETE_RATIO;
  }
  return true;
}

function bestResidential(civ: Civ, s: Settlement, landScarce: boolean): BuildingDef {
  let best = BUILDINGS[B.CAMP];
  const tierCap = civ.caps.housingTier;
  for (const def of RESIDENTIAL) {
    if ((def.housingTier ?? 0) > tierCap) continue;
    if (def.id !== B.CAMP && !hasUnlocked(civ, def.id)) continue;
    if (def.id === B.SUBURB && (landScarce || s.pop < 20000 || civ.caps.roadTier < 3)) continue;
    // the best dwelling the nation can actually build (a tower nobody can afford houses nobody)
    if ((def.housingTier ?? 0) >= (best.housingTier ?? 0) && (def.id === B.CAMP || canAfford(civ, def))) best = def;
  }
  // suburbs are an alternative, not a replacement, for dense housing
  if (best.id === B.SUBURB) best = RESIDENTIAL.filter((d) => d.id !== B.SUBURB && (d.housingTier ?? 0) <= tierCap && (d.id === B.CAMP || hasUnlocked(civ, d.id))).pop() ?? best;
  return best;
}

function residentialRank(type: number): number {
  return BUILDINGS[type]?.housingTier ?? -1;
}

function isBuildable(sim: Sim, s: Settlement, i: number): boolean {
  const m = sim.w.map;
  if (m.settle[i] !== s.id || m.bld[i]) return false;
  const t = m.terrain[i];
  if (isWaterTerrain(t)) return false;
  return TERRAIN[t].buildable && !m.fire[i];
}

function isDiggable(sim: Sim, s: Settlement, i: number): boolean {
  const m = sim.w.map;
  return m.settle[i] === s.id && !m.bld[i] && !isWaterTerrain(m.terrain[i]) && !m.fire[i];
}

function placementScore(sim: Sim, s: Settlement, def: BuildingDef, i: number, x: number, y: number, d: number): number {
  const m = sim.w.map;
  const t = m.terrain[i];
  switch (def.placement) {
    case 'center':
      return 10 - d * 2;
    case 'urban': {
      let adj = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = (y + dy) * m.w + x + dx;
        if (m.inBounds(x + dx, y + dy) && m.bld[j] && m.settle[j] === s.id && BUILDINGS[m.bld[j]].category !== 'food') adj++;
      }
      return 8 - d * 1.2 + adj * 1.5 - (t === T.HILLS ? 0.5 : 0);
    }
    case 'farmland': {
      if (t === T.MOUNTAIN || t === T.SNOW || t === T.GLACIER || t === T.BEACH) return -1;
      const irr = (sim.w.civs.get(s.civId)?.caps.irrigation ?? 0) > 0 && m.hasFreshWater(i);
      const pot = (m.fert[i] / 255) * cropSuitability(m.temp[i], m.moist[i], irr);
      if (pot < 0.08) return -1;
      return pot * 10 - Math.abs(d - Math.max(1.5, s.radius * 0.5)) * 0.4 + (m.hasFreshWater(i) ? 1 : 0);
    }
    case 'coast':
      return m.isCoastal(i) || hasLakeNeighbor(sim, i) ? 8 - d : -1;
    case 'river':
      return m.river[i] > 0 ? 6 + Math.log2(1 + m.river[i]) - d * 0.3 : -1;
    case 'deposit': {
      const dep = m.dep[i];
      if (!dep || dep === Deposit.FISH || dep === Deposit.OIL || dep === Deposit.GAS || dep === Deposit.SPICES || dep === Deposit.FURS) return -1;
      return 10 - d * 0.3;
    }
    case 'oil':
      return m.dep[i] === Deposit.OIL || m.dep[i] === Deposit.GAS ? 10 - d * 0.3 : -1;
    case 'forest':
      return m.veg[i] > 110 ? m.veg[i] / 30 - d * 0.3 : -1;
    case 'hills': {
      let hills = t === T.HILLS ? 2 : 0;
      for (let k = 0; k < 4; k++) {
        const xx = x + [1, -1, 0, 0][k];
        const yy = y + [0, 0, 1, -1][k];
        if (m.inBounds(xx, yy) && (m.terrain[m.idx(xx, yy)] === T.MOUNTAIN || m.terrain[m.idx(xx, yy)] === T.HILLS)) hills++;
      }
      return hills > 0 ? hills * 2 - d * 0.3 : -1;
    }
    case 'edge':
      return d >= s.radius * 0.55 ? 5 - Math.abs(d - s.radius * 0.8) : -1;
    case 'open':
      return t === T.GRASS || t === T.STEPPE || t === T.DESERT || t === T.SAVANNA || t === T.TUNDRA ? 5 - Math.abs(d - s.radius * 0.7) * 0.5 : -1;
  }
  return 0;
}

function hasLakeNeighbor(sim: Sim, i: number): boolean {
  const m = sim.w.map;
  const x = m.xOf(i);
  const y = m.yOf(i);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!m.inBounds(x + dx, y + dy)) continue;
    if (m.terrain[m.idx(x + dx, y + dy)] === T.LAKE) return true;
  }
  return false;
}

/** Find the best free tile for a building type (null if none). */
export function findSite(sim: Sim, s: Settlement, def: BuildingDef): number | null {
  const m = sim.w.map;
  let best = -1;
  let bestScore = 0;
  const r = Math.max(2, s.radius + 0.5);
  const dig = def.placement === 'deposit' || def.placement === 'oil';
  eachOwnTile(sim, s, r, (i, x, y, d2) => {
    // mines and wells go where the ore is, mountains included
    if (dig ? !isDiggable(sim, s, i) : !isBuildable(sim, s, i)) return;
    if (def.footprint === 2) {
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) {
        if (!m.inBounds(x + dx, y + dy)) return;
        if (!isBuildable(sim, s, m.idx(x + dx, y + dy))) return;
      }
    }
    if (def.category !== 'food' && def.placement !== 'deposit' && def.placement !== 'oil' && m.dep[i] && m.dep[i] !== Deposit.FISH) {
      // do not cover unexploited mineral deposits with houses
      if (DEPOSITS[m.dep[i]].good !== Good.LUXURY || def.category === 'residential') return;
    }
    const sc = placementScore(sim, s, def, i, x, y, Math.sqrt(d2)) + sim.rng.float() * 0.3;
    if (sc > bestScore) {
      bestScore = sc;
      best = i;
    }
  });
  return best >= 0 ? best : null;
}

/** Choose and start a construction project from measured needs. */
export function planConstruction(sim: Sim, s: Settlement, civ: Civ): void {
  if (s.construction) return;
  const w = sim.w;
  const m = w.map;
  const caps = civ.caps;
  const sites = getSites(sim, s);
  const tier = eraToTier(civ.era);
  const pop = s.pop;
  const cands: { type: number; score: number; upgrade?: number }[] = [];
  const add = (type: number, score: number, upgrade?: number) => {
    if (score <= 0) return;
    const def = BUILDINGS[type];
    if (!def) return;
    if (type !== B.CAMP && !hasUnlocked(civ, type)) return;
    if (pop < def.minPop) return;
    if (def.max && s.bld[type] >= def.max && upgrade === undefined) return;
    // the nation's values and current mission reshape its priorities
    cands.push({ type, score: score * ethosBuildMult(civ, type) * missionBuildMult(civ, type), upgrade });
  };
  // housing pressure
  const pressure = pop / Math.max(1, s.housing);
  const freeLand = countFree(sim, s);
  const resi = bestResidential(civ, s, freeLand < 4);
  if (pressure > 0.85) add(resi.id, 3 + Math.min(1, pressure - 0.85) * 12); // capped: crowding is urgent, not infinitely so
  // upgrade an older residential district in place
  if (pressure > 0.7 && freeLand < 6) {
    const old = oldestResidential(sim, s, residentialRank(resi.id));
    if (old !== null) cands.push({ type: resi.id, score: 2.5 + Math.min(1, pressure - 0.7) * 10, upgrade: old });
  }
  // food
  if (caps.farming > 0) {
    const needYear = pop * 0.9;
    const farmOut = sites.farmPot * BALANCE.farmYield * (1 + Math.max(0, caps.farming - 1) + caps.biotech * 0.4 + caps.irrigation * 0.15);
    const local = (needYear * 1.15 - farmOut - sites.forage * 0.6) / Math.max(1, needYear);
    // the national market also signals: hungry cities elsewhere make farmland worth developing here
    const national = civ.acc.foodNeed > 0 ? civ.acc.foodShort / civ.acc.foodNeed : 0;
    const deficit = Math.max(local, national > 0.05 && freeLand > 0 ? national * 0.8 : 0);
    if (deficit > 0) add(B.FARM, 2 + deficit * 8);
    // no free land and real hunger: redevelop an outlying surplus district into farmland
    if (deficit > 0.2 && freeLand < 2 && hasUnlocked(civ, B.FARM)) {
      const site = redevelopForFarm(sim, s);
      if (site !== null) cands.push({ type: B.FARM, score: 2 + deficit * 8, upgrade: site });
    }
    if (caps.herding > 0 && sites.pastures < Math.max(1, sites.farms / 3)) add(B.PASTURE, 1.5 + deficit * 3);
    if (s.bld[B.GRANARY] === 0 && pop > 250) add(B.GRANARY, 1.2);
  }
  if (caps.fishing > 0 && s.coastal && sites.fisheries < 2) add(B.FISHERY, 2.2);
  // materials
  const woodLow = civ.stock[Good.WOOD] < Math.max(60, civ.population * 0.02);
  const stoneLow = civ.stock[Good.STONE] < Math.max(60, civ.population * 0.02);
  if (woodLow && sites.forestShare > 0.05) add(B.LUMBER, 2 + (sites.lumber === 0 ? 1.5 : 0));
  if (stoneLow && caps.quarrying > 0 && sites.hillShare > 0.03) add(B.QUARRY, 2 + (sites.quarries === 0 ? 1.5 : 0));
  // unworked deposits the civ can extract
  if (caps.mining > 0 || caps.oilExtraction > 0) {
    eachOwnTile(sim, s, s.radius, (i) => {
      const d = m.dep[i];
      if (!d || m.bld[i] || m.settle[i] !== s.id) return;
      const def = DEPOSITS[d];
      const cap = (caps as unknown as Record<string, number>)[def.extractCap] ?? 0;
      if (def.extractCap === 'forage' || def.extractCap === 'farming' || cap <= 0) return;
      const want = d === Deposit.OIL || d === Deposit.GAS ? B.OIL_WELL : B.MINE;
      const scarcity = 1 + saturate(Math.max(0, civ.population * 0.001 - civ.stock[def.good]), civ.population * 0.001 + 5) * 3;
      add(want, 2.5 * scarcity);
    });
  }
  // industry & crafts
  const unemployed = s.employment[6] / Math.max(1, pop);
  // crafts scale with population up to a target count (factories take over in industrial eras)
  const workshopTarget = pop / (caps.industry > 0 ? 15000 : 5000);
  if (pop > 150) add(B.WORKSHOP, 1 + (workshopTarget - s.bld[B.WORKSHOP]) * 1.2);
  const smithyTarget = pop / (caps.industry > 0 ? 60000 : 8000); // steel mills and factories replace the village smithy
  if (pop > 150 && caps.metalTier >= 1) add(B.SMITHY, 1 + (smithyTarget - s.bld[B.SMITHY]) * 1.5);
  if (caps.industry > 0) add(B.FACTORY, 1.5 + unemployed * 20 + pop / 20000 - s.bld[B.FACTORY] * 0.8);
  // the steel industry grows with metal scarcity whenever ore and fuel can be had
  if (caps.industry > 0 && (civ.access[Good.IRON] > 0.2 || civ.stock[Good.IRON] > 100) && (civ.access[Good.COAL] > 0.2 || civ.stock[Good.COAL] > 100)) {
    const metalNeed = civ.population * 0.01 + 1;
    add(B.STEEL_MILL, 2 + 6 * saturate(Math.max(0, metalNeed - civ.stock[Good.METAL]), metalNeed) - s.bld[B.STEEL_MILL]);
  }
  if (caps.oilExtraction > 0 && civ.stock[Good.OIL] > 100) add(B.REFINERY, 1.5);
  // the electronics industry grows with chip scarcity (first fabs are tooled without chips of their own)
  if (caps.computing > 0) {
    const chipNeed = civ.population * 0.002 + 1;
    add(B.CHIP_FAB, 1.2 + caps.computing * 0.2 + 10 * saturate(Math.max(0, chipNeed - civ.stock[Good.ELECTRONICS]), chipNeed) - s.bld[B.CHIP_FAB]);
  }
  if (caps.robotics > 0) add(B.ROBOT_FACTORY, 1 + caps.robotics);
  if (caps.crafts > 0 && s.river) add(B.MILL, 1);
  // energy deficit
  if (caps.electrification > 0) {
    const produced = civ.acc.prod[Good.ENERGY];
    const used = civ.acc.use[Good.ENERGY] + civ.acc.energyUse;
    const deficit = used >= produced * 0.9 || civ.stock[Good.ENERGY] < civ.population * 0.05;
    if (deficit) {
      if (caps.fusionPower > 0) add(B.FUSION, 4);
      if (caps.nuclearPower > 0 && civ.access[Good.URANIUM] > 0.3) add(B.POWER_NUCLEAR, 3);
      if (caps.renewables > 0) {
        add(B.SOLAR, 2.5 + (civ.policies.environment === 'strict' ? 1.5 : 0));
        add(B.WIND, 2.4 + (civ.policies.environment === 'strict' ? 1.5 : 0));
      }
      if (s.river) add(B.HYDRO, 2.6);
      add(B.POWER_FOSSIL, 2.8 - (civ.policies.environment === 'strict' ? 1.5 : 0));
    }
  }
  // services
  const temples = s.bld[B.TEMPLE];
  if (pop > 120 * (temples + 1) * (temples + 1)) add(B.TEMPLE, 1.6 + civ.personality.piety);
  if (caps.currency > 0) add(B.MARKET, 1.5 - s.bld[B.MARKET] * 0.6);
  add(B.LIBRARY, 1.2 - s.bld[B.LIBRARY] * 0.8);
  add(B.SCHOOL, 1 + civ.budget.education * 8 + pop / 10000 - s.bld[B.SCHOOL] * 0.7);
  add(B.UNIVERSITY, 1.2 + civ.personality.science - s.bld[B.UNIVERSITY] * 0.9);
  add(B.HOSPITAL, 1 + civ.budget.health * 8 + pop / 40000 - s.bld[B.HOSPITAL] * 0.8);
  add(B.LAB, 1 + civ.budget.research * 8 + pop / 80000 - s.bld[B.LAB] * 0.9);
  add(B.AQUEDUCT, 1.4);
  // a city whose team plays in a league wants a proper venue
  const hasTeam = [...sim.w.leagues.values()].some((l) => l.active && l.teams.some((t) => t.settlementId === s.id));
  add(B.ARENA, 0.8 + (hasTeam ? 2.5 : 0));
  add(B.MONUMENT, 0.6);
  add(B.PARK, 0.7);
  add(B.BANK, 1 + caps.finance);
  add(B.OFFICE, 1 + caps.finance * 0.5 + pop / 300000 - s.bld[B.OFFICE] * 0.5);
  add(B.WAREHOUSE, 0.8);
  add(B.DATA_CENTER, 1 + caps.computing * 0.3);
  // seat of government
  if (s.capital) {
    if (s.bld[B.PALACE] === 0) add(B.PALACE, 4);
    else {
      const pt = palaceTier(sim, s);
      if (pt !== null && pt.tier < tier - 1) cands.push({ type: B.PALACE, score: 2.5, upgrade: pt.tile });
    }
  }
  // military & fortification
  const threatened = atWar(sim, civ) || civ.personality.caution > 0.7;
  if (caps.fortification > 0 && threatened && s.bld[B.WALL] < 6) add(B.WALL, 1.5 + (atWar(sim, civ) ? 2 : 0));
  if (caps.fortification >= 3 && threatened && (s.capital || s.pop > 5000)) add(B.FORT, 1.5);
  add(B.BARRACKS, 0.8 + civ.budget.military * 4);
  if (caps.landTier >= 9) add(B.MILITARY_BASE, 0.8 + civ.budget.military * 3);
  if (caps.airTier >= 1) add(B.AIRBASE, 0.6 + civ.budget.military * 3);
  if (caps.navalTier >= 5 && s.coastal) add(B.NAVAL_BASE, 0.7 + civ.budget.military * 3);
  if (caps.nuclearWeapons > 0 && sim.w.laws.advancedWeapons && s.capital) add(B.SILO, 1 + civ.personality.caution);
  // transport
  if (caps.navalTier >= 2 && s.coastal) add(B.HARBOR, 2 + civ.personality.trade - s.bld[B.HARBOR] * 1.5);
  if (caps.railTier >= 1) add(B.STATION, 2);
  if (caps.airTier >= 2) add(B.AIRPORT, 2);
  // one launch site per nation, in a large city (not necessarily the capital); priority grows with
  // space capability and scientific ambition so it is not forever outranked by everyday needs
  if (caps.spaceTier >= 1 && !civHasBuilding(sim, civ, B.SPACEPORT) && isLargestCity(sim, civ, s)) add(B.SPACEPORT, 2 + caps.spaceTier * 1.2 + civ.personality.science * 2);
  if (caps.spaceTier >= 7) add(B.MEGASTRUCTURE, 1);
  if (caps.biotech > 0 && pop > 20000) add(B.GREENHOUSE, 1 + (civ.econ.livingStandard < 2 ? 1 : 0));
  // replace aging farms with modern ones (cheap tier upgrade)
  const farmUpgrade = oldFarm(sim, s, tier);
  if (farmUpgrade !== null) cands.push({ type: B.FARM, score: 1.3, upgrade: farmUpgrade });

  if (!cands.length) return;
  cands.sort((a, b) => b.score - a.score || a.type - b.type);
  // walk down the ranked list: unaffordable wishes record demand but don't block cheaper needs
  let siteTries = 0;
  let wishes = 0;
  for (const c of cands) {
    if (siteTries >= 8) break;
    const def = BUILDINGS[c.type];
    if (!canAfford(civ, def)) {
      // record the unmet need so traders can supply it (top wishes only)
      if (wishes++ < 4) for (const [g, amt] of Object.entries(def.cost)) civ.acc.want[Good[g as GoodKey]] += (amt as number) * 0.25;
      continue;
    }
    siteTries++;
    let tile = c.upgrade !== undefined ? c.upgrade : findSite(sim, s, def);
    let upgrade = c.upgrade !== undefined;
    // Land-use intensification: a built-up city with a strong need (jobs, power, services) replaces
    // its oldest, lowest-density housing instead of giving up -- as long as it is not overcrowded.
    if (tile === null && c.score >= BALANCE.redevelopScore && (redevelopable(def) || (def.category === 'residential' && def.footprint === 1))) {
      // era-obsolete sites go first (village smithies in a steel age, water mills on the grid, ...);
      // then, when the city is not overcrowded, its oldest low-density housing
      if (def.footprint === 2) tile = pressure < 1.1 || def.category === 'residential' ? redevelopBlock(sim, s, civ, residentialRank(resi.id)) : null;
      else tile = obsoleteSite(sim, s, civ) ?? (pressure < 1.1 && def.category !== 'residential' ? oldestResidential(sim, s, residentialRank(resi.id)) : null);
      upgrade = tile !== null;
    }
    if (tile === null) continue;
    startProject(sim, s, civ, c.type, tile, upgrade);
    return;
  }
}

function countFree(sim: Sim, s: Settlement): number {
  const m = sim.w.map;
  let n = 0;
  eachOwnTile(sim, s, Math.max(1.5, s.radius * 0.7), (i) => {
    if (isBuildable(sim, s, i)) n++;
  });
  return n;
}

function oldestResidential(sim: Sim, s: Settlement, targetRank: number): number | null {
  const m = sim.w.map;
  let best: number | null = null;
  let bestKey = Infinity;
  eachOwnTile(sim, s, s.radius + 1, (i, x, y, d2) => {
    if (m.settle[i] !== s.id) return;
    const b = m.bld[i];
    if (!b || BUILDINGS[b].category !== 'residential' || m.bldFlags[i] & (BLDF.HISTORIC | BLDF.PART)) return;
    const rank = residentialRank(b);
    if (rank >= targetRank || BUILDINGS[b].footprint > 1) return;
    const key = rank * 100 + d2; // lowest tier first, nearest the center first
    if (key < bestKey) {
      bestKey = key;
      best = i;
    }
  });
  return best;
}

const REDEVELOPABLE = new Set(['industry', 'military', 'commerce', 'extraction']);

const URBAN_PLACEMENTS = new Set(['urban', 'center', 'edge', 'open']);
/** Buildings that may replace old housing in a full city (single-tile urban uses, not homes or farms). */
function redevelopable(def: BuildingDef): boolean {
  return def.category !== 'residential' && def.category !== 'food' && URBAN_PLACEMENTS.has(def.placement);
}

/** A 2x2 block of this settlement's land holding only old low-density housing, farmland or nothing. */
function redevelopBlock(sim: Sim, s: Settlement, civ: Civ, targetRank: number): number | null {
  const m = sim.w.map;
  let best: number | null = null;
  let bestD = -1;
  const ok = (j: number): boolean => {
    if (m.settle[j] !== s.id || !TERRAIN[m.terrain[j]].buildable || isWaterTerrain(m.terrain[j])) return false;
    const b = m.bld[j];
    if (!b) return true;
    if (m.bldFlags[j] & (BLDF.HISTORIC | BLDF.PART)) return false;
    const def = BUILDINGS[b];
    if (!def || def.footprint > 1) return false;
    return (def.category === 'residential' && residentialRank(b) < targetRank) || b === B.FARM || isObsolete(civ, s, b);
  };
  eachOwnTile(sim, s, s.radius, (i, x, y, d2) => {
    if (x + 1 >= m.w || y + 1 >= m.h) return;
    if (!ok(i) || !ok(i + 1) || !ok(i + m.w) || !ok(i + m.w + 1)) return;
    if (d2 > bestD) { bestD = d2; best = i; } // outskirts first
  });
  return best;
}

/** Buildings a civilization has outgrown (never landmarks, which are preserved as historic). */
function isObsolete(civ: Civ, s: Settlement, b: number): boolean {
  const c = civ.caps;
  switch (b) {
    case B.CAMP:
    case B.HUT:
      return c.industry > 0;
    case B.SMITHY:
      return c.industry > 0 && s.bld[B.SMITHY] > Math.max(1, s.pop / 60000);
    case B.WORKSHOP:
      return c.industry > 0 && s.bld[B.WORKSHOP] > Math.max(1, s.pop / 15000);
    case B.MILL:
      return c.electrification >= 0.5;
    case B.GRANARY:
      return c.industry > 0 && c.foodPreservation >= 0.6 && s.bld[B.GRANARY] > 1;
  }
  return false;
}

function obsoleteSite(sim: Sim, s: Settlement, civ: Civ): number | null {
  const m = sim.w.map;
  let best: number | null = null;
  let bestD = -1;
  eachOwnTile(sim, s, s.radius + 1, (i, _x, _y, d2) => {
    if (m.settle[i] !== s.id || !m.bld[i] || m.bldFlags[i] & (BLDF.HISTORIC | BLDF.PART)) return;
    if (BUILDINGS[m.bld[i]]?.footprint !== 1 || !isObsolete(civ, s, m.bld[i])) return;
    if (d2 > bestD) { bestD = d2; best = i; }
  });
  return best;
}

function civHasBuilding(sim: Sim, civ: Civ, type: number): boolean {
  for (const id of civ.settlements) if ((sim.w.settlements.get(id)?.bld[type] ?? 0) > 0) return true;
  return false;
}

function isLargestCity(sim: Sim, civ: Civ, s: Settlement): boolean {
  for (const id of civ.settlements) { const o = sim.w.settlements.get(id); if (o && o.pop > s.pop) return false; }
  return true;
}

/**
 * Land-use competition: the outermost non-unique industrial/military/commercial/extraction district
 * on arable land (never historic, multi-tile or the last of its kind).
 */
function redevelopForFarm(sim: Sim, s: Settlement): number | null {
  const m = sim.w.map;
  let best: number | null = null;
  let bestD = -1;
  eachOwnTile(sim, s, s.radius + 1, (i, _x, _y, d2) => {
    if (m.settle[i] !== s.id) return;
    const b = m.bld[i];
    if (!b || m.bldFlags[i] & (BLDF.HISTORIC | BLDF.PART)) return;
    const def = BUILDINGS[b];
    if (!def || def.footprint > 1 || !REDEVELOPABLE.has(def.category) || s.bld[b] < 2) return;
    if (def.placement === 'deposit' || def.placement === 'oil') return; // mines sit on their deposit
    if (m.fert[i] < 50 || cropSuitability(m.temp[i], m.moist[i], true) < 0.3) return;
    if (d2 > bestD) {
      bestD = d2;
      best = i;
    }
  });
  return best;
}

function oldFarm(sim: Sim, s: Settlement, tier: number): number | null {
  const m = sim.w.map;
  if (tier < 1) return null;
  let found: number | null = null;
  eachOwnTile(sim, s, s.radius + 1, (i) => {
    if (found !== null || m.settle[i] !== s.id || m.bld[i] !== B.FARM) return;
    if ((m.bldFlags[i] & BLDF.TIER_MASK) < tier - 1) found = i;
  });
  return found;
}

function palaceTier(sim: Sim, s: Settlement): { tile: number; tier: number } | null {
  const m = sim.w.map;
  let res: { tile: number; tier: number } | null = null;
  eachOwnTile(sim, s, s.radius + 1, (i) => {
    if (res || m.settle[i] !== s.id || m.bld[i] !== B.PALACE || m.bldFlags[i] & BLDF.PART) return;
    res = { tile: i, tier: m.bldFlags[i] & BLDF.TIER_MASK };
  });
  return res;
}

export function atWar(sim: Sim, civ: Civ): boolean {
  for (const wr of sim.w.wars.values()) if (!wr.end && (wr.attackers.includes(civ.id) || wr.defenders.includes(civ.id))) return true;
  return false;
}

function startProject(sim: Sim, s: Settlement, civ: Civ, type: number, tile: number, upgrade: boolean): void {
  const def = BUILDINGS[type];
  const need = new Array(GOOD_COUNT).fill(0);
  for (const [g, amt] of Object.entries(def.cost)) need[Good[g as GoodKey]] = amt as number;
  // later tiers of farms & upgrades are cheaper (improving existing land)
  const laborMult = type === B.FARM && upgrade ? 0.4 : 1;
  s.construction = { type, tile, progress: 0, need, labor: def.labor * laborMult, upgrade };
  if (!upgrade) {
    // scaffolding is visible while the district is built
    const m = sim.w.map;
    m.bld[tile] = B.CONSTRUCTION;
    m.bldFlags[tile] = 0;
    s.bld[B.CONSTRUCTION]++;
    addBldTile(sim, s.id, tile);
    markTile(sim, tile);
  }
}

/** Advance the current project with this month's builders. */
export function progressConstruction(sim: Sim, s: Settlement, civ: Civ, builders: number): void {
  const job = s.construction;
  if (!job) return;
  const m = sim.w.map;
  // the site may have been lost (conquest, disaster)
  if (m.settle[job.tile] !== s.id || (!job.upgrade && m.bld[job.tile] !== B.CONSTRUCTION)) {
    cancelProject(sim, s);
    return;
  }
  const productivity = (1 + civ.caps.construction) * (1 + civ.caps.robotics * 0.6) * (1 + civ.caps.automation * 0.3);
  const work = (Math.max(0, builders) / 12) * productivity;
  if (!(work > 0)) return;
  const total = BUILDINGS[job.type].labor || 1;
  const frac = clamp(work / Math.max(0.001, job.labor), 0, 1);
  // materials consumed in proportion to work done
  let materialsOk = 1;
  const access = s.capital ? 1 : clamp(s.access, 0.2, 1);
  for (let g = 0; g < GOOD_COUNT; g++) {
    if (job.need[g] <= 0) continue;
    const want = job.need[g] * frac;
    civ.acc.want[g] += want;
    let got = Math.min(civ.stock[g] * access, want);
    civ.stock[g] -= got;
    civ.acc.use[g] += got;
    civ.acc.inv += got * civ.prices[g];
    // concrete stands in for missing timber/steel (counted as stone use and investment)
    // the allowance is a share of the job's materials when work starts, not of each month's remainder
    // (otherwise repeated halving would let concrete replace all the steel)
    job.subLeft ??= job.need.map((v, k) => v * concreteShare(civ, k));
    if (got < want && job.subLeft[g] > 0) {
      const maxSub = Math.min(want - got, job.subLeft[g]);
      const stone = Math.min(civ.stock[Good.STONE] * access, maxSub * CONCRETE_RATIO);
      civ.stock[Good.STONE] -= stone;
      civ.acc.use[Good.STONE] += stone;
      civ.acc.inv += stone * civ.prices[Good.STONE];
      got += stone / CONCRETE_RATIO;
      job.subLeft[g] -= stone / CONCRETE_RATIO;
    }
    job.need[g] -= got;
    if (want > 0) materialsOk = Math.min(materialsOk, got / want);
  }
  const done = Math.min(work * materialsOk, Math.max(0, job.labor));
  job.labor -= done;
  civ.acc.inv += done * 0.5; // value of construction labour
  job.progress = clamp(1 - job.labor / total, 0, 1);
  if (materialsOk < 0.05 && sim.rng.chance(0.03)) {
    cancelProject(sim, s);
    return;
  }
  if (job.labor <= 0.01 && job.need.every((v) => v <= 0.5)) completeProject(sim, s, civ);
}

export function cancelProject(sim: Sim, s: Settlement): void {
  const job = s.construction;
  if (!job) return;
  const m = sim.w.map;
  if (!job.upgrade && m.bld[job.tile] === B.CONSTRUCTION) {
    m.bld[job.tile] = 0;
    s.bld[B.CONSTRUCTION] = Math.max(0, s.bld[B.CONSTRUCTION] - 1);
    removeBldTile(sim, s.id, job.tile);
    markTile(sim, job.tile);
  }
  s.construction = null;
}

function completeProject(sim: Sim, s: Settlement, civ: Civ): void {
  const job = s.construction!;
  const m = sim.w.map;
  const tier = eraToTier(civ.era);
  if (job.upgrade) {
    const oldType = m.bld[job.tile];
    const oldTier = m.bldFlags[job.tile] & BLDF.TIER_MASK;
    const def = BUILDINGS[oldType];
    // landmarks of a much older era are preserved instead of demolished
    if (def?.landmark && oldTier <= tier - 2 && oldType !== B.PALACE) {
      m.bldFlags[job.tile] |= BLDF.HISTORIC;
      s.construction = null;
      return;
    }
    removeBuilding(sim, job.tile, false);
  } else if (m.bld[job.tile] === B.CONSTRUCTION) {
    m.bld[job.tile] = 0;
    s.bld[B.CONSTRUCTION] = Math.max(0, s.bld[B.CONSTRUCTION] - 1);
    removeBldTile(sim, s.id, job.tile);
  }
  const def = BUILDINGS[job.type];
  if (def.footprint === 2) {
    const x = m.xOf(job.tile);
    const y = m.yOf(job.tile);
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) {
      if (!m.inBounds(x + dx, y + dy)) continue;
      const j = m.idx(x + dx, y + dy);
      if (m.bld[j] && m.bld[j] !== job.type) removeBuilding(sim, j, false);
    }
  }
  placeBuilding(sim, s, job.type, job.tile, tier);
  s.construction = null;
  // historic status for old landmarks elsewhere in the city
  markHistoric(sim, s, tier);
  const firstKey = `bld:${def.key}`;
  const significant = [B.PALACE, B.TEMPLE, B.UNIVERSITY, B.ARENA, B.AQUEDUCT, B.STATION, B.AIRPORT, B.SPACEPORT, B.POWER_NUCLEAR, B.FUSION, B.MEGASTRUCTURE, B.FORT, B.LIBRARY] as number[];
  if (significant.includes(job.type)) {
    const first = sim.w.milestones[firstKey] === undefined;
    if (first) sim.w.milestones[firstKey] = sim.year;
    logEvent(sim, {
      type: 'construction',
      cat: 'economy',
      title: `${s.name} completed a ${def.name.toLowerCase()}${first && job.type >= B.STATION ? ' — the first in the world' : ''}`,
      civs: [civ.id],
      settlements: [s.id],
      x: m.xOf(job.tile),
      y: m.yOf(job.tile),
      importance: first && ([B.STATION, B.AIRPORT, B.SPACEPORT, B.POWER_NUCLEAR, B.FUSION, B.MEGASTRUCTURE] as number[]).includes(job.type) ? 4 : 1,
    });
  }
}

function markHistoric(sim: Sim, s: Settlement, tier: number): void {
  const m = sim.w.map;
  eachOwnTile(sim, s, s.radius + 1, (i) => {
    if (m.settle[i] !== s.id || !m.bld[i]) return;
    const def = BUILDINGS[m.bld[i]];
    if (!def?.landmark || def.id === B.PALACE) return;
    if ((m.bldFlags[i] & BLDF.TIER_MASK) <= tier - 2 && !(m.bldFlags[i] & BLDF.HISTORIC)) m.bldFlags[i] |= BLDF.HISTORIC;
  });
}

export type { BuildingId };
