/**
 * Settlement economy (monthly): labour allocation, food, materials, industry,
 * energy, services and household consumption — all in physical units that
 * flow through the settlement's food store and the civilization's national
 * market stock. Nothing here creates value from thin air: outputs require
 * workers, worked land or buildings, technology capabilities and, for
 * manufacturing and power, material inputs drawn from the national stock.
 *
 * Model classification: [S] stylized abstraction (magnitudes in config/balance.ts).
 */
import { bldTiles } from '../civilizations/territory';
import type { Sim } from '../sim/context';
import type { Civ, Settlement } from '../sim/types';
import { B } from '../civilizations/buildingTypes';
import { BUILDINGS, SECTOR } from '../civilizations/buildings';
import { Good, GOODS, GOOD_COUNT, DEPOSITS, Deposit } from '../world/resources';
import { TERRAIN, T, isWaterTerrain } from '../world/terrain';
import { BALANCE } from '../config/balance';
import { clamp, clamp01 } from '../core/math';
import { growingWeight } from '../core/time';
import { huntHerds, localHeat } from '../ecology/ecology';
import { workforceFromCohorts } from '../population/demography';
import { logEvent } from '../history/events';

// ---------------------------------------------------------------- sites cache

export interface Sites {
  farms: number;
  farmPot: number;
  pastures: number;
  pastureVeg: number;
  fisheries: number;
  fishPot: number;
  plantations: number;
  lumber: number;
  lumberVeg: number;
  quarries: number;
  mines: number[]; // tile indices
  wells: number[];
  forage: number; // wild food capacity, person-years/year
  solar: number;
  wind: number;
  hydro: number;
  forestShare: number;
  hillShare: number;
  year: number;
}

/** Crop suitability of a tile's climate (0..1.2). */
export function cropSuitability(temp: number, moist: number, irrigated: boolean): number {
  let t: number;
  if (temp < -2) t = 0.05;
  else if (temp < 6) t = 0.25 + ((temp + 2) / 8) * 0.5;
  else if (temp <= 27) t = 1;
  else if (temp <= 34) t = 1 - (temp - 27) * 0.08;
  else t = 0.4;
  let P = moist / 255;
  if (irrigated) P = Math.max(P, 0.55);
  let m: number;
  if (P < 0.12) m = 0.15;
  else if (P < 0.3) m = 0.35 + (P - 0.12) * 3.2;
  else if (P <= 0.85) m = 1;
  else m = 0.9;
  return t * m;
}

/** Wild food capacity (person-years/year) around a point, excluding built tiles. */
export function forageCapacity(sim: Sim, x: number, y: number, r: number): number {
  const m = sim.w.map;
  let total = 0;
  m.forRadius(x, y, r, (i, _x, _y, d2) => {
    if (m.bld[i] && m.bld[i] !== B.CAMP) return;
    const def = TERRAIN[m.terrain[i]];
    const fall = 1 / (1 + d2 / (r * r));
    let f = def.forage;
    if (!def.water) f *= 0.35 + 0.65 * Math.min(1, m.veg[i] / Math.max(30, def.vegCap));
    if (m.river[i] > 0) f += 5;
    if (m.dep[i] === Deposit.FISH) f += 15 * (m.depAmt[i] / 255);
    total += f * fall;
  });
  return total;
}

export function markSitesDirty(sim: Sim, sid: number): void {
  const s = sim.w.settlements.get(sid);
  if (s) s.sites = undefined;
}

export function getSites(sim: Sim, s: Settlement): Sites {
  // cached on the settlement itself (serialized), so a restored save reuses the exact same sites
  const c = s.sites;
  if (c && c.year === sim.year) return c;
  const m = sim.w.map;
  const civ = sim.w.civs.get(s.civId);
  const irrigation = (civ?.caps.irrigation ?? 0) > 0;
  const st: Sites = {
    farms: 0, farmPot: 0, pastures: 0, pastureVeg: 0, fisheries: 0, fishPot: 0, plantations: 0, lumber: 0, lumberVeg: 0, quarries: 0,
    mines: [], wells: [], forage: 0, solar: 0, wind: 0, hydro: 0, forestShare: 0, hillShare: 0, year: sim.year,
  };
  let land = 0;
  let forest = 0;
  let hills = 0;
  const r = Math.max(2, s.radius + 1);
  m.forRadius(s.x, s.y, r, (i) => {
    if (m.settle[i] !== s.id) return;
    const t = m.terrain[i];
    if (!isWaterTerrain(t)) {
      land++;
      if (t === T.FOREST || t === T.TAIGA || t === T.JUNGLE) forest++;
      if (t === T.HILLS || t === T.MOUNTAIN) hills++;
    }
    const b = m.bld[i];
    if (!b) return;
    switch (b) {
      case B.FARM: {
        st.farms++;
        const irr = irrigation && m.hasFreshWater(i);
        st.farmPot += (m.fert[i] / 255) * cropSuitability(m.temp[i], m.moist[i], irr) * (m.hasFreshWater(i) ? 1.2 : 1) * (1 - m.pollution[i] / 500);
        break;
      }
      case B.PASTURE:
        st.pastures++;
        st.pastureVeg += m.veg[i];
        break;
      case B.PLANTATION:
        st.plantations++;
        break;
      case B.FISHERY: {
        st.fisheries++;
        let pot = 0.4;
        m.forRadius(m.xOf(i), m.yOf(i), 2, (j) => {
          if (m.dep[j] === Deposit.FISH) pot += 0.3 * (m.depAmt[j] / 255);
          else if (isWaterTerrain(m.terrain[j])) pot += 0.05;
        });
        st.fishPot += Math.min(1.8, pot);
        break;
      }
      case B.LUMBER: {
        st.lumber++;
        let v = 0;
        m.forRadius(m.xOf(i), m.yOf(i), 1.5, (j) => (v += m.veg[j]));
        st.lumberVeg += v / 9;
        break;
      }
      case B.QUARRY:
        st.quarries++;
        break;
      case B.MINE:
        st.mines.push(i);
        break;
      case B.OIL_WELL:
        st.wells.push(i);
        break;
      case B.SOLAR: {
        const lat = Math.abs(m.latitude(m.yOf(i), sim.w.meta.latSpan));
        st.solar += clamp(1.25 - lat / 70 - m.moist[i] / 600, 0.35, 1.2);
        break;
      }
      case B.WIND:
        st.wind += t === T.STEPPE || t === T.BEACH || t === T.TUNDRA || m.isCoastal(i) ? 1.15 : 0.8;
        break;
      case B.HYDRO:
        st.hydro += clamp(Math.log2(1 + m.river[i] / 8) / 3, 0.3, 1.5);
        break;
    }
  });
  st.forage = forageCapacity(sim, s.x, s.y, Math.min(6, Math.max(3, s.radius + 1)));
  st.forestShare = land ? forest / land : 0;
  st.hillShare = land ? hills / land : 0;
  s.sites = st;
  return st;
}

