/**
 * Technology runtime: research, discovery, adoption, diffusion, loss.
 *
 * Research points (RP) per year come from folk innovation (population), the
 * learned (education x service workers in knowledge institutions), research
 * spending, institutions (libraries, universities, labs), connectivity and
 * stability. Discovery happens when accumulated progress exceeds a tech's
 * cost; DIFFUSION from contacts adds progress for techs neighbours already use
 * (catching up is cheaper than inventing — Gerschenkron/Comin-Hobijn style,
 * stylized). ADOPTION then rises over `adoptionYears` only while material and
 * geographic requirements are met, and decays when they are lost. Collapse of
 * literacy and institutions can make a civilization FORGET techs.
 */
import { mediaResearchMult } from '../media/media';
import type { Sim } from '../sim/context';
import type { Civ, TechState } from '../sim/types';
import { CAP_KEYS, emptyCaps, isTierCap, type GeoFeature, type TechDef } from './types';
import { TECHS, TECH_BY_ID, STARTING_TECHS } from './techData';
import { B, BUILDING_KEYS } from '../civilizations/buildingTypes';
import { Good, type GoodKey } from '../world/resources';
import { BALANCE } from '../config/balance';
import { clamp01, saturate } from '../core/math';
import { logEvent } from '../history/events';
import { createPerson } from '../population/persons';
import { T } from '../world/terrain';

/** Effective research cost: data cost x global multiplier x era scaling (pacing knob). */
export function effCost(t: TechDef): number {
  return t.cost * BALANCE.techCostMult * Math.pow(BALANCE.techEraScale, t.era - 1);
}

export function techState(civ: Civ, id: string): TechState {
  let s = civ.techs[id];
  if (!s) civ.techs[id] = s = { known: false, progress: 0, adoption: 0, year: -1 };
  return s;
}

export function knows(civ: Civ, id: string): boolean {
  return !!civ.techs[id]?.known;
}

export function adoption(civ: Civ, id: string): number {
  return civ.techs[id]?.adoption ?? 0;
}

/** Give a brand-new civ (or band) the starting techs, fully adopted. */
export function initTechs(civ: Civ): void {
  for (const id of STARTING_TECHS) {
    const s = techState(civ, id);
    s.known = true;
    s.adoption = 1;
    s.year = 0;
  }
  computeCaps(civ);
}

/** Recompute capabilities and unlocked buildings from adoption levels. */
export function computeCaps(civ: Civ): void {
  const caps = emptyCaps();
  const unlocked = new Set<number>([B.CAMP]);
  for (const id in civ.techs) {
    const st = civ.techs[id];
    if (!st.known || st.adoption <= 0) continue;
    const def = TECH_BY_ID.get(id);
    if (!def) continue;
    for (const k in def.effects) {
      const key = k as (typeof CAP_KEYS)[number];
      const v = def.effects[key] as number;
      if (isTierCap(key)) {
        if (st.adoption >= 0.5 && v > caps[key]) caps[key] = v;
      } else caps[key] += v * st.adoption;
    }
    if (def.unlocks?.buildings && st.adoption >= 0.25) for (const b of def.unlocks.buildings) unlocked.add(B[b]);
  }
  civ.caps = caps;
  civ.unlocked = [...unlocked].sort((a, b) => a - b);
  civ.era = eraOf(civ);
  let score = 0;
  for (const id in civ.techs) {
    const st = civ.techs[id];
    const def = TECH_BY_ID.get(id);
    if (st.known && def) score += st.adoption * def.era;
  }
  civ.techScore = score;
}

export function hasUnlocked(civ: Civ, building: number): boolean {
  return civ.unlocked.includes(building);
}

/**
 * Descriptive era: the highest era in which the civ has adopted (>= 0.5) at
 * least 35% of that era's technologies (min 2). Eras are labels, not gates.
 */
export function eraOf(civ: Civ): number {
  const total = new Array(16).fill(0);
  const have = new Array(16).fill(0);
  for (const t of TECHS) total[t.era]++;
  for (const id in civ.techs) {
    const st = civ.techs[id];
    const def = TECH_BY_ID.get(id);
    if (def && st.known && st.adoption >= 0.5) have[def.era]++;
  }
  let era = 1;
  for (let e = 2; e <= 15; e++) if (total[e] && have[e] >= Math.max(2, Math.ceil(total[e] * 0.35))) era = e;
  return era;
}

