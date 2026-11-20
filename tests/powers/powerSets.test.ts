/**
 * Round 10: worlds have a power set. Realistic is 'grounded' (real people, real animals, land shaping,
 * natural disasters); Observer is 'none'; god mode is 'all'. Old observer saves stay 'none'.
 */
import { describe, it, expect } from 'vitest';
import { POWERS, POWER_BY_ID, applyPower } from '../../src/powers/powers';
import { powerSetOf, powerAllowed } from '../../src/powers/powerSet';
import { assignMission } from '../../src/civilizations/missions';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { makeSim } from '../helpers';

const GROUNDED = [
  'raise', 'lower', 'mountain', 'ocean', 'shallow', 'river', 'fertility_up', 'fertility_down', 'res_remove',
  ...POWERS.filter((p) => p.id.startsWith('res_') && p.id !== 'res_exotic').map((p) => p.id),
  ...POWERS.filter((p) => p.id.startsWith('biome_') && !['biome_alien_grass', 'biome_corrupt', 'biome_crystal'].includes(p.id)).map((p) => p.id),
  'trees', 'clear', 'rain', ...POWERS.filter((p) => p.id.startsWith('animal_')).map((p) => p.id),
  'spawn_human',
  ...POWERS.filter((p) => p.id.startsWith('dis_')).map((p) => p.id),
  'asteroid', 'supervolcano', 'superflare', 'gamma_burst', 'emp',
];
const ctx = { selectedCiv: 0 };
const land = (sim: ReturnType<typeof makeSim>) => {
  const m = sim.w.map;
  for (let i = 0; i < m.n; i++) if (m.isLand(i) && m.hasFreshWater(i)) return [m.xOf(i), m.yOf(i)] as const;
  for (let i = 0; i < m.n; i++) if (m.isLand(i)) return [m.xOf(i), m.yOf(i)] as const;
  throw new Error('no land');
};

describe('power sets', () => {
  it('the grounded set matches the spec list', () => {
    expect(POWERS.filter((p) => p.grounded).map((p) => p.id).sort()).toEqual([...new Set(GROUNDED)].sort());
  });

  it('grounded refuses fantasy, fiction and hand-of-god politics, and changes nothing', () => {
    const sim = makeSim('ps-1', 48, (c) => { c.settings.powerSet = 'grounded'; c.settings.startEra = 4; });
    const [x, y] = land(sim);
    sim.syncRng();
    const before = encodeWorld(sim.w);
    for (const id of ['spawn_sylvan', 'monster', 'found_city', 'war', 'nuke', 'climate_warm', 'tech_grant', 'horror_zombie']) {
      expect(applyPower(sim, id, x, y, 2, ctx), id).toBe('Not available in this world');
    }
    sim.syncRng();
    expect(encodeWorld(sim.w)).toEqual(before);
  });

  it('grounded allows placing humans and real animals', () => {
    const sim = makeSim('ps-2', 48, (c) => { c.settings.powerSet = 'grounded'; c.settings.startCivs = 0; });
    const [x, y] = land(sim);
    expect(applyPower(sim, 'spawn_human', x, y, 1, ctx)).toBeNull();
    expect(sim.w.bands.size).toBe(1);
    expect(applyPower(sim, 'animal_deer', x, y, 1, ctx)).toBeNull();
  });

  it('none refuses everything, even placing humans', () => {
    const sim = makeSim('ps-3', 48, (c) => { c.settings.powerSet = 'none'; c.settings.startCivs = 0; });
    const [x, y] = land(sim);
    expect(applyPower(sim, 'spawn_human', x, y, 1, ctx)).toBe('Not available in this world');
    expect(sim.w.bands.size).toBe(0);
  });

  it('an old observer save (no powerSet) loads as none; an old god-mode save as all', () => {
    const obs = makeSim('ps-4', 32, (c) => { c.settings.observer = true; });
    delete obs.w.meta.settings.powerSet;
    obs.syncRng();
    expect(powerSetOf(decodeWorld(encodeWorld(obs.w)).meta.settings)).toBe('none');
    const god = makeSim('ps-5', 32);
    delete god.w.meta.settings.powerSet;
    expect(powerSetOf(god.w.meta.settings)).toBe('all');
    expect(powerAllowed(god.w.meta.settings, POWER_BY_ID.nuke)).toBe(true);
  });

  it('the decoder refuses an unknown power set', () => {
    const sim = makeSim('ps-6', 32);
    (sim.w.meta.settings as { powerSet?: string }).powerSet = 'godlike';
    sim.syncRng();
    expect(() => decodeWorld(encodeWorld(sim.w))).toThrow();
  });

  it('missions are a god power: refused unless the set is all', () => {
    const sim = makeSim('ps-7', 48, (c) => { c.settings.powerSet = 'grounded'; c.settings.startEra = 4; });
    const civ = [...sim.w.civs.values()][0];
    expect(assignMission(sim, civ, 'expand' as never)).toBe(false);
  });
});
