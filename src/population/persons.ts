/**
 * Individual persons: creation, inheritance (genes + traits), naming, death.
 */
import type { Sim } from '../sim/context';
import type { Person, PersonRole, SpeciesKey } from '../sim/types';
import { clamp, clamp01 } from '../core/math';
import { INNATE_TRAITS, TRAIT_BY_KEY } from './traits';
import { makeName } from '../culture/language';
import { onNotableDeath } from '../politics/succession';
import { onKinDeath } from './development';

export interface NewPerson {
  female?: boolean;
  born: number;
  species: SpeciesKey;
  civId: number;
  settlementId?: number;
  bandId?: number;
  cultureId: number;
  religionId: number;
  fatherId?: number;
  motherId?: number;
  role?: PersonRole;
  job?: string;
  family?: string;
  notable?: boolean;
  traits?: string[];
}

export function phonOfCulture(sim: Sim, cultureId: number) {
  const c = sim.w.cultures.get(cultureId);
  const lang = c ? sim.w.languages.get(c.languageId) : undefined;
  return lang?.phon ?? sim.w.languages.values().next().value?.phon;
}

export function inheritGenes(sim: Sim, f?: Person, m?: Person): number[] {
  const rng = sim.rng;
  const g: number[] = [];
  for (let k = 0; k < 4; k++) {
    const a = f ? f.genes[k] : rng.range(0.3, 0.7);
    const b = m ? m.genes[k] : rng.range(0.3, 0.7);
    g.push(clamp01((a + b) / 2 + rng.normal() * 0.08));
  }
  return g;
}

export function rollTraits(sim: Sim, f?: Person, m?: Person): string[] {
  const rng = sim.rng;
  const out: string[] = [];
  const has = (k: string) => out.includes(k) || (TRAIT_BY_KEY[k]?.opposite ? out.includes(TRAIT_BY_KEY[k].opposite!) : false);
  for (const parent of [f, m]) {
    if (!parent) continue;
    for (const t of parent.traits) {
      const def = TRAIT_BY_KEY[t];
      if (def && def.kind !== 'acquired' && !has(t) && rng.chance(def.heritable)) out.push(t);
    }
  }
  const target = rng.int(1, 3);
  let guard = 0;
  while (out.length < target && guard++ < 20) {
    const def = INNATE_TRAITS[rng.int(0, INNATE_TRAITS.length - 1)];
    if (!has(def.key) && rng.chance(def.rarity * 3)) out.push(def.key);
  }
  return out;
}

export function computeSkills(sim: Sim, genes: number[], traits: string[]) {
  const rng = sim.rng;
  const s = {
    admin: 2 + genes[1] * 4 + rng.range(0, 2),
    military: 2 + genes[0] * 2 + genes[2] * 2 + rng.range(0, 2),
    diplomacy: 2 + (1 - genes[2]) * 2 + genes[1] * 2 + rng.range(0, 2),
    learning: 1 + genes[1] * 5 + rng.range(0, 2),
  };
  for (const t of traits) {
    const def = TRAIT_BY_KEY[t];
    if (!def?.skills) continue;
    for (const [k, v] of Object.entries(def.skills)) (s as Record<string, number>)[k] += v as number;
  }
  s.admin = clamp(s.admin, 0, 10);
  s.military = clamp(s.military, 0, 10);
  s.diplomacy = clamp(s.diplomacy, 0, 10);
  s.learning = clamp(s.learning, 0, 10);
  return s;
}

export function createPerson(sim: Sim, a: NewPerson): Person {
  const w = sim.w;
  const rng = sim.rng;
  const f = a.fatherId ? w.persons.get(a.fatherId) : undefined;
  const m = a.motherId ? w.persons.get(a.motherId) : undefined;
  const genes = inheritGenes(sim, f, m);
  const traits = a.traits ?? rollTraits(sim, f, m);
  const phon = phonOfCulture(sim, a.cultureId);
  const p: Person = {
    id: ++w.ids.person,
    name: phon ? makeName(rng, phon, 'person') : 'Ana',
    family: a.family ?? f?.family,
    female: a.female ?? rng.chance(0.5),
    born: a.born,
    species: a.species,
    civId: a.civId,
    settlementId: a.settlementId ?? 0,
    bandId: a.bandId ?? 0,
    cultureId: a.cultureId,
    religionId: a.religionId,
    fatherId: a.fatherId ?? 0,
    motherId: a.motherId ?? 0,
    spouseId: 0,
    children: [],
    dynastyId: f?.dynastyId ?? 0,
    role: a.role ?? 'commoner',
    job: a.job ?? '',
    traits,
    genes,
    skills: computeSkills(sim, genes, traits),
    health: clamp01(0.75 + genes[0] * 0.25),
    notable: a.notable ?? false,
    titles: [],
    reigns: [],
    events: [],
  };
  if (p.notable) p.deeds = [{ y: a.born, t: a.born < sim.year ? 'Born' : `Born${f || m ? ' to ' + [f?.name, m?.name].filter(Boolean).join(' and ') : ''}` }];
  w.persons.set(p.id, p);
  if (f) f.children.push(p.id);
  if (m) m.children.push(p.id);
  return p;
}

export function ageOf(sim: Sim, p: Person): number {
  return sim.year - p.born;
}

export function displayName(sim: Sim, p: Person): string {
  const title = p.titles.length ? p.titles[p.titles.length - 1] + ' ' : '';
  return `${title}${p.name}${p.family ? ' ' + p.family : ''}`;
}

/** Mark a person as historically notable (kept after death). Also keeps their parents' records. */
export function makeNotable(sim: Sim, p: Person): void {
  if (!p.notable) p.deeds ??= [{ y: p.born, t: 'Born' }];
  p.notable = true;
}

/** Remove a person from life. Notable persons are archived; others are deleted. */
export function killPerson(sim: Sim, p: Person, cause: string): void {
  if (p.died !== undefined) return;
  const w = sim.w;
  p.died = sim.year;
  p.deathCause = cause;
  if (p.settlementId) {
    const s = w.settlements.get(p.settlementId);
    if (s && s.mode === 'individual') {
      const k = s.members.indexOf(p.id);
      if (k >= 0) s.members.splice(k, 1);
    }
  }
  if (p.bandId) {
    const b = w.bands.get(p.bandId);
    if (b) {
      const k = b.members.indexOf(p.id);
      if (k >= 0) b.members.splice(k, 1);
    }
  }
  if (p.spouseId) {
    const sp = w.persons.get(p.spouseId);
    if (sp && sp.spouseId === p.id) sp.spouseId = 0;
  }
  if (p.notable) onKinDeath(sim, p);
  onNotableDeath(sim, p);
  if (!p.notable) w.persons.delete(p.id);
}

/** Remove a living commoner record silently (absorbed into cohort aggregation). */
export function absorbPerson(sim: Sim, p: Person): void {
  if (p.notable) return;
  if (p.spouseId) {
    const sp = sim.w.persons.get(p.spouseId);
    if (sp && sp.spouseId === p.id && !sp.notable) sp.spouseId = 0;
  }
  sim.w.persons.delete(p.id);
}