/** Geographic features in a civ's territory (cached per year in sim.cache). */
export function civFeatures(sim: Sim, civ: Civ): Set<GeoFeature> {
  const key = `feat:${civ.id}`;
  const cached = sim.cache[key] as { year: number; set: Set<GeoFeature> } | undefined;
  if (cached && cached.year === sim.year) return cached.set;
  const set = new Set<GeoFeature>();
  const m = sim.w.map;
  for (const sid of civ.settlements) {
    const s = sim.w.settlements.get(sid);
    if (!s) continue;
    m.forRadius(s.x, s.y, Math.max(3, s.radius), (i) => {
      const t = m.terrain[i];
      if (t <= T.SHALLOW) set.add('coast');
      if (m.river[i] > 0 || t === T.LAKE) set.add('river');
      if (t === T.MOUNTAIN || t === T.HILLS) set.add('mountain');
      if (t === T.FOREST || t === T.TAIGA || t === T.JUNGLE) set.add('forest');
      if (t === T.DESERT) set.add('desert');
    });
  }
  for (const bid of civ.bands) {
    const b = sim.w.bands.get(bid);
    if (!b) continue;
    m.forRadius(b.x, b.y, 4, (i) => {
      const t = m.terrain[i];
      if (t <= T.SHALLOW) set.add('coast');
      if (m.river[i] > 0 || t === T.LAKE) set.add('river');
    });
  }
  // domesticable animals / horses near the civ's people
  const pts: [number, number][] = [];
  for (const sid of civ.settlements) {
    const s = sim.w.settlements.get(sid);
    if (s) pts.push([s.x, s.y]);
  }
  for (const h of sim.w.herds.values()) {
    if (h.owner === civ.id) {
      set.add('domesticable');
      if (h.species === 'horse') set.add('horses');
      continue;
    }
    for (const [x, y] of pts) {
      if ((h.x - x) ** 2 + (h.y - y) ** 2 < 144) {
        if (['goat', 'sheep', 'cow', 'boar', 'chicken', 'camel', 'horse', 'alienbeast'].includes(h.species)) set.add('domesticable');
        if (h.species === 'horse') set.add('horses');
        break;
      }
    }
  }
  if (civ.access[Good.HORSES] > 0.2) set.add('horses');
  sim.cache[key] = { year: sim.year, set };
  return set;
}

function realismAllows(sim: Sim, t: TechDef): boolean {
  const mode = sim.w.meta.settings.realism;
  if (t.realism === 'speculative') return sim.w.laws.speculativeTech && mode === 'unrestricted';
  if (t.realism === 'plausible' && mode === 'grounded' && t.era >= 13) return false;
  return true;
}

/** Can this civ research/discover `t` right now? */
export function techAvailable(sim: Sim, civ: Civ, t: TechDef): boolean {
  if (knows(civ, t.id)) return false;
  if (!realismAllows(sim, t)) return false;
  if (t.advancedWeapon && !sim.w.laws.advancedWeapons) return false;
  for (const p of t.prereqs) if (!knows(civ, p)) return false;
  if (t.requires?.minPopulation && civ.population < t.requires.minPopulation) return false;
  if (t.requires?.features?.length) {
    const f = civFeatures(sim, civ);
    if (!t.requires.features.some((x) => f.has(x))) return false;
  }
  return true;
}

function resourcesMet(civ: Civ, t: TechDef): boolean {
  const r = t.requires;
  if (!r) return true;
  if (r.resources) for (const g of r.resources) if ((civ.access[Good[g as GoodKey]] ?? 0) < 0.3) return false;
  if (r.anyResources && r.anyResources.length && !r.anyResources.some((g) => (civ.access[Good[g as GoodKey]] ?? 0) >= 0.3)) return false;
  return true;
}

