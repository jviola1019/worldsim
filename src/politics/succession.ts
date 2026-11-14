/**
 * Leadership & succession.
 *
 * Hereditary systems pass power to the eldest living child, then siblings,
 * then other members of the dynasty; with no candidate a succession crisis
 * hits legitimacy and a new dynasty seizes power. Elective systems choose a
 * new leader (from the ruling faction). Rulers, heirs and consorts are
 * notable persons: they age, marry (sometimes diplomatically across
 * dynasties) and have children through a yearly "notables" step, even when
 * their home settlement is simulated as aggregate cohorts.
 */
import type { Sim } from '../sim/context';
import type { Civ, Dynasty, Person } from '../sim/types';
import { createPerson, killPerson, phonOfCulture } from '../population/persons';
import { healthIndices, mortalitySchedule } from '../population/demography';
import { makeName } from '../culture/language';
import { logEvent } from '../history/events';
import { rulerTitle, isHereditary, civDisplayName } from './govforms';
import { clamp01, romanNumeral } from '../core/math';

function alive(p: Person | undefined): p is Person {
  return !!p && p.died === undefined;
}

export function onNotableDeath(sim: Sim, p: Person): void {
  const w = sim.w;
  for (const r of p.reigns) if (r.end === undefined) r.end = sim.year;
  let wasRuler = false;
  for (const civ of w.civs.values()) {
    if (!civ.alive) continue;
    if (civ.rulerId === p.id) {
      wasRuler = true;
      civ.rulerId = 0;
      logEvent(sim, {
        type: 'ruler_death',
        cat: 'politics',
        title: `${p.titles[p.titles.length - 1] ?? 'Leader'} ${p.name} of ${civ.name} died (${p.deathCause ?? 'unknown causes'})`,
        civs: [civ.id],
        persons: [p.id],
        importance: 2,
        ...capitalXY(sim, civ),
      });
      handleVacancy(sim, civ, p);
    } else if (civ.heirId === p.id) {
      civ.heirId = pickHeir(sim, civ)?.id ?? 0;
    }
  }
  for (const a of w.armies.values()) if (a.generalId === p.id) a.generalId = 0;
  for (const r of w.religions.values()) if (r.headId === p.id) r.headId = 0;
  if (!wasRuler && p.notable && p.role !== 'commoner' && p.role !== 'consort' && p.role !== 'general' && p.role !== 'heir') {
    logEvent(sim, {
      type: 'notable_death',
      cat: 'demography',
      title: `${p.name}${p.family ? ' ' + p.family : ''}, ${p.role.replace('_', ' ')}, died`,
      civs: p.civId ? [p.civId] : [],
      persons: [p.id],
      importance: 1,
    });
  }
}

function capitalXY(sim: Sim, civ: Civ): { x?: number; y?: number } {
  const s = sim.w.settlements.get(civ.capital);
  return s ? { x: s.x, y: s.y } : {};
}

export function handleVacancy(sim: Sim, civ: Civ, dead?: Person): void {
  const successor = pickSuccessor(sim, civ, dead);
  if (successor) crown(sim, civ, successor, isHereditary(civ) ? 'inherited' : 'elected');
  else successionCrisis(sim, civ);
}

/** Eldest living child of the current ruler (hereditary systems only). */
export function pickHeir(sim: Sim, civ: Civ): Person | undefined {
  if (!isHereditary(civ)) return undefined;
  const ruler = sim.w.persons.get(civ.rulerId);
  if (!ruler) return undefined;
  const kids = ruler.children.map((id) => sim.w.persons.get(id)).filter(alive);
  kids.sort((a, b) => a.born - b.born || a.id - b.id);
  const heir = kids[0];
  if (heir) {
    heir.notable = true;
    if (heir.role === 'commoner') heir.role = 'heir';
  }
  return heir;
}

export function pickSuccessor(sim: Sim, civ: Civ, dead?: Person): Person | undefined {
  const w = sim.w;
  if (isHereditary(civ)) {
    const prev = dead ?? w.persons.get(civ.rulerId);
    if (prev) {
      const kids = prev.children.map((id) => w.persons.get(id)).filter(alive);
      kids.sort((a, b) => a.born - b.born || a.id - b.id);
      if (kids.length) return kids[0];
      const heir = w.persons.get(civ.heirId);
      if (alive(heir)) return heir;
      const parents = [w.persons.get(prev.fatherId), w.persons.get(prev.motherId)].filter((x): x is Person => !!x);
      const sibs: Person[] = [];
      for (const par of parents) for (const id of par.children) {
        const s = w.persons.get(id);
        if (alive(s) && s.id !== prev.id && !sibs.includes(s)) sibs.push(s);
      }
      sibs.sort((a, b) => a.born - b.born || a.id - b.id);
      if (sibs.length) return sibs[0];
      if (prev.dynastyId) {
        const d = w.dynasties.get(prev.dynastyId);
        if (d) {
          const members = d.members.map((id) => w.persons.get(id)).filter(alive).filter((m) => m.civId === civ.id);
          members.sort((a, b) => a.born - b.born || a.id - b.id);
          if (members.length) return members[0];
        }
      }
    }
    return undefined;
  }
  return createLeader(sim, civ);
}

