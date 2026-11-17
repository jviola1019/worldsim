/**
 * Demography at two resolutions.
 *
 * COHORT mode (larger settlements): population is kept in 17 five-year age
 * bands. Each month: aging (1/60 of a band moves up), births from women 15-49
 * using a total fertility rate (TFR) and an age-specific shape, deaths from an
 * annual mortality schedule. Mortality interpolates geometrically between a
 * pre-modern and a modern schedule by health indices that come from
 * technology, health spending, nutrition and sanitation — producing a
 * demographic transition as societies develop (mortality falls first, then
 * fertility once contraception, education and urbanization arrive).
 *
 * INDIVIDUAL mode (bands, small villages): each person is simulated with the
 * same rates as monthly Bernoulli trials; couples form; children inherit genes,
 * traits, culture and religion; families and bloodlines emerge.
 */
import { record } from './ledger';
import type { Sim } from '../sim/context';
import type { Civ, Person, Settlement, SpeciesKey, DemographicFlows } from '../sim/types';
import { AGE_BANDS, BALANCE, FERTILITY_SHAPE, MORTALITY_MODERN, MORTALITY_PRE } from '../config/balance';
import { clamp, clamp01 } from '../core/math';
import { createPerson, killPerson, absorbPerson } from './persons';

/** Age-band famine vulnerability (young children and the elderly suffer most). */
const VULN = [2.2, 1.1, 0.6, 0.5, 0.5, 0.5, 0.5, 0.5, 0.6, 0.7, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0];

export const SPECIES_DEMOGRAPHY: Record<SpeciesKey, { oldMortality: number; fertility: number; maturity: number }> = {
  human: { oldMortality: 1, fertility: 1, maturity: 1 },
  sylvan: { oldMortality: 0.45, fertility: 0.7, maturity: 1.2 },
  delver: { oldMortality: 0.75, fertility: 0.85, maturity: 1 },
  grakk: { oldMortality: 1.35, fertility: 1.25, maturity: 0.9 },
};

export interface HealthIdx {
  general: number;
  infant: number;
  old: number;
}

export function emptyFlows(): DemographicFlows {
  return { births: 0, deaths: 0, famine: 0, disease: 0, war: 0, disaster: 0, emigration: 0, immigration: 0 };
}

export function healthIndices(civ: Civ | undefined, prosperity: number): HealthIdx {
  if (!civ) return { general: 0.05, infant: 0.05, old: 0.05 };
  const c = civ.caps;
  const spend = 0.55 + 0.45 * clamp01(civ.budget.health * 8);
  const pros = 0.7 + 0.3 * clamp01(prosperity / 1.2);
  const general = clamp01(0.03 + c.healthcare * spend * pros);
  const infant = clamp01(Math.max(general, c.infantCare * spend * pros));
  const old = clamp01(general * 0.85 + (c.lifespan + c.lifeExtension * 0.5) * spend);
  return { general, infant, old };
}

/** Annual death probabilities per band for given health indices. */
export function mortalitySchedule(h: HealthIdx, species: SpeciesKey, out = new Float64Array(AGE_BANDS)): Float64Array {
  const sp = SPECIES_DEMOGRAPHY[species];
  for (let b = 0; b < AGE_BANDS; b++) {
    const t = b === 0 ? h.infant : b >= 12 ? h.old : h.general;
    let q = Math.pow(MORTALITY_PRE[b], 1 - t) * Math.pow(MORTALITY_MODERN[b], t);
    if (b >= 11) q *= sp.oldMortality;
    out[b] = clamp(q, 0, 0.95);
  }
  return out;
}

/** Period life expectancy at birth from annual band death probabilities. */
export function lifeExpectancy(q: ArrayLike<number>): number {
  let alive = 1;
  let years = 0;
  for (let b = 0; b < AGE_BANDS; b++) {
    if (b === AGE_BANDS - 1) {
      // open-ended last band: expected remaining years ~ 1/q
      years += alive * (1 / Math.max(0.05, q[b]));
      break;
    }
    const survive5 = Math.pow(1 - q[b], 5);
    // average person-years lived in the band
    years += alive * 5 * (1 + survive5) / 2;
    alive *= survive5;
  }
  return years;
}

