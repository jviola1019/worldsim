/**
 * Round 10: development pace. 'slow' (Realistic's default) makes placed humans take generations to settle
 * and centuries to build cities; 'standard' leaves every lever at exactly 1, so standard worlds are unchanged.
 */
import type { WorldSettings } from './types';
import { BALANCE } from '../config/balance';

export type PaceLever = 'settle' | 'research' | 'build' | 'birth';

export function paceMult(s: Pick<WorldSettings, 'pace'>, lever: PaceLever): number {
  if (s.pace !== 'slow') return 1;
  return lever === 'settle' ? BALANCE.slowSettleMult : lever === 'research' ? BALANCE.slowResearchMult : lever === 'build' ? BALANCE.slowBuildMult : BALANCE.slowBirthMult;
}