/** A new leader drawn from the civ's people (elections, councils, usurpers). */
export function createLeader(sim: Sim, civ: Civ, role: Person['role'] = 'ruler'): Person {
  const w = sim.w;
  const rng = sim.rng;
  const cap = w.settlements.get(civ.capital);
  // Tribal councils in small villages choose an elder from the actual residents.
  if (cap && cap.mode === 'individual' && cap.members.length) {
    let best: Person | undefined;
    let bestScore = -1;
    for (const id of cap.members) {
      const p = w.persons.get(id);
      if (!alive(p)) continue;
      const age = sim.year - p.born;
      if (age < 25) continue;
      const score = p.skills.admin + p.skills.diplomacy + Math.min(20, age - 25) * 0.15 + rng.float();
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) return best;
  }
  const religion = civ.stateReligion || cap?.religions[0]?.id || 0;
  const phon = phonOfCulture(sim, civ.cultureId);
  const p = createPerson(sim, {
    born: sim.year - rng.int(32, 58),
    species: civ.species,
    civId: civ.id,
    settlementId: civ.capital,
    cultureId: civ.cultureId,
    religionId: religion,
    role,
    notable: true,
    family: phon ? makeName(rng, phon, 'family') : undefined,
  });
  return p;
}

export function crown(sim: Sim, civ: Civ, person: Person, how: 'founded' | 'inherited' | 'elected' | 'chosen' | 'seized'): void {
  const w = sim.w;
  person.role = 'ruler';
  person.notable = true;
  person.civId = civ.id;
  // regnal number: count earlier rulers of this civ with the same name
  let same = 0;
  for (const q of w.persons.values()) {
    if (q.id === person.id || q.name !== person.name) continue;
    if (q.reigns.some((r) => r.civId === civ.id)) same++;
  }
  const title = rulerTitle(civ, person.female);
  const regnal = same > 0 ? ` ${romanNumeral(same + 1)}` : '';
  person.titles.push(title);
  person.reigns.push({ civId: civ.id, start: sim.year, title: `${title} of ${civ.baseName}` });
  if (regnal) person.name = person.name + regnal;
  civ.rulerId = person.id;
  if (isHereditary(civ)) {
    if (!person.dynastyId) {
      const phon = phonOfCulture(sim, person.cultureId || civ.cultureId);
      const name = person.family ?? (phon ? makeName(sim.rng, phon, 'family') : 'Avan');
      person.family = name;
      const d: Dynasty = { id: ++w.ids.dynasty, name, founderId: person.id, civId: civ.id, founded: sim.year, members: [person.id] };
      w.dynasties.set(d.id, d);
      person.dynastyId = d.id;
    }
    civ.dynastyId = person.dynastyId;
  }
  civ.heirId = pickHeir(sim, civ)?.id ?? 0;
  if (how === 'seized') civ.legitimacy = clamp01(civ.legitimacy - 0.15);
  if (how === 'elected') civ.legitimacy = clamp01(civ.legitimacy + 0.05);
  const verb =
    how === 'founded' ? 'led the founding of' : how === 'inherited' ? 'inherited the rule of' : how === 'elected' ? 'was chosen to lead' : how === 'seized' ? 'seized power in' : 'became leader of';
  logEvent(sim, {
    type: 'leader',
    cat: 'politics',
    title: `${title} ${person.name}${person.family ? ' ' + person.family : ''} ${verb} ${civDisplayName(civ)}`,
    civs: [civ.id],
    persons: [person.id],
    importance: how === 'seized' ? 3 : 2,
    ...capitalXY(sim, civ),
  });
}

export function successionCrisis(sim: Sim, civ: Civ): void {
  civ.legitimacy = clamp01(civ.legitimacy - 0.25);
  civ.stability = clamp01(civ.stability - 0.15);
  civ.unrest = clamp01(civ.unrest + 0.15);
  logEvent(sim, {
    type: 'succession_crisis',
    cat: 'politics',
    title: `Succession crisis in ${civ.name}: no legitimate heir`,
    civs: [civ.id],
    importance: 3,
    causes: [{ label: 'Ruling line left no surviving heir', weight: 1 }],
    ...capitalXY(sim, civ),
  });
  const usurper = createLeader(sim, civ);
  usurper.dynastyId = 0;
  crown(sim, civ, usurper, 'seized');
}

/** Ensure the ruler's spouse, children and heir survive aggregation into cohorts. */
export function protectRulingFamily(sim: Sim, civ: Civ): void {
  const r = sim.w.persons.get(civ.rulerId);
  if (!r) return;
  r.notable = true;
  const sp = sim.w.persons.get(r.spouseId);
  if (sp) {
    sp.notable = true;
    if (sp.role === 'commoner') sp.role = 'consort';
  }
  for (const id of r.children) {
    const c = sim.w.persons.get(id);
    if (c && c.died === undefined) c.notable = true;
  }
}

