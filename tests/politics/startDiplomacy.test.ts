/**
 * Round 10 (mode audit): developed worlds start with a diplomatic past. In atomic-age starts every pair began
 * neutral (opinion ~0, trust ≤ 0.3) and no alliance or international organization formed in 100 years,
 * though "Modern Geopolitics" promises alliances and tense borders.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import type { Simulation } from '../../src/sim/simulation';

const live = (sim: Simulation) => [...sim.w.relations.values()].filter((r) => sim.w.civs.get(r.a)?.alive && sim.w.civs.get(r.b)?.alive && r.contact > -1e8);
const treaties = (sim: Simulation, kind: string) => [...sim.w.treaties.values()].filter((t) => t.kind === kind && t.active);

describe('developed starts have a diplomatic past', () => {
  for (const seed of ['dip-a', 'dip-b']) {
    it(`an atomic-age start (${seed}) has a bloc: friends with trust, a defensive pact, an organization, and a cold rival`, () => {
      const sim = makeSim(seed, 128, (c) => { c.settings.startEra = 10; c.settings.startCivs = 8; });
      const rels = live(sim);
      expect(rels.some((r) => r.opinion > 30 && r.trust > 0.5)).toBe(true);
      expect(treaties(sim, 'defensive').length).toBeGreaterThan(0);
      const orgs = [...sim.w.orgs.values()].filter((o) => !o.dissolved);
      expect(orgs.length).toBeGreaterThan(0);
      expect(orgs[0].members.length).toBeGreaterThanOrEqual(3);
      expect(rels.some((r) => r.opinion < -20)).toBe(true); // tense borders, not universal friendship
    });
  }

  it('a classical start has no international organizations (they would be anachronistic)', () => {
    const sim = makeSim('dip-c', 96, (c) => { c.settings.startEra = 4; c.settings.startCivs = 6; });
    expect(sim.w.orgs.size).toBe(0);
  });
});

describe('scenario objectives are not pre-completed (review fix)', () => {
  it('The Long Standoff: the start-of-world treaty organization does not count as "an organization is founded"', async () => {
    const { configFor } = await import('../../scripts/mode-audit');
    const { createSimulation } = await import('../../src/sim/bootstrap');
    const { scenarioObjectives } = await import('../../src/scenarios/scenarios');
    const org = scenarioObjectives('standoff').find((o) => o.id === 'org')!;
    expect(org.check(createSimulation(configFor('standoff', 'audit-standoff-0')))).toBe(false); // nothing done at year 0
    const bloc = makeSim('dip-a', 128, (c) => { c.settings.startEra = 10; c.settings.startCivs = 8; });
    expect(bloc.w.orgs.size).toBeGreaterThan(0); // a world that starts with a seeded bloc
    expect(org.check(bloc)).toBe(false); // …which is not "founded" during play
  });

  it('the seeded organization binds only nations that are not cold to one another', () => {
    for (const seed of ['dip-a', 'dip-b', 'dip-d']) {
      const sim = makeSim(seed, 128, (c) => { c.settings.startEra = 10; c.settings.startCivs = 8; });
      for (const o of sim.w.orgs.values()) for (const a of o.members) for (const b of o.members) {
        if (a >= b) continue;
        const r = [...sim.w.relations.values()].find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
        expect(r ? r.opinion : 0, `${seed}: ${a}-${b}`).toBeGreaterThan(-20);
      }
    }
  });
});

describe('The Long Standoff can reach its own goal (final audit fix)', () => {
  it('starts with friends and pacts but no organization, and one is founded during play', async () => {
    const { configFor } = await import('../../scripts/mode-audit');
    const { createSimulation } = await import('../../src/sim/bootstrap');
    const { scenarioObjectives } = await import('../../src/scenarios/scenarios');
    const sim = createSimulation(configFor('standoff', 'audit-standoff-0'));
    expect(sim.w.orgs.size).toBe(0); // founding one is the scenario's goal
    expect([...sim.w.relations.values()].some((r) => r.opinion > 30 && r.trust > 0.5)).toBe(true);
    const goal = scenarioObjectives('standoff').find((o) => o.id === 'org')!;
    let years = 0;
    while (!goal.check(sim) && years < 60) { sim.runYears(5); years += 5; }
    expect(goal.check(sim), `no organization after ${years} years`).toBe(true);
  }, 300000);
});
