/**
 * Round 10: which god powers a world allows. 'all' is god mode, 'grounded' is Realistic (real people, real
 * animals, shaping the land, natural disasters), 'none' is Observer. Older saves have no powerSet: an observer
 * save stays 'none', anything else is 'all'.
 */
import type { PowerSet, WorldSettings } from '../sim/types';

export const POWER_SETS: readonly PowerSet[] = ['all', 'grounded', 'none'];

export function powerSetOf(s: WorldSettings): PowerSet {
  return s.powerSet ?? (s.observer ? 'none' : 'all');
}

export function powerAllowed(s: WorldSettings, p: { grounded?: boolean }): boolean {
  const set = powerSetOf(s);
  return set === 'all' || (set === 'grounded' && !!p.grounded);
}

/** Inspector god controls (trait editor, missions, laws) belong to god mode only. */
export const godMode = (s: WorldSettings): boolean => powerSetOf(s) === 'all';