// ---------------------------------------------------------------- monthly economy

export interface EconResult {
  adequacy: number;
  foodProduced: number;
  builders: number;
}

const DEMAND_SCRATCH = new Float64Array(GOOD_COUNT);

/** Household demand per capita per year for manufactured goods & energy. */
export function householdDemand(civ: Civ, out: Float64Array = DEMAND_SCRATCH): Float64Array {
  const c = civ.caps;
  out.fill(0);
  out[Good.GOODS] = 0.03 + 0.12 * Math.min(1, c.crafts) + 0.9 * Math.min(1, c.industry) + 1.2 * Math.min(1, c.automation * 2);
  out[Good.LUXURY] = 0.004 + 0.02 * Math.min(1, c.currency) + 0.08 * Math.min(1, c.finance);
  out[Good.ENERGY] = 3 * Math.min(1, c.electrification) * (1 + c.computing * 0.3 + c.ai * 0.3);
  out[Good.ELECTRONICS] = 0.06 * Math.min(1, c.computing) + 0.05 * Math.min(1, c.ai);
  out[Good.OIL] = 0.25 * Math.min(1, c.airTier >= 1 || c.roadTier >= 4 ? 1 : 0) * (1 - Math.min(0.8, c.renewables * 0.3 + c.energyStorage * 0.3));
  return out;
}

/** Construction materials that industry may not draw below a reserve held for builders. */
const RESERVED = new Set<number>([Good.WOOD, Good.METAL, Good.MACHINERY, Good.ELECTRONICS]);

function take(civ: Civ, g: number, amount: number, access: number): number {
  if (!(amount > 0)) return 0; // negative or NaN requests would create goods from nothing
  civ.acc.want[g] += amount;
  // industrial economies keep a construction stockpile: producers compete for steel and timber,
  // so new plants, homes and schools are not starved by the factories they would supply
  const reserve = RESERVED.has(g) && civ.caps.industry > 0 ? civ.population * BALANCE.constructionReserve : 0;
  const avail = Math.max(0, civ.stock[g] - reserve) * access;
  const got = Math.min(avail, amount);
  civ.stock[g] -= got;
  civ.acc.use[g] += got;
  return got;
}

function give(civ: Civ, g: number, amount: number): void {
  if (amount <= 0) return;
  civ.stock[g] += amount;
  civ.acc.prod[g] += amount;
}

function workforce(sim: Sim, s: Settlement, childLabor: number): number {
  if (s.mode === 'cohort') return workforceFromCohorts(s.cohorts, childLabor);
  let wf = 0;
  for (const id of s.members) {
    const p = sim.w.persons.get(id);
    if (!p) continue;
    const age = sim.year - p.born;
    if (age >= 15 && age < 65) wf++;
    else if (age >= 10 && age < 15) wf += childLabor;
  }
  return wf;
}