function inIndividualGroup(sim: Sim, p: Person): boolean {
  if (p.bandId) return sim.w.bands.has(p.bandId);
  const s = sim.w.settlements.get(p.settlementId);
  return !!s && s.mode === 'individual' && s.members.includes(p.id);
}

/**
 * Yearly life events of notable people who are not part of an
 * individual-mode group: mortality (elite health), dynastic marriages and births.
 */
export function notablesYearly(sim: Sim): void {
  const w = sim.w;
  const rng = sim.rng;
  const living: Person[] = [];
  for (const p of w.persons.values()) if (p.notable && p.died === undefined && !inIndividualGroup(sim, p)) living.push(p);
  const schedCache = new Map<number, Float64Array>();
  for (const p of living) {
    const civ = w.civs.get(p.civId);
    const age = sim.year - p.born;
    let q = schedCache.get(p.civId);
    if (!q) {
      const h = healthIndices(civ, 1.6);
      h.general = Math.min(1, h.general + 0.1);
      h.old = Math.min(1, h.old + 0.08);
      q = mortalitySchedule(h, civ?.species ?? 'human');
      schedCache.set(p.civId, q);
    }
    const band = Math.min(16, Math.max(0, Math.floor(age / 5)));
    let qq = q[band] * (1.3 - 0.6 * p.genes[0]);
    if (p.traits.includes('frail')) qq *= 1.4;
    if (rng.float() < qq) {
      killPerson(sim, p, age > 60 ? 'old age' : age < 5 ? 'childhood illness' : rng.pick(['illness', 'fever', 'an accident', 'a wasting disease']));
      continue;
    }
    if (!civ || !civ.alive) continue;
    const isCore = p.id === civ.rulerId || p.id === civ.heirId;
    // dynastic marriage
    if (isCore && age >= 18 && !p.spouseId && rng.chance(0.35)) marry(sim, civ, p);
    // births within the ruling couple
    const mother = p.female ? p : w.persons.get(p.spouseId);
    const father = p.female ? w.persons.get(p.spouseId) : p;
    if (isCore && mother && father && alive(mother) && alive(father)) {
      const mAge = sim.year - mother.born;
      // only the core member (ruler/heir) rolls, so each couple rolls once
      if (mAge >= 16 && mAge <= 44 && rng.chance(0.24 * (0.6 + 0.8 * mother.genes[3]))) {
        const child = createPerson(sim, {
          born: sim.year,
          species: civ.species,
          civId: civ.id,
          settlementId: civ.capital,
          cultureId: father.cultureId || civ.cultureId,
          religionId: father.religionId,
          fatherId: father.id,
          motherId: mother.id,
          notable: true,
          family: p.family,
        });
        child.dynastyId = p.dynastyId;
        if (child.dynastyId) w.dynasties.get(child.dynastyId)?.members.push(child.id);
        if (!civ.heirId && isHereditary(civ) && p.id === civ.rulerId) civ.heirId = pickHeir(sim, civ)?.id ?? 0;
      }
    }
  }
}

function marry(sim: Sim, civ: Civ, p: Person): void {
  const w = sim.w;
  const rng = sim.rng;
  // Occasionally a diplomatic marriage with another known dynasty.
  let fromCiv = civ;
  if (civ.knownCivs.length && rng.chance(0.3)) {
    const other = w.civs.get(rng.pick(civ.knownCivs));
    if (other && other.alive && isHereditary(other)) fromCiv = other;
  }
  const phon = phonOfCulture(sim, fromCiv.cultureId);
  const ruler = w.persons.get(fromCiv.rulerId);
  const spouse = createPerson(sim, {
    female: !p.female,
    born: p.born + rng.int(-6, 6),
    species: fromCiv.species,
    civId: civ.id,
    settlementId: civ.capital,
    cultureId: fromCiv.cultureId,
    religionId: fromCiv.stateReligion || p.religionId,
    role: 'consort',
    notable: true,
    family: fromCiv !== civ ? ruler?.family : phon ? makeName(rng, phon, 'family') : undefined,
  });
  p.spouseId = spouse.id;
  spouse.spouseId = p.id;
  if (fromCiv !== civ) {
    const key = civ.id < fromCiv.id ? `${civ.id}-${fromCiv.id}` : `${fromCiv.id}-${civ.id}`;
    const rel = w.relations.get(key);
    if (rel) {
      rel.opinion = Math.min(100, rel.opinion + 12);
      rel.trust = clamp01(rel.trust + 0.05);
    }
    logEvent(sim, {
      type: 'royal_marriage',
      cat: 'diplomacy',
      title: `${p.name} of ${civ.name} married ${spouse.name} of the ${fromCiv.adjective} court`,
      civs: [civ.id, fromCiv.id],
      persons: [p.id, spouse.id],
      importance: 1,
    });
  }
}