/**
 * Total fertility rate. Pre-transition societies sit near natural fertility;
 * the transition requires contraception capability and is driven by child
 * survival, education, urbanization and prosperity (evidence-informed
 * direction; magnitudes stylized).
 */
export function tfrFor(civ: Civ | undefined, s: { education: number; prosperity: number; pop: number }, q0: number, foodAdequacy: number, species: SpeciesKey): number {
  const sp = SPECIES_DEMOGRAPHY[species];
  let tfr = BALANCE.tfrMax * sp.fertility;
  if (civ) {
    const childSurvival = Math.pow(1 - q0, 5); // ~0.68 pre-modern .. 0.99 modern
    const survivalFactor = clamp01((childSurvival - 0.7) / 0.28);
    const urban = clamp01(Math.log10(Math.max(1, s.pop) / 5000) / 2.5);
    const dev = clamp01(0.35 * s.education + 0.3 * survivalFactor + 0.2 * urban + 0.15 * clamp01(s.prosperity / 1.6));
    const access = clamp01(civ.caps.contraception);
    const transition = clamp01(dev * (0.25 + 0.75 * access));
    tfr = tfr - (tfr - BALANCE.tfrMin * sp.fertility) * transition;
    // cultural/religious pronatalism (small)
    tfr *= 1 + 0.08 * (civ.inst.religiousAuthority - 0.3);
  }
  // hunger suppresses fertility
  tfr *= 0.45 + 0.55 * clamp01(foodAdequacy);
  return Math.max(0.3, tfr);
}

export interface DemoCtx {
  q: Float64Array; // annual mortality (already including urban penalty)
  tfr: number;
  adequacy: number;
}

/** One month of cohort demography. Returns natural growth (births - deaths). */
export function cohortMonth(s: Settlement, ctx: DemoCtx, flows: DemographicFlows): void {
  const c = s.cohorts;
  // births
  let births = 0;
  for (let k = 0; k < FERTILITY_SHAPE.length; k++) births += (c[3 + k] * 0.5 * ctx.tfr * FERTILITY_SHAPE[k]) / 5 / 12;
  // deaths (split into baseline vs famine excess)
  let deaths = 0;
  let famine = 0;
  const hunger = 1 - clamp01(ctx.adequacy);
  for (let b = 0; b < AGE_BANDS; b++) {
    const base = 1 - Math.pow(1 - ctx.q[b], 1 / 12);
    const qf = clamp(ctx.q[b] * (1 + BALANCE.famineMortality * hunger * VULN[b]), 0, 0.95);
    const total = 1 - Math.pow(1 - qf, 1 / 12);
    const d = c[b] * total;
    deaths += c[b] * base;
    famine += d - c[b] * base;
    c[b] -= d;
  }
  // aging
  for (let b = AGE_BANDS - 2; b >= 0; b--) {
    const move = c[b] / 60;
    c[b] -= move;
    c[b + 1] += move;
  }
  c[0] += births;
  flows.births += births;
  flows.deaths += deaths;
  flows.famine += famine;
}

export function cohortTotal(c: number[]): number {
  let t = 0;
  for (let b = 0; b < c.length; b++) t += c[b];
  return t;
}

/** Working-age population (15-64) plus partial teen labor in pre-industrial societies. */
export function workforceFromCohorts(c: number[], childLabor: number): number {
  let wf = c[2] * childLabor;
  for (let b = 3; b <= 12; b++) wf += c[b];
  wf += c[13] * 0.3;
  return wf;
}

/** Fraction of people aged 65+. */
export function elderlyShare(c: number[]): number {
  const t = cohortTotal(c);
  if (t <= 0) return 0;
  return (c[13] + c[14] + c[15] + c[16]) / t;
}

// --------------------------------------------------------------------------
// Individual mode

export interface IndivPlace {
  settlementId: number;
  bandId: number;
  civId: number;
  cultureId: number;
  religionId: number;
  species: SpeciesKey;
}

/**
 * One month of individual-level demography for a group of persons.
 * Returns the ids of newborns (already registered).
 */
