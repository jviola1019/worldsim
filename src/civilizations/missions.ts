/**
 * NATIONAL MISSIONS: the goal a nation is pursuing right now.
 *
 * Missions arise from measured conditions (a hungry nation turns to welfare, a threatened one to
 * defense, a coastal trader to commerce, a space-capable scientific state to the stars), weighted
 * by the nation's ethos and its leader's personality, and picked with the simulation's random
 * stream. A mission has a metric measured at its start, a target and a deadline; while it runs it
 * steers research and construction strongly. It ends in success (legitimacy and stability rise) or
 * failure (they fall), recorded with the measured numbers. In god mode the player can also assign
 * a mission (assignMission); observer worlds never receive player missions.
 */
import type { Sim } from '../sim/context';
import type { Civ } from '../sim/types';
import type { TechCategory } from '../technology/types';
import type { EthosKey } from './ethos';
import { B } from './buildingTypes';
import { clamp01 } from '../core/math';
import { logEvent } from '../history/events';

export type MissionKind = 'science' | 'expansion' | 'faith' | 'trade' | 'military' | 'culture' | 'space' | 'environment' | 'welfare' | 'defense' | 'industry';

export interface Mission {
  kind: MissionKind;
  since: number;
  until: number;
  /** Metric value when the mission began, and the value that counts as success. */
  start: number;
  target: number;
  reason: string;
  /** Set by the player in god mode. */
  assigned?: boolean;
}

export interface MissionDef {
  kind: MissionKind;
  name: string;
  goal: string;
  research: Partial<Record<TechCategory, number>>;
  build: Partial<Record<number, number>>;
  affinity: Partial<Record<EthosKey, number>>;
}

export const MISSIONS: Record<MissionKind, MissionDef> = {
  science: { kind: 'science', name: 'Age of Discovery', goal: 'Raise the nation\'s knowledge by an eighth', research: { science: 1.8, computing: 1.6, medicine: 1.3 }, build: { [B.LIBRARY]: 1.8, [B.UNIVERSITY]: 1.8, [B.LAB]: 1.8, [B.SCHOOL]: 1.4 }, affinity: { technocratic: 2, atomic: 1.4 } },
  expansion: { kind: 'expansion', name: 'Manifest Frontier', goal: 'Found two new settlements', research: { transport: 1.6, maritime: 1.4, agriculture: 1.2 }, build: { [B.HARBOR]: 1.3 }, affinity: { expansionist: 2.2, militarist: 1.2 } },
  faith: { kind: 'faith', name: 'Great Awakening', goal: 'Bring one in twenty more people into the state faith', research: { culture: 1.8 }, build: { [B.TEMPLE]: 2.4, [B.MONUMENT]: 1.4 }, affinity: { theocratic: 2.5, traditionalist: 1.4 } },
  trade: { kind: 'trade', name: 'Merchant Empire', goal: 'Grow foreign trade by a seventh', research: { economy: 1.8, maritime: 1.6, transport: 1.3 }, build: { [B.HARBOR]: 2, [B.MARKET]: 1.8, [B.BANK]: 1.6, [B.WAREHOUSE]: 1.5 }, affinity: { mercantile: 2.4 } },
  military: { kind: 'military', name: 'Iron Legions', goal: 'Grow military power by three fifths', research: { military: 2, materials: 1.3 }, build: { [B.BARRACKS]: 2, [B.FORT]: 1.6, [B.MILITARY_BASE]: 2, [B.AIRBASE]: 1.6 }, affinity: { militarist: 2.4, atomic: 1.3 } },
  culture: { kind: 'culture', name: 'Golden Age', goal: 'Raise three great cultural works', research: { culture: 1.8, communication: 1.4 }, build: { [B.MONUMENT]: 2.2, [B.ARENA]: 2, [B.PARK]: 1.6, [B.TEMPLE]: 1.2 }, affinity: { artistic: 2.5, egalitarian: 1.2 } },
  space: { kind: 'space', name: 'Reach for the Stars', goal: 'Advance the space programme a full step', research: { space: 2.4, computing: 1.4, energy: 1.2 }, build: { [B.SPACEPORT]: 3, [B.LAB]: 1.5, [B.CHIP_FAB]: 1.4 }, affinity: { technocratic: 1.8, atomic: 1.8, militarist: 1.1 } },
  environment: { kind: 'environment', name: 'Green Renewal', goal: 'Cut emissions per person by a fifth', research: { energy: 1.6, agriculture: 1.2 }, build: { [B.SOLAR]: 2.4, [B.WIND]: 2.4, [B.HYDRO]: 2, [B.PARK]: 1.6, [B.POWER_FOSSIL]: 0.3 }, affinity: { ecological: 2.6, egalitarian: 1.3 } },
  welfare: { kind: 'welfare', name: 'Bread and Health', goal: 'Raise living standards by 8%', research: { agriculture: 1.6, medicine: 1.5, civic: 1.2 }, build: { [B.FARM]: 1.5, [B.HOSPITAL]: 1.8, [B.SCHOOL]: 1.3, [B.GRANARY]: 1.5 }, affinity: { egalitarian: 2, theocratic: 1.1 } },
  defense: { kind: 'defense', name: 'Shield of the Realm', goal: 'Strengthen defenses by three fifths', research: { military: 1.6, materials: 1.2 }, build: { [B.WALL]: 2, [B.FORT]: 2.2, [B.BARRACKS]: 1.5 }, affinity: { isolationist: 2, militarist: 1.4, traditionalist: 1.2 } },
  industry: { kind: 'industry', name: 'Great Leap of Industry', goal: 'Grow the economy by a third', research: { industry: 1.8, energy: 1.5, materials: 1.4 }, build: { [B.FACTORY]: 1.8, [B.STEEL_MILL]: 1.8, [B.POWER_FOSSIL]: 1.3, [B.MINE]: 1.4 }, affinity: { technocratic: 1.3, militarist: 1.2, atomic: 1.3 } },
};

