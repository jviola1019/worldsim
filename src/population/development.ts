/**
 * Character development over a lifetime (notable persons only).
 *
 * Skills move toward a personal potential set by genes, innate traits and the
 * civilization's education level (`literacy` capability). Growth is fastest
 * in youth, slows in middle age and declines in old age (martial skill first).
 * Practice in a role (ruler, general, scholar...) adds experience to the
 * matching skills. Life events (battles, wars, losses, epidemics, long reigns)
 * add stress or grant acquired traits, and are written to the person's deed log
 * so biographies show causes, not just outcomes.
 *
 * Rates are stylized game-design choices, not empirical estimates.
 */
import type { Sim } from '../sim/context';
import type { Civ, Person } from '../sim/types';
import { clamp, clamp01 } from '../core/math';
import { TRAIT_BY_KEY } from './traits';
import { atWar } from '../civilizations/urban';

export type SkillKey = 'admin' | 'military' | 'diplomacy' | 'learning';
const SKILLS: SkillKey[] = ['admin', 'military', 'diplomacy', 'learning'];

/** Skills a role practises, with yearly experience weight. */
const PRACTICE: Record<string, Partial<Record<SkillKey, number>>> = {
  ruler: { admin: 1, diplomacy: 0.7 },
  chief: { admin: 0.6, military: 0.5, diplomacy: 0.4 },
  heir: { admin: 0.5, learning: 0.4, military: 0.3 },
  consort: { diplomacy: 0.6 },
  general: { military: 1.2 },
  scholar: { learning: 1.2 },
  prophet: { learning: 0.5, diplomacy: 0.8 },
  religious_leader: { learning: 0.6, diplomacy: 0.6 },
  merchant: { diplomacy: 0.7, admin: 0.5 },
  explorer: { military: 0.4, learning: 0.5 },
  rebel: { military: 0.8, diplomacy: 0.4 },
  founder: { admin: 0.7, diplomacy: 0.5 },
};

export function deed(sim: Sim, p: Person, text: string): void {
  (p.deeds ??= []).push({ y: sim.year, t: text });
  if (p.deeds.length > 40) p.deeds.splice(1, p.deeds.length - 40); // keep the first (birth) entry
}

/** Grant a trait if absent; removes its opposite. Returns true when gained. */
export function gainTrait(sim: Sim, p: Person, key: string, why: string): boolean {
  if (p.traits.includes(key)) return false;
  const def = TRAIT_BY_KEY[key];
  if (!def) return false;
  if (def.opposite) {
    const k = p.traits.indexOf(def.opposite);
    if (k >= 0) p.traits.splice(k, 1);
  }
  p.traits.push(key);
  if (def.skills) for (const [s, v] of Object.entries(def.skills)) p.skills[s as SkillKey] = clamp(p.skills[s as SkillKey] + (v as number), 0, 10);
  if (def.health) p.health = clamp01(p.health + def.health);
  deed(sim, p, `Became ${def.name.toLowerCase()} — ${why}`);
  return true;
}

export function loseTrait(sim: Sim, p: Person, key: string, why: string): void {
  const k = p.traits.indexOf(key);
  if (k < 0) return;
  p.traits.splice(k, 1);
  const def = TRAIT_BY_KEY[key];
  if (def?.skills) for (const [s, v] of Object.entries(def.skills)) p.skills[s as SkillKey] = clamp(p.skills[s as SkillKey] - (v as number), 0, 10);
  deed(sim, p, `No longer ${def?.name.toLowerCase() ?? key} — ${why}`);
}

/** Potential ceiling for a skill: genes + innate traits + schooling. */
export function potential(p: Person, k: SkillKey, education: number): number {
  const g = p.genes;
  const base = k === 'admin' ? 3 + g[1] * 4 : k === 'military' ? 3 + g[0] * 2.5 + g[2] * 2 : k === 'diplomacy' ? 3 + (1 - g[2]) * 2 + g[1] * 2 : 2 + g[1] * 5;
  let t = 0;
  for (const tr of p.traits) t += TRAIT_BY_KEY[tr]?.skills?.[k] ?? 0;
  const school = k === 'learning' ? education * 3 : k === 'military' ? 0.5 : education * 1.5;
  return clamp(base + t + school, 0, 10);
}

