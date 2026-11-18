/**
 * ETHOS: what a society values, and therefore how it works.
 *
 * Two nations at the same technology level can be very different places to live: a 1940s
 * atomic-age society that puts reactors in everything and builds bunkers, a priest-ruled realm, a
 * merchant republic, a frugal ecological commonwealth. The ethos is DERIVED each year from measured
 * inputs (the culture's values, institutions, leadership personality, the nation's situation and
 * recent history) and is sticky: it changes only when another profile clearly dominates for long
 * enough, or abruptly after a revolution. It then steers what the nation researches, how fast it
 * adopts some inventions, what it builds, how it spends, which policies it prefers, and how its
 * leaders lean (personality drifts toward the ethos). Effects are multipliers on existing decisions,
 * so every outcome still comes from the simulation, not from a script.
 */
import type { Sim } from '../sim/context';
import type { Civ, Budget, Personality, Institutions } from '../sim/types';
import type { TechCategory } from '../technology/types';
import { B } from './buildingTypes';
import { clamp, clamp01 } from '../core/math';
import { logEvent } from '../history/events';

export type EthosKey =
  | 'technocratic' | 'theocratic' | 'militarist' | 'mercantile' | 'egalitarian' | 'ecological'
  | 'isolationist' | 'expansionist' | 'traditionalist' | 'artistic' | 'atomic';

export interface CivEthos {
  key: EthosKey;
  since: number;
  /** How clearly it dominates the alternatives (0..1). */
  strength: number;
}

interface EthosDef {
  key: EthosKey;
  name: string;
  /** One line shown in the nation overview. */
  blurb: string;
  research: Partial<Record<TechCategory, number>>;
  build: Partial<Record<number, number>>;
  budget: Partial<Record<keyof Budget, number>>;
  /** Personality the nation's leaders drift toward. */
  lean: Partial<Personality>;
  /** Adoption speed multiplier for specific inventions. */
  adoption?: (techId: string) => number;
}

const NUCLEAR = new Set(['nuclear_fission', 'nuclear_power', 'nuclear_weapons', 'rocketry', 'fusion_power']);
const DIGITAL_GREEN = new Set(['internet', 'mobile_telecom', 'machine_learning', 'solar_power', 'wind_power', 'smart_grids', 'grid_storage', 'lithium_batteries']);
const SECULAR = new Set(['scientific_method', 'modern_contraception', 'family_planning', 'evolution_theory']);
const GREEN = new Set(['solar_power', 'wind_power', 'grid_storage', 'smart_grids', 'carbon_capture']);

