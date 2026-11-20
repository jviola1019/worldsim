/**
 * Settlements: founding, the monthly cycle (economy -> demography ->
 * construction -> health/migration), yearly upkeep (territory, education,
 * access), transfer between civilizations and destruction.
 */
import { paceMult } from '../sim/pace';
import { record, residents, transfer } from '../population/ledger';
import type { Sim } from '../sim/context';
import type { Civ, Settlement, SpeciesKey } from '../sim/types';
import { AGE_BANDS, BALANCE } from '../config/balance';
import { B, BUILDING_COUNT, eraToTier } from './buildingTypes';
import { GOOD_COUNT } from '../world/resources';
import { clamp, clamp01 } from '../core/math';
import { makeName } from '../culture/language';
import { phonOfCulture } from '../population/persons';
import {
  cohortMonth, cohortTotal, convertToCohorts, convertToIndividuals, emptyFlows, healthIndices, individualMonth,
  lifeExpectancy, mortalitySchedule, tfrFor, removePeople,
} from '../population/demography';
import { settlementEconomy } from '../economy/production';
import { planConstruction, progressConstruction, placeBuilding, removeBuilding, recomputeHousing, cancelProject } from './urban';
import { recomputeTerritory, setTileSettlement, territoryTiles } from './territory';
import { revealAround } from './knowledge';
import { logEvent } from '../history/events';
import { markOverlay, markTile } from '../sim/context';
import { protectRulingFamily, crown, createLeader } from '../politics/succession';
import { TICKS_PER_MONTH, monthOf } from '../core/time';
import { diseaseMonthly } from '../population/disease';
import { localBeliefMonthly } from '../culture/religion';
import { emigrate } from '../population/migration';
import { addPressure, famineType, ecoStressOf } from './endings';
import { horrorMonthly } from '../powers/horrors';

export interface NewSettlement {
  members?: number[];
  pop?: number;
  name?: string;
  cultureId?: number;
  religionId?: number;
  species?: SpeciesKey;
  quiet?: boolean;
  cause?: string;
}

export function foundSettlement(sim: Sim, civ: Civ, x: number, y: number, o: NewSettlement = {}): Settlement {
  const w = sim.w;
  const m = w.map;
  const phon = phonOfCulture(sim, o.cultureId ?? civ.cultureId);
  const s: Settlement = {
    id: ++w.ids.settlement,
    name: o.name ?? (phon ? makeName(sim.rng, phon, 'place') : 'Haven'),
    civId: civ.id,
    x,
    y,
    founded: sim.year,
    founderCiv: civ.id,
    species: o.species ?? civ.species,
    mode: 'individual',
    members: [],
    cohorts: new Array(AGE_BANDS).fill(0),
    pop: 0,
    cultures: [{ id: o.cultureId ?? civ.cultureId, f: 1 }],
    religions: o.religionId ? [{ id: o.religionId, f: 1 }] : [],
    food: 0,
    housing: 0,
    bld: new Array(BUILDING_COUNT).fill(0),
    construction: null,
    radius: 1.6,
    territory: 0,
    education: 0,
    health: 0.4,
    prosperity: 1,
    unrest: 0,
    loyalty: 1,
    epidemics: [],
    immunity: {},
    access: 1,
    coastal: false,
    river: false,
    employment: new Array(7).fill(0),
    output: new Array(GOOD_COUNT).fill(0),
    occupiedBy: 0,
    wallTier: 0,
    garrison: 0,
    flows: emptyFlows(),
    events: [],
    capital: false,
    decline: 0,
    lastTerritory: -1,
    links: [],
  };
  w.settlements.set(s.id, s);
  sim.centers.set(m.idx(x, y), s.id);
  const center = m.idx(x, y);
  s.coastal = m.isCoastal(center);
  s.river = m.hasFreshWater(center);
  if (o.members) {
    s.members = o.members.slice();
    for (const id of s.members) {
      const p = w.persons.get(id);
      if (p) {
        p.settlementId = s.id;
        p.bandId = 0;
        p.civId = civ.id;
      }
    }
  } else if (o.pop) {
    if (o.pop > BALANCE.individualMax) {
      s.mode = 'cohort';
      // weights sum to 1.007, so normalize: founding must not create people (conservation; see population/ledger.ts)
      const profile = [0.13, 0.12, 0.11, 0.1, 0.09, 0.08, 0.07, 0.065, 0.055, 0.045, 0.04, 0.03, 0.025, 0.02, 0.015, 0.008, 0.004];
      const norm = profile.reduce((x, y) => x + y, 0);
      for (let b = 0; b < AGE_BANDS; b++) s.cohorts[b] = (o.pop * profile[b]) / norm;
    } else {
      s.mode = 'cohort';
      s.cohorts = new Array(AGE_BANDS).fill(0);
      s.cohorts[5] = o.pop;
      convertToIndividuals(sim, s);
    }
  }
  s.pop = s.mode === 'cohort' ? cohortTotal(s.cohorts) : s.members.length;
  s.food = s.pop * 0.5;
  civ.settlements.push(s.id);
  if (!civ.capital || !w.settlements.get(civ.capital)) {
    civ.capital = s.id;
    s.capital = true;
  }
  setTileSettlement(sim, center, s.id);
  const tier = eraToTier(civ.era);
  // round 7: the best early dwelling the era allows (round 6 always began with huts, even in the modern age)
  const first = tier >= 2 && civ.caps.housingTier >= 2 && civ.unlocked.includes(B.HOUSE) ? B.HOUSE : civ.caps.housingTier >= 1 && civ.unlocked.includes(B.HUT) ? B.HUT : B.CAMP;
  if (m.bld[center]) removeBuilding(sim, center);
  placeBuilding(sim, s, first, center, tier);
  recomputeTerritory(sim, s);
  revealAround(sim, civ, x, y, 10);
  if (!civ.rulerId) {
    const leader = createLeader(sim, civ);
    crown(sim, civ, leader, 'founded');
  }
  if (!o.quiet)
    logEvent(sim, {
      type: 'settlement_founded',
      cat: 'founding',
      title: `${s.name} was founded by ${civ.name}`,
      civs: [civ.id],
      settlements: [s.id],
      x,
      y,
      importance: civ.settlements.length <= 1 ? 2 : 1,
      causes: o.cause ? [{ label: o.cause, weight: 1 }] : undefined,
    });
  return s;
}