export function settlementEconomy(sim: Sim, s: Settlement, civ: Civ, month: number): EconResult {
  const w = sim.w;
  const m = w.map;
  const caps = civ.caps;
  const sites = getSites(sim, s);
  const pop = Math.max(0, s.pop);
  const needYear = pop * BALANCE.foodNeedPerCapita;
  const needMonth = needYear / 12;
  const industrial = caps.industry >= 0.5;
  const childLabor = industrial ? 0.05 : 0.45;
  const access = s.capital ? 1 : clamp(s.access, 0.15, 1);
  const emp = s.employment;
  for (let k = 0; k < emp.length; k++) emp[k] = 0;
  const out = s.output;
  for (let k = 0; k < GOOD_COUNT; k++) out[k] *= 0.9; // decay of the annualized display value

  // Working time falls as productivity rises (annual hours roughly halved 1870-2000): automated,
  // welfare-state economies supply fewer full-time-equivalent workers per working-age person.
  const hours = industrial ? 1 - clamp(BALANCE.hoursPerAutomation * caps.automation + 0.08 * clamp01(caps.welfare), 0, 0.45) : 1;
  let free = Math.max(0, workforce(sim, s, childLabor) * hours - s.garrison);
  emp[SECTOR.MILITARY] = Math.min(s.garrison, free + s.garrison);
  const totalWorkers = free;

  // --- climate & season
  const i0 = m.idx(s.x, s.y);
  const c = w.climate;
  const cell = ((s.y / c.cellSize) | 0) * c.cellsX + ((s.x / c.cellSize) | 0);
  const rain = c.rain[cell] ?? 0;
  const temp = m.temp[i0] + localHeat(sim, i0);
  const heatStress = temp > 30 ? Math.max(0.4, 1 - (temp - 30) * 0.06) : 1;
  const climateMult = clamp(1 + 0.75 * rain, 0.15, 1.25) * heatStress;
  const absLat = Math.abs(m.latitude(s.y, w.meta.latSpan));
  const season = growingWeight(month, absLat) / seasonNorm(absLat);

  // --- food sources (annual rates)
  const farmBonus = Math.max(0, caps.farming - 1) + caps.biotech * 0.4 + caps.irrigation * 0.15;
  const mech = clamp(caps.farmMechanization, 0, 0.97);
  type Src = { yieldYear: number; labor: number; seasonal: boolean; kind: number };
  const srcs: Src[] = [];
  if (sites.farms > 0 && caps.farming > 0) {
    srcs.push({ yieldYear: sites.farmPot * BALANCE.farmYield * (1 + farmBonus) * climateMult, labor: sites.farms * BALANCE.farmLabor * Math.max(0.03, 1 - mech), seasonal: true, kind: 0 });
  }
  if (sites.pastures > 0 && caps.herding > 0) {
    srcs.push({ yieldYear: sites.pastures * BALANCE.pastureYield * (1 + Math.max(0, caps.herding - 1)) * (0.45 + sites.pastureVeg / sites.pastures / 255) * clamp(1 + 0.5 * rain, 0.3, 1.2), labor: sites.pastures * BALANCE.pastureLabor * Math.max(0.05, 1 - mech * 0.8), seasonal: false, kind: 1 });
  }
  if (sites.fisheries > 0) {
    srcs.push({ yieldYear: sites.fishPot * BALANCE.fisheryYield * (1 + caps.fishing), labor: sites.fisheries * BALANCE.fisheryLabor * Math.max(0.1, 1 - mech * 0.5), seasonal: false, kind: 2 });
  }
  if (s.bld[B.GREENHOUSE] > 0) {
    srcs.push({ yieldYear: s.bld[B.GREENHOUSE] * 25000 * (1 + caps.biotech), labor: s.bld[B.GREENHOUSE] * 60 * Math.max(0.2, 1 - caps.automation), seasonal: false, kind: 3 });
  }
  const forProd = BALANCE.foragerProductivity * (1 + caps.forage);
  const forageYear = sites.forage * (1 + caps.forage * 0.5) * clamp(1 + 0.4 * rain, 0.4, 1.2);
  srcs.push({ yieldYear: forageYear, labor: forageYear / forProd, seasonal: false, kind: 4 });

  // desired annual production: need + reserve gap (+ a little for the national pool)
  const reserve = needYear * BALANCE.foodReserveYears;
  const gap = clamp((reserve - s.food) / Math.max(1, needYear), -0.25, 0.5);
  // National market: when the national reserve is below ~4 months of national need, farms everywhere
  // produce at capacity for sale to the cities (surplus is moved into the pool below). Otherwise produce
  // for local need plus a small marketable margin.
  const nationalNeed = civ.population * BALANCE.foodNeedPerCapita;
  const nationalShort = civ.stock[Good.FOOD] < nationalNeed * 0.33;
  let demandYear = nationalShort ? Infinity : needYear * (1 + gap) + needYear * 0.05;
  // sort by food per worker
  srcs.sort((a, b) => b.yieldYear / Math.max(1e-6, b.labor) - a.yieldYear / Math.max(1e-6, a.labor));
  let producedMonth = 0;
  let foodWorkers = 0;
  for (const src of srcs) {
    if (demandYear <= 0 || free <= 0 || src.labor <= 0 || src.yieldYear <= 0) continue;
    const perWorker = src.yieldYear / src.labor;
    // foraging never runs at "capacity" for the market (it would strip the land); other sources keep capacity mode
    const dem = src.kind === 4 && demandYear === Infinity ? Math.max(0, needYear * (1 + gap) - producedMonth * 12) : demandYear;
    const wanted = Math.min(src.labor, dem === Infinity ? src.labor : dem / perWorker);
    const assigned = Math.min(free, wanted);
    const staffing = assigned / src.labor;
    let yearRate = src.yieldYear * Math.pow(staffing, 0.85);
    if (src.kind === 4) {
      // foraging: part of the take comes from hunting real herds
      const huntDemand = (yearRate / 12) * 0.35;
      const meat = huntHerds(sim, s.x, s.y, 7, huntDemand, 1 + caps.forage);
      yearRate = yearRate * 0.65 + meat * 12;
      // overuse of wild land lowers vegetation (and thus future forage)
      if (staffing > 0.6) degradeAround(sim, s.x, s.y, 3, staffing - 0.6);
    }
    if (src.kind === 3) {
      const energyNeed = (yearRate / 12) * 0.3;
      const got = take(civ, Good.ENERGY, energyNeed, access);
      yearRate *= energyNeed > 0 ? got / energyNeed : 1;
    }
    const monthOut = (yearRate / 12) * (src.seasonal ? season : 1);
    producedMonth += monthOut;
    demandYear -= yearRate;
    free -= assigned;
    foodWorkers += assigned;
  }
  emp[SECTOR.FOOD] = foodWorkers;
  s.food += producedMonth;
  civ.acc.prod[Good.FOOD] += producedMonth;
  out[Good.FOOD] += producedMonth * 12 * 0.1;
  // draw from the national pool when low (famine relief / internal trade)
  if (s.food < needMonth * 2 && civ.stock[Good.FOOD] > 0) {
    const draw = Math.min(civ.stock[Good.FOOD] * access, needMonth * 3 - s.food);
    if (draw > 0) {
      civ.stock[Good.FOOD] -= draw;
      s.food += draw;
    }
  }
  const eaten = Math.min(s.food, needMonth);
  const adequacy = needMonth > 0 ? eaten / needMonth : 1;
  s.food -= eaten;
  civ.acc.use[Good.FOOD] += eaten;
  civ.acc.foodNeed += needMonth;
  civ.acc.foodShort += needMonth - eaten;
  const preservation = clamp01(caps.foodPreservation) * 0.7 + (s.bld[B.GRANARY] > 0 ? 0.25 : 0);
  s.food -= (s.food * BALANCE.foodSpoilage * (1 - clamp(preservation, 0, 0.9))) / 12;
  if (s.food > reserve * (nationalShort ? 1 : 2)) {
    const surplus = (s.food - reserve * (nationalShort ? 0.8 : 1.5)) * access * (nationalShort ? 0.8 : 0.5);
    s.food -= surplus;
    civ.stock[Good.FOOD] += surplus;
  }

  // --- construction labour
  let builders = 0;
  if (s.construction || s.pop > s.housing * 0.85) {
    const want = (s.construction ? s.construction.labor * 12 * 0.5 : 0) + s.pop * 0.01 + 2;
    builders = Math.max(0, Math.min(free * 0.3, want)); // never negative: free can dip below 0 after allocation rounding
    free -= builders;
  }
  emp[SECTOR.CONSTRUCTION] = builders;

  // --- buildings with jobs, in priority order
  const automation = clamp(caps.automation, 0, 0.95);
  const robotics = clamp(caps.robotics, 0, 0.9);
  const staff = (type: number, laborScale: number): number => {
    const n = s.bld[type];
    if (!n) return 0;
    const jobs = BUILDINGS[type].jobs * n * laborScale;
    if (jobs <= 0) return 0;
    const a = Math.min(free, jobs);
    free -= a;
    emp[BUILDINGS[type].sector] += a;
    return a / jobs;
  };
  // energy first
  produceEnergy(sim, s, civ, staff, automation, sites, access);
  // extraction
  const lumberStaff = staff(B.LUMBER, 1 - robotics * 0.6);
  if (lumberStaff > 0) {
    const wood = (sites.lumber * BALANCE.lumberYield * (1 + caps.woodcutting) * (1 + BALANCE.industrialExtraction * 0.5 * Math.max(0, caps.industry)) * clamp(sites.lumberVeg / 180, 0.2, 1.3) * lumberStaff) / 12;
    give(civ, Good.WOOD, wood);
    out[Good.WOOD] += wood * 12 * 0.1;
  }
  const quarryStaff = staff(B.QUARRY, 1 - robotics * 0.6);
  if (quarryStaff > 0 && caps.quarrying > 0) {
    const stone = (sites.quarries * BALANCE.quarryYield * (1 + Math.max(0, caps.quarrying - 1) + caps.robotics * 0.5) * quarryStaff) / 12;
    give(civ, Good.STONE, stone);
    out[Good.STONE] += stone * 12 * 0.1;
  }
  const mineStaff = staff(B.MINE, 1 - robotics * 0.7);
  if (mineStaff > 0) extractDeposits(sim, s, civ, sites.mines, mineStaff, false);
  const wellStaff = staff(B.OIL_WELL, 1 - robotics * 0.7);
  if (wellStaff > 0) extractDeposits(sim, s, civ, sites.wells, wellStaff, true);

  // processing & manufacturing
  const armsWanted = civ.stock[Good.ARMS] < armsTarget(civ);
  const smithStaff = staff(B.SMITHY, 1);
  if (smithStaff > 0) smithing(civ, s, (s.bld[B.SMITHY] * BALANCE.smithyOutput * (1 + caps.crafts) * smithStaff) / 12, armsWanted, access);
  const steelStaff = staff(B.STEEL_MILL, 1 - automation * 0.7);
  if (steelStaff > 0) {
    const cap = (s.bld[B.STEEL_MILL] * 32000 * steelStaff * (1 + Math.max(0, caps.industry - 1))) / 12;
    const iron = take(civ, Good.IRON, cap * 1.3, access);
    const coal = take(civ, Good.COAL, cap * 0.6, access);
    const made = Math.min(iron / 1.3, coal / 0.6);
    give(civ, Good.METAL, made);
    out[Good.METAL] += made * 12 * 0.1;
    civ.acc.emissions += coal * 1.0;
  }
  staff(B.MILL, 1);
  const workshopStaff = staff(B.WORKSHOP, 1 - automation * 0.5);
  if (workshopStaff > 0) {
    const mills = Math.min(3, s.bld[B.MILL]);
    const cap = (s.bld[B.WORKSHOP] * BALANCE.workshopOutput * (1 + caps.crafts) * (1 + 0.12 * mills) * workshopStaff) / 12;
    const wood = take(civ, Good.WOOD, cap * 0.3, access);
    const metal = take(civ, Good.METAL, cap * 0.04, access);
    const made = Math.min(cap, wood / 0.3) * (metal >= cap * 0.03 ? 1 : 0.75);
    give(civ, Good.GOODS, made);
    out[Good.GOODS] += made * 12 * 0.1;
    const gold = take(civ, Good.GOLD, cap * 0.02, access);
    give(civ, Good.LUXURY, gold * 5);
  }
  const factoryStaff = staff(B.FACTORY, 1 - automation);
  // automation both cuts the labor a plant needs (staffing above) and raises what each plant turns out
  if (factoryStaff > 0 && caps.industry > 0) manufacture(sim, civ, s, (s.bld[B.FACTORY] * BALANCE.factoryOutput * (1 + Math.max(0, caps.industry - 1)) * (1 + automation) * factoryStaff) / 12, armsWanted, access);
  staff(B.REFINERY, 1 - automation * 0.6);
  const fabStaff = staff(B.CHIP_FAB, 1 - automation * 0.5);
  if (fabStaff > 0) {
    const cap = (s.bld[B.CHIP_FAB] * 7000 * fabStaff * (1 + caps.computing * 0.2)) / 12;
    const rare = take(civ, Good.RARE, cap * 0.1, access);
    const mach = take(civ, Good.MACHINERY, cap * 0.05, access);
    const energy = take(civ, Good.ENERGY, cap * 2, access);
    // silicon and copper are everywhere; rare metals (dopants, specialty alloys) lift a fab from 40% to full output
    const made = Math.min(cap, rare / 0.1 + cap * 0.4, mach / 0.05 + cap * 0.5, energy / 2);
    give(civ, Good.ELECTRONICS, made);
    out[Good.ELECTRONICS] += made * 12 * 0.1;
  }
  const robStaff = staff(B.ROBOT_FACTORY, 1);
  if (robStaff > 0) {
    const cap = (s.bld[B.ROBOT_FACTORY] * 24000 * robStaff * (1 + caps.ai)) / 12;
    const metal = take(civ, Good.METAL, cap * 0.5, access);
    const elec = take(civ, Good.ELECTRONICS, cap * 0.15, access);
    const energy = take(civ, Good.ENERGY, cap, access);
    const made = Math.min(cap, metal / 0.5, elec / 0.15, energy);
    give(civ, Good.MACHINERY, made * 0.6);
    give(civ, Good.GOODS, made * 2);
    out[Good.MACHINERY] += made * 0.6 * 12 * 0.1;
  }
  // services: civic & commercial buildings
  let serviceWorkers = 0;
  const serviceLabor = 1 - automation * 0.45;
  for (const t of SERVICE_TYPES) {
    if (!s.bld[t]) continue;
    const before = free;
    staff(t, serviceLabor);
    serviceWorkers += before - free;
  }
  // informal sector & unemployment
  if (free > 0) {
    if (!industrial) {
      // household production: gathering wood & stone, crafts, small services
      const wood = (free * BALANCE.informalMaterials * 2.5 * (0.3 + sites.forestShare * 1.4)) / 12;
      const stone = (free * BALANCE.informalMaterials * 0.5 * (0.2 + sites.hillShare * 1.6)) / 12;
      give(civ, Good.WOOD, wood);
      give(civ, Good.STONE, stone);
      give(civ, Good.GOODS, (free * 0.03) / 12);
      emp[SECTOR.RESOURCES] += free * 0.6;
      emp[SECTOR.SERVICES] += free * 0.4;
      serviceWorkers += free * 0.2;
      free = 0;
    } else {
      // Market services are demand-driven (structural change): households buy more services as their
      // GOODS income rises (lagged one month; goods only, so service jobs cannot inflate their own demand).
      // Automation cuts the labor each unit of service needs. Building-based service staff count first.
      const goodsIncome = Math.log2(1 + (s.goodsPerCap ?? 0) / 0.9);
      const perCapita = 0.04 + BALANCE.serviceDemandMax * clamp((goodsIncome - 0.6) / 2, 0, 1);
      const demandJobs = pop * perCapita * (1 - automation * 0.2);
      const market = Math.min(free, Math.max(0, demandJobs - serviceWorkers));
      emp[SECTOR.SERVICES] += market;
      serviceWorkers += market;
      free -= market;
      // what remains: informal work, else unemployment (a safety net lets people search instead)
      const informal = free * clamp(0.75 - caps.welfare * 0.2 - caps.automation * 0.15, 0.3, 0.75);
      emp[SECTOR.SERVICES] += informal;
      serviceWorkers += informal * 0.4;
      free -= informal;
      emp[SECTOR.UNEMPLOYED] = free;
    }
  }
  const servProd = 0.9 * (1 + caps.markets + caps.finance * 0.6 + caps.computing * 0.4 + caps.ai * 0.6) * (0.55 + s.education);
  civ.acc.services += (serviceWorkers * servProd) / 12;
  civ.acc.workers += totalWorkers;
  civ.acc.unemployed += emp[SECTOR.UNEMPLOYED];

  // --- household consumption from the national market
  const dem = householdDemand(civ);
  const share = civ.population > 0 ? pop / civ.population : 0;
  let consValue = eaten * civ.prices[Good.FOOD];
  let satisfied = 0;
  let weight = 0;
  for (const g of HOUSEHOLD_GOODS) {
    const want = (dem[g] * pop) / 12;
    if (want <= 0) continue;
    civ.acc.want[g] += want;
    // households also leave the builders' stockpile of electronics alone (see take())
    const reserve = RESERVED.has(g) && industrial ? civ.population * BALANCE.constructionReserve : 0;
    const stock = Math.max(0, civ.stock[g] - reserve);
    const avail = Math.min(stock * access, Math.max(want, stock * share));
    const got = Math.min(want, avail);
    civ.stock[g] -= got;
    civ.acc.use[g] += got;
    consValue += got * civ.prices[g];
    satisfied += (got / want) * GOODS[g].basePrice;
    weight += GOODS[g].basePrice;
    if (g === Good.ENERGY) civ.acc.energyUse += got;
  }
  s.goodsPerCap = pop > 0 ? (consValue * 12) / pop : 0; // goods + food only; drives next month's service demand
  consValue += (serviceWorkers * servProd * 0.6) / 12;
  civ.acc.cons += consValue;
  const perCap = pop > 0 ? (consValue * 12) / pop : 0;
  const target = Math.log2(1 + perCap / 0.9) * (0.75 + 0.25 * adequacy);
  s.prosperity += (target - s.prosperity) * 0.08;
  if (weight > 0 && satisfied / weight < 0.5 && industrial) s.unrest = clamp01(s.unrest + 0.002);

  // individual-mode: assign visible jobs
  if (s.mode === 'individual') assignJobs(sim, s, emp);

  return { adequacy, foodProduced: producedMonth, builders };
}