export const ETHOS: Record<EthosKey, EthosDef> = {
  technocratic: {
    key: 'technocratic', name: 'Technocratic', blurb: 'Ruled by experts; laboratories and universities are its cathedrals.',
    research: { science: 1.6, computing: 1.6, medicine: 1.2, space: 1.3 }, build: { [B.LAB]: 1.8, [B.UNIVERSITY]: 1.6, [B.SCHOOL]: 1.3, [B.DATA_CENTER]: 1.5 },
    budget: { research: 0.05, education: 0.03 }, lean: { science: 0.9, caution: 0.55 },
  },
  theocratic: {
    key: 'theocratic', name: 'Theocratic', blurb: 'Faith orders law, learning and daily life.',
    research: { culture: 1.6, civic: 1.2, science: 0.75 }, build: { [B.TEMPLE]: 2, [B.MONUMENT]: 1.4 },
    budget: { religion: 0.07 }, lean: { piety: 0.9 }, adoption: (t) => (SECULAR.has(t) ? 0.6 : 1),
  },
  militarist: {
    key: 'militarist', name: 'Militarist', blurb: 'The army comes first; glory is won on the battlefield.',
    research: { military: 1.8, materials: 1.2, industry: 1.2 }, build: { [B.BARRACKS]: 1.8, [B.FORT]: 1.6, [B.MILITARY_BASE]: 1.8, [B.AIRBASE]: 1.6, [B.NAVAL_BASE]: 1.6, [B.SILO]: 1.8 },
    budget: { military: 0.1 }, lean: { aggression: 0.85, expansion: 0.7 },
  },
  mercantile: {
    key: 'mercantile', name: 'Mercantile', blurb: 'A nation of traders: ports, banks and open sea lanes.',
    research: { economy: 1.6, maritime: 1.6, transport: 1.3 }, build: { [B.HARBOR]: 1.8, [B.MARKET]: 1.6, [B.BANK]: 1.6, [B.WAREHOUSE]: 1.4, [B.OFFICE]: 1.3 },
    budget: { infrastructure: 0.04 }, lean: { trade: 0.9, aggression: 0.3 },
  },
  egalitarian: {
    key: 'egalitarian', name: 'Egalitarian', blurb: 'Fair shares: schools, clinics and a voice for everyone.',
    research: { medicine: 1.4, civic: 1.4 }, build: { [B.SCHOOL]: 1.5, [B.HOSPITAL]: 1.6, [B.PARK]: 1.4 },
    budget: { welfare: 0.06, health: 0.04, education: 0.03 }, lean: { aggression: 0.3, caution: 0.5 },
  },
  ecological: {
    key: 'ecological', name: 'Ecological', blurb: 'Lives within the land: green power, parks and frugal growth.',
    research: { agriculture: 1.2, energy: 1.2, industry: 0.8 }, build: { [B.SOLAR]: 2.2, [B.WIND]: 2.2, [B.HYDRO]: 1.8, [B.PARK]: 1.6, [B.POWER_FOSSIL]: 0.4, [B.FACTORY]: 0.8 },
    budget: { health: 0.02 }, lean: { aggression: 0.25, expansion: 0.35 }, adoption: (t) => (GREEN.has(t) ? 1.5 : 1),
  },
  isolationist: {
    key: 'isolationist', name: 'Isolationist', blurb: 'Self-reliant and wary of outsiders; walls before harbours.',
    research: { maritime: 0.6, economy: 0.8, military: 1.2 }, build: { [B.WALL]: 1.5, [B.FORT]: 1.4, [B.HARBOR]: 0.6 },
    budget: { military: 0.03 }, lean: { trade: 0.15, caution: 0.85, expansion: 0.3 },
  },
  expansionist: {
    key: 'expansionist', name: 'Expansionist', blurb: 'Always the next valley, the next coast, the next frontier.',
    research: { transport: 1.4, maritime: 1.3, agriculture: 1.2 }, build: { [B.HARBOR]: 1.3, [B.STATION]: 1.3 },
    budget: { infrastructure: 0.05 }, lean: { expansion: 0.9 },
  },
  traditionalist: {
    key: 'traditionalist', name: 'Traditionalist', blurb: 'The old ways are proven ways; change comes slowly.',
    research: { culture: 1.3, civic: 1.1 }, build: { [B.TEMPLE]: 1.3, [B.MONUMENT]: 1.3, [B.PALACE]: 1.3 },
    budget: { religion: 0.02 }, lean: { caution: 0.7 }, adoption: () => 0.75, // wary but not closed: closing trade (caution > 0.8) is the isolationist's choice
  },
  artistic: {
    key: 'artistic', name: 'Artistic', blurb: 'Festivals, stadiums and monuments; prestige through culture.',
    research: { culture: 1.6, communication: 1.3 }, build: { [B.ARENA]: 1.8, [B.MONUMENT]: 1.6, [B.PARK]: 1.6 },
    budget: { education: 0.02 }, lean: { aggression: 0.3 },
  },
  atomic: {
    key: 'atomic', name: 'Atomic-age', blurb: 'Locked in the atomic dream: reactors, rockets, bunkers and chrome; slow to go digital.',
    research: { energy: 1.6, military: 1.4, space: 1.3, computing: 0.6 }, build: { [B.POWER_NUCLEAR]: 3, [B.SILO]: 2, [B.FORT]: 1.4, [B.SOLAR]: 0.5, [B.WIND]: 0.5 },
    budget: { military: 0.05, research: 0.02 }, lean: { caution: 0.7, aggression: 0.6 },
    adoption: (t) => (NUCLEAR.has(t) ? 1.6 : DIGITAL_GREEN.has(t) ? 0.55 : 1),
  },
};