/** The measured quantity a mission tracks. */
export function missionMetric(sim: Sim, civ: Civ, kind: MissionKind): number {
  switch (kind) {
    case 'science': return civ.techScore;
    case 'expansion': return civ.settlements.length;
    case 'faith': return stateFaithShare(sim, civ);
    case 'trade': return (civ.tradeExp ?? 0) + (civ.tradeImp ?? 0);
    case 'military': return civ.militaryPower;
    case 'culture': return countBuildings(sim, civ, [B.MONUMENT, B.ARENA, B.PARK, B.TEMPLE]);
    case 'space': return civ.caps.spaceTier + civ.space.stations * 0.25 + (civ.space.lunarBase ? 1 : 0) + civ.space.colonies.length;
    case 'environment': return (civ.econ.emissions / Math.max(1, civ.population)) * 1000;
    case 'welfare': return civ.econ.livingStandard;
    case 'defense': return civ.militaryPower + countBuildings(sim, civ, [B.WALL, B.FORT]) * 50;
    case 'industry': return civ.econ.gdp;
  }
}

function targetFor(kind: MissionKind, start: number): number {
  switch (kind) {
    case 'science': return start * 1.12 + 3;
    case 'expansion': return start + 2;
    case 'faith': return Math.min(1, start + 0.05);
    case 'trade': return start * 1.15 + 3;
    case 'military': return start * 1.6 + 10;
    case 'culture': return start + 3;
    case 'space': return start + 1;
    case 'environment': return start * 0.8;
    case 'welfare': return start * 1.08;
    case 'defense': return start * 1.6 + 10;
    case 'industry': return start * 1.33 + 1;
  }
}

const achieved = (kind: MissionKind, now: number, target: number) => (kind === 'environment' ? now <= target : now >= target);

function countBuildings(sim: Sim, civ: Civ, types: number[]): number {
  let n = 0;
  for (const id of civ.settlements) { const s = sim.w.settlements.get(id); if (s) for (const t of types) n += s.bld[t]; }
  return n;
}

function stateFaithShare(sim: Sim, civ: Civ): number {
  if (!civ.stateReligion) return 0;
  let f = 0, p = 0;
  for (const id of civ.settlements) {
    const s = sim.w.settlements.get(id);
    if (!s) continue;
    p += s.pop;
    f += s.pop * (s.religions.find((r) => r.id === civ.stateReligion)?.f ?? 0);
  }
  return p > 0 ? f / p : 0;
}

function atWar(sim: Sim, civ: Civ): boolean {
  for (const wr of sim.w.wars.values()) if (!wr.end && (wr.attackers.includes(civ.id) || wr.defenders.includes(civ.id))) return true;
  return false;
}

/** How pressing each mission is now (measured), before ethos weighting. */
function needs(sim: Sim, civ: Civ): Record<MissionKind, { w: number; why: string }> {
  const c = civ.caps;
  let threat = 0;
  for (const id of civ.knownCivs) { const o = sim.w.civs.get(id); if (o?.alive && o.militaryPower > civ.militaryPower * 1.3) threat++; }
  const coastal = civ.settlements.filter((id) => sim.w.settlements.get(id)?.coastal).length / Math.max(1, civ.settlements.length);
  const pollution = (civ.econ.emissions / Math.max(1, civ.population)) * 1000;
  const war = atWar(sim, civ);
  return {
    science: { w: 0.6 + civ.personality.science, why: 'An inquisitive leadership' },
    expansion: { w: civ.era <= 8 ? 0.5 + civ.personality.expansion : 0.15, why: 'Open land beyond the frontier' },
    faith: { w: civ.stateReligion ? 0.3 + civ.inst.religiousAuthority : 0, why: 'A state church seeking converts' },
    trade: { w: ((civ.tradeExp ?? 0) + (civ.tradeImp ?? 0) > 0 ? 0.4 : 0.05) + coastal * 0.6 + civ.personality.trade * 0.4, why: `${Math.round(coastal * 100)}% of its towns are ports` },
    military: { w: (war ? 1.2 : 0.2) + civ.personality.aggression * 0.6, why: war ? 'A war to win' : 'Ambitious generals' },
    culture: { w: 0.3 + civ.inst.liberties * 0.4, why: 'Peace and prosperity invite the arts' },
    space: { w: c.spaceTier >= 1 ? 1 + civ.personality.science : 0, why: 'Rockets that can reach orbit' },
    environment: { w: c.pollutionControl > 0 ? Math.min(2, pollution * 0.5) * (0.5 + civ.inst.participation) : 0, why: `Emissions of ${pollution.toFixed(1)} per thousand people` },
    welfare: { w: civ.econ.livingStandard < 1 ? 1.6 : 0.3, why: `Living standard ${civ.econ.livingStandard.toFixed(2)}` },
    defense: { w: threat * 0.6 + (war ? 0.5 : 0), why: `${threat} stronger neighbour${threat === 1 ? '' : 's'}` },
    industry: { w: c.industry > 0 ? 0.8 : 0.1, why: 'Factories to build' },
  };
}

