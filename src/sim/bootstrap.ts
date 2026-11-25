/**
 * Seeding a new world: wildlife, optional fantasy monsters, and starting
 * peoples. In prehistoric starts, peoples are wandering bands. Later-era
 * presets (Age of Kingdoms, Industrializing, Modern) generate developed
 * civilizations: their techs, cities and roads are CONSTRUCTED BY GENERATION
 * (not by simulated history) — this is recorded in the world history so it is
 * never presented as emergent.
 */
import { realWorld } from '../powers/powerSet';
import { makeName } from '../culture/language';
import { phonOfCulture } from '../population/persons';
import { makeTreaty } from '../politics/diplomacy';
import { ensureRelation, getRelation } from '../civilizations/knowledge';
import type { IntlOrg } from './types';
import { eraToTier } from '../civilizations/buildingTypes';
import { BUILDINGS } from '../civilizations/buildings';
import { getSites } from '../economy/production';
import { findSite, placeBuilding } from '../civilizations/urban';
import { hasUnlocked } from '../technology/research';
import { cohortTotal } from '../population/demography';
import { BALANCE } from '../config/balance';
import { cropSuitability } from '../economy/production';
import type { Sim } from './context';
import type { Civ, SpeciesKey } from './types';
import type { WorldConfig } from '../config/laws';
import { Simulation } from './simulation';
import { createWorldState } from './world';
import { SPECIES_BY_KEY, SPECIES, MONSTERS } from '../ecology/species';
import { habitat, spawnHerd, spawnMonster } from '../ecology/ecology';
import { spawnBand } from '../population/bands';
import { TERRAIN, isWaterTerrain } from '../world/terrain';
import { createCiv, createCulture } from '../civilizations/civ';
import { foundSettlement } from '../civilizations/settlement';
import { TECHS } from '../technology/techData';
import { grantTech, computeCaps, techState, eraOf } from '../technology/research';
import { planConstruction } from '../civilizations/urban';
import { infrastructureYearly } from '../economy/trade';
import { GOOD_COUNT, Good } from '../world/resources';
import { logEvent } from '../history/events';
import { recomputeTerritory } from '../civilizations/territory';
import { makeContact } from '../civilizations/knowledge';
import { createLeader, crown } from '../politics/succession';
import { foundReligion } from '../culture/religion';
import { deriveGovForm, civDisplayName } from '../politics/govforms';
import { ERA_NAMES } from '../technology/techData';
import { clamp } from '../core/math';
import type { WorldGenResult } from '../world/worldgen';
import { removeBuilding } from '../civilizations/urban';
import { B } from '../civilizations/buildingTypes';
import { forgetTech } from '../technology/research';

export function createSimulation(cfg: WorldConfig, gen?: WorldGenResult): Simulation {
  const w = createWorldState(cfg, gen);
  const sim = new Simulation(w);
  seedLife(sim);
  return sim;
}

