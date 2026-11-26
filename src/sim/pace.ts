/**
 * Round 10: development pace. 'slow' (Realistic's default) makes placed humans take generations to settle
 * and centuries to build cities; 'standard' leaves every lever at exactly 1, so standard worlds are unchanged.
 */
import type { WorldSettings } from './types';
import { BALANCE } from '../config/balance';
import { clamp01 } from '../core/math';

export type PaceLever = 'settle' | 'research' | 'build' | 'birth';

export function paceMult(s: Pick<WorldSettings, 'pace'>, lever: PaceLever): number {
  if (s.pace !== 'slow') return 1;
  return lever === 'settle' ? BALANCE.slowSettleMult : lever === 'research' ? BALANCE.slowResearchMult : lever === 'build' ? BALANCE.slowBuildMult : BALANCE.slowBirthMult;
}

/**
 * Round 10 second addendum (Task 8f): the Slow birth lever acts on the pre-transition share of fertility only. It stands
 * in for the slow growth of early farming and foraging peoples (it was calibrated on placed humans, VALIDATION §R10).
 * Modern fertility is already set by the demographic transition; cutting it further made modern towns shrink (about
 * 2.1 children per woman fell to about 1.4) and Realistic worlds that start in a modern era lost over 90% of their
 * people in 300 years. `transition` is fertilityTransition (0..1); a society before the transition keeps the full lever.
 */
export function birthPaceMult(s: Pick<WorldSettings, 'pace'>, transition: number): number {
  const k = paceMult(s, 'birth');
  if (k === 1 || !(transition > 0)) return k; // before the transition: exactly the calibrated lever
  return 1 - (1 - k) * (1 - clamp01(transition));
}
