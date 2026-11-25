/**
 * Round 10 second addendum (Task 4): world pandemics. A yearly draw whose chance rises with connectivity
 * (rail, steamships, flight), a heavy-tailed severity draw calibrated so about 1 in 8 pandemics would kill
 * at least 1% of the world, and one summary event per pandemic when it ends.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { connectivity, pandemicChance, drawSeverity, startPandemic, closePandemics, pandemicYearly } from '../../src/population/pandemic';
import { diseaseMonthly } from '../../src/population/disease';
import { BALANCE } from '../../src/config/balance';
import { Rng } from '../../src/core/rng';

function world(seed: string, era = 4) {
  const sim = makeSim(seed, 64, (c) => { c.settings.startEra = era; c.settings.startCivs = 3; });
  sim.w.laws.diseases = true;
  return sim;
}

describe('pandemic: connectivity and chance', () => {
  it('connectivity is 0 with one settlement and within 0..1 otherwise', () => {
    const sim = world('pan-1', 10);
    expect(sim.w.settlements.size).toBeGreaterThan(1);
    const c = connectivity(sim);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
    const keep = [...sim.w.settlements.keys()][0];
    for (const id of [...sim.w.settlements.keys()]) if (id !== keep) sim.w.settlements.delete(id);
    expect(connectivity(sim)).toBe(0);
  });

  it('chance is the pre-industrial rate at connectivity 0 and the modern rate at 1', () => {
    const sim = world('pan-2', 4);
    for (const c of sim.w.civs.values()) c.era = 4;
    expect(connectivity(sim)).toBe(0);
    expect(pandemicChance(sim)).toBeCloseTo(BALANCE.pandemicPreIndustrial, 12);
    const ids = [...sim.w.settlements.keys()];
    expect(ids.length).toBeGreaterThan(1);
    for (const s of sim.w.settlements.values()) if (!s.links.length) s.links.push(ids.find((i) => i !== s.id)!);
    for (const c of sim.w.civs.values()) c.era = 10;
    expect(connectivity(sim)).toBe(1);
    expect(pandemicChance(sim)).toBeCloseTo(BALANCE.pandemicModern, 12);
  });

  it('nothing is drawn when the epidemics law is off', () => {
    const sim = world('pan-3', 10);
    sim.w.laws.diseases = false;
    const before = sim.w.diseases.size;
    for (let k = 0; k < 200; k++) pandemicYearly(sim);
    expect(sim.w.diseases.size).toBe(before);
  });
});

describe('pandemic: severity draw', () => {
  it('200 seeded draws: r0 in 1.4-3, and the share meant to kill at least 1% of the world is within 0.05-0.25', () => {
    const rng = new Rng('pandemic-severity');
    let severe = 0;
    for (let k = 0; k < 200; k++) {
      const d = drawSeverity(rng);
      expect(d.r0).toBeGreaterThanOrEqual(1.4);
      expect(d.r0).toBeLessThanOrEqual(3);
      expect(d.lethality).toBeGreaterThan(0);
      expect(d.lethality).toBeLessThanOrEqual(1);
      expect(d.targetShare).toBeGreaterThan(0);
      if (d.targetShare >= 0.01) severe++;
    }
    expect(severe / 200).toBeGreaterThanOrEqual(0.05);
    expect(severe / 200).toBeLessThanOrEqual(0.25);
  });
});

describe('pandemic: spread and summary', () => {
  it('a forced pandemic in a two-settlement linked world reaches the second town and logs exactly one pandemic event', () => {
    const sim = world('pan-4', 4);
    const [a, b] = [...sim.w.settlements.values()];
    for (const id of [...sim.w.settlements.keys()]) if (id !== a.id && id !== b.id) sim.w.settlements.delete(id);
    a.links = [b.id];
    b.links = [a.id];
    for (const s of [a, b]) { s.pop = 10000; s.epidemics = []; s.immunity = {}; }
    for (const c of sim.w.civs.values()) { c.caps.diseaseControl = 0; c.caps.healthcare = 0; c.caps.sanitation = 0; }
    const d = startPandemic(sim, { r0: 3, lethality: 0.2, targetShare: 0.19 });
    expect(d).toBeDefined();
    expect(d!.pandemic).toBe(true);
    expect(d!.origin === a.id || d!.origin === b.id).toBe(true);
    const other = d!.origin === a.id ? b : a;
    let reached = false;
    for (let m = 0; m < 72; m++) {
      for (const s of [a, b]) diseaseMonthly(sim, s, sim.w.civs.get(s.civId)!);
      if (other.epidemics.some((e) => e.diseaseId === d!.id)) reached = true;
    }
    expect(reached).toBe(true);
    expect([a, b].some((s) => s.epidemics.some((e) => e.diseaseId === d!.id))).toBe(false);
    closePandemics(sim);
    closePandemics(sim); // a second pass must not log it again
    const evs = sim.w.events.filter((e) => e.type === 'pandemic');
    expect(evs.length).toBe(1);
    expect(d!.ended).toBeDefined();
    expect(evs[0].title).toContain(d!.name);
    expect(evs[0].title).toMatch(/%/);
  });
});