export function seedLife(sim: Sim): void {
  const w = sim.w;
  const m = w.map;
  const st = w.meta.settings;
  logEvent(sim, { type: 'world_created', cat: 'founding', title: `The world of ${w.meta.name} was created`, importance: 3 });
  if (st.empty) return;
  // wildlife
  let land = 0;
  for (let i = 0; i < m.n; i++) if (m.isLand(i)) land++;
  const herds = Math.round((land / 70) * st.biodiversity);
  const candidates = SPECIES.filter((s) => !s.aquatic && (st.alien ? s.alien || s.flying : !s.alien) && (!s.megafauna || st.startEra <= 2));
  for (let k = 0; k < herds; k++) {
    const i = sim.rng.int(0, m.n - 1);
    if (!m.isLand(i)) continue;
    const weights = candidates.map((sp) => habitat(sim, sp, i) * (sp.diet === 'predator' ? 0.25 : 1));
    const pick = sim.rng.weighted(weights);
    // round 10 addendum: test the habitat itself (predators are weighted 0.25, so 'weight > 0.3' never seeded one)
    if (pick >= 0 && habitat(sim, candidates[pick], i) > 0.3) spawnHerd(sim, candidates[pick].key, m.xOf(i), m.yOf(i));
  }
  settlePredators(sim);
  let water = 0;
  for (let i = 0; i < m.n; i++) if (m.isWater(i)) water++;
  const fish = Math.round((water / 300) * st.biodiversity);
  for (let k = 0; k < fish; k++) {
    const i = sim.rng.int(0, m.n - 1);
    if (!m.isWater(i)) continue;
    // round 10 addendum: seals in cold coastal water
    const kind = m.terrain[i] === 0 && sim.rng.chance(0.3) ? 'whale' : m.temp[i] < 6 && m.terrain[i] !== 0 && !st.alien && sim.rng.chance(0.3) ? 'seal' : 'fish';
    spawnHerd(sim, kind, m.xOf(i), m.yOf(i));
  }
  if ((w.laws.fantasyCreatures || st.fantasy) && !realWorld(st)) {
    for (let k = 0; k < Math.round(land / 4000) + 2; k++) {
      const def = sim.rng.pick(MONSTERS);
      for (let t = 0; t < 30; t++) {
        const i = sim.rng.int(0, m.n - 1);
        if (def.biomes.includes(m.terrain[i])) {
          spawnMonster(sim, def.kind, m.xOf(i), m.yOf(i));
          break;
        }
      }
    }
  }
  // peoples
  const species: SpeciesKey[] = st.fantasy ? ['human', 'sylvan', 'delver', 'grakk'] : ['human'];
  const sites = pickStartSites(sim, st.startCivs);
  sites.forEach((i, k) => {
    const sp = species[k % species.length];
    if (st.startEra <= 1) spawnBand(sim, m.xOf(i), m.yOf(i), sp, sim.rng.int(18, 30));
    else developedCiv(sim, m.xOf(i), m.yOf(i), sp, st.startEra);
  });
  if (st.startEra > 1) {
    // everyone nearby knows each other at the start of a developed world
    const civs = [...w.civs.values()];
    for (const a of civs) for (const b of civs) if (a.id < b.id) {
      const ca = w.settlements.get(a.capital);
      const cb = w.settlements.get(b.capital);
      // round 10: from era 9 (telegraph, radio, flight) every nation knows every other; earlier, only neighbours
      if (ca && cb && (st.startEra >= 9 || Math.hypot(ca.x - cb.x, ca.y - cb.y) < 25 + st.startEra * 5)) makeContact(sim, a.id, b.id);
    }
    if (st.startEra >= 9) seedDiplomaticPast(sim);
    logEvent(sim, {
      type: 'generated_start',
      cat: 'founding',
      title: `The chronicle begins in the ${ERA_NAMES[st.startEra]} era`,
      text: 'Starting civilizations, cities and roads were generated for this preset; history from this point on is simulated.',
      importance: 3,
    });
  }
  if (w.meta.scenario === 'collapse') applyCollapseScenario(sim);
}

/**
 * Round 10 addendum (life audit): a land predator seeded where no prey is within its 12-tile search moves to the
 * nearest herbivore herd standing in country it can live in, or is not kept. Wildlife starts sparse, so packs
 * placed far from prey starved before the prey spread. Uses no random draws.
 */
function settlePredators(sim: Sim): void {
  const w = sim.w;
  const m = w.map;
  const herbivores = [...w.herds.values()].filter((o) => SPECIES_BY_KEY[o.species]?.diet === 'herbivore');
  for (const h of [...w.herds.values()]) {
    const sp = SPECIES_BY_KEY[h.species];
    if (!sp || sp.diet !== 'predator' || sp.aquatic) continue;
    if (herbivores.some((o) => Math.hypot(o.x - h.x, o.y - h.y) <= 12)) continue;
    const home = herbivores
      .filter((o) => habitat(sim, sp, Math.floor(o.y) * m.w + Math.floor(o.x)) >= 0.3)
      .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y) || a.id - b.id)[0];
    if (home) {
      h.x = home.x; h.y = home.y; h.tx = home.x; h.ty = home.y;
    } else {
      w.herds.delete(h.id);
      const st = w.speciesStatus[h.species];
      if (st) st.count = Math.max(0, st.count - h.count);
    }
  }
}