const HOUSEHOLD_GOODS = [Good.GOODS, Good.LUXURY, Good.ENERGY, Good.ELECTRONICS, Good.OIL];
const SERVICE_TYPES = [
  B.PALACE, B.TEMPLE, B.MARKET, B.GRANARY, B.HARBOR, B.LIBRARY, B.SCHOOL, B.HOSPITAL, B.UNIVERSITY, B.BANK,
  B.WAREHOUSE, B.LAB, B.OFFICE, B.DATA_CENTER, B.ARENA, B.STATION, B.AIRPORT, B.BARRACKS, B.FORT, B.MILITARY_BASE,
  B.AIRBASE, B.NAVAL_BASE, B.SPACEPORT, B.PARK, B.MONUMENT, B.AQUEDUCT, B.SILO, B.MEGASTRUCTURE,
];

const seasonNormCache = new Map<number, number>();
function seasonNorm(absLat: number): number {
  const k = Math.round(absLat);
  let v = seasonNormCache.get(k);
  if (v === undefined) {
    let sum = 0;
    for (let mo = 0; mo < 12; mo++) sum += growingWeight(mo, k);
    v = sum / 12 || 1;
    seasonNormCache.set(k, v);
  }
  return v;
}

function degradeAround(sim: Sim, x: number, y: number, r: number, intensity: number): void {
  const m = sim.w.map;
  const rng = sim.rng;
  for (let k = 0; k < 3; k++) {
    const i = m.idx(clamp(Math.round(x + rng.range(-r, r)), 0, m.w - 1), clamp(Math.round(y + rng.range(-r, r)), 0, m.h - 1));
    if (m.isLand(i)) m.veg[i] = Math.max(0, m.veg[i] - Math.round(6 * intensity));
  }
}

