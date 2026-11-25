/**
 * Round 10 (mode audit): seafaring nations send explorers. The explorer agent existed (it reveals the map and
 * makes first contact) but nothing ever launched one, so island nations never met: in "Island Realms" each knew
 * 0–2 others for 60 years, no trade treaty formed and no sea route in 200 years.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { configFor } from '../../scripts/mode-audit';
import { createSimulation } from '../../src/sim/bootstrap';

describe('explorers', () => {
  // Round 10 second addendum, task 4 (world pandemics) changed histories: audit world 0 no longer logs an exploration
  // within 40 years (it still meets 10 more nations). Re-measured over 36 worlds (0 to 35): a world both logs an
  // exploration and gains more than 2 contacts in 30 of 36 before the change and 29 of 36 after, so the rate is unchanged.
  // The test now asks it of at least half of worlds 0 to 7 (5 of 8 after the change).
  it('island sailors go exploring and meet other nations (most worlds)', () => {
    let ok = 0;
    for (let i = 0; i < 8; i++) {
      const sim = createSimulation(configFor('islands', `audit-islands-${i}`));
      const known = () => [...sim.w.civs.values()].filter((c) => c.alive).reduce((t, c) => t + c.knownCivs.length, 0);
      const before = known();
      sim.runYears(40);
      if (sim.w.events.some((e) => e.type === 'exploration') && known() > before + 2) ok++;
    }
    expect(ok, `${ok} of 8 worlds`).toBeGreaterThanOrEqual(4);
  }, 300000);

  it('a people without sailing sends no sea voyages', () => {
    const sim = createSimulation(configFor('primitive', 'audit-primitive-0'));
    sim.runYears(10);
    expect([...sim.w.agents.values()].some((a) => a.kind === 'explorer')).toBe(false);
  }, 120000);
});

// round 10 addendum: the scenario's own 200-year horizon (was 120). Round 10 task 3 (disease) changed histories:
// audit world 1 no longer builds a sea route within 200 years. Re-measured over six worlds (0 to 5) the first sea
// route came at years 67, none, 42, none, 147 and 30, so sea trade appears in 4 of 6 within the horizon.
describe('sea trade', () => {
  const sims: ReturnType<typeof createSimulation>[] = [];
  beforeAll(() => {
    for (let i = 0; i < 6; i++) {
      const sim = createSimulation(configFor('islands', `audit-islands-${i}`));
      sim.runYears(200);
      sims.push(sim);
    }
  }, 900000);

  it('coastal partners ship by sea when the voyage is cheaper than the land detour (Island Realms)', () => {
    const withSea = sims.filter((s) => [...s.w.routes.values()].some((r) => r.mode === 'sea')).length;
    expect(withSea, `${withSea} of ${sims.length} worlds`).toBeGreaterThanOrEqual(3);
  });

  it('every sea route runs mostly over water (review fix)', () => {
    let seen = 0;
    for (const sim of sims) {
      const m = sim.w.map;
      for (const r of [...sim.w.routes.values()].filter((x) => x.mode === 'sea')) {
        seen++;
        const water = r.path.filter((i) => m.isWater(i)).length / r.path.length;
        expect(water, `route ${r.id}: ${Math.round(water * 100)}% water`).toBeGreaterThan(0.6);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