const has = (civ: Civ, t: string) => (civ.techs[t]?.adoption ?? 0) >= 0.5;

/** How well each ethos fits this nation now (measured inputs only). */
export function ethosScores(sim: Sim, civ: Civ): Record<EthosKey, number> {
  const cu = sim.w.cultures.get(civ.cultureId)?.values;
  const v = cu ?? { tradition: 0, collectivism: 0, martial: 0, hierarchy: 0, mercantile: 0, seafaring: 0, piety: 0, nature: 0 };
  const i = civ.inst, p = civ.personality, c = civ.caps;
  let coastal = 0, n = 0, wars = 0;
  for (const id of civ.settlements) { const s = sim.w.settlements.get(id); if (s) { n++; if (s.coastal) coastal++; } }
  for (const wr of sim.w.wars.values()) if ((wr.attackers.includes(civ.id) || wr.defenders.includes(civ.id)) && sim.year - wr.start < 60) wars++;
  const coast = n ? coastal / n : 0;
  const pollution = (civ.econ.emissions / Math.max(1, civ.population)) * 1000;
  const nuclearAge = has(civ, 'nuclear_power') || has(civ, 'nuclear_weapons');
  return {
    technocratic: p.science * 0.7 + Math.min(0.4, c.research * 0.06) + i.techGovernance * 0.8 + (1 - i.religiousAuthority) * 0.35 - v.tradition * 0.3 - 0.25,
    theocratic: (v.piety + 1) * 0.35 + i.religiousAuthority * 0.8 + (civ.stateReligion ? 0.15 : 0) + p.piety * 0.25 - 0.5,
    militarist: (v.martial + 1) * 0.35 + i.militaryInfluence * 0.5 + p.aggression * 0.45 + Math.min(0.35, wars * 0.04) - 0.4,
    mercantile: (v.mercantile + 1) * 0.35 + (v.seafaring + 1) * 0.2 + p.trade * 0.6 + coast * 0.5 + c.markets * 0.15 - 0.3,
    egalitarian: (v.collectivism + 1) * 0.2 + i.participation * 0.5 + i.welfare * 0.4 + i.liberties * 0.3 - (v.hierarchy + 1) * 0.2 - 0.2,
    ecological: (v.nature + 1) * 0.35 + (c.pollutionControl > 0 ? Math.min(0.5, pollution * 0.15) * i.participation : 0) + Math.min(0.3, Math.max(0, sim.w.climate.anomaly - 1.5) * 0.1) - 0.3,
    isolationist: (v.tradition + 1) * 0.25 + p.caution * 0.5 - p.trade * 0.4 + (civ.knownCivs.length <= 1 ? 0.3 : 0) - 0.15,
    expansionist: p.expansion * 0.7 + (civ.era <= 7 ? 0.25 : 0) - 0.15,
    traditionalist: (v.tradition + 1) * 0.35 + (v.hierarchy + 1) * 0.15 + i.hereditary * 0.4 - 0.3,
    artistic: c.culturalOutput * 0.15 + (1 - (v.martial + 1) / 2) * 0.45 + i.liberties * 0.25 - 0.15,
    // the atomic dream needs the atom, and a centralized state that bets on it
    atomic: nuclearAge ? 0.3 + i.centralization * 0.4 + i.militaryInfluence * 0.3 + p.science * 0.2 + (civ.ethos?.key === 'atomic' ? 0.3 : 0) : -9,
  };
}

/**
 * Identity is partly relative: a nation sees itself as "the traders" or "the faithful" by
 * comparison with the nations it knows. Each archetype's fit is measured against the average fit
 * of the other living nations, so neighbours with similar conditions still differ in what is
 * distinctive about them.
 */
