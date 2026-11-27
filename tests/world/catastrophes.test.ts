/**
 * Task 8 part C (catastrophe realism): an airburst explodes in the air and leaves no crater.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { asteroidImpact, AIRBURST_RADIUS } from '../../src/world/catastrophes';
import { B } from '../../src/civilizations/buildingTypes';
import type { Sim } from '../../src/sim/context';

/** A land tile with only land within 4 tiles. */
function inland(sim: Sim): [number, number] {
  const m = sim.w.map;
  for (let i = 0; i < m.n; i++) {
    if (!m.isLand(i)) continue;
    const x = m.xOf(i), y = m.yOf(i);
    if (x < 7 || y < 7 || x > m.w - 8 || y > m.h - 8) continue;
    let water = 0;
    m.forRadius(x, y, 4, (j) => { if (!m.isLand(j)) water++; });
    if (!water) return [x, y];
  }
  throw new Error('no inland site');
}

describe('an airburst (Tunguska-class) leaves no crater', () => {
  it('it flattens the forest over about 2,150 km² (21 tiles of ~100 km²) and burns only near ground zero, with no crater', () => {
    const sim = makeSim('airburst-1', 96, (c) => { c.settings.startCivs = 0; });
    const m = sim.w.map;
    const [x, y] = inland(sim);
    m.forRadius(x, y, 6, (j) => { m.veg[j] = 200; m.fire[j] = 0; });
    const before = Array.from(m.veg);
    asteroidImpact(sim, x, y, 'airburst');
    let flattened = 0, burning = 0;
    m.forRadius(x, y, 6, (j, tx, ty, d2) => {
      expect(m.bld[j], 'no crater').not.toBe(B.CRATER);
      if (m.veg[j] <= before[j] * 0.35) flattened++;
      if (m.fire[j]) { burning++; expect(Math.hypot(tx - x, ty - y), 'fires only near ground zero').toBeLessThanOrEqual(1); }
      if (d2 > AIRBURST_RADIUS * AIRBURST_RADIUS) expect(m.veg[j], 'beyond the flattened zone').toBe(before[j]);
    });
    expect(flattened).toBeGreaterThanOrEqual(19);
    expect(flattened).toBeLessThanOrEqual(25);
    expect(burning).toBeGreaterThan(0);
  });
});