/** Research points per year. */
export function researchOutput(sim: Sim, civ: Civ): number {
  const w = sim.w;
  let scholars = 0;
  let folk = 0;
  let institutions = 0;
  let edu = 0;
  for (const sid of civ.settlements) {
    const s = w.settlements.get(sid);
    if (!s) continue;
    folk += s.pop;
    edu += s.pop * s.education;
    institutions += s.bld[B.LIBRARY] * 1 + s.bld[B.UNIVERSITY] * 4 + s.bld[B.LAB] * 12 + s.bld[B.TEMPLE] * 0.2 + s.bld[B.SCHOOL] * 0.5 + s.bld[B.DATA_CENTER] * 6;
    scholars += s.employment[4] * s.education * 0.25;
  }
  for (const bid of civ.bands) folk += w.bands.get(bid)?.members.length ?? 0;
  const pop = Math.max(1, folk);
  const eduRate = edu / pop;
  // Folk innovation grows sublinearly with population (Kremer-style scale effect, stylized).
  const folkRP = BALANCE.folkResearch * Math.pow(pop, 0.62);
  const learnedRP = BALANCE.researchPerScholar * scholars * (1 + institutions * 0.03);
  const spend = 0.6 + 0.4 * clamp01(civ.budget.research * 10) + civ.budget.research * 6;
  const caps = civ.caps;
  const mult =
    (1 + caps.research) *
    (1 + caps.computing * 0.3 + caps.ai * 0.6) *
    (0.6 + 0.4 * civ.stability) *
    (1 - 0.3 * Math.max(0, civ.inst.religiousAuthority - 0.5)) *
    (1 + 0.25 * (civ.personality.science - 0.5)) *
    (0.8 + 0.4 * eduRate) *
    mediaResearchMult(civ) *
    w.laws.researchSpeed *
    w.meta.settings.techSpeed;
  return (folkRP + learnedRP * spend) * mult;
}

/** Utility-based research choice with bounded rationality (softmax over needs). */
export function chooseResearch(sim: Sim, civ: Civ): string {
  const options = TECHS.filter((t) => techAvailable(sim, civ, t));
  if (!options.length) return '';
  const atWar = [...sim.w.wars.values()].some((wr) => !wr.end && (wr.attackers.includes(civ.id) || wr.defenders.includes(civ.id)));
  const hungry = (civ.econ.livingStandard ?? 1) < 0.9;
  const p = civ.personality;
  const weights = options.map((t) => {
    let u = 1 / Math.pow(t.cost + 20, 0.45); // cheaper first
    switch (t.category) {
      case 'agriculture':
      case 'subsistence':
        u *= hungry ? 2.2 : 1.1;
        break;
      case 'military':
        u *= (atWar ? 2.5 : 0.8) * (0.6 + p.aggression);
        break;
      case 'economy':
      case 'maritime':
        u *= 0.7 + p.trade;
        break;
      case 'science':
      case 'computing':
        u *= 0.6 + p.science;
        break;
      case 'civic':
        u *= 0.9 + civ.inst.capacity * 0.3;
        break;
      case 'medicine':
        u *= 1 + (1 - civ.stability) * 0.3;
        break;
      case 'energy':
      case 'industry':
        u *= 1.1;
        break;
    }
    // prefer techs we already have resources for
    if (!resourcesMet(civ, t)) u *= 0.4;
    return u;
  });
  // softmax-ish stochastic pick: sharpen by caution (cautious = more deliberate)
  const sharp = 1 + p.caution;
  const pw = weights.map((x) => Math.pow(x, sharp));
  const k = sim.rng.weighted(pw);
  return options[Math.max(0, k)].id;
}