export function individualMonth(sim: Sim, members: number[], ctx: DemoCtx, place: IndivPlace, flows: DemographicFlows): number[] {
  const w = sim.w;
  const rng = sim.rng;
  const year = sim.year;
  const born: number[] = [];
  const hunger = 1 - clamp01(ctx.adequacy);
  const singlesF: Person[] = [];
  const singlesM: Person[] = [];
  // copy because deaths mutate the members array
  const ids = members.slice();
  for (const id of ids) {
    const p = w.persons.get(id);
    if (!p || p.died !== undefined) continue;
    const age = year - p.born;
    const b = Math.min(AGE_BANDS - 1, Math.max(0, Math.floor(age / 5)));
    let q = ctx.q[b] * (1.35 - 0.7 * p.genes[0]);
    if (p.traits.includes('frail')) q *= 1.4;
    if (p.traits.includes('strong')) q *= 0.75;
    const qBase = q;
    q = clamp(q * (1 + BALANCE.famineMortality * hunger * VULN[b]), 0, 0.95);
    const pm = 1 - Math.pow(1 - q, 1 / 12);
    if (rng.float() < pm) {
      const isFamine = rng.float() > qBase / q;
      if (isFamine) flows.famine++;
      else flows.deaths++;
      killPerson(sim, p, isFamine ? 'starvation' : age < 5 ? 'childhood illness' : age > 55 ? 'old age' : 'illness');
      continue;
    }
    if (age >= 16 && !p.spouseId) (p.female ? singlesF : singlesM).push(p);
    // births to partnered women of fertile age
    if (p.female && age >= 15 && age < 50 && p.spouseId) {
      const sp = w.persons.get(p.spouseId);
      if (sp && sp.died === undefined) {
        const k = Math.min(6, Math.floor((age - 15) / 5));
        const fert = 0.55 + 0.9 * p.genes[3];
        const pb = ((ctx.tfr * FERTILITY_SHAPE[k]) / 5 / 12) * fert * 1.15; // partnered women carry all births
        if (rng.float() < pb) {
          const child = createPerson(sim, {
            born: year,
            species: place.species,
            civId: place.civId,
            settlementId: place.settlementId,
            bandId: place.bandId,
            cultureId: p.cultureId || place.cultureId,
            religionId: p.religionId || place.religionId,
            fatherId: sp.id,
            motherId: p.id,
            job: 'child',
          });
          members.push(child.id);
          born.push(child.id);
          flows.births++;
        }
      }
    }
  }
  // pair formation (avoid close kin)
  rng.shuffle(singlesF);
  rng.shuffle(singlesM);
  for (const f of singlesF) {
    if (!singlesM.length || !rng.chance(0.06)) continue;
    for (let k = 0; k < singlesM.length; k++) {
      const m = singlesM[k];
      if (closeKin(f, m)) continue;
      f.spouseId = m.id;
      m.spouseId = f.id;
      singlesM.splice(k, 1);
      break;
    }
  }
  return born;
}

function closeKin(a: Person, b: Person): boolean {
  if (a.fatherId && (a.fatherId === b.fatherId || a.fatherId === b.id)) return true;
  if (a.motherId && (a.motherId === b.motherId || a.motherId === b.id)) return true;
  if (b.fatherId === a.id || b.motherId === a.id) return true;
  return false;
}

/** Count living members by age band. */
export function membersToCohorts(sim: Sim, members: number[]): number[] {
  const c = new Array(AGE_BANDS).fill(0);
  for (const id of members) {
    const p = sim.w.persons.get(id);
    if (!p || p.died !== undefined) continue;
    const b = Math.min(AGE_BANDS - 1, Math.max(0, Math.floor((sim.year - p.born) / 5)));
    c[b]++;
  }
  return c;
}

/** Switch a settlement from individual to cohort representation. */
export function convertToCohorts(sim: Sim, s: Settlement): void {
  s.cohorts = membersToCohorts(sim, s.members);
  for (const id of s.members) {
    const p = sim.w.persons.get(id);
    if (!p) continue;
    if (p.notable || p.role !== 'commoner') continue; // notable people stay as individuals
    absorbPerson(sim, p);
  }
  s.members = [];
  s.mode = 'cohort';
}

/** Integer counts per band whose sum is Math.round(total) (largest-remainder method). */
export function wholeCounts(c: number[]): number[] {
  const total = Math.round(c.reduce((a, b) => a + b, 0));
  const out = c.map((v) => Math.floor(Math.max(0, v)));
  let rest = total - out.reduce((a, b) => a + b, 0);
  const order = c.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) out[order[k][1]]++;
  return out;
}