export function armsTarget(civ: Civ): number {
  let soldiers = 0;
  return civ.population * 0.002 * (1 + civ.budget.military * 4) + soldiers;
}

function smithing(civ: Civ, s: Settlement, cap: number, armsWanted: boolean, access: number): void {
  const tier = civ.caps.metalTier;
  let made = 0;
  if (tier >= 3 && civ.stock[Good.IRON] > 0) {
    const fuelG = civ.stock[Good.COAL] > cap * 0.5 ? Good.COAL : Good.WOOD;
    const perUnit = fuelG === Good.COAL ? 0.5 : 1;
    const fuel = take(civ, fuelG, cap * perUnit, access);
    // without enough charcoal/coal, smiths fall back to marginal fuels at low efficiency
    const fuelled = Math.min(cap, fuel / perUnit + cap * 0.35);
    const iron = take(civ, Good.IRON, fuelled * 1.4, access);
    made = iron / 1.4;
    if (fuelG === Good.COAL) civ.acc.emissions += fuel;
  }
  if (made < cap * 0.5 && tier >= 2 && civ.stock[Good.COPPER] > 0 && civ.stock[Good.TIN] > 0) {
    const rem = cap - made;
    const cu = take(civ, Good.COPPER, rem * 0.88, access);
    const sn = take(civ, Good.TIN, rem * 0.12, access);
    made += Math.min(cu / 0.88, sn / 0.12);
  }
  if (made < cap * 0.5 && tier >= 1 && civ.stock[Good.COPPER] > 0) {
    const rem = cap - made;
    const cu = take(civ, Good.COPPER, rem * 1.2, access);
    made += cu / 1.2;
  }
  if (made <= 0) return;
  let arms = 0;
  if (armsWanted) {
    arms = made * 0.35;
    give(civ, Good.ARMS, arms);
  }
  const mach = civ.caps.industry > 0 ? (made - arms) * 0.12 : 0;
  give(civ, Good.MACHINERY, mach * 0.5);
  give(civ, Good.METAL, made - arms - mach);
  s.output[Good.METAL] += (made - arms) * 12 * 0.1;
}