export function grantTech(sim: Sim, civ: Civ, id: string, how: 'research' | 'diffusion' | 'god' | 'conquest' | 'espionage' | 'serendipity' | 'start'): boolean {
  const def = TECH_BY_ID.get(id);
  if (!def) return false;
  const st = techState(civ, id);
  if (st.known) return false;
  st.known = true;
  st.year = sim.year;
  st.progress = def.cost;
  if (how === 'god') st.adoption = Math.max(st.adoption, 0.1);
  if (civ.researchTarget === id) civ.researchTarget = '';
  // world-first milestone?
  const mkey = `tech:${id}`;
  const first = sim.w.milestones[mkey] === undefined;
  if (first) sim.w.milestones[mkey] = sim.year;
  const cap = sim.w.settlements.get(civ.capital);
  let persons: number[] = [];
  if (how === 'research' && def.era >= 3 && cap) {
    const inventor = createPerson(sim, {
      born: sim.year - sim.rng.int(25, 60),
      species: civ.species,
      civId: civ.id,
      settlementId: cap.id,
      cultureId: civ.cultureId,
      religionId: civ.stateReligion || cap.religions[0]?.id || 0,
      role: 'scholar',
      notable: true,
    });
    inventor.titles.push(def.category === 'military' ? 'Engineer' : def.category === 'medicine' ? 'Physician' : 'Scholar');
    persons = [inventor.id];
  }
  const verb = how === 'diffusion' ? 'adopted knowledge of' : how === 'conquest' ? 'captured the secrets of' : how === 'espionage' ? 'stole the secrets of' : how === 'god' ? 'received divine knowledge of' : 'discovered';
  const importance = first && def.era >= 2 ? (def.era >= 7 ? 4 : 3) : how === 'research' && def.era >= 5 ? 2 : 1;
  const inventorName = persons.length ? sim.w.persons.get(persons[0])?.name : undefined;
  logEvent(sim, {
    type: first ? 'tech_first' : 'tech',
    cat: 'technology',
    title: `${civ.name} ${verb} ${def.name}${inventorName ? ` (${inventorName})` : ''}${first ? ' — a world first' : ''}`,
    text: def.description,
    civs: [civ.id],
    persons,
    x: cap?.x,
    y: cap?.y,
    importance,
  });
  computeCaps(civ);
  return true;
}

export function forgetTech(sim: Sim, civ: Civ, id: string, cause: string): void {
  const st = civ.techs[id];
  const def = TECH_BY_ID.get(id);
  if (!st || !st.known || !def) return;
  // dependents become unusable too
  st.known = false;
  st.adoption = 0;
  st.progress = def.cost * 0.4; // fragments survive, rediscovery is faster
  st.lost = (st.lost ?? 0) + 1;
  logEvent(sim, {
    type: 'tech_lost',
    cat: 'technology',
    title: `Knowledge of ${def.name} was lost in ${civ.name}`,
    civs: [civ.id],
    importance: def.era >= 4 ? 2 : 1,
    causes: [{ label: cause, weight: 1 }],
  });
  for (const t of TECHS) if (t.prereqs.includes(id) && civ.techs[t.id]?.known) forgetTech(sim, civ, t.id, `Depended on ${def.name}`);
}

/** Contact intensity between two civs (0..1+) for diffusion. */
function contactIntensity(sim: Sim, civ: Civ, other: Civ): number {
  const key = civ.id < other.id ? `${civ.id}-${other.id}` : `${other.id}-${civ.id}`;
  const rel = sim.w.relations.get(key);
  if (!rel) return 0;
  let c = 0.05;
  c += saturate(rel.trade, 2000) * 0.6;
  c += saturate(rel.border, 20) * 0.3;
  for (const tid of rel.treaties) {
    const tr = sim.w.treaties.get(tid);
    if (tr?.active && (tr.kind === 'alliance' || tr.kind === 'research' || tr.kind === 'federation')) c += 0.3;
  }
  c *= 1 + civ.caps.communication * 0.1;
  return c;
}

