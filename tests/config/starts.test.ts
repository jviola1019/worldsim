/**
 * Round 10 second addendum: three starts, start era capped at Atomic & Space, old presets as variants.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PRESETS, START_VARIANTS, MAX_START_ERA, clampStartEra, eraPeopleDefault, presetByKey, defaultConfig, randomizeConfig } from '../../src/config/laws';
import { SCENARIOS } from '../../src/scenarios/scenarios';
import { makeSim } from '../helpers';
import { TECH_BY_ID } from '../../src/technology/techData';
import { createSimulation } from '../../src/sim/bootstrap';

afterEach(() => vi.restoreAllMocks());

describe('starts', () => {
  it('has exactly three presets in order', () => {
    expect(PRESETS.map((p) => p.key)).toEqual(['realistic', 'god', 'observer']);
    expect(PRESETS[1].name).toBe('God mode');
    expect(presetByKey('primitive')!.key).toBe('god');
    expect(START_VARIANTS.map((v) => v.key)).toEqual(['kingdoms', 'industrial', 'modern', 'collapse', 'alien']);
  });

  it('no preset, variant, scenario or random roll starts past the cap', () => {
    for (const p of PRESETS) {
      const c = defaultConfig(); p.apply(c);
      expect(c.settings.startEra).toBeLessThanOrEqual(MAX_START_ERA);
    }
    for (const v of START_VARIANTS) {
      const c = defaultConfig(); presetByKey('god')!.apply(c); v.apply(c);
      expect(c.settings.startEra).toBeLessThanOrEqual(MAX_START_ERA);
    }
    for (const s of SCENARIOS) {
      const c = defaultConfig(); s.apply(c);
      expect(c.settings.startEra, s.key).toBeLessThanOrEqual(MAX_START_ERA);
    }
    let x = 12345;
    vi.spyOn(Math, 'random').mockImplementation(() => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296));
    for (let i = 0; i < 1000; i++) {
      const c = defaultConfig(); randomizeConfig(c);
      expect(c.settings.startEra).toBeLessThanOrEqual(MAX_START_ERA);
      expect(c.settings.startEra).toBeGreaterThanOrEqual(1);
    }
  });

  it('collapse moves era 1 to 3 but keeps a later era', () => {
    const c = defaultConfig(); presetByKey('god')!.apply(c);
    START_VARIANTS.find((v) => v.key === 'collapse')!.apply(c);
    expect(c.settings.startEra).toBe(3);
    expect(c.scenario).toBe('collapse');
  });

  it('clampStartEra', () => {
    expect(clampStartEra(13)).toBe(10);
    expect(clampStartEra(0)).toBe(1);
    expect(clampStartEra(4.4)).toBe(4);
  });

  it('createWorld clamps an over-cap era', () => {
    const c = defaultConfig(); c.gen.width = 64; c.gen.height = 64; c.gen.seed = 'cap-14';
    c.settings.startEra = 14;
    const w = createSimulation(c).w;
    expect(w.meta.settings.startEra).toBeLessThanOrEqual(10);
    const eras = [...w.civs.values()].map((v) => v.era);
    expect(Math.max(...eras)).toBeLessThanOrEqual(10);
  });

  it('era people defaults', () => {
    expect(eraPeopleDefault('realistic', 1)).toBe(0);
    expect(eraPeopleDefault('god', 1)).toBe(5);
    expect(eraPeopleDefault('observer', 1)).toBe(5);
    expect(eraPeopleDefault('god', 4)).toBe(8);
    expect(eraPeopleDefault('god', 9)).toBe(8);
    expect(eraPeopleDefault('observer', 10)).toBe(10);
  });

  it('Space Race starts at era 10', () => {
    const c = defaultConfig(); SCENARIOS.find((s) => s.key === 'space_race')!.apply(c);
    expect(c.settings.startEra).toBe(10);
  });

  it('makeSim above the cap hands out the era technologies the late-game tests rely on', () => {
    const sim = makeSim('starts-dev', 64, (c) => { c.settings.startEra = 12; });
    expect(sim.w.meta.settings.startEra).toBe(10);
    for (const civ of [...sim.w.civs.values()].filter((c) => c.alive)) {
      expect(civ.era, civ.name).toBeGreaterThanOrEqual(11);
      const digital = Object.keys(civ.techs).filter((id) => civ.techs[id].known && (TECH_BY_ID.get(id)?.era ?? 0) >= 11);
      expect(digital.length, civ.name).toBeGreaterThan(0);
    }
  });

  it('developTo respects the world rules (no speculative tech when it is off)', () => {
    const sim = makeSim('starts-rules', 64, (c) => { c.settings.startEra = 12; c.settings.realism = 'plausible'; c.laws.speculativeTech = false; });
    for (const civ of sim.w.civs.values()) for (const id of Object.keys(civ.techs)) if (civ.techs[id].known) expect(TECH_BY_ID.get(id)?.realism, id).not.toBe('speculative');
  });
});