function pickStartSites(sim: Sim, count: number): number[] {
  const m = sim.w.map;
  const out: number[] = [];
  const minDist = Math.max(10, Math.sqrt(m.n / Math.max(1, count)) * 0.55);
  for (let tries = 0; tries < 4000 && out.length < count; tries++) {
    const i = sim.rng.int(0, m.n - 1);
    const def = TERRAIN[m.terrain[i]];
    if (isWaterTerrain(m.terrain[i]) || def.habitability < 0.6 || !def.buildable) continue;
    // round 10 addendum: people begin beside water (river, lake or sea) as real first settlements did; a dry
    // site is taken only in the last quarter of the search, when the map has no wet land left (was: dry
    // sites accepted 30% of the time, so every start could land inland by chance)
    if (!m.hasFreshWater(i) && !m.isCoastal(i) && tries < 3000) continue;
    const x = m.xOf(i);
    const y = m.yOf(i);
    if (out.some((j) => Math.hypot(m.xOf(j) - x, m.yOf(j) - y) < minDist)) continue;
    out.push(i);
  }
  return out;
}

/** Generate a civilization at roughly the given era (starting conditions, not simulated history). */
export function developedCiv(sim: Sim, x: number, y: number, species: SpeciesKey, era: number): Civ {
  const w = sim.w;
  const rng = sim.rng;
  const culture = createCulture(sim, { originCiv: 0 });
  const civ = createCiv(sim, { species, x, y, cultureId: culture.id, quiet: true });
  culture.originCiv = civ.id;
  // techs: all of earlier eras (with some gaps), part of the current era
  for (const t of TECHS) {
    if (t.era < era || (t.era === era && rng.chance(0.4))) {
      if (t.advancedWeapon && !w.laws.advancedWeapons) continue;
      if (t.era < era - 1 || rng.chance(0.85)) {
        const st = techState(civ, t.id);
        st.known = true;
        st.year = 0;
        st.adoption = 1;
      }
    }
  }
  // remove techs whose prerequisites are missing
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of TECHS) if (civ.techs[t.id]?.known && t.prereqs.some((p) => !civ.techs[p]?.known)) {
      civ.techs[t.id].known = false;
      civ.techs[t.id].adoption = 0;
      changed = true;
    }
  }
  // round 10 (mode audit): the grants above average ~34% of the start era's techs, against the 35% that eraOf
  // needs, so developed starts came out one era low. Top up with techs whose prerequisites are known (start era
  // first) until the nation really stands in the promised era.
  for (let guard = 0; guard < 200 && eraOf(civ) < era; guard++) {
    const ready = TECHS.filter((t) => t.era <= era && !civ.techs[t.id]?.known && !(t.advancedWeapon && !w.laws.advancedWeapons) && t.prereqs.every((p) => civ.techs[p]?.known));
    if (!ready.length) break;
    const now = ready.filter((t) => t.era === era);
    const t = rng.pick(now.length ? now : ready);
    const st = techState(civ, t.id);
    st.known = true;
    st.year = 0;
    st.adoption = 1;
  }
  computeCaps(civ);
  // institutions plausible for the era
  const i = civ.inst;
  i.centralization = clamp(0.3 + era * 0.04, 0, 0.8);
  i.capacity = clamp(0.1 + era * 0.05, 0, 0.7);
  i.hereditary = era >= 9 ? (rng.chance(0.3) ? 0.7 : 0.1) : rng.chance(0.8) ? 0.8 : 0.2;
  i.participation = era >= 9 ? rng.range(0.2, 0.8) : rng.range(0.05, 0.3);
  i.competition = i.participation * rng.range(0.3, 1);
  i.liberties = rng.range(0.2, 0.7);
  i.ruleOfLaw = clamp(0.2 + era * 0.04, 0, 0.8);
  i.welfare = era >= 9 ? rng.range(0.1, 0.6) : 0.05;
  // every institution varies, so developed worlds start with genuinely different states
  i.religiousAuthority = rng.range(0.05, era >= 9 ? 0.6 : 0.85);
  i.militaryInfluence = rng.range(0.1, 0.75);
  i.stateEconomy = era >= 8 ? rng.range(0.05, 0.8) : rng.range(0.05, 0.3);
  i.federalism = rng.range(0.1, 0.8);
  i.techGovernance = era >= 11 ? rng.range(0, 0.7) : 0;
  // population scaled by era
  const capPop = Math.round([0, 200, 1500, 5000, 12000, 20000, 40000, 80000, 200000, 400000, 800000, 1500000, 2000000][Math.min(12, era)] * rng.range(0.6, 1.3));
  const cap = foundSettlement(sim, civ, x, y, { pop: capPop, quiet: true });
  const others = rng.int(2, 3 + Math.floor(era / 2));
  for (let k = 0; k < others; k++) {
    for (let t = 0; t < 30; t++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(6, 10 + era);
      const sx = Math.round(x + Math.cos(a) * r);
      const sy = Math.round(y + Math.sin(a) * r);
      if (!w.map.inBounds(sx, sy)) continue;
      const ii = w.map.idx(sx, sy);
      if (w.map.isWater(ii) || w.map.settle[ii] || !TERRAIN[w.map.terrain[ii]].buildable) continue;
      if ([...w.settlements.values()].some((s) => Math.hypot(s.x - sx, s.y - sy) < 5)) continue;
      foundSettlement(sim, civ, sx, sy, { pop: Math.round(capPop * rng.range(0.1, 0.4)), quiet: true });
      break;
    }
  }
  // Size the people to the land BEFORE building (so districts and jobs match the people who live there).
  // A developed start must be able to feed itself; without this, era presets began in mass famine.
  const fit = landFit(sim, civ);
  if (fit < 1) {
    for (const sid of civ.settlements) {
      const s = w.settlements.get(sid)!;
      if (s.mode !== 'cohort') continue;
      const k = Math.max(fit, 150 / Math.max(1, s.pop));
      s.cohorts = s.cohorts.map((v) => v * k);
      s.pop = cohortTotal(s.cohorts);
    }
  }
  // stock materials so generated cities can be built
  for (let g = 0; g < GOOD_COUNT; g++) civ.stock[g] = Math.max(civ.stock[g], 200 * era * era);
  civ.stock[Good.FOOD] = capPop * 0.5 * fit;
  for (const sid of civ.settlements) {
    const s = w.settlements.get(sid)!;
    s.food = s.pop * 0.6;
    s.education = clamp(civ.caps.literacy * 0.6, 0, 0.95);
    s.prosperity = 1 + era * 0.25;
    const projects = Math.round(4 + Math.sqrt(s.pop) / 12);
    for (let k = 0; k < projects; k++) {
      planConstruction(sim, s, civ);
      const job = s.construction;
      if (!job) break;
      completeNow(sim, s.id, civ); // starting conditions: complete instantly
      if (s.housing >= s.pop * 1.05 && k > projects / 2) break;
    }
    recomputeTerritory(sim, s);
  }
  layOutFarmland(sim, civ);
  for (let k = 0; k < 6; k++) infrastructureYearly(sim, civ);
  if (era >= 3 && rng.chance(0.85)) {
    const r = foundReligion(sim, cap, civ);
    for (const sid of civ.settlements) {
      const s = w.settlements.get(sid)!;
      s.religions = [{ id: r.id, f: rng.range(0.6, 0.95) }, { id: 0, f: 0.1 }];
    }
    civ.stateReligion = r.id;
  }
  civ.govForm = deriveGovForm(civ, civ.settlements.length);
  civ.name = civDisplayName(civ);
  if (!civ.rulerId) crown(sim, civ, createLeader(sim, civ), 'founded');
  civ.population = [...civ.settlements].reduce((a, id) => a + (w.settlements.get(id)?.pop ?? 0), 0);
  civ.treasury = civ.population * 0.05;
  return civ;
}

