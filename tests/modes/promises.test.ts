/**
 * Round 10, Task 9: every kept game mode keeps the promises its description makes (the cheap, start-of-world
 * ones; the long ones are measured by scripts/mode-audit.ts and recorded in VALIDATION §R10).
 */
import { describe, it, expect } from 'vitest';
import { MODES, configFor, snapshot } from '../../scripts/mode-audit';
import { createSimulation } from '../../src/sim/bootstrap';

describe('game modes keep their promises', () => {
  for (const spec of MODES) {
    const starts = spec.promises.filter((p) => p.at === 'start');
    if (!starts.length) continue;
    it(`${spec.key}: ${starts.map((p) => p.id).join(', ')}`, () => {
      const sim = createSimulation(configFor(spec.key, `audit-${spec.key}-0`));
      const st = snapshot(sim);
      for (const p of starts) expect(p.check(sim, st), `${spec.key}/${p.id}: ${p.text}`).toBe(true);
    }, 60000);
  }

  it('Space Race: nations start in the atomic and space era (10), the cap on starts', () => {
    const sim = createSimulation(configFor('space_race', 'audit-space_race-0'));
    expect([...sim.w.civs.values()].filter((c) => c.alive).every((c) => c.era >= 10)).toBe(true);
  }, 60000);

  it('The Long Standoff and Modern Geopolitics start in the atomic age', () => {
    for (const k of ['standoff', 'modern']) {
      const sim = createSimulation(configFor(k, `audit-${k}-0`));
      expect([...sim.w.civs.values()].filter((c) => c.alive).every((c) => c.era >= 10), k).toBe(true);
    }
  }, 60000);
});