function relativeScores(sim: Sim, civ: Civ): Record<EthosKey, number> {
  const own = ethosScores(sim, civ);
  const others = [...sim.w.civs.values()].filter((o) => o.alive && o.settlements.length && o.id !== civ.id);
  if (!others.length) return own;
  const mean = {} as Record<EthosKey, number>;
  for (const k of Object.keys(own) as EthosKey[]) mean[k] = 0;
  for (const o of others) {
    const sc = ethosScores(sim, o);
    for (const k of Object.keys(own) as EthosKey[]) mean[k] += Math.max(-1, sc[k]) / others.length;
  }
  const out = {} as Record<EthosKey, number>;
  for (const k of Object.keys(own) as EthosKey[]) out[k] = own[k] - 0.7 * mean[k];
  return out;
}

/** Yearly: drift toward the best-fitting ethos (sticky), and leaders lean toward it. */
export function ethosYearly(sim: Sim, civ: Civ): void {
  if (!civ.alive || !civ.settlements.length) return;
  const scores = relativeScores(sim, civ);
  const keys = Object.keys(scores) as EthosKey[];
  keys.sort((a, b) => scores[b] - scores[a]);
  const best = keys[0], second = keys[1];
  const cur = civ.ethos;
  const margin = scores[best] - scores[second];
  if (!cur) {
    civ.ethos = { key: best, since: sim.year, strength: clamp01(margin * 2 + 0.3) };
  } else if (best !== cur.key) {
    const lead = scores[best] - (scores[cur.key] ?? -9);
    // hysteresis: a clear lead, sustained by time in office (regime changes reset the clock)
    if (lead > 0.18 && (sim.year - cur.since > 30 || civ.regimeAge < 2)) {
      const old = ETHOS[cur.key].name;
      civ.ethos = { key: best, since: sim.year, strength: clamp01(margin * 2 + 0.3) };
      const capital = sim.w.settlements.get(civ.capital);
      logEvent(sim, {
        type: 'ethos_change', cat: 'culture', title: `${civ.name} turned from ${old.toLowerCase()} to ${ETHOS[best].name.toLowerCase()} values`,
        civs: [civ.id], x: capital?.x ?? -1, y: capital?.y ?? -1, importance: 3,
        causes: topCauses(sim, civ, best),
      });
    } else cur.strength = clamp01(cur.strength * 0.95 + clamp01(margin * 2 + 0.3) * 0.05);
  } else cur.strength = clamp01(cur.strength * 0.9 + clamp01(margin * 2 + 0.3) * 0.1);
  // leaders and policy lean toward the ethos
  const def = ETHOS[civ.ethos!.key];
  const k = 0.04 * (0.5 + civ.ethos!.strength);
  for (const [trait, target] of Object.entries(def.lean) as [keyof Personality, number][]) civ.personality[trait] = clamp01(civ.personality[trait] + (target - civ.personality[trait]) * k);
}

/** Policies the ethos insists on (applied after the ordinary yearly policy decisions). */
export function ethosPolicies(civ: Civ): void {
  const k = civ.ethos?.key;
  if (k === 'mercantile') civ.policies.trade = 'free';
  if (k === 'isolationist') { civ.policies.trade = 'autarky'; civ.policies.migration = 'closed'; }
  if (k === 'ecological' && civ.caps.pollutionControl > 0) civ.policies.environment = 'strict';
  if (k === 'theocratic' && civ.policies.tolerance === 'tolerant' && civ.stateReligion) civ.policies.tolerance = 'state_faith';
}