import { progressConstruction } from '../civilizations/urban';
function completeNow(sim: Sim, sid: number, civ: Civ): void {
  const s = sim.w.settlements.get(sid);
  if (!s || !s.construction) return;
  s.construction.labor = 0;
  s.construction.need.fill(0);
  progressConstruction(sim, s, civ, 1000);
}

/** After the Collapse: ruins of a lost civilization and forgotten techs. */
function applyCollapseScenario(sim: Sim): void {
  const w = sim.w;
  const m = w.map;
  const rng = sim.rng;
  for (let k = 0; k < Math.round(m.n / 900); k++) {
    const i = rng.int(0, m.n - 1);
    if (m.isLand(i) && !m.bld[i] && !m.settle[i]) {
      m.bld[i] = B.RUINS;
      m.bldFlags[i] = rng.chance(0.5) ? 5 : 0;
    }
  }
  for (const civ of w.civs.values()) {
    for (const t of TECHS) if (t.era >= 3 && civ.techs[t.id]?.known && rng.chance(0.3)) forgetTech(sim, civ, t.id, 'Lost in the great collapse');
    civ.stability = 0.4;
  }
  logEvent(sim, { type: 'scenario', cat: 'founding', title: 'Survivors emerge among the ruins of a fallen age', importance: 3 });
  void removeBuilding;
  void grantTech;
}

