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
import { triggerDisaster } from '../../src/world/environment';
import { asteroidImpact } from '../../src/world/catastrophes';
import { closePandemics } from '../../src/population/pandemic';
import type { Disease } from '../../src/sim/types';

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

// ------------------------------------------------------------------------------- Task 7: realistic visuals

const kindsOf = (e: FxEntry | FxSpec | undefined) => allSpecs(e).map((s) => s.kind);
/** A land tile with no water within 6 tiles, and a coastal land tile (both exist on a 64-tile world). */
function landSites(sim: Sim) {
  const m = sim.w.map;
  let inland: [number, number] | null = null, coast: [number, number] | null = null;
  for (let i = 0; i < m.n && !(inland && coast); i++) {
    if (!m.isLand(i)) continue;
    const x = m.xOf(i), y = m.yOf(i);
    if (!coast && m.isCoastal(i)) coast = [x, y];
    if (!inland && x > 6 && y > 6 && x < m.w - 7 && y < m.h - 7) {
      let water = 0;
      m.forRadius(x, y, 6, (j) => { if (!m.isLand(j)) water++; });
      if (!water) inland = [x, y];
    }
  }
  if (!inland || !coast) throw new Error('no sites');
  return { inland, coast };
}

describe('Task 7: realistic disaster and disease visuals', () => {
  it('a storm is a rain squall; a large coastal storm is a hurricane; the tornado is kept for tornado events', () => {
    expect(DISASTER_FX.storm.kind).toBe('fx.squall');
    expect(DISASTER_FX.hurricane.kind).toBe('fx.hurricane');
    expect(EFFECT_SPRITES['fx.tornado']).toBeDefined();
    expect(UNUSED_SPRITES['fx.tornado']).toMatch(/tornado/);
  });

  it('triggerDisaster draws a hurricane for a large coastal storm and a squall inland or small', () => {
    const sim = makeSim('fx-storm', 64, (c) => { c.settings.startCivs = 0; });
    const { inland, coast } = landSites(sim);
    const play = (x: number, y: number, r: number) => { sim.fx.length = 0; triggerDisaster(sim, 'storm', x, y, r, true); return sim.fx.map((f) => f.kind); };
    expect(play(coast[0], coast[1], 5)).toEqual(['fx.hurricane']);
    expect(play(inland[0], inland[1], 6)).toEqual(['fx.squall']);
    expect(play(coast[0], coast[1], 2)).toEqual(['fx.squall']);
  });

  it('a volcano erupts (ash column, then dark smoke), not the generic explosion; the supervolcano too', () => {
    expect(kindsOf(DISASTER_FX.volcano)[0]).toBe('fx.eruption');
    expect(kindsOf(DISASTER_FX.volcano)).not.toContain('fx.explosion');
    expect(kindsOf(FX_BY_POWER.supervolcano)[0]).toBe('fx.eruption');
  });

  it('natural disease shows the sickness pall, never a skull; skulls stay for fictional horrors', () => {
    for (const id of ['epidemic', 'pandemic', 'infertility_outbreak']) {
      expect(kindsOf(eventEntry(id))[0], id).toBe('fx.pall');
      expect(kindsOf(eventEntry(id)), id).not.toContain('fx.skull');
    }
    expect(kindsOf(FX_BY_POWER.dis_plague)[0]).toBe('fx.pall');
    expect(kindsOf(DISASTER_FX.plague)[0]).toBe('fx.pall');
    expect(kindsOf(FX_BY_POWER.horror_zombie)).toContain('fx.skull');
    expect(kindsOf(eventEntry('horror_ghoul'))).toContain('fx.skull');
  });

  it('a geomagnetic storm shows the aurora across the map (placeless), as does the solar storm power', () => {
    const e = eventEntry('geomagnetic_storm');
    expect(isSpec(e) && e.kind).toBe('fx.aurora');
    expect(isSpec(e) && e.world).toBe(true);
    expect(kindsOf(FX_BY_POWER.emp)).toContain('fx.aurora');
    const sim = makeSim('fx-aurora', 48);
    sim.fx.length = 0;
    logEvent(sim, { type: 'geomagnetic_storm', cat: 'disaster', title: 'Storm', importance: 3 });
    expect(sim.fx.map((f) => [f.kind, f.x])).toEqual([['fx.aurora', -1]]);
  });

  it('an airburst is a fireball and shock ring in the sky, then smoke; a ground impact keeps the explosion', () => {
    expect(kindsOf(DISASTER_FX.airburst)).toContain('fx.airburst');
    expect(kindsOf(DISASTER_FX.airburst)).not.toContain('fx.explosion');
    expect(kindsOf(DISASTER_FX.meteor)).toContain('fx.explosion');
    const sim = makeSim('fx-airburst', 64, (c) => { c.settings.startCivs = 0; });
    const { inland } = landSites(sim);
    sim.fx.length = 0;
    asteroidImpact(sim, inland[0], inland[1], 'airburst');
    expect(sim.fx.map((f) => f.kind)).toEqual(['fx.meteor']);
    expect(kindsOf(sim.fx[0].then)).toContain('fx.airburst');
  });

  it('a pandemic lays the pall on each town it reached, with one world flash in its colour', () => {
    const sim = makeSim('fx-pandemic', 64, (c) => { c.settings.startEra = 4; });
    const towns = [...sim.w.settlements.values()];
    expect(towns.length).toBeGreaterThan(3);
    const origin = towns[0];
    const d: Disease = { id: ++sim.w.ids.disease, name: 'Test Flu', r0: 2, lethality: 0.01, duration: 1, immunity: 600, origin: origin.id, emerged: sim.year - 2, zoonotic: false, totalDeaths: 5000, pandemic: true, worldPop: 1e5 };
    sim.w.diseases.set(d.id, d);
    for (const s of towns) s.immunity[d.id] = 0.5;
    sim.fx.length = 0;
    closePandemics(sim);
    const palls = sim.fx.filter((f) => f.kind === 'fx.pall');
    const places = new Set(palls.map((f) => `${f.x},${f.y}`));
    expect(palls.length).toBe(places.size); // one per place
    const expected = new Set(towns.map((s) => `${s.x},${s.y}`));
    // every reached town is covered: by its own pall or a pall within 2 tiles (the per-place cap)
    for (const s of towns) expect(palls.some((f) => (f.x - s.x) ** 2 + (f.y - s.y) ** 2 <= 4), s.name).toBe(true);
    expect(places.size).toBeLessThanOrEqual(expected.size);
    expect(sim.fx.filter((f) => f.flash).map((f) => f.flash)).toEqual(['sick']);
  });

  it('the new effects change no history: storms, an airburst and a pandemic with and without their effects', () => {
    const base = makeSim('fx-det7', 64, (c) => { c.settings.startEra = 5; });
    base.runYears(1);
    base.syncRng();
    const save = encodeWorld(base.w);
    const a = new Simulation(decodeWorld(save));
    const b = new Simulation(decodeWorld(save));
    b.fx.push(...Array.from({ length: 401 }, () => ({ kind: 'fx.star', x: 0, y: 0, t: 1e9, dur: 1e9 })));
    for (const sim of [a, b]) {
      const { inland, coast } = landSites(sim);
      triggerDisaster(sim, 'storm', coast[0], coast[1], 5, true);
      triggerDisaster(sim, 'storm', inland[0], inland[1], 6);
      triggerDisaster(sim, 'volcano', inland[0], inland[1], 3, true);
      asteroidImpact(sim, inland[0], inland[1], 'airburst');
      logEvent(sim, { type: 'geomagnetic_storm', cat: 'disaster', title: 'Storm', importance: 3 });
      const towns = [...sim.w.settlements.values()];
      const d: Disease = { id: ++sim.w.ids.disease, name: 'Test Flu', r0: 2, lethality: 0.01, duration: 1, immunity: 600, origin: towns[0].id, emerged: sim.year - 2, zoonotic: false, totalDeaths: 5000, pandemic: true, worldPop: 1e5 };
      sim.w.diseases.set(d.id, d);
      for (const s of towns) s.immunity[d.id] = 0.5;
      closePandemics(sim); // the pall on every reached town
      sim.runYears(3);
      sim.syncRng();
    }
    expect(a.fx.length).toBeGreaterThan(0);
    expect(Buffer.from(encodeWorld(a.w)).equals(Buffer.from(encodeWorld(b.w)))).toBe(true);
  }, 120000);
});