function topCauses(sim: Sim, civ: Civ, key: EthosKey) {
  const i = civ.inst, p = civ.personality;
  const all: { label: string; weight: number }[] = [
    { label: `Religious authority ${(i.religiousAuthority * 100).toFixed(0)}%`, weight: key === 'theocratic' ? i.religiousAuthority : 0 },
    { label: `Military influence ${(i.militaryInfluence * 100).toFixed(0)}%`, weight: key === 'militarist' || key === 'atomic' ? i.militaryInfluence : 0 },
    { label: `Scientific bent of its leaders ${(p.science * 100).toFixed(0)}%`, weight: key === 'technocratic' || key === 'atomic' ? p.science : 0 },
    { label: `Trading spirit ${(p.trade * 100).toFixed(0)}%`, weight: key === 'mercantile' ? p.trade : 0 },
    { label: `Participation ${(i.participation * 100).toFixed(0)}%`, weight: key === 'egalitarian' ? i.participation : 0 },
    { label: `Climate warming ${sim.w.climate.anomaly.toFixed(1)}°C`, weight: key === 'ecological' ? Math.max(0.1, sim.w.climate.anomaly / 5) : 0 },
    { label: `Caution of its leaders ${(p.caution * 100).toFixed(0)}%`, weight: key === 'isolationist' || key === 'traditionalist' ? p.caution : 0 },
    { label: `Drive to expand ${(p.expansion * 100).toFixed(0)}%`, weight: key === 'expansionist' ? p.expansion : 0 },
    { label: `Centralization ${(i.centralization * 100).toFixed(0)}%`, weight: key === 'atomic' ? i.centralization : 0 },
    { label: `Cultural output`, weight: key === 'artistic' ? 0.5 : 0 },
  ];
  return all.filter((c) => c.weight > 0).slice(0, 3);
}

// ---------------------------------------------------------------- effects read by other systems

export function ethosResearchMult(civ: Civ, category: TechCategory): number {
  const e = civ.ethos;
  if (!e) return 1;
  const m = ETHOS[e.key].research[category] ?? 1;
  return 1 + (m - 1) * (0.5 + e.strength * 0.5);
}

export function ethosAdoptionMult(civ: Civ, techId: string): number {
  const e = civ.ethos;
  const f = e ? ETHOS[e.key].adoption : undefined;
  return f ? clamp(1 + (f(techId) - 1) * (0.5 + e!.strength * 0.5), 0.3, 2) : 1;
}

export function ethosBuildMult(civ: Civ, type: number): number {
  const e = civ.ethos;
  if (!e) return 1;
  const m = ETHOS[e.key].build[type] ?? 1;
  return 1 + (m - 1) * (0.5 + e.strength * 0.5);
}

export function ethosBudget(civ: Civ, t: Record<keyof Budget, number>): void {
  const e = civ.ethos;
  if (!e) return;
  for (const [k, add] of Object.entries(ETHOS[e.key].budget) as [keyof Budget, number][]) t[k] += add * (0.5 + e.strength * 0.5);
}

/** Institutions each ethos wants: an extra voice in institutional drift (government.ts). */
const IDEAL: Record<EthosKey, Partial<Institutions>> = {
  technocratic: { techGovernance: 0.85, ruleOfLaw: 0.8, religiousAuthority: 0.1 },
  theocratic: { religiousAuthority: 0.9, liberties: 0.3, hereditary: 0.6 },
  militarist: { militaryInfluence: 0.85, centralization: 0.8, participation: 0.25 },
  mercantile: { liberties: 0.75, stateEconomy: 0.1, ruleOfLaw: 0.85 },
  egalitarian: { participation: 0.9, welfare: 0.9, liberties: 0.8, hereditary: 0 },
  ecological: { federalism: 0.75, welfare: 0.6, participation: 0.7 },
  isolationist: { centralization: 0.7, liberties: 0.35, militaryInfluence: 0.55 },
  expansionist: { centralization: 0.65, militaryInfluence: 0.55 },
  traditionalist: { hereditary: 0.85, religiousAuthority: 0.6, participation: 0.2 },
  artistic: { liberties: 0.8, federalism: 0.6 },
  atomic: { centralization: 0.8, stateEconomy: 0.65, militaryInfluence: 0.6, techGovernance: 0.5 },
};

export function ethosIdeal(civ: Civ): { ideal: Partial<Institutions>; power: number } | undefined {
  const e = civ.ethos;
  return e ? { ideal: IDEAL[e.key], power: 0.35 * (0.4 + e.strength) } : undefined;
}