/**
 * Share of the planned starting population the civ's land can feed (≤ 1): arable land within reach of its
 * towns (not water, not another nation's), a third of it farmed at the civ's technology, plus foraging.
 * An a-priori estimate used only to size developed starts; the running economy then takes over.
 */
function landFit(sim: Sim, civ: Civ): number {
  const w = sim.w;
  const m = w.map;
  const caps = civ.caps;
  const irrigated = caps.irrigation > 0;
  const bonus = Math.max(0, caps.farming - 1) + caps.biotech * 0.4 + caps.irrigation * 0.15;
  const seen = new Set<number>();
  let farmland = 0;
  let pop = 0;
  for (const sid of civ.settlements) {
    const s = w.settlements.get(sid)!;
    pop += s.pop;
    m.forRadius(s.x, s.y, 9, (i) => {
      if (seen.has(i) || m.isWater(i) || (m.owner[i] && m.owner[i] !== civ.id)) return;
      seen.add(i);
      farmland += (m.fert[i] / 255) * cropSuitability(m.temp[i], m.moist[i], irrigated);
    });
  }
  const capacity = farmland * 0.33 * BALANCE.farmYield * (1 + (caps.farming > 0 ? bonus : 0));
  const need = pop * BALANCE.foodNeedPerCapita;
  return need > 0 ? clamp(capacity / need, 0.05, 1) : 1;
}

/**
 * A developed start begins with the farmland that feeds it: farms are placed on each town's best free
 * land until the civ's annual farm + forage output covers its people (or no suitable land remains).
 */
function layOutFarmland(sim: Sim, civ: Civ): void {
  if (civ.caps.farming <= 0 || !hasUnlocked(civ, B.FARM)) return;
  const w = sim.w;
  const bonus = Math.max(0, civ.caps.farming - 1) + civ.caps.biotech * 0.4 + civ.caps.irrigation * 0.15;
  const tier = eraToTier(civ.era);
  const supply = () => {
    let y = 0;
    for (const sid of civ.settlements) {
      const st = getSites(sim, w.settlements.get(sid)!);
      y += st.farmPot * BALANCE.farmYield * (1 + bonus) + st.forage;
    }
    return y;
  };
  const need = civ.settlements.reduce((a, sid) => a + (w.settlements.get(sid)?.pop ?? 0), 0) * BALANCE.foodNeedPerCapita;
  for (let guard = 0; guard < 2000 && supply() < need; guard++) {
    let placed = false;
    for (const sid of civ.settlements) {
      const s = w.settlements.get(sid)!;
      const tile = findSite(sim, s, BUILDINGS[B.FARM]);
      if (tile === null) continue;
      placeBuilding(sim, s, B.FARM, tile, tier);
      placed = true;
    }
    if (!placed) break;
  }
}

