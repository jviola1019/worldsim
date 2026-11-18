/**
 * How civilizations end.
 *
 * Every fallen civilization gets a structured `Civ.ending` (type, year, recorded causes, absorber).
 * Endings are never rolled as such: they come from mechanisms.
 *  - DIRECT endings end the state outright: conquest, civil war, federation, cultural assimilation,
 *    fragmentation, economic collapse and AI takeover. The mechanism passes its type and causes.
 *  - DEPOPULATION endings: every death source also adds typed EXISTENTIAL PRESSURE to the civilization
 *    (nuclear war, famine, nuclear winter, engineered pandemic...). Pressure decays 10% a year, so when
 *    the last people die out the dominant *recent* pressure is the ending and the top pressures are its
 *    recorded causes.
 * Assimilation also lives here: a small, peaceful state whose people already share a much larger
 * neighbour's culture can join it (and a shrunken state in demographic collapse can be absorbed).
 */
import type { Sim } from '../sim/context';
import type { Cause, Civ, CivEnding, EndingType, Settlement, WorldEndings } from '../sim/types';
import { clamp01 } from '../core/math';
import { getRelation } from './knowledge';

export interface EndingDef {
  label: string;
  /** Can happen in a Realistic (observer) world. */
  realistic: boolean;
  /** Fictional threat: god mode only. */
  godOnly?: boolean;
}

export const ENDINGS: Record<EndingType, EndingDef> = {
  conquest: { label: 'Conquered and annexed', realistic: true },
  civil_war: { label: 'Lost a civil war', realistic: true },
  union: { label: 'Joined a federal union', realistic: true },
  assimilation: { label: 'Absorbed by a neighbouring culture', realistic: true },
  fragmentation: { label: 'Fragmented into successor states', realistic: true },
  economic_collapse: { label: 'Economic and systemic collapse', realistic: true },
  war: { label: 'Destroyed by war', realistic: true },
  nuclear_war: { label: 'Nuclear war', realistic: true },
  nuclear_winter: { label: 'Nuclear winter', realistic: true },
  famine: { label: 'Famine', realistic: true },
  ecological_collapse: { label: 'Ecological collapse', realistic: true },
  climate_runaway: { label: 'Runaway climate change', realistic: true },
  pandemic: { label: 'Pandemic', realistic: true },
  engineered_pandemic: { label: 'Engineered pandemic', realistic: true },
  infertility: { label: 'Infertility pandemic', realistic: true },
  demographic_collapse: { label: 'Demographic collapse', realistic: true },
  asteroid: { label: 'Asteroid impact', realistic: true },
  supervolcano: { label: 'Supervolcanic eruption', realistic: true },
  cosmic: { label: 'Cosmic catastrophe (superflare or gamma-ray burst)', realistic: true },
  disaster: { label: 'Natural disasters', realistic: true },
  ai_takeover: { label: 'AI takeover', realistic: true },
  grey_goo: { label: 'Runaway nanotechnology', realistic: true },
  dispersal: { label: 'Its last people died out or dispersed', realistic: true },
  monsters: { label: 'Destroyed by monsters', realistic: false },
  zombies: { label: 'Zombie apocalypse', realistic: false, godOnly: true },
  ghouls: { label: 'Overrun by ghouls', realistic: false, godOnly: true },
  blight: { label: 'The Creeping Blight', realistic: false, godOnly: true },
};

export const ENDING_TYPES = Object.keys(ENDINGS) as EndingType[];

/** World-level war/catastrophe state, created on first use (older saves lack it). */
export function worldEndings(sim: Sim): WorldEndings {
  return (sim.w.endings ??= {
    techLead: { civ: 0, since: sim.year, changes: 0, history: [] },
    chemBan: 0,
    lastNuclearUse: 0,
    coolingSource: 'supervolcano',
    uv: 0,
    log: [],
    cure: {},
    goo: [],
  });
}