function manufacture(sim: Sim, civ: Civ, s: Settlement, cap: number, armsWanted: boolean, access: number): void {
  const electric = civ.caps.electrification >= 0.3;
  let energyOk = 1;
  if (electric) {
    const need = cap * 0.45;
    const got = take(civ, Good.ENERGY, need, access);
    energyOk = need > 0 ? got / need : 1;
    if (energyOk < 0.6) {
      // fall back to direct coal/steam for part of the plant
      const coal = take(civ, Good.COAL, cap * 0.25 * (1 - energyOk), access);
      energyOk = Math.min(1, energyOk + coal / (cap * 0.25));
      civ.acc.emissions += coal;
    }
  } else {
    const need = cap * 0.25;
    const coal = take(civ, Good.COAL, need, access);
    const wood = coal < need ? take(civ, Good.WOOD, (need - coal) * 2, access) / 2 : 0;
    energyOk = need > 0 ? (coal + wood) / need : 1;
    civ.acc.emissions += coal;
  }
  const effective = cap * clamp01(energyOk);
  // industrial economies recycle scrap: part of the metal input comes back from worn-out goods
  const perUnit = 0.16 * (1 - clamp(BALANCE.scrapPerIndustry * civ.caps.industry, 0, 0.45));
  const metal = take(civ, Good.METAL, effective * perUnit, access);
  const units = Math.min(effective, metal / perUnit);
  const machShare = 0.18;
  const armsShare = armsWanted ? 0.15 : 0;
  give(civ, Good.MACHINERY, units * machShare * 0.4);
  give(civ, Good.ARMS, units * armsShare * 0.6);
  give(civ, Good.GOODS, units * (1 - machShare - armsShare));
  s.output[Good.GOODS] += units * (1 - machShare - armsShare) * 12 * 0.1;
  // local industrial pollution
  addPollution(sim, s, B.FACTORY, (1 - civ.caps.pollutionControl) * policyFactor(civ));
}