/**
 * Round 10 (mode audit): a developed modern world begins with a diplomatic past instead of every pair neutral.
 * Nations whose cultures hold similar values are friends with trust and a defensive pact; the most different
 * neighbours start cold (tense borders). From the atomic age (era 10) the largest bloc has founded a treaty
 * organization. Measured before: no alliance or organization formed in 100 years of an era-10 world.
 */
function seedDiplomaticPast(sim: Sim): void {
  const w = sim.w;
  const rng = sim.rng;
  const civs = [...w.civs.values()].filter((c) => c.alive);
  if (civs.length < 3) return;
  const dist = (a: Civ, b: Civ) => {
    const va = w.cultures.get(a.cultureId)?.values, vb = w.cultures.get(b.cultureId)?.values;
    if (!va || !vb) return 1;
    const ks = Object.keys(va) as (keyof typeof va)[];
    return Math.sqrt(ks.reduce((t, k) => t + (va[k] - vb[k]) ** 2, 0) / ks.length);
  };
  // two blocs, like a cold war: the two most different cultures anchor them; each nation joins the nearer one
  let seedA = civs[0], seedB = civs[1], far = -1;
  for (const a of civs) for (const b of civs) if (a.id < b.id && dist(a, b) > far) { far = dist(a, b); seedA = a; seedB = b; }
  const blocOf = new Map<number, number>();
  for (const c of civs) blocOf.set(c.id, dist(c, seedA) <= dist(c, seedB) ? 0 : 1);
  blocOf.set(seedA.id, 0); blocOf.set(seedB.id, 1);
  const pairs: { a: Civ; b: Civ; d: number }[] = [];
  for (const a of civs) for (const b of civs) if (a.id < b.id && a.knownCivs.includes(b.id)) pairs.push({ a, b, d: dist(a, b) });
  const across = pairs.filter((p) => blocOf.get(p.a.id) !== blocOf.get(p.b.id)).sort((x, y) => y.d - x.d);
  for (const p of pairs) {
    if (blocOf.get(p.a.id) !== blocOf.get(p.b.id)) continue;
    const rel = ensureRelation(sim, p.a.id, p.b.id);
    rel.opinion = rng.range(35, 55);
    rel.trust = rng.range(0.55, 0.75);
    makeTreaty(sim, p.a, p.b, 'defensive', 40, true);
  }
  for (const p of across.slice(0, Math.max(1, Math.ceil(across.length / 2)))) {
    const rel = ensureRelation(sim, p.a.id, p.b.id);
    rel.opinion = rng.range(-40, -22);
    rel.trust = rng.range(0.1, 0.25);
  }
  // from the atomic age the larger bloc has a treaty organization, unless founding one is the scenario's own goal
  if (w.meta.settings.startEra < 10 || w.meta.scenario === 'standoff') return;
  const big = [0, 1].map((k) => civs.filter((c) => blocOf.get(c.id) === k)).sort((x, y) => y.length - x.length)[0];
  const members = big.filter((c) => big.some((o) => o.id !== c.id && c.knownCivs.includes(o.id))).slice(0, 7).map((c) => c.id);
  if (members.length < 3) return;
  const founder = w.civs.get(members[0])!;
  const phon = phonOfCulture(sim, founder.cultureId);
  const word = phon ? makeName(rng, phon, 'word') : 'Concord';
  const org: IntlOrg = { id: ++w.ids.org, name: `${word} ${rng.pick(['Treaty Organization', 'Pact', 'Alliance', 'Compact'])}`, kind: 'alliance', founded: w.meta.startYear, founder: founder.id, members };
  w.orgs.set(org.id, org);
  logEvent(sim, { type: 'org_founded', cat: 'diplomacy', title: `The ${org.name} binds ${org.members.length} nations in mutual defence`, civs: org.members, importance: 3 });
}
