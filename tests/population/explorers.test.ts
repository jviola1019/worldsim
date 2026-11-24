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