/** Move a settlement to another civilization (conquest, secession, treaty). */
export function transferSettlement(sim: Sim, s: Settlement, to: Civ, cause: string, quiet = false): void {
  const w = sim.w;
  const from = w.civs.get(s.civId);
  if (from) {
    from.settlements = from.settlements.filter((id) => id !== s.id);
    if (from.capital === s.id) {
      from.capital = from.settlements[0] ?? 0;
      s.capital = false;
      const nc = w.settlements.get(from.capital);
      if (nc) nc.capital = true;
    }
  }
  s.capital = false;
  transfer(sim, s.civId, to.id, residents(s));
  s.civId = to.id;
  s.occupiedBy = 0;
  s.loyalty = 0.4;
  if (s.construction) cancelProject(sim, s);
  to.settlements.push(s.id);
  if (!to.capital) {
    to.capital = s.id;
    s.capital = true;
  }
  for (const i of territoryTiles(sim, s)) {
    w.map.owner[i] = to.id;
    markOverlay(sim, i);
    if (w.map.bld[i]) markTile(sim, i); // buildings wear the owner's colours
  }
  if (!quiet)
    logEvent(sim, {
      type: 'settlement_transfer',
      cat: 'politics',
      title: `${s.name} passed from ${from?.name ?? 'no one'} to ${to.name}`,
      civs: from ? [from.id, to.id] : [to.id],
      settlements: [s.id],
      x: s.x,
      y: s.y,
      importance: s.pop > 20000 ? 3 : 2,
      causes: [{ label: cause, weight: 1 }],
    });
}

export function destroySettlement(sim: Sim, s: Settlement, cause: string): void {
  const w = sim.w;
  const m = w.map;
  const civ = w.civs.get(s.civId);
  if (s.construction) cancelProject(sim, s);
  for (const i of territoryTiles(sim, s)) {
    if (m.bld[i] && m.bld[i] !== B.RUINS) removeBuilding(sim, i, m.bld[i] !== B.FARM && m.bld[i] !== B.PASTURE && sim.rng.chance(0.5));
    setTileSettlement(sim, i, 0);
    markTile(sim, i);
  }
  record(sim, s.civId, 'destroyed', residents(s)); // the last residents disperse or perish with the town
  for (const id of s.members.slice()) {
    const p = w.persons.get(id);
    if (p && !p.notable) w.persons.delete(id);
    else if (p) p.settlementId = 0;
  }
  s.members = [];
  s.cohorts.fill(0);
  s.pop = 0;
  s.abandoned = sim.year;
  w.settlements.delete(s.id);
  sim.centers.delete(m.idx(s.x, s.y));
  if (civ) {
    civ.settlements = civ.settlements.filter((id) => id !== s.id);
    if (civ.capital === s.id) {
      civ.capital = civ.settlements[0] ?? 0;
      const nc = w.settlements.get(civ.capital);
      if (nc) nc.capital = true;
    }
  }
  logEvent(sim, {
    type: 'settlement_lost',
    cat: 'demography',
    title: `${s.name} was ${cause === 'abandoned' ? 'abandoned' : 'destroyed'}`,
    civs: civ ? [civ.id] : [],
    x: s.x,
    y: s.y,
    importance: 2,
    causes: [{ label: cause, weight: 1 }],
  });
}