/** Record a catastrophe in the world log (bounded). */
export function logCatastrophe(sim: Sim, type: string, x: number, y: number): void {
  const e = worldEndings(sim);
  e.log.push({ year: sim.year, type, x, y });
  if (e.log.length > 200) e.log.splice(0, e.log.length - 200);
}

/** Add typed existential pressure (people lost to this cause) to a civilization. */
export function addPressure(sim: Sim, civId: number, type: EndingType, amount: number, cause?: string): void {
  if (!civId || !(amount > 0) || !Number.isFinite(amount)) return;
  const civ = sim.w.civs.get(civId);
  if (!civ) return;
  const p = (civ.pressure ??= {});
  p[type] = (p[type] ?? 0) + amount;
  if (cause) (civ.pressureCause ??= {})[type] = cause;
}

/** Yearly decay of pressure (recent causes dominate). */
export function decayPressure(civ: Civ): void {
  const p = civ.pressure;
  if (!p) return;
  for (const k of Object.keys(p) as EndingType[]) {
    const v = (p[k] ?? 0) * 0.9;
    if (v < 0.5) delete p[k];
    else p[k] = v;
  }
}

/** The dominant recent pressure and the top pressures as causes (for a depopulation ending). */
export function inferEnding(civ: Civ): { type: EndingType; causes: Cause[] } {
  const p = civ.pressure ?? {};
  const list = (Object.keys(p) as EndingType[]).map((k) => ({ k, v: p[k] ?? 0 })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  if (!list.length) return { type: 'dispersal', causes: [{ label: 'Emigration, abandonment and natural decline', weight: 1 }] };
  const causes = list.slice(0, 4).map(({ k, v }) => ({ label: civ.pressureCause?.[k] ?? ENDINGS[k].label, weight: v }));
  return { type: list[0].k, causes };
}

/** Build the structured ending record. */
export function makeEnding(sim: Sim, type: EndingType, causes: Cause[] | undefined, by?: Civ): CivEnding {
  const c = causes && causes.length ? causes : [{ label: ENDINGS[type].label, weight: 1 }];
  const total = c.reduce((a, x) => a + Math.max(0, x.weight), 0) || 1;
  return { type, year: sim.year, causes: c.map((x) => ({ label: x.label, weight: Math.round((Math.max(0, x.weight) / total) * 1000) / 1000 })), by: by?.id ?? 0 };
}

/**
 * Attribute famine deaths in a settlement to their underlying cause: strong global cooling (nuclear
 * winter, impact or volcanic winter, ozone loss), runaway heat, degraded land, a fictional blight, or
 * plain famine.
 */
export function famineType(sim: Sim, s: Settlement): EndingType {
  const w = sim.w;
  if (s.horror?.kind === 'blight' && s.horror.level > 0.1) return 'blight';
  const cooling = globalCooling(w.climate);
  const e = w.endings;
  if (cooling > 1 && e) return e.coolingSource;
  if (cooling > 1) return 'supervolcano';
  if (e && e.uv > 0.2) return 'cosmic';
  if (w.climate.anomaly > 3) return 'climate_runaway';
  if ((s.ecoStress ?? 0) > 0.55) return 'ecological_collapse';
  return 'famine';
}

/** Stratospheric soot cooling (°C): ~1.7 at 5 units, ~8.6 at 150 (shape of published nuclear-winter studies). */
export function sootCooling(soot: number | undefined): number {
  return soot && soot > 0 ? 2.5 * Math.log(1 + soot / 5) : 0;
}

/** Total global cooling from aerosols and soot (°C). */
export function globalCooling(c: { aerosol: number; soot?: number }): number {
  return Math.max(0, c.aerosol) + sootCooling(c.soot);
}

/** Crop/forage yield multiplier from global cooling and UV stress (nuclear/impact/volcanic winter). */
export function coolingYieldMult(sim: Sim): number {
  const cooling = globalCooling(sim.w.climate);
  const uv = sim.w.endings?.uv ?? 0;
  return Math.max(0.08, 1 - 0.09 * Math.max(0, cooling - 0.3)) * (1 - 0.5 * clamp01(uv));
}

/** Land degradation around a settlement: bare and polluted land relative to what it could carry. */
export function ecoStressOf(sim: Sim, s: Settlement): number {
  const m = sim.w.map;
  let n = 0;
  let stress = 0;
  m.forRadius(s.x, s.y, Math.max(2, s.radius), (i) => {
    if (m.isWater(i)) return;
    n++;
    stress += m.pollution[i] / 255 * 0.6 + (m.fert[i] < 20 && m.veg[i] < 10 ? 0.6 : 0);
  });
  return n ? clamp01(stress / n) : 0;
}

/**
 * Peaceful absorption (yearly, per small civ): a small state at peace whose settlements mostly share
 * a much larger neighbour's culture (or language family), with good relations, joins it. A shrunken
 * state dominated by demographic-collapse pressure can be absorbed the same way.
 */
export function absorptionCandidate(sim: Sim, civ: Civ): { by: Civ; type: EndingType; causes: Cause[] } | null {
  const w = sim.w;
  if (!civ.alive || civ.settlements.length === 0 || civ.settlements.length > 3 || civ.overlord) return null;
  // share of the people who belong to each culture
  const cult = new Map<number, number>();
  let pop = 0;
  for (const sid of civ.settlements) {
    const s = w.settlements.get(sid);
    if (!s) continue;
    pop += s.pop;
    for (const c of s.cultures) cult.set(c.id, (cult.get(c.id) ?? 0) + c.f * s.pop);
  }
  if (pop <= 0) return null;
  const p = civ.pressure ?? {};
  const demo = (p.demographic_collapse ?? 0) > 0 && (Object.keys(p) as EndingType[]).every((k) => (p[k] ?? 0) <= (p.demographic_collapse ?? 0));
  const shrunk = civ.peakPop > 0 && pop < civ.peakPop * 0.1;
  let best: { by: Civ; score: number; share: number } | null = null;
  for (const oid of civ.knownCivs) {
    const o = w.civs.get(oid);
    if (!o || !o.alive || o.population < pop * 6 || o.settlements.length === 0) continue;
    const rel = getRelation(sim, civ.id, oid);
    if (!rel || rel.opinion < 40 || rel.border <= 0) continue;
    let share = (cult.get(o.cultureId) ?? 0) / pop;
    const oc = w.cultures.get(o.cultureId);
    const mine = w.cultures.get(civ.cultureId);
    if (oc && mine && w.languages.get(oc.languageId)?.rootId === w.languages.get(mine.languageId)?.rootId) share = Math.max(share, 0.5);
    const score = share + rel.opinion / 200 + (o.caps.culturalOutput + o.caps.mediaReach) * 0.1;
    if ((share >= 0.6 || (demo && shrunk)) && (!best || score > best.score)) best = { by: o, score, share };
  }
  if (!best) return null;
  if (demo && shrunk) {
    return { by: best.by, type: 'demographic_collapse', causes: [
      { label: `Population fell to ${Math.round((pop / civ.peakPop) * 100)}% of its peak`, weight: 0.5 },
      { label: civ.pressureCause?.demographic_collapse ?? 'Births far below deaths for generations', weight: 0.4 },
      { label: `Joined the larger ${best.by.adjective} state`, weight: 0.1 },
    ] };
  }
  return { by: best.by, type: 'assimilation', causes: [
    { label: `${Math.round(best.share * 100)}% of its people shared ${best.by.adjective} culture`, weight: best.share },
    { label: `Friendly relations with ${best.by.name}`, weight: 0.3 },
    { label: `A much larger neighbour (${Math.round(best.by.population / Math.max(1, pop))}× its population)`, weight: 0.2 },
  ] };
}
