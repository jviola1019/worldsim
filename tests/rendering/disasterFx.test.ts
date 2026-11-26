/**
 * Round 10 second addendum (Task 7): realistic disaster and disease visuals. The new sprites exist, animate and are
 * used; sick towns carry a marker; under Reduce motion every new effect is one still frame.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { EFFECT_SPRITES } from '../../src/rendering/art/effects';
import { fxFrame, sickMarker, auroraAlpha, stillKind, pallShowsSymbol, STILL_FRAME, SICK_SHARE } from '../../src/rendering/fxMotion';
import { DISASTER_FX, FX_BY_EVENT, FX_BY_POWER, STATE_FX, UNUSED_SPRITES, isSpec, type FxEntry, type FxSpec } from '../../src/sim/conceptFx';
import type { Settlement } from '../../src/sim/types';

/** Every sprite this task adds, and every one it redraws. */
const NEW = ['fx.squall', 'fx.hurricane', 'fx.eruption', 'fx.pall', 'fx.aurora', 'fx.airburst', 'fx.sick', 'fx.heat', 'fx.blizzard'];
/** The effects among them (the sick-town marker is a one-frame badge the renderer pulses by opacity). */
const EFFECTS = NEW.filter((k) => k !== 'fx.sick');
const REDRAWN = ['fx.flood', 'fx.wave', 'fx.quake'];

const used = (): Set<string> => {
  const out = new Set<string>();
  const walk = (e: FxEntry | FxSpec | undefined) => { if (e && isSpec(e)) { out.add(e.kind); walk(e.then); } };
  for (const e of [...Object.values(FX_BY_POWER), ...Object.values(FX_BY_EVENT), ...Object.values(DISASTER_FX), ...Object.values(STATE_FX)]) walk(e);
  return out;
};

const town = (i: number): Settlement => ({ epidemics: i > 0 ? [{ diseaseId: 1, s: 1 - i, i, r: 0, deaths: 0 }] : [] }) as unknown as Settlement;

describe('Task 7 sprites', () => {
  it('every new sprite exists and animates (more than one frame), and every redrawn one too', () => {
    expect(EFFECT_SPRITES['fx.sick']).toBeDefined();
    for (const id of [...EFFECTS, ...REDRAWN]) {
      expect(EFFECT_SPRITES[id], id).toBeDefined();
      expect(EFFECT_SPRITES[id].frames.length, id).toBeGreaterThan(1);
    }
  });

  it('every new sprite is used: by a concept, or (the sick-town marker) by the renderer', () => {
    const u = used();
    for (const id of EFFECTS) expect(u.has(id), id).toBe(true);
    expect(UNUSED_SPRITES['fx.sick']).toMatch(/renderer/);
    const renderer = readFileSync('src/rendering/renderer.ts', 'utf8');
    expect(renderer).toContain("'fx.sick'");
    expect(renderer).toContain('sickMarker(');
  });

  it('the drought and blizzard have their own sprites (the old ones were 2-6 px and could not be seen)', () => {
    expect(DISASTER_FX.drought.kind).toBe('fx.heat');
    expect(DISASTER_FX.blizzard.kind).toBe('fx.blizzard');
    for (const id of ['fx.heat', 'fx.blizzard', 'fx.flood', 'fx.wave']) expect(EFFECT_SPRITES[id].w, id).toBeGreaterThanOrEqual(12);
  });
});

describe('sick-town marker', () => {
  it('a town with more than 1% infected gets a marker; at 0 (or exactly 1%) it gets none', () => {
    expect(SICK_SHARE).toBe(0.01);
    expect(sickMarker(town(0.02), 0, false)).not.toBeNull();
    expect(sickMarker(town(0), 0, false)).toBeNull();
    expect(sickMarker(town(0.01), 0, false)).toBeNull();
  });

  it('the marker pulses slowly; under Reduce motion it is still', () => {
    const s = town(0.05);
    const alphas = [0, 0.4, 0.8, 1.2].map((t) => sickMarker(s, t, false)!.alpha);
    expect(new Set(alphas).size).toBeGreaterThan(1);
    for (const a of alphas) expect(a).toBeGreaterThanOrEqual(0.5);
    // slow: no more than one pulse a second (alpha changes by at most a little over 50 ms)
    expect(Math.abs(sickMarker(s, 0.05, false)!.alpha - sickMarker(s, 0, false)!.alpha)).toBeLessThan(0.15);
    const still = [0, 0.4, 0.8, 1.2, 9].map((t) => sickMarker(s, t, true)!.alpha);
    expect(new Set(still).size).toBe(1);
  });
});

