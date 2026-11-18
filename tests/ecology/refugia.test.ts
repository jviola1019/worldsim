import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';

describe('hunting leaves refuge populations (regression: total ungulate extinction stalled half of all worlds in the Medieval era)', () => {
  it('seed modern-1: domesticable animals survive 300 years of foraging and nations domesticate them', () => {
    const sim = makeSim('modern-1', 128);
    sim.runYears(300);
    const domesticable = ['goat', 'sheep', 'cow', 'boar', 'chicken', 'camel', 'horse'];
    const alive = [...sim.w.herds.values()].filter((h) => domesticable.includes(h.species)).reduce((a, h) => a + h.count, 0);
    expect(alive).toBeGreaterThan(50);
    const civs = [...sim.w.civs.values()].filter((c) => c.alive);
    expect(civs.some((c) => c.techs.domestication?.known)).toBe(true);
  }, 180000);
});
