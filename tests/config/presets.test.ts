/**
 * Round 10: Realistic is a grounded sandbox that starts empty and slow; Observer keeps the old hands-off
 * Realistic exactly (so long-run balance data stays comparable).
 */
import { describe, it, expect } from 'vitest';
import { PRESETS, defaultConfig } from '../../src/config/laws';
import { createSimulation } from '../../src/sim/bootstrap';
import { TECHS } from '../../src/technology/techData';
import { techPermitted } from '../../src/technology/research';

const applied = (key: string) => {
  const c = defaultConfig();
  c.gen.width = 64; c.gen.height = 64; c.gen.seed = 'preset-' + key;
  PRESETS.find((p) => p.key === key)!.apply(c);
  return c;
};

describe('Realistic and Observer presets', () => {
  it('realistic preset is an empty, grounded, slow sandbox with wildlife', () => {
    const c = applied('realistic');
    expect(c.settings.startCivs).toBe(0);
    expect(c.settings.powerSet).toBe('grounded');
    expect(c.settings.pace).toBe('slow');
    expect(c.settings.observer).toBeFalsy();
    expect(c.settings.fantasy).toBe(false);
    expect(c.settings.empty).toBe(false);
    expect(c.laws.horrors).toBe(false);
    expect(c.laws.fantasyCreatures).toBe(false);
    // round 10 addendum (owner): every science-based technology, era 15 included
    expect(c.settings.realism).toBe('unrestricted');
    expect(c.laws.speculativeTech).toBe(true);
    expect(c.laws.advancedWeapons).toBe(true);
    const sim = createSimulation(c);
    expect(TECHS.every((t) => techPermitted(sim, t))).toBe(true);
    expect(sim.year).toBe(0);
    expect(sim.w.herds.size).toBeGreaterThan(0);
    expect(sim.w.bands.size).toBe(0);
    expect(sim.w.civs.size).toBe(0);
  });

  it('observer preset equals the old (round-9) Realistic, with no powers and standard pace', () => {
    const c = applied('observer');
    expect({
      startEra: c.settings.startEra, startCivs: c.settings.startCivs, realism: c.settings.realism, fantasy: c.settings.fantasy,
      alien: c.settings.alien, disasterFrequency: c.settings.disasterFrequency, observer: c.settings.observer,
      fantasyCreatures: c.laws.fantasyCreatures, speculativeTech: c.laws.speculativeTech, disasters: c.laws.disasters,
      diseases: c.laws.diseases, horrors: c.laws.horrors, powerSet: c.settings.powerSet, pace: c.settings.pace ?? 'standard',
    }).toEqual({
      startEra: 1, startCivs: 5, realism: 'grounded', fantasy: false, alien: false, disasterFrequency: 1, observer: true,
      fantasyCreatures: false, speculativeTech: false, disasters: true, diseases: true, horrors: false, powerSet: 'none', pace: 'standard',
    });
  });
});