const qScratch = new Float64Array(AGE_BANDS);

/** The monthly cycle of one settlement. */
export function settlementMonthly(sim: Sim, s: Settlement): void {
  const w = sim.w;
  const civ = w.civs.get(s.civId);
  if (!civ) return;
  const month = monthOf(w.tick);
  // 1. economy (food, production, consumption, labour)
  const econ = settlementEconomy(sim, s, civ, month);
  // 2. demography
  const hi = healthIndices(civ, s.prosperity);
  const q = mortalitySchedule(hi, s.species, qScratch);
  if (s.pop > 5000) {
    const urban = 1 + 0.35 * (1 - clamp01(civ.caps.sanitation)) * Math.min(1, Math.log10(s.pop / 5000));
    for (let b = 0; b < AGE_BANDS; b++) q[b] = Math.min(0.95, q[b] * urban);
  }
  let tfr = tfrFor(civ, s, q[0], econ.adequacy, s.species) * paceMult(sim.w.meta.settings, 'birth');
  // an infertility pandemic sterilizes adults; generations born to the fertile slowly replace them
  if (s.sterility) {
    tfr *= 1 - s.sterility;
    s.sterility = s.sterility * (1 - 1 / (12 * 35));
    if (s.sterility < 0.001) delete s.sterility;
  }
  // world law: population cap (fertility collapses when the cap is reached)
  const cap = sim.w.laws.populationCap;
  if (cap > 0 && livePopulation(sim) >= cap) tfr *= 0.05;
  const ctx = { q, tfr, adequacy: econ.adequacy };
  const f0b = s.flows.births, f0d = s.flows.deaths, f0f = s.flows.famine;
  if (s.mode === 'cohort') cohortMonth(s, ctx, s.flows);
  else individualMonth(sim, s.members, ctx, { settlementId: s.id, bandId: 0, civId: civ.id, cultureId: s.cultures[0]?.id ?? civ.cultureId, religionId: s.religions[0]?.id ?? 0, species: s.species }, s.flows);
  record(sim, s.civId, 'births', s.flows.births - f0b);
  record(sim, s.civId, 'deaths', s.flows.deaths - f0d);
  record(sim, s.civId, 'famine', s.flows.famine - f0f);
  if (s.flows.famine - f0f > 0) addPressure(sim, s.civId, famineType(sim, s), s.flows.famine - f0f);
  s.pop = s.mode === 'cohort' ? cohortTotal(s.cohorts) : s.members.length;
  if (s.mode === 'individual' && s.pop > BALANCE.individualMax) {
    if (s.capital) protectRulingFamily(sim, civ);
    convertToCohorts(sim, s);
  } else if (s.mode === 'cohort' && s.pop < BALANCE.individualMin && s.pop >= 1) convertToIndividuals(sim, s);
  // 3. construction
  const projects = 1 + Math.min(6, Math.floor(Math.sqrt(s.pop / 8000)));
  let builders = econ.builders;
  for (let k = 0; k < projects; k++) {
    if (!s.construction) {
      // a planning pass that found nothing to build is not repeated for two months (it scans the town)
      if (sim.w.tick < (s.planRetryTick ?? 0)) break;
      planConstruction(sim, s, civ);
      if (!s.construction) s.planRetryTick = sim.w.tick + 2 * TICKS_PER_MONTH;
    }
    if (!s.construction) break;
    const before = s.construction.labor;
    progressConstruction(sim, s, civ, builders);
    const used = Math.max(0, (before - (s.construction?.labor ?? 0)) * 12);
    builders = Math.max(0, builders - used);
    if (s.construction || builders < 1) break;
  }
  // 4. health, beliefs, migration
  diseaseMonthly(sim, s, civ);
  if (s.horror) horrorMonthly(sim, s, civ);
  localBeliefMonthly(sim, s, civ);
  if (month === 0) s.health = clamp01((lifeExpectancy(q) - 18) / 65);
  if (month % 3 === 1 && (econ.adequacy < 0.75 || s.unrest > 0.6 || s.pop > s.housing * 1.4)) emigrate(sim, s, civ, econ.adequacy);
  s.unrest = clamp01(s.unrest * 0.97 + (econ.adequacy < 0.85 ? (0.85 - econ.adequacy) * 0.08 : 0));
  // 5. yearly upkeep (first month of the year for this settlement)
  if (month === 0) settlementYearly(sim, s, civ);
  // 6. collapse
  if (s.pop < 1) destroySettlement(sim, s, 'abandoned');
}

