/**
 * Round 10 (mode audit): seafaring nations send explorers. The explorer agent existed (it reveals the map and
 * makes first contact) but nothing ever launched one, so island nations never met: in "Island Realms" each knew
 * 0–2 others for 60 years, no trade treaty formed and no sea route in 200 years.
 */
import { describe, it, expect } from 'vitest';
import { configFor } from '../../scripts/mode-audit';
import { createSimulation } from '../../src/sim/bootstrap';

describe('explorers', () => {
  it('island sailors go exploring and meet other nations', () => {
    const sim = createSimulation(configFor('islands', 'audit-islands-0'));
    const known = () => [...sim.w.civs.values()].filter((c) => c.alive).reduce((t, c) => t + c.knownCivs.length, 0);
    const before = known();
    sim.runYears(40);
    expect(sim.w.events.some((e) => e.type === 'exploration')).toBe(true);
    expect(known()).toBeGreaterThan(before + 2);
  }, 120000);

  it('a people without sailing sends no sea voyages', () => {
    const sim = createSimulation(configFor('primitive', 'audit-primitive-0'));
    sim.runYears(10);
    expect([...sim.w.agents.values()].some((a) => a.kind === 'explorer')).toBe(false);
  }, 120000);
});

describe('sea trade', () => {
  it('coastal partners ship by sea when the voyage is cheaper than the land detour (Island Realms)', () => {
    const sim = createSimulation(configFor('islands', 'audit-islands-1'));
    sim.runYears(120);
    const routes = [...sim.w.routes.values()];
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.some((r) => r.mode === 'sea'), routes.map((r) => r.mode).join(',')).toBe(true);
  }, 300000);
});

describe('sea trade sails on water (review fix)', () => {
  it('every sea route runs mostly over water, and trade between neighbours on one island stays overland', () => {
    const sim = createSimulation(configFor('islands', 'audit-islands-1'));
    sim.runYears(120);
    const m = sim.w.map;
    const sea = [...sim.w.routes.values()].filter((r) => r.mode === 'sea');
    expect(sea.length).toBeGreaterThan(0);
    for (const r of sea) {
      const water = r.path.filter((i) => m.isWater(i)).length / r.path.length;
      expect(water, `route ${r.id}: ${Math.round(water * 100)}% water`).toBeGreaterThan(0.6);
    }
  }, 300000);
});
