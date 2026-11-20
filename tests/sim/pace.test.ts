/**
 * Round 10: Slow pace. Placed humans take generations to settle and centuries to build cities;
 * Standard pace is untouched (every lever exactly 1).
 */
import { describe, it, expect } from 'vitest';
import { paceMult } from '../../src/sim/pace';
import { spawnBand } from '../../src/population/bands';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import { makeSim } from '../helpers';

/** An empty world with one band of 24 humans placed next to fresh water (as in scripts/pace-calibrate.ts). */
export function placedWorld(seed: string, pace: 'standard' | 'slow', size = 128) {
  const sim = makeSim(seed, size, (c) => { c.settings.startCivs = 0; c.settings.startEra = 1; c.settings.pace = pace; });
  const m = sim.w.map;
  for (let i = 0; i < m.n; i += 7) {
    const x = i % m.w, y = (i / m.w) | 0;
    if (m.hasFreshWater(i) && !m.isWater(i) && x > 20 && y > 20 && x < m.w - 20 && spawnBand(sim, x, y, 'human', 24)) break;
  }
  return sim;
}

describe('pace', () => {
  it('standard pace is exactly 1 for every lever', () => {
    for (const lever of ['settle', 'research', 'build', 'birth'] as const) {
      expect(paceMult({ pace: 'standard' } as never, lever)).toBe(1);
      expect(paceMult({} as never, lever)).toBe(1);
    }
  });

  it('slow pace slows settling', () => {
    expect(paceMult({ pace: 'slow' } as never, 'settle')).toBeLessThan(0.2);
  });

  for (const seed of ['pace-a', 'pace-b']) {
    it(`slow world (${seed}): no village in the first 40 years`, () => {
      const sim = placedWorld(seed, 'slow');
      expect(sim.w.bands.size).toBe(1);
      sim.runYears(40);
      expect(sim.w.settlements.size).toBe(0);
      expect(sim.w.bands.size).toBeGreaterThan(0); // still alive, still wandering
    }, 120000);
  }

  it('a slow world saved and reloaded continues identically', () => {
    const sim = placedWorld('pace-c', 'slow', 64);
    sim.runYears(5);
    sim.syncRng();
    const copy = new Simulation(decodeWorld(encodeWorld(sim.w)));
    sim.runYears(20);
    copy.runYears(20);
    sim.syncRng(); copy.syncRng();
    expect(encodeWorld(copy.w)).toEqual(encodeWorld(sim.w));
  }, 120000);
});
