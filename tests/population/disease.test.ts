import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { diseaseMonthly } from '../../src/population/disease';
import { BALANCE } from '../../src/config/balance';
import type { Disease } from '../../src/sim/types';

function setup(seed: string) {
  const sim = makeSim(seed, 64, (c) => { c.settings.startEra = 4; c.settings.startCivs = 3; });
  const s = [...sim.w.settlements.values()][0];
  const civ = sim.w.civs.get(s.civId)!;
  sim.w.laws.diseases = true;
  s.pop = 10000;
  s.epidemics = [];
  s.immunity = {};
  const d: Disease = { id: 9001, name: 'Test Fever', r0: 2.5, lethality: 0.1, duration: 1, immunity: 1200, origin: s.id, emerged: sim.year, zoonotic: false, totalDeaths: 0 };
  sim.w.diseases.set(d.id, d);
  return { sim, s, civ, d };
}

describe('disease: medicine mainly saves lives', () => {
  it('with full control, healthcare and sanitation a novel r0 2.5 disease still spreads', () => {
    const { sim, s, civ, d } = setup('dis-1');
    civ.caps.diseaseControl = 1; civ.caps.healthcare = 1; civ.caps.sanitation = 1;
    s.epidemics.push({ diseaseId: d.id, s: 0.99, i: 0.01, r: 0, deaths: 0 });
    diseaseMonthly(sim, s, civ);
    const e = s.epidemics.find((x) => x.diseaseId === d.id)!;
    expect(e.i).toBeGreaterThan(0.01);
  });

  it('full control and healthcare cut lethality to at most 15% of the base', () => {
    const { sim, s, civ, d } = setup('dis-2');
    civ.caps.diseaseControl = 1; civ.caps.healthcare = 1; civ.caps.sanitation = 1;
    s.epidemics.push({ diseaseId: d.id, s: 0.99, i: 0.01, r: 0, deaths: 0 });
    diseaseMonthly(sim, s, civ);
    const e = s.epidemics.find((x) => x.diseaseId === d.id)!;
    const rec = (1 / d.duration) * 0.01;
    const dead = rec - e.r; // r gains rec - dead
    expect(dead / rec).toBeLessThanOrEqual(0.15 * d.lethality + 1e-9);
  });

  it('transmission cut constants are as designed', () => {
    expect(BALANCE.medicineTransmissionCut).toBeLessThanOrEqual(0.3);
    expect(BALANCE.sanitationTransmissionCut).toBeLessThanOrEqual(0.25);
    expect(BALANCE.epidemicLogShare).toBe(0.005);
  });
});

describe('disease: epidemic logging threshold', () => {
  function finish(seed: string, deaths: number): number {
    const { sim, s, civ, d } = setup(seed);
    s.epidemics.push({ diseaseId: d.id, s: 0.9, i: 0.0001, r: 0.1, deaths });
    const before = sim.w.events.filter((ev) => ev.type === 'epidemic').length;
    diseaseMonthly(sim, s, civ);
    expect(s.epidemics.length).toBe(0);
    return sim.w.events.filter((ev) => ev.type === 'epidemic').length - before;
  }
  it('logs 0.6% of a 10,000 town but not 0.3%', () => {
    expect(finish('dis-3', 60)).toBe(1);
    expect(finish('dis-4', 30)).toBe(0);
  });
});