/** Switch a (shrinking) settlement from cohorts back to individuals. */
export function convertToIndividuals(sim: Sim, s: Settlement): void {
  const rng = sim.rng;
  const civ = sim.w.civs.get(s.civId);
  const culture = s.cultures[0]?.id ?? civ?.cultureId ?? 0;
  const religion = s.religions[0]?.id ?? 0;
  const members: number[] = [];
  const adultsF: Person[] = [];
  const adultsM: Person[] = [];
  // whole people from fractional cohorts: largest-remainder rounding keeps the total within ±0.5,
  // and the difference is recorded explicitly as a resolution adjustment (not silently created/destroyed)
  const counts = wholeCounts(s.cohorts);
  record(sim, s.civId, 'resolution', counts.reduce((a, b) => a + b, 0) - cohortTotal(s.cohorts));
  for (let b = 0; b < AGE_BANDS; b++) {
    const n = counts[b];
    for (let k = 0; k < n; k++) {
      const p = createPerson(sim, {
        born: sim.year - (b * 5 + rng.int(0, 4)),
        species: s.species,
        civId: s.civId,
        settlementId: s.id,
        cultureId: culture,
        religionId: religion,
        job: b < 2 ? 'child' : 'laborer',
      });
      members.push(p.id);
      if (b >= 4 && b <= 12) (p.female ? adultsF : adultsM).push(p);
    }
  }
  for (let k = 0; k < Math.min(adultsF.length, adultsM.length); k++) {
    if (rng.chance(0.7)) {
      adultsF[k].spouseId = adultsM[k].id;
      adultsM[k].spouseId = adultsF[k].id;
    }
  }
  s.members = members;
  s.cohorts = new Array(AGE_BANDS).fill(0);
  s.mode = 'individual';
}

/** Remove `amount` people from a settlement across ages (war, disaster, emigration). */
export function removePeople(sim: Sim, s: Settlement, amount: number, cause: string, workingAgeBias = 0): number {
  if (amount <= 0) return 0;
  if (s.mode === 'cohort') {
    const total = cohortTotal(s.cohorts);
    if (total <= 0) return 0;
    const frac = Math.min(1, amount / total);
    let removed = 0;
    for (let b = 0; b < AGE_BANDS; b++) {
      const bias = workingAgeBias > 0 && b >= 3 && b <= 9 ? 1 + workingAgeBias : 1;
      const r = Math.min(s.cohorts[b], s.cohorts[b] * frac * bias);
      s.cohorts[b] -= r;
      removed += r;
    }
    return removed;
  }
  let removed = 0;
  const ids = s.members.slice();
  sim.rng.shuffle(ids);
  for (const id of ids) {
    if (removed >= amount) break;
    const p = sim.w.persons.get(id);
    if (!p) continue;
    if (cause === 'emigration') {
      const k = s.members.indexOf(id);
      if (k >= 0) s.members.splice(k, 1);
      absorbPerson(sim, p);
    } else killPerson(sim, p, cause);
    removed++;
  }
  return removed;
}

/** Add people (immigrants, settlers) to a settlement with a working-age profile. */
export function addPeople(sim: Sim, s: Settlement, amount: number, cultureId: number, religionId: number): void {
  if (amount <= 0) return;
  if (s.mode === 'cohort') {
    const profile = [0.08, 0.07, 0.07, 0.12, 0.14, 0.13, 0.1, 0.08, 0.06, 0.05, 0.04, 0.03, 0.02, 0.01, 0, 0, 0];
    for (let b = 0; b < AGE_BANDS; b++) s.cohorts[b] += amount * profile[b];
  } else {
    const n = Math.round(amount);
    record(sim, s.civId, 'resolution', n - amount); // whole people only in individual mode
    for (let k = 0; k < n; k++) {
      const p = createPerson(sim, {
        born: sim.year - sim.rng.int(0, 40),
        species: s.species,
        civId: s.civId,
        settlementId: s.id,
        cultureId,
        religionId,
        job: 'laborer',
      });
      s.members.push(p.id);
    }
  }
}
