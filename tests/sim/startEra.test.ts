/**
 * Round 10 (mode audit): a developed start begins in the era the preset promises. Before the fix, era-4/7/10
 * starts came out one era low: the current era's techs were granted at ~34% against a 35% era threshold.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';

describe('developed starts', () => {
  for (const era of [4, 7, 10]) {
    for (const seed of ['se-a', 'se-b']) {
      it(`a start in era ${era} (${seed}) puts every nation in era ${era}`, () => {
        const sim = makeSim(`${seed}-${era}`, 96, (c) => { c.settings.startEra = era; c.settings.startCivs = 6; });
        const eras = [...sim.w.civs.values()].filter((c) => c.alive).map((c) => c.era);
        expect(eras.length).toBeGreaterThan(0);
        expect(eras.every((e) => e === era), eras.join(',')).toBe(true);
      });
    }
  }
});