export function researchYearly(sim: Sim, civ: Civ): void {
  const w = sim.w;
  const rng = sim.rng;
  const rp = researchOutput(sim, civ);
  civ.researchRate = rp;
  // 1) directed research
  if (!civ.researchTarget || knows(civ, civ.researchTarget) || !TECH_BY_ID.has(civ.researchTarget)) civ.researchTarget = chooseResearch(sim, civ);
  if (civ.researchTarget) {
    const def = TECH_BY_ID.get(civ.researchTarget)!;
    if (!techAvailable(sim, civ, def)) civ.researchTarget = chooseResearch(sim, civ);
  }
  if (civ.researchTarget) {
    const def = TECH_BY_ID.get(civ.researchTarget)!;
    const st = techState(civ, def.id);
    st.progress += rp;
    if (st.progress >= effCost(def)) grantTech(sim, civ, def.id, 'research');
  }
  // 2) diffusion from contacts (catch-up is cheaper)
  const absorb = (0.3 + 0.7 * clamp01(avgEducation(sim, civ) * 2 + civ.caps.literacy * 0.5)) * (1 + civ.caps.diffusion) * (1 - 0.4 * Math.max(0, civ.personality.caution - 0.5));
  for (const oid of civ.knownCivs) {
    const other = w.civs.get(oid);
    if (!other || !other.alive) continue;
    const ci = contactIntensity(sim, civ, other);
    if (ci <= 0) continue;
    for (const id in other.techs) {
      const ot = other.techs[id];
      if (!ot.known || ot.adoption < 0.5) continue;
      const def = TECH_BY_ID.get(id);
      if (!def || knows(civ, id) || !techAvailable(sim, civ, def)) continue;
      const st = techState(civ, id);
      st.progress += effCost(def) * BALANCE.diffusionRate * ci * absorb;
      if (st.progress >= effCost(def)) grantTech(sim, civ, id, 'diffusion');
    }
  }
  // 3) serendipity
  if (rng.chance(BALANCE.serendipity * (1 + civ.personality.science))) {
    const opts = TECHS.filter((t) => techAvailable(sim, civ, t) && effCost(t) < (rp + 50) * 8);
    if (opts.length) {
      const t = rng.pick(opts);
      const st = techState(civ, t.id);
      st.progress += effCost(t) * rng.range(0.2, 0.6);
      if (st.progress >= effCost(t)) grantTech(sim, civ, t.id, 'serendipity');
    }
  }
  // 4) adoption & regression
  let changed = false;
  const investment = 0.5 + clamp01(civ.econ.investment / Math.max(1, civ.econ.gdp) * 4);
  for (const id in civ.techs) {
    const st = civ.techs[id];
    if (!st.known) continue;
    const def = TECH_BY_ID.get(id);
    if (!def) continue;
    const before = st.adoption;
    if (resourcesMet(civ, def)) {
      if (st.adoption < 1) st.adoption = Math.min(1, st.adoption + (investment * (1 + civ.caps.communication * 0.03)) / def.adoptionYears);
    } else if (st.adoption > 0) {
      st.adoption = Math.max(0, st.adoption - 0.06); // lost access to required materials
    }
    if ((before < 0.25) !== (st.adoption < 0.25) || (before < 0.5) !== (st.adoption < 0.5) || Math.abs(before - st.adoption) > 0.05) changed = true;
  }
  // 5) knowledge loss when literacy & institutions collapse
  const institutions = civ.settlements.reduce((acc, sid) => {
    const s = w.settlements.get(sid);
    return acc + (s ? s.bld[B.LIBRARY] + s.bld[B.UNIVERSITY] + s.bld[B.TEMPLE] * 0.3 : 0);
  }, 0);
  const fragile = avgEducation(sim, civ) < 0.04 && institutions < 1 && civ.stability < 0.35;
  if (fragile || civ.settlements.length === 0) {
    for (const id in civ.techs) {
      const st = civ.techs[id];
      const def = TECH_BY_ID.get(id);
      if (!st.known || !def || def.era < 3 || STARTING_TECHS.includes(id)) continue;
      if (st.adoption < 0.35 && rng.chance(BALANCE.knowledgeLoss * (def.era / 4))) forgetTech(sim, civ, id, 'Collapse of literacy and learned institutions');
      else if (rng.chance(0.1)) st.adoption = Math.max(0, st.adoption - 0.05);
    }
    changed = true;
  }
  if (changed) computeCaps(civ);
}

export function avgEducation(sim: Sim, civ: Civ): number {
  let pop = 0;
  let edu = 0;
  for (const sid of civ.settlements) {
    const s = sim.w.settlements.get(sid);
    if (!s) continue;
    pop += s.pop;
    edu += s.pop * s.education;
  }
  return pop > 0 ? edu / pop : 0;
}

/** Ids of all buildings keys referenced by techs (used by tests/tools). */
export function unlockableBuildings(): string[] {
  const set = new Set<string>();
  for (const t of TECHS) for (const b of t.unlocks?.buildings ?? []) set.add(b);
  return BUILDING_KEYS.filter((k) => set.has(k));
}