function policyFactor(civ: Civ): number {
  return civ.policies.environment === 'strict' ? 0.35 : civ.policies.environment === 'basic' ? 0.7 : 1;
}

function addPollution(sim: Sim, s: Settlement, type: number, factor: number): void {
  if (!sim.w.laws.pollution) return;
  const m = sim.w.map;
  const amount = (BUILDINGS[type].pollution * factor) / 12;
  if (amount <= 0) return;
  // pollute the building tiles of this type (sampled) and the center
  const i = m.idx(s.x, s.y);
  m.pollution[i] = Math.min(255, m.pollution[i] + amount * 0.3);
  const tiles = bldTiles(sim, s.id);
  for (const t of tiles) if (m.bld[t] === type) m.pollution[t] = Math.min(255, m.pollution[t] + amount);
}

function produceEnergy(sim: Sim, s: Settlement, civ: Civ, staff: (t: number, l: number) => number, automation: number, sites: Sites, access: number): void {
  const c = civ.caps;
  const out = s.output;
  let energy = 0;
  const fossil = staff(B.POWER_FOSSIL, 1 - automation * 0.5);
  if (fossil > 0) {
    const cap = (s.bld[B.POWER_FOSSIL] * BALANCE.powerFossilOutput * fossil * (1 + c.energyEfficiency * 0.3)) / 12;
    const per = BALANCE.fossilFuelPerEnergy;
    let need = cap * per;
    const gas = take(civ, Good.GAS, need * 0.8, access);
    need -= gas / 0.8;
    const coal = need > 0 ? take(civ, Good.COAL, need, access) : 0;
    need -= coal;
    const oil = need > 0 ? take(civ, Good.OIL, need * 0.75, access) : 0;
    const produced = gas / 0.8 / per + coal / per + oil / 0.75 / per;
    energy += produced;
    civ.acc.emissions += coal * 1 + oil * 0.8 + gas * 0.55;
    addPollution(sim, s, B.POWER_FOSSIL, (1 - c.pollutionControl) * policyFactor(civ) * (coal > 0 ? 1 : 0.4));
  }
  const nuclear = staff(B.POWER_NUCLEAR, 1 - automation * 0.4);
  if (nuclear > 0 && c.nuclearPower > 0) {
    const cap = (s.bld[B.POWER_NUCLEAR] * BALANCE.powerNuclearOutput * nuclear) / 12;
    const u = take(civ, Good.URANIUM, cap * BALANCE.uraniumPerEnergy, access);
    energy += u / BALANCE.uraniumPerEnergy;
  }
  if (s.bld[B.SOLAR]) {
    staff(B.SOLAR, 1);
    energy += (sites.solar * BALANCE.solarOutput * (1 + Math.max(0, c.renewables - 1)) * (0.75 + 0.25 * Math.min(1, c.energyStorage))) / 12;
  }
  if (s.bld[B.WIND]) {
    staff(B.WIND, 1);
    energy += (sites.wind * BALANCE.windOutput * (1 + Math.max(0, c.renewables - 1)) * (0.75 + 0.25 * Math.min(1, c.energyStorage))) / 12;
  }
  if (s.bld[B.HYDRO]) {
    staff(B.HYDRO, 1);
    energy += (sites.hydro * BALANCE.hydroOutput) / 12;
  }
  const fusion = staff(B.FUSION, 1 - automation * 0.5);
  if (fusion > 0 && c.fusionPower > 0) energy += (s.bld[B.FUSION] * BALANCE.fusionOutput * fusion) / 12;
  if (energy > 0) {
    give(civ, Good.ENERGY, energy);
    out[Good.ENERGY] += energy * 12 * 0.1;
  }
}