export function missionsYearly(sim: Sim, civ: Civ): void {
  if (!civ.alive || !civ.settlements.length) return;
  const m = civ.mission;
  if (m) {
    const now = missionMetric(sim, civ, m.kind);
    if (achieved(m.kind, now, m.target)) return endMission(sim, civ, true, now);
    if (sim.year >= m.until) return endMission(sim, civ, false, now);
    return;
  }
  if (civ.era < 2 || sim.year - (civ.missionLog?.at(-1)?.end ?? -99) < 3) return; // a breath between missions
  const n = needs(sim, civ);
  const kinds = Object.keys(MISSIONS) as MissionKind[];
  const ethos = civ.ethos?.key;
  const weights = kinds.map((k) => Math.max(0, n[k].w) * (ethos ? MISSIONS[k].affinity[ethos] ?? 1 : 1));
  const pick = kinds[Math.max(0, sim.rng.weighted(weights))];
  startMission(sim, civ, pick, n[pick].why, false);
}

export function startMission(sim: Sim, civ: Civ, kind: MissionKind, reason: string, assigned: boolean): void {
  const start = missionMetric(sim, civ, kind);
  civ.mission = { kind, since: sim.year, until: sim.year + 25 + (civ.era >= 9 ? 0 : 10), start, target: targetFor(kind, start), reason, assigned: assigned || undefined };
  const cap = sim.w.settlements.get(civ.capital);
  logEvent(sim, {
    type: 'mission_start', cat: 'politics', title: `${civ.name} launched "${MISSIONS[kind].name}": ${MISSIONS[kind].goal.toLowerCase()}`,
    civs: [civ.id], x: cap?.x ?? -1, y: cap?.y ?? -1, importance: 2,
    causes: [{ label: assigned ? 'Decreed by a higher power' : reason, weight: 1 }],
  });
}

/** God mode: set a nation's mission (refused in observer worlds). */
export function assignMission(sim: Sim, civ: Civ, kind: MissionKind): boolean {
  if (sim.w.meta.settings.observer || !civ.alive) return false;
  civ.mission = undefined;
  startMission(sim, civ, kind, 'Decreed by a higher power', true);
  return true;
}

function endMission(sim: Sim, civ: Civ, ok: boolean, now: number): void {
  const m = civ.mission!;
  const def = MISSIONS[m.kind];
  (civ.missionLog ??= []).push({ kind: m.kind, start: m.since, end: sim.year, ok });
  if (civ.missionLog.length > 30) civ.missionLog.shift();
  civ.mission = undefined;
  civ.legitimacy = clamp01(civ.legitimacy + (ok ? 0.05 : -0.03));
  civ.stability = clamp01(civ.stability + (ok ? 0.03 : -0.02));
  const cap = sim.w.settlements.get(civ.capital);
  const fmt = (x: number) => (Math.abs(x) >= 100 ? Math.round(x).toLocaleString('en-US') : x.toFixed(2));
  logEvent(sim, {
    type: ok ? 'mission_success' : 'mission_failed', cat: 'politics',
    title: ok ? `${civ.name} achieved "${def.name}"` : `${civ.name} fell short of "${def.name}"`,
    civs: [civ.id], x: cap?.x ?? -1, y: cap?.y ?? -1, importance: ok ? 3 : 2,
    causes: [{ label: `Measured ${fmt(m.start)} → ${fmt(now)} (target ${fmt(m.target)}) over ${sim.year - m.since} years`, weight: 1 }],
  });
}

export function missionResearchMult(civ: Civ, category: TechCategory): number {
  return civ.mission ? MISSIONS[civ.mission.kind].research[category] ?? 1 : 1;
}

export function missionBuildMult(civ: Civ, type: number): number {
  return civ.mission ? MISSIONS[civ.mission.kind].build[type] ?? 1 : 1;
}
