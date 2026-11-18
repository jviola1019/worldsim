/**
 * Population accounting ledger.
 *
 * Boundaries:
 *  - a civilization's population = residents of its settlements + members of its bands + its people in
 *    transit (migrant / settler agents) + its space colonies;
 *  - the world's population = the same summed over everything (no civilization owns nothing).
 *
 * Ledgers are CUMULATIVE (never reset), so the difference between any two sample points is exact even
 * after statistical decimation. For every boundary and period:
 *
 *   closing − opening = births − deaths(all causes) + immigration − emigration
 *                       + transferIn − transferOut − destroyed − lost + resolution + divine
 *
 * Moves inside a boundary (e.g. a migrant between two towns of the same nation) are not recorded at that
 * boundary. At world level emigration/immigration/transfers are internal and therefore never recorded.
 * `resolution` is the explicit rounding when cohorts (fractional people) become individuals (whole people).
 */
import type { Sim } from '../sim/context';
import type { Settlement } from '../sim/types';
import { cohortTotal } from './demography';

export const LEDGER_KEYS = [
  'births', 'deaths', 'famine', 'disease', 'war', 'disaster',
  'emigration', 'immigration', 'transferIn', 'transferOut',
  'destroyed', 'lost', 'resolution', 'divine',
] as const;
export type LedgerKey = (typeof LEDGER_KEYS)[number];
export type PopLedger = Record<LedgerKey, number>;

/** Sign of each key in the identity above. */
export const LEDGER_SIGN: Record<LedgerKey, 1 | -1> = {
  births: 1, deaths: -1, famine: -1, disease: -1, war: -1, disaster: -1,
  emigration: -1, immigration: 1, transferIn: 1, transferOut: -1,
  destroyed: -1, lost: -1, resolution: 1, divine: 1,
};

const INTERNAL_AT_WORLD: ReadonlySet<LedgerKey> = new Set(['emigration', 'immigration', 'transferIn', 'transferOut']);

export function emptyLedger(): PopLedger {
  const l = {} as PopLedger;
  for (const k of LEDGER_KEYS) l[k] = 0;
  return l;
}

/** Record `n` people under `key` for civ `civId` (0 = no civilization) and, unless internal, for the world. */
export function record(sim: Sim, civId: number, key: LedgerKey, n: number): void {
  if (!n || !Number.isFinite(n)) return;
  const w = sim.w;
  if (civId) {
    const civ = w.civs.get(civId);
    if (civ) (civ.ledger ??= emptyLedger())[key] += n;
  }
  if (!INTERNAL_AT_WORLD.has(key)) (w.popLedger ??= emptyLedger())[key] += n;
}

/** Record a vital event at a settlement: keeps the settlement's yearly flows and the ledgers in step. */
export function flow(sim: Sim, s: Settlement, key: 'births' | 'deaths' | 'famine' | 'disease' | 'war' | 'disaster', n: number): void {
  if (!n || !Number.isFinite(n)) return;
  s.flows[key] += n;
  record(sim, s.civId, key, n);
}

/** A cross-boundary move of `n` people between civilizations (no-op when both are the same). */
export function migrate(sim: Sim, fromCiv: number, toCiv: number, n: number): void {
  if (fromCiv === toCiv || !n) return;
  record(sim, fromCiv, 'emigration', n);
  record(sim, toCiv, 'immigration', n);
}

/** People changing allegiance without moving (annexation, secession, band splitting off as a new tribe). */
export function transfer(sim: Sim, fromCiv: number, toCiv: number, n: number): void {
  if (fromCiv === toCiv || !n) return;
  record(sim, fromCiv, 'transferOut', n);
  record(sim, toCiv, 'transferIn', n);
}

/** Live residents of a settlement (independent of the monthly-cached `s.pop`). */
export function residents(s: Settlement): number {
  return s.mode === 'cohort' ? cohortTotal(s.cohorts) : s.members.length;
}

/** Population inside the boundary of civ `civId`, or of the whole world when `civId` is undefined. */
export function boundaryPopulation(sim: Sim, civId?: number): number {
  const w = sim.w;
  let p = 0;
  for (const s of w.settlements.values()) if (civId === undefined || s.civId === civId) p += residents(s);
  for (const b of w.bands.values()) if (civId === undefined || b.civId === civId) p += b.members.length;
  for (const a of w.agents.values()) if (a.pop > 0 && (civId === undefined || a.civId === civId)) p += a.pop;
  for (const c of w.colonies.values()) if (civId === undefined || c.civId === civId) p += c.pop;
  return p;
}

/** Net change implied by a ledger difference (`to` − `from`, cumulative ledgers). */
export function ledgerNet(from: PopLedger | undefined, to: PopLedger): number {
  let n = 0;
  for (const k of LEDGER_KEYS) n += LEDGER_SIGN[k] * (to[k] - (from?.[k] ?? 0));
  return n;
}

