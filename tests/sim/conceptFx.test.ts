/**
 * Round 7: every concept shows on the map. Coverage of the registry, the power and event hooks,
 * one source of effects, and effects never changing history.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { makeSim } from '../helpers';
import { POWERS, applyPower } from '../../src/powers/powers';
import { FX_BY_POWER, FX_BY_EVENT, DISASTER_FX, STATE_FX, UNUSED_SPRITES, eventEntry, isSpec, emitFx, type FxEntry, type FxSpec } from '../../src/sim/conceptFx';
import { EFFECT_SPRITES } from '../../src/rendering/art/effects';
import { logEvent } from '../../src/history/events';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import type { Sim } from '../../src/sim/context';

const srcFiles = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? srcFiles(p) : /\.tsx?$/.test(f) ? [p] : [];
});
const SRC = srcFiles('src');

/** Every event type the source can log: literal types, and prefixes of built ones ('treaty_' + kind). */
function emittedTypes(): { exact: Set<string>; prefixes: Set<string> } {
  const exact = new Set<string>(), prefixes = new Set<string>();
  for (const f of SRC) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/type: '([a-z_0-9]+)'(\s*\+)?/g)) (m[2] ? prefixes : exact).add(m[1]);
  }
  return { exact, prefixes };
}

const allSpecs = (e: FxEntry | FxSpec | undefined, out: FxSpec[] = []): FxSpec[] => {
  if (!e || !isSpec(e)) return out;
  out.push(e);
  return allSpecs(e.then, out);
};

describe('coverage: every concept has a decision', () => {
  it('every god power has an entry, and there are no entries for powers that do not exist', () => {
    const ids = new Set(POWERS.map((p) => p.id));
    for (const id of ids) expect(FX_BY_POWER[id], id).toBeDefined();
    for (const k of Object.keys(FX_BY_POWER)) expect(ids.has(k), `stale entry ${k}`).toBe(true);
    expect(ids.size).toBe(123); // round 10 addendum: +15 animals placeable by hand
  });

  it('every event type the source logs has an entry (exact or by prefix)', () => {
    const { exact, prefixes } = emittedTypes();
    expect(exact.size + prefixes.size).toBeGreaterThan(100);
    for (const t of exact) expect(eventEntry(t), t).toBeDefined();
    for (const p of prefixes) expect(FX_BY_EVENT[p + '*'] ?? eventEntry(p + 'x'), `${p}*`).toBeDefined();
  });

  it('every "none" says why, and every effect is a real sprite', () => {
    const entries: FxEntry[] = [...Object.values(FX_BY_POWER), ...Object.values(FX_BY_EVENT), ...Object.values(DISASTER_FX), ...Object.values(STATE_FX)];
    for (const e of entries) {
      if (!isSpec(e)) { expect(e.none.length, 'reason').toBeGreaterThan(5); continue; }
      for (const s of allSpecs(e)) {
        expect(EFFECT_SPRITES[s.kind], s.kind).toBeDefined();
        expect(s.dur).toBeGreaterThan(0);
      }
    }
  });

  it('every effect sprite is used by some concept (or listed as unused with a reason)', () => {
    const used = new Set<string>();
    for (const e of [...Object.values(FX_BY_POWER), ...Object.values(FX_BY_EVENT), ...Object.values(DISASTER_FX), ...Object.values(STATE_FX)]) for (const s of allSpecs(e)) used.add(s.kind);
    for (const id of Object.keys(EFFECT_SPRITES)) {
      if (!id.startsWith('fx.')) continue;
      expect(used.has(id) || !!UNUSED_SPRITES[id], `${id} never plays`).toBe(true);
    }
    expect(used.has('fx.firework')).toBe(true);
  });
});