export function extractDeposits(sim: Sim, s: Settlement, civ: Civ, tiles: number[], staffing: number, wells: boolean): void {
  const m = sim.w.map;
  const c = civ.caps;
  const deplete = sim.w.laws.resourceDepletion;
  for (const i of tiles) {
    const d = m.dep[i];
    if (!d) continue;
    const def = DEPOSITS[d];
    const capKey = def.extractCap as keyof typeof c;
    if (def.extractCap !== 'forage' && def.extractCap !== 'farming' && !((c[capKey] ?? 0) > 0)) continue;
    if (wells !== (d === Deposit.OIL || d === Deposit.GAS)) continue;
    // Industrial extraction (powered drills, explosives, mechanized haulage, ore processing) multiplies
    // output per worker AND makes lower-grade ore economic, so the same factor scales the extraction
    // rate and the recoverable reserve: depletion time is unchanged, industrial supply becomes feasible.
    const industrial = 1 + BALANCE.industrialExtraction * Math.max(0, c.industry);
    const bonus = (1 + Math.max(0, c.mining - 1) * 0.5 + c.deepMining * 0.4 + c.robotics * 0.5 + (wells ? c.oilExtraction * 0.3 : 0)) * industrial;
    let amount = (def.baseYield * BALANCE.mineYieldMult * bonus * staffing) / 12;
    if (!def.renewable && deplete) {
      // Reserve growth: better mining technology makes lower-grade ore recoverable, so each unit
      // extracted draws down less of the deposit (recoverable reserves grow with technology).
      const recovery = (1 + BALANCE.reserveGrowth * (c.deepMining + c.robotics)) * industrial;
      amount = Math.min(amount, m.depAmt[i] * recovery);
      m.depAmt[i] -= amount / recovery;
      if (m.depAmt[i] <= 0.5) {
        m.dep[i] = Deposit.NONE;
        m.depAmt[i] = 0;
        logEvent(sim, { type: 'deposit_exhausted', cat: 'economy', title: `The ${def.name.toLowerCase()} deposit near ${s.name} is exhausted`, civs: [civ.id], settlements: [s.id], x: m.xOf(i), y: m.yOf(i), importance: 1 });
      }
    }
    give(civ, def.good, amount);
    s.output[def.good] += amount * 12 * 0.1;
    if (d === Deposit.COAL || d === Deposit.URANIUM) m.pollution[i] = Math.min(255, m.pollution[i] + 0.15);
  }
}

function assignJobs(sim: Sim, s: Settlement, emp: number[]): void {
  const quota = [emp[SECTOR.FOOD], emp[SECTOR.RESOURCES], emp[SECTOR.INDUSTRY], emp[SECTOR.CONSTRUCTION], emp[SECTOR.SERVICES], emp[SECTOR.MILITARY]];
  const names = [s.bld[B.FARM] ? 'farmer' : 'forager', 'gatherer', 'crafter', 'builder', 'trader', 'warrior'];
  let k = 0;
  for (const id of s.members) {
    const p = sim.w.persons.get(id);
    if (!p) continue;
    const age = sim.year - p.born;
    if (age < 10) {
      p.job = 'child';
      continue;
    }
    if (age >= 65) {
      p.job = 'elder';
      continue;
    }
    while (k < quota.length && quota[k] < 0.5) k++;
    if (k >= quota.length) {
      p.job = 'idle';
      continue;
    }
    p.job = names[k];
    quota[k] -= 1;
  }
}
