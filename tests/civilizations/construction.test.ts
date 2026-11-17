import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { progressConstruction } from '../../src/civilizations/urban';
import { GOOD_COUNT } from '../../src/world/resources';
import { B } from '../../src/civilizations/buildingTypes';

describe('construction never creates goods (regression: NaN economy at year ~700)', () => {
  it.each([-500, Number.NaN])('builders = %s leaves stocks and the job untouched', (builders) => {
    const sim = makeSim('cons-1', 96);
    sim.runYears(60);
    const s = [...sim.w.settlements.values()].find((x) => x.civId && sim.w.civs.get(x.civId)?.alive)!;
    const civ = sim.w.civs.get(s.civId)!;
    // a pending project with material needs and labor left
    const tile = sim.w.map.idx(s.x, s.y);
    const need = new Array(GOOD_COUNT).fill(0);
    need[1] = 50; need[2] = 50;
    s.construction = { type: B.WORKSHOP, tile, progress: 0, need, labor: 100, upgrade: true };
    const before = civ.stock.slice();
    progressConstruction(sim, s, civ, builders);
    for (let g = 0; g < GOOD_COUNT; g++) expect(civ.stock[g]).toBeLessThanOrEqual(before[g]);
    expect(s.construction?.labor ?? 100).toBeLessThanOrEqual(100);
    for (const v of civ.stock) expect(Number.isFinite(v)).toBe(true);
  }, 60000);
});