describe('one source of effects', () => {
  it('no system pushes effects directly: addFx is only called by the registry', () => {
    const offenders = SRC.filter((f) => !f.endsWith('context.ts') && !f.endsWith('conceptFx.ts') && /\baddFx\(/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

/** The settlement with the most people (a target for tap powers). */
const biggest = (sim: Sim) => [...sim.w.settlements.values()].sort((a, b) => b.pop - a.pop)[0];

describe('the power hook', () => {
  it('every power that takes effect shows its spec at the tap or the affected place (one effect per tap)', () => {
    const sim = makeSim('fx-powers', 64, (c) => { c.settings.startEra = 6; c.laws.advancedWeapons = true; c.laws.speculativeTech = true; c.laws.horrors = true; });
    sim.runYears(3);
    let applied = 0, drawn = 0;
    for (const p of POWERS) {
      const s = biggest(sim);
      if (!s) break;
      sim.fx.length = 0;
      const civ = sim.w.civs.get(s.civId)!;
      const res = applyPower(sim, p.id, s.x, s.y, 2, { selectedCiv: civ.id });
      if (res !== null) continue;
      applied++;
      const e = FX_BY_POWER[p.id];
      if (isSpec(e)) {
        expect(sim.fx.filter((f) => f.kind === e.kind).length, p.id).toBe(1);
        drawn++;
      } else if (e.none.includes('disaster')) {
        expect(sim.fx.length, `${p.id}: the disaster draws`).toBeGreaterThan(0);
      }
    }
    expect(applied).toBeGreaterThan(80);
    expect(drawn).toBeGreaterThan(70);
  }, 120000);

  it('a brush stroke over the same place shows one puff, not one per application', () => {
    const sim = makeSim('fx-brush', 48);
    for (let k = 0; k < 6; k++) applyPower(sim, 'raise', 20, 20, 2, { selectedCiv: 0 });
    expect(sim.fx.filter((f) => f.kind === 'fx.dust').length).toBe(1);
  });

  it('a power that logs an event does not draw twice (the event hook stays quiet inside a power)', () => {
    const sim = makeSim('fx-once', 64, (c) => { c.settings.startEra = 4; });
    sim.runYears(2);
    const s = biggest(sim);
    sim.fx.length = 0;
    applyPower(sim, 'dis_plague', s.x, s.y, 2, { selectedCiv: 0 }); // logs god_plague at the city
    expect(sim.fx.length).toBe(1);
    expect(sim.fx[0].ring).toBeGreaterThan(0);
  });
});

describe('the event hook', () => {
  it('a placed event shows its effect; a minor or placeless one does not; a placeless flash event only flashes', () => {
    const sim = makeSim('fx-events', 48);
    sim.fx.length = 0;
    logEvent(sim, { type: 'world_games', cat: 'culture', title: 'Games', x: 10, y: 10, importance: 3 });
    expect(sim.fx.map((f) => f.kind)).toEqual(['fx.firework']);
    sim.fx.length = 0;
    logEvent(sim, { type: 'world_games', cat: 'culture', title: 'Games', x: 10, y: 10, importance: 1 });
    logEvent(sim, { type: 'peace', cat: 'politics', title: 'Peace', importance: 3 });
    logEvent(sim, { type: 'construction', cat: 'economy', title: 'Built', x: 5, y: 5, importance: 3 });
    expect(sim.fx).toEqual([]);
    logEvent(sim, { type: 'gamma_ray_burst', cat: 'disaster', title: 'Burst', importance: 4 });
    expect(sim.fx.map((f) => [f.kind, f.x, f.flash])).toEqual([['flash', -1, 'white']]);
  });

  it('prefix types resolve (treaty_trade, horror_zombie, space_moon)', () => {
    for (const t of ['treaty_trade', 'horror_zombie', 'space_moon']) expect(isSpec(eventEntry(t)), t).toBe(true);
  });

  it('identical effects in one place are capped (a long war cannot flood the screen)', () => {
    const sim = makeSim('fx-cap', 48);
    sim.fx.length = 0;
    for (let k = 0; k < 20; k++) emitFx(sim, STATE_FX.battle, 10, 10);
    expect(sim.fx.length).toBe(STATE_FX.battle.cap);
    for (let k = 0; k < 20; k++) emitFx(sim, STATE_FX.battle, 30, 30); // somewhere else is a separate place
    expect(sim.fx.length).toBe(2 * STATE_FX.battle.cap!);
  });
});

describe('effects never change history', () => {
  it('the same world with effects drawn and with every effect dropped ends identical', () => {
    const base = makeSim('fx-det', 64, (c) => { c.settings.startEra = 5; });
    base.runYears(2);
    base.syncRng();
    const save = encodeWorld(base.w);
    const a = new Simulation(decodeWorld(save));
    const b = new Simulation(decodeWorld(save));
    // b drops every effect: a full queue rejects all pushes
    b.fx.push(...Array.from({ length: 401 }, () => ({ kind: 'fx.star', x: 0, y: 0, t: 1e9, dur: 1e9 })));
    for (const sim of [a, b]) {
      const s = biggest(sim);
      for (const id of ['dis_earthquake', 'grow', 'tech_grant', 'religion_found', 'dis_plague', 'raise']) applyPower(sim, id, s.x, s.y, 2, { selectedCiv: s.civId });
      sim.runYears(5);
      sim.syncRng();
    }
    expect(a.fx.length).toBeGreaterThan(0);
    expect(Buffer.from(encodeWorld(a.w)).equals(Buffer.from(encodeWorld(b.w)))).toBe(true);
  }, 120000);
});