function settlementYearly(sim: Sim, s: Settlement, civ: Civ): void {
  recomputeTerritory(sim, s);
  recomputeHousing(s);
  // education converges slowly toward what literacy, schools and spending allow
  // mass schooling systems serve far more pupils per school site than a medieval cathedral school
  const schools = s.bld[B.SCHOOL] * 8000 * (1 + 2 * civ.caps.literacy) + s.bld[B.LIBRARY] * 2000 + s.bld[B.UNIVERSITY] * 20000 + s.bld[B.TEMPLE] * 300;
  const coverage = clamp01(schools / Math.max(1, s.pop));
  const target = clamp01(civ.caps.literacy * (0.25 + 0.75 * coverage) * (0.6 + 0.4 * clamp01(civ.budget.education * 8)));
  s.education += (target - s.education) * 0.06;
  // market access: capital or connected by road/river/sea to the capital
  const cap = sim.w.settlements.get(civ.capital);
  if (cap && cap !== s) {
    const d = Math.hypot(cap.x - s.x, cap.y - s.y);
    const road = sim.w.map.roadTier(sim.w.map.idx(s.x, s.y));
    const reach = 10 + civ.caps.roadTier * 6 + civ.caps.railTier * 12 + civ.caps.communication * 2 + (s.coastal && cap.coastal ? civ.caps.navalTier * 6 : 0) + road * 4;
    s.access = clamp(1.15 - d / Math.max(4, reach), 0.15, 1);
  } else s.access = 1;
  s.loyalty = clamp01(s.loyalty + 0.03 - s.unrest * 0.05);
  s.ecoStress = ecoStressOf(sim, s);
  revealAround(sim, civ, s.x, s.y, s.radius + 4);
  if (s.flows.famine > s.pop * 0.05 && s.pop > 50)
    logEvent(sim, { type: 'famine', cat: 'demography', title: `Famine struck ${s.name}`, civs: [civ.id], settlements: [s.id], x: s.x, y: s.y, importance: 2, causes: famineCauses(sim, s) });
}

function famineCauses(sim: Sim, s: Settlement) {
  const c = sim.w.climate;
  const cell = ((s.y / c.cellSize) | 0) * c.cellsX + ((s.x / c.cellSize) | 0);
  const out = [];
  if ((c.rain[cell] ?? 0) < -0.25) out.push({ label: 'Regional drought', weight: -c.rain[cell] });
  if (s.pop > s.housing * 1.2) out.push({ label: 'Overcrowding beyond the land’s capacity', weight: 0.4 });
  if (s.occupiedBy) out.push({ label: 'War and occupation', weight: 0.6 });
  if (s.access < 0.4) out.push({ label: 'Poor connection to the rest of the realm', weight: 0.3 });
  out.push({ label: 'Food production below need', weight: 0.3 });
  return out;
}

/** Population-weighted culture/religion merge helper used by migration and settlers. */
export function mixShares(target: { id: number; f: number }[], id: number, frac: number): void {
  if (!id || frac <= 0) return;
  for (const sh of target) sh.f *= 1 - frac;
  const ex = target.find((x) => x.id === id);
  if (ex) ex.f += frac;
  else target.push({ id, f: frac });
  target.sort((a, b) => b.f - a.f);
  if (target.length > 4) target.length = 4;
  const tot = target.reduce((a, b) => a + b.f, 0) || 1;
  for (const sh of target) sh.f /= tot;
}

export { removePeople };

/** World population from current state, memoized per tick (identical before and after a save/load). */
function livePopulation(sim: Sim): number {
  const c = sim.cache.livePop as { tick: number; v: number } | undefined;
  if (c && c.tick === sim.w.tick) return c.v;
  let v = 0;
  for (const s of sim.w.settlements.values()) v += s.pop;
  for (const b of sim.w.bands.values()) v += b.members.length;
  sim.cache.livePop = { tick: sim.w.tick, v };
  return v;
}
