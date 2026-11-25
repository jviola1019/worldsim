/**
 * Round 10 addendum: a WorldBox-style pixel hand drops placed people and animals onto the map. Visual only: it lives
 * in sim.fx (never saved or digested) and draws no random numbers; the placement itself happens on the tap.
 */
import { describe, it, expect } from 'vitest';
import { POWERS, applyPower, isPlacingPower } from '../../src/powers/powers';
import { FX_BY_POWER, isSpec } from '../../src/sim/conceptFx';
import { ALL_SPRITES } from '../../src/rendering/art/index';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import { makeSim } from '../helpers';

const PLACING = POWERS.filter((p) => p.id.startsWith('spawn_') && p.id !== 'spawn_army' || p.id.startsWith('animal_'));
const ctx = { selectedCiv: 0 };
const land = (sim: Simulation) => {
  const m = sim.w.map;
  for (let i = 0; i < m.n; i++) if (m.isLand(i) && m.hasFreshWater(i)) return [m.xOf(i), m.yOf(i)] as const;
  throw new Error('no land');
};

describe('placing hand', () => {
  it('every placing power shows the hand, carrying a sprite the atlas has', () => {
    expect(PLACING.length).toBeGreaterThan(20);
    for (const p of PLACING) {
      expect(isPlacingPower(p.id), p.id).toBe(true);
      const e = FX_BY_POWER[p.id];
      expect(isSpec(e) && e.kind, p.id).toBe('fx.hand');
      const sprite = isSpec(e) ? e.sprite : undefined;
      expect(sprite && ALL_SPRITES[sprite], `${p.id} sprite ${sprite}`).toBeTruthy();
    }
    expect(isPlacingPower('spawn_army')).toBe(false);
    expect(isPlacingPower('raise')).toBe(false);
    expect((FX_BY_POWER.animal_deer as { sprite: string }).sprite).toBe('ani.deer');
  });

  it('the hand sprite has three frames: closed, open, open and tilted', () => {
    expect(ALL_SPRITES['fx.hand'].frames.length).toBe(3);
  });

  it('a placement plays the hand with the placed sprite; a refused one plays none', () => {
    const sim = makeSim('hand-1', 48, (c) => { c.settings.startCivs = 0; });
    const [x, y] = land(sim);
    expect(applyPower(sim, 'animal_fish', x, y, 1, ctx)).not.toBeNull(); // fish on land: refused
    expect(sim.fx.some((f) => f.kind === 'fx.hand')).toBe(false);
    expect(applyPower(sim, 'animal_deer', x, y, 1, ctx)).toBeNull();
    const hand = sim.fx.find((f) => f.kind === 'fx.hand');
    expect(hand?.sprite).toBe('ani.deer');
  });

  it('the hand changes no history: the same placement with and without its effect leaves the same world', () => {
    const a = makeSim('hand-2', 48, (c) => { c.settings.startCivs = 0; });
    a.syncRng();
    const b = new Simulation(decodeWorld(encodeWorld(a.w)));
    const [x, y] = land(a);
    applyPower(a, 'spawn_human', x, y, 1, ctx);
    applyPower(b, 'spawn_human', x, y, 1, ctx);
    b.fx.length = 0; // no hand in this copy
    a.runYears(5);
    b.runYears(5);
    expect(a.digest()).toBe(b.digest());
  });
});