export function addStress(p: Person, v: number): void {
  let m = 1;
  if (p.traits.includes('content') || p.traits.includes('wise')) m *= 0.7;
  if (p.traits.includes('paranoid') || p.traits.includes('ambitious')) m *= 1.25;
  p.stress = clamp01((p.stress ?? 0) + v * m);
}

/** Yearly development step for a living notable person. */
export function developPerson(sim: Sim, p: Person, civ: Civ | undefined, age: number): void {
  const rng = sim.rng;
  const education = civ ? clamp01(civ.caps.literacy) : 0;
  const xp = (p.xp ??= { admin: 0, military: 0, diplomacy: 0, learning: 0 });
  const practice = PRACTICE[p.role] ?? {};
  const diligent = p.traits.includes('diligent') ? 1.3 : p.traits.includes('lazy') ? 0.7 : 1;
  if (age === 16) deed(sim, p, 'Came of age');
  for (const k of SKILLS) {
    const prac = (practice[k] ?? 0) * diligent;
    xp[k] += prac;
    const cap = Math.min(10, potential(p, k, education) + Math.min(2, xp[k] * 0.04));
    let d = 0;
    if (age < 12) d = 0;
    else if (age < 30) d = (cap - p.skills[k]) * (0.1 + 0.05 * prac) * diligent;
    else if (age < 55) d = (cap - p.skills[k]) * 0.04 * prac;
    if (age >= 60) d -= (k === 'military' ? 0.12 : 0.05) * (1 + (age - 60) / 15);
    if (age >= 60 && k === 'diplomacy') d += 0.03; // elders keep their counsel
    p.skills[k] = clamp(p.skills[k] + d, 0, 10);
  }
  // stress decays; chronic stress shapes personality and health
  const st = p.stress ?? 0;
  if (civ && (p.id === civ.rulerId || p.role === 'general') && atWar(sim, civ)) addStress(p, 0.06);
  if (civ && p.id === civ.rulerId && civ.legitimacy < 0.3) addStress(p, 0.05);
  p.stress = Math.max(0, (p.stress ?? 0) - 0.12);
  if (st > 0.7) {
    p.health = clamp01(p.health - 0.03);
    if (rng.chance(0.25)) {
      const k = rng.pick(['melancholic', 'paranoid', 'cruel']);
      gainTrait(sim, p, k, 'years of strain');
      p.stress = Math.max(0, st - 0.4);
    }
  }
  // milestone traits from accomplishments
  if (p.skills.military >= 8.5 && rng.chance(0.3)) gainTrait(sim, p, 'tactician', 'mastery of war');
  if (p.skills.learning >= 8.5 && rng.chance(0.3)) gainTrait(sim, p, 'scholar', 'a lifetime of study');
  if (p.skills.diplomacy >= 8.5 && rng.chance(0.3)) gainTrait(sim, p, 'silver_tongue', 'renown at court');
  if (age >= 70 && rng.chance(0.2)) gainTrait(sim, p, 'venerable', 'great age');
  if (civ && p.id === civ.rulerId) {
    const reign = p.reigns.find((r) => r.civId === civ.id && r.end === undefined);
    const years = reign ? sim.year - reign.start : 0;
    if (years >= 10 && p.skills.admin >= 7 && rng.chance(0.15)) gainTrait(sim, p, 'statesman', `${years} years of rule`);
    if (years >= 8 && civ.legitimacy > 0.8 && rng.chance(0.12)) gainTrait(sim, p, 'beloved', 'a just and long reign');
    if (years >= 5 && civ.legitimacy < 0.25 && (p.traits.includes('cruel') || st > 0.5) && rng.chance(0.15)) gainTrait(sim, p, 'tyrant', 'ruling through fear');
    if (p.traits.includes('beloved') && civ.legitimacy < 0.35) loseTrait(sim, p, 'beloved', 'the people turned');
  }
  // melancholy can lift in peaceful years
  if (p.traits.includes('melancholic') && (p.stress ?? 0) < 0.1 && rng.chance(0.08)) loseTrait(sim, p, 'melancholic', 'found peace');
}