describe('Reduce motion: each new effect returns its still frame', () => {
  it('every new effect has a still frame within its sprite', () => {
    for (const id of EFFECTS) {
      expect(STILL_FRAME[id], id).toBeDefined();
      expect(STILL_FRAME[id]).toBeLessThan(EFFECT_SPRITES[id].frames.length);
    }
  });

  it('under Reduce motion the frame is the still one whatever the progress or time; otherwise it moves', () => {
    for (const id of EFFECTS) {
      const n = EFFECT_SPRITES[id].frames.length;
      const reduced = new Set<number>();
      const moving = new Set<number>();
      for (let k = 0; k <= 10; k++) {
        reduced.add(fxFrame(id, n, k / 10, k * 0.37, true));
        moving.add(fxFrame(id, n, k / 10, k * 0.37, false));
      }
      expect([...reduced], id).toEqual([STILL_FRAME[id]]);
      expect(moving.size, id).toBeGreaterThan(1);
    }
  });

  it('a sequence collapses to its characteristic still: the eruption and the airburst, not the smoke after them', () => {
    expect(stillKind(DISASTER_FX.volcano)).toBe('fx.eruption');
    expect(stillKind(DISASTER_FX.airburst)).toBe('fx.airburst');
    expect(stillKind(DISASTER_FX.meteor)).toBe('fx.smoke'); // older sequences keep their final still
  });

  it('the aurora fades in and out, and holds one alpha under Reduce motion', () => {
    expect(auroraAlpha(0, false)).toBeLessThan(auroraAlpha(0.5, false));
    expect(auroraAlpha(1, false)).toBeLessThan(auroraAlpha(0.5, false));
    expect(new Set([0, 0.2, 0.5, 0.9, 1].map((p) => auroraAlpha(p, true))).size).toBe(1);
  });

  it('existing effects keep their behaviour (fire loops at 8 fps; others play once over their life)', () => {
    expect(fxFrame('fx.fire', 4, 0.5, 1.0, false)).toBe(8);
    expect(fxFrame('fx.explosion', 5, 0.5, 0, false)).toBe(2);
    expect(fxFrame('fx.explosion', 5, 0.9, 0, true)).toBe(2);
  });
});

describe('fix round 1: sickness symbol, pall haze, aurora light', () => {
  const keys = (id: string) => new Set(EFFECT_SPRITES[id].frames.flat().join(''));
  const RED = ['n', 'm', 'r'];
  it('the sick-town marker is a figure in bed, not a red cross (no red keys; skin and pillow present)', () => {
    const k = keys('fx.sick');
    for (const r of RED) expect(k.has(r), r).toBe(false);
    expect(k.has('S')).toBe(true); // a face on the pillow
  });

  it('the pall carries no symbol of its own (no red cross) and is a pale green haze, not grey', () => {
    const k = keys('fx.pall');
    for (const r of RED) expect(k.has(r), r).toBe(false);
    const px = EFFECT_SPRITES['fx.pall'].frames[0].join('').replace(/\./g, '');
    const greens = [...px].filter((c) => 'Ykl'.includes(c)).length;
    expect(greens / px.length).toBeGreaterThan(0.6);
  });

  it('a pall shows the sickbed symbol only where no sick-town marker already does', () => {
    const at = (x: number, y: number, i: number) => ({ x, y, epidemics: i > 0 ? [{ diseaseId: 1, s: 1 - i, i, r: 0, deaths: 0 }] : [] }) as unknown as Settlement;
    expect(pallShowsSymbol([at(10, 10, 0.05)], 10, 10)).toBe(false); // the marker is there: one symbol, not two
    expect(pallShowsSymbol([at(10, 10, 0)], 10, 10)).toBe(true); // recovered town (an epidemic is logged as it ends)
    expect(pallShowsSymbol([at(30, 30, 0.05)], 10, 10)).toBe(true); // a sick town elsewhere does not count
    const renderer = readFileSync('src/rendering/renderer.ts', 'utf8');
    expect(renderer).toContain('pallShowsSymbol(');
  });

  it('the aurora is light, not grass: no grass palette keys, and it is composited additively', () => {
    const k = keys('fx.aurora');
    for (const g of ['l', 'k', 'j', 'i']) expect(k.has(g), g).toBe(false);
    expect(k.has('G') || k.has('H')).toBe(true);
    const renderer = readFileSync('src/rendering/renderer.ts', 'utf8');
    expect(renderer).toMatch(/globalCompositeOperation = 'lighter'/);
  });
});
