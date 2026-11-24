/**
 * Round 10: who lives in the world, counted honestly. A nation is a living people with at least one
 * settlement; a people that only wanders in bands is a tribe. Used by the HUD, the nations list and statistics.
 */
import type { WorldState } from './types';
import { formatNumber } from '../core/math';

export interface PeoplesCount { nations: number; tribes: number; people: number }

export function countPeoples(w: WorldState): PeoplesCount {
  let nations = 0, tribes = 0, people = 0;
  for (const c of w.civs.values()) {
    if (!c.alive) continue;
    if (c.settlements.length > 0) nations++;
    else tribes++;
    people += c.population;
  }
  for (const b of w.bands.values()) people += b.members.length;
  return { nations, tribes, people };
}

// a no-break space keeps each number with its word when the line wraps ("8 nations", never "8 / nations")
const NB = '\u00a0';
const plural = (n: number, one: string, many: string) => `${n}${NB}${n === 1 ? one : many}`;

/** The HUD line: "Medieval · 1.2M people · 9 nations · 1 tribe" (zero parts left out). */
export function peoplesLine(c: PeoplesCount, eraName: string): string {
  if (c.people <= 0) return 'No people yet';
  const parts = [eraName, `${formatNumber(c.people, 1)}${NB}people`];
  if (c.nations) parts.push(plural(c.nations, 'nation', 'nations'));
  if (c.tribes) parts.push(plural(c.tribes, 'tribe', 'tribes'));
  return parts.join(' · ');
}
