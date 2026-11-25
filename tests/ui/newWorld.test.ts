/**
 * Starts, disease and predators, Task 2: the New World screen's pure helpers. The era confirmation shows only
 * for a start after Prehistoric (on the Scenario screen, only when the player moved the era away from the
 * scenario's own), and "Randomize settings" never breaks the chosen start's fixed rules.
 */
import { describe, it, expect } from 'vitest';
import { defaultConfig, presetByKey, MAX_START_ERA, type WorldConfig } from '../../src/config/laws';
import { needsEraConfirm, randomizeForStart } from '../../src/ui/screens/NewWorldScreen';

const withEra = (era: number): WorldConfig => {
  const c = defaultConfig();
  c.settings.startEra = era;
  return c;
};

describe('needsEraConfirm', () => {
  it('asks nothing for a Prehistoric start', () => expect(needsEraConfirm(withEra(1))).toBe(false));
  it('asks before a start after Prehistoric', () => expect(needsEraConfirm(withEra(4))).toBe(true));
  it('asks nothing for a scenario at its own era', () => expect(needsEraConfirm(withEra(10), 10)).toBe(false));
  it('asks when the player moved a scenario to another era', () => expect(needsEraConfirm(withEra(5), 3)).toBe(true));
  it('asks nothing when a scenario is moved back to Prehistoric', () => expect(needsEraConfirm(withEra(1), 3)).toBe(false));
});

describe('randomizeForStart keeps the start rules', () => {
  const start = (key: 'realistic' | 'god' | 'observer') => {
    const c = defaultConfig();
    presetByKey(key)!.apply(c);
    return c;
  };

  it('Realistic: never fantasy or alien, always grounded powers and Slow pace (200 rolls)', () => {
    for (let k = 0; k < 200; k++) {
      const c = randomizeForStart(start('realistic'), 'realistic');
      expect(c.settings.fantasy || c.gen.fantasy || c.laws.fantasyCreatures).toBe(false);
      expect(c.settings.alien || c.gen.alien).toBe(false);
      expect(c.laws.horrors).toBe(false);
      expect(c.settings.powerSet).toBe('grounded');
      expect(c.settings.pace).toBe('slow');
      expect(c.settings.startEra).toBeGreaterThanOrEqual(1);
      expect(c.settings.startEra).toBeLessThanOrEqual(MAX_START_ERA);
    }
  });

  it('Observer: never fantasy or alien, no powers (200 rolls)', () => {
    for (let k = 0; k < 200; k++) {
      const c = randomizeForStart(start('observer'), 'observer');
      expect(c.settings.fantasy || c.gen.fantasy || c.laws.fantasyCreatures).toBe(false);
      expect(c.settings.alien || c.gen.alien).toBe(false);
      expect(c.settings.powerSet).toBe('none');
      expect(c.settings.observer).toBe(true);
    }
  });

  it('keeps the name, seed, size and map shape, and does not change its input', () => {
    const c = start('god');
    c.name = 'Kept';
    c.gen.seed = 'seed-kept';
    const before = JSON.stringify(c);
    const r = randomizeForStart(c, 'god');
    expect(JSON.stringify(c)).toBe(before);
    expect([r.name, r.gen.seed, r.gen.width, r.gen.height, r.gen.shape]).toEqual([c.name, c.gen.seed, c.gen.width, c.gen.height, c.gen.shape]);
  });

  it('a Prehistoric Realistic roll starts empty (you place the first humans)', () => {
    for (let k = 0; k < 100; k++) {
      const c = randomizeForStart(start('realistic'), 'realistic');
      if (c.settings.startEra === 1) expect(c.settings.startCivs).toBe(0);
    }
  });
});
