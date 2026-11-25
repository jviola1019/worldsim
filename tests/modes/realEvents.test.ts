/**
 * Round 10 addendum (owner): "realistic mode should include all technically possible scenarios and events" and
 * nothing that is not. Every catastrophe and ending marked realistic is triggered by world laws, not by the power
 * set (only missions and fictional horrors check the power set), so a Realistic world must open every such law;
 * fictional endings must never fire. Breadth (which events actually happen, at what rates) is measured by
 * scripts/events-audit.ts (docs/data/round10/events-audit.txt).
 */
import { describe, it, expect } from 'vitest';
import { defaultConfig, PRESETS } from '../../src/config/laws';
import { createSimulation } from '../../src/sim/bootstrap';
import { ENDINGS } from '../../src/civilizations/endings';
import { realWorld } from '../../src/powers/powerSet';

const realistic = () => {
  const c = defaultConfig();
  PRESETS.find((p) => p.key === 'realistic')!.apply(c);
  return c;
};

describe('Realistic includes every technically possible event', () => {
  it('opens every law a realistic catastrophe or ending needs', () => {
    const c = realistic();
    expect(c.laws.disasters).toBe(true); // earthquakes, eruptions, floods, storms, impacts, supervolcanoes, solar storms
    expect(c.laws.diseases).toBe(true); // pandemics, engineered pandemics, infertility
    expect(c.laws.advancedWeapons).toBe(true); // nuclear, chemical and biological weapons, cyber and orbital warfare
    expect(c.laws.speculativeTech).toBe(true); // AI takeover after AGI, runaway nanotechnology
    expect(c.settings.realism).toBe('unrestricted');
    expect(c.settings.disasterFrequency).toBe(1); // natural rates (world/catastrophes.ts)
  });

  it('marks exactly the fictional endings as unrealistic', () => {
    const fictional = Object.entries(ENDINGS).filter(([, e]) => !e.realistic).map(([k]) => k).sort();
    expect(fictional).toEqual(['blight', 'ghouls', 'monsters', 'zombies']);
  });

  it('a developed Realistic world runs 150 years without any fictional being or ending', () => {
    const c = realistic();
    c.gen.seed = 'real-events-1'; c.gen.width = 96; c.gen.height = 96;
    c.settings.startEra = 10; c.settings.startCivs = 6;
    const sim = createSimulation(c);
    expect(realWorld(sim.w.meta.settings)).toBe(true);
    sim.runYears(150);
    expect(sim.w.monsters.size).toBe(0);
    expect([...sim.w.settlements.values()].some((s) => s.horror)).toBe(false);
    const endings = [...sim.w.civs.values()].map((x) => x.ending?.type).filter(Boolean);
    for (const e of endings) expect(ENDINGS[e!].realistic, String(e)).toBe(true);
    const log = sim.w.endings?.log ?? [];
    expect(log.some((l) => ['zombies', 'ghouls', 'blight', 'monsters'].includes(l.type))).toBe(false);
  }, 300000);
});
