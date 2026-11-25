/**
 * Round 10: Slow pace. Placed humans take generations to settle and centuries to build cities;
 * Standard pace is untouched (every lever exactly 1).
 */
import { describe, it, expect } from 'vitest';
import { paceMult } from '../../src/sim/pace';
import { spawnBand, slowSettleFactor } from '../../src/population/bands';
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

  // round 10 addendum: daughter bands keep their lineage's arrival year. When each split restarted the 30-year settle
  // delay, bands that split faster than that never settled: pace-c had 1,272 bands and 83,344 individual people by
  // year 400, and its save grew past what JSON can hold (the checkpoint failed with 'Invalid string length')
  it('a band that splits keeps its lineage\'s arrival year, so the Slow settle delay applies once', () => {
    const sim = placedWorld('pace-c', 'slow', 64);
    const first = [...sim.w.bands.values()][0].founded;
    sim.runYears(150);
    expect(sim.w.bands.size + sim.w.settlements.size).toBeGreaterThan(1); // the people grew and split
    for (const b of sim.w.bands.values()) expect(b.founded).toBe(first);
  }, 120000);

  // round 10 addendum: population pressure. In Slow pace the settle chance rises with local crowding (other bands and
  // villages nearby): as foraging land fills, settling becomes the better choice. Without it bands kept splitting and
  // a world could hold hundreds of thousands of individual foragers, more than a save can hold.
  it('Slow pace: crowding raises a band\'s chance to settle; a lone band is unaffected', () => {
    const sim = placedWorld('pace-a', 'slow', 64);
    const b = [...sim.w.bands.values()][0];
    sim.year = b.founded + 200; // past the delay and the ramp
    const alone = slowSettleFactor(sim, b);
    expect(alone).toBeCloseTo(paceMult(sim.w.meta.settings, 'settle'), 10);
    for (let k = 0; k < 4; k++) spawnBand(sim, Math.floor(b.x) + (k % 2), Math.floor(b.y) + 1, 'human', 20);
    expect(slowSettleFactor(sim, b)).toBeGreaterThan(alone * 2);
  });
});