/** Mortality multiplier from development state (stress, acquired traits). */
export function developmentMortality(p: Person): number {
  let m = 1 + (p.stress ?? 0) * 0.6;
  if (p.traits.includes('scarred')) m *= 1.1;
  if (p.traits.includes('survivor')) m *= 0.95;
  return m;
}

/** A general (or ruler leading troops) took part in a battle. */
export function onBattle(sim: Sim, personId: number, won: boolean, place: string, big: boolean): void {
  const p = sim.w.persons.get(personId);
  if (!p || p.died !== undefined) return;
  const rng = sim.rng;
  const text = `${won ? 'Won' : 'Lost'} the battle near ${place}`;
  const last = p.deeds?.[p.deeds.length - 1];
  // repeated clashes at the same place in the same year count as one engagement
  if (last && last.y === sim.year && last.t.startsWith(text)) {
    const m = /×(\d+)\)$/.exec(last.t);
    last.t = `${text} (×${m ? +m[1] + 1 : 2})`;
    return;
  }
  p.battles = (p.battles ?? 0) + 1;
  if (won) p.victories = (p.victories ?? 0) + 1;
  if (p.xp) p.xp.military += won ? 2 : 1.2;
  p.skills.military = clamp(p.skills.military + (won ? 0.15 : 0.08), 0, 10);
  addStress(p, won ? 0.05 : 0.15);
  deed(sim, p, text + (big ? ' (a great battle)' : ''));
  if (!won && rng.chance(0.18)) {
    gainTrait(sim, p, 'scarred', `wounded near ${place}`);
    p.health = clamp01(p.health - 0.08);
  }
  if (p.battles >= 3) gainTrait(sim, p, 'veteran', `${p.battles} battles fought`);
  if ((p.victories ?? 0) >= 5) gainTrait(sim, p, 'conqueror', `${p.victories} victories`);
  if (p.battles - (p.victories ?? 0) >= 4 && rng.chance(0.3)) gainTrait(sim, p, 'craven', 'repeated defeats');
}

/** War ended: the rulers of both sides remember it. */
export function onWarEnd(sim: Sim, winner: Civ | undefined, loser: Civ | undefined, warName: string, decisive: boolean): void {
  const wr = winner ? sim.w.persons.get(winner.rulerId) : undefined;
  const lr = loser ? sim.w.persons.get(loser.rulerId) : undefined;
  if (wr && wr.died === undefined) {
    deed(sim, wr, `Victorious in ${warName}`);
    if (decisive && sim.rng.chance(0.4)) gainTrait(sim, wr, 'conqueror', `triumph in ${warName}`);
  }
  if (lr && lr.died === undefined) {
    deed(sim, lr, `Defeated in ${warName}`);
    addStress(lr, decisive ? 0.4 : 0.2);
  }
}

/** A close relative died: grief for the surviving family. */
export function onKinDeath(sim: Sim, dead: Person): void {
  const w = sim.w;
  const kin = [dead.spouseId, dead.fatherId, dead.motherId, ...dead.children];
  for (const id of kin) {
    const k = id ? w.persons.get(id) : undefined;
    if (!k || k.died !== undefined || !k.notable) continue;
    const young = sim.year - dead.born < 20;
    addStress(k, dead.id === k.spouseId || (young && k.children.includes(dead.id)) ? 0.3 : 0.12);
    if (dead.id === k.spouseId) deed(sim, k, `Mourned ${dead.name}, their spouse`);
    else if (k.children.includes(dead.id)) deed(sim, k, `Lost their child ${dead.name}`);
  }
}

/** Survived an epidemic that hit their settlement. */
export function onEpidemicSurvived(sim: Sim, settlementId: number, disease: string): void {
  for (const p of sim.w.persons.values()) {
    if (p.settlementId !== settlementId || p.died !== undefined || !p.notable) continue;
    if (sim.rng.chance(0.5)) gainTrait(sim, p, 'survivor', `lived through the ${disease}`);
  }
}
