/**
 * Task 8 Part B follow-up (controller rulings): the Space Race and Industrializing promises measure something that
 * can fail within their horizons.
 * - Space Race starts at era 10: a colony needs an era-14 technology, 4 eras away (2 of 6 worlds in 450 years), so it
 *   is a long-term goal reported by the audit, not a promise. The promise within 150 years is the race itself: at
 *   least two nations launch rockets into space.
 * - Industrializing starts in era 7, so "someone reaches the industrial era" held at year 0. The promise is now the
 *   next step: someone reaches the Late Industrial era (8) within 120 years.
 */
import { describe, it, expect } from 'vitest';
import { MODES, type Snapshot } from '../../scripts/mode-audit';
import { SCENARIOS } from '../../src/scenarios/scenarios';
import type { Simulation } from '../../src/sim/simulation';

const promise = (mode: string, id: string) => MODES.find((m) => m.key === mode)!.promises.find((p) => p.id === id);
const st = {} as Snapshot;
const fake = (civs: { era?: number; launches?: number; alive?: boolean }[]) =>
  ({ w: { civs: new Map(civs.map((c, k) => [k + 1, { id: k + 1, alive: c.alive ?? true, era: c.era ?? 10, space: { launches: c.launches ?? 0, stations: 0 } }])), colonies: new Map() } }) as unknown as Simulation;

describe('Space Race: the rivals race to space; the colony is a long-term goal', () => {
  it('the race is won only when two nations have launched', () => {
    const race = promise('space_race', 'race')!;
    expect(race).toBeDefined();
    expect(race.check(fake([{ launches: 0 }, { launches: 0 }]), st)).toBe(false);
    expect(race.check(fake([{ launches: 12 }, { launches: 0 }, { launches: 0 }]), st)).toBe(false); // one nation alone is no race
    expect(race.check(fake([{ launches: 12 }, { launches: 1 }]), st)).toBe(true);
  });

  it('the colony is not a pass/fail promise within the horizon, and the scenario calls it long-term', () => {
    expect(promise('space_race', 'colony')).toBeUndefined();
    const sc = SCENARIOS.find((s) => s.key === 'space_race')!;
    expect(sc.objectives.find((o) => o.id === 'colony')!.label).toMatch(/long-term/i);
    expect(sc.objectives.some((o) => o.id === 'race')).toBe(true);
  });
});

describe('Industrializing: the promise is the next industrial step', () => {
  it('the steam promise that held at year 0 is gone', () => {
    expect(promise('industrial', 'steam')).toBeUndefined();
  });

  it('reaching the Late Industrial era can fail', () => {
    const late = promise('industrial', 'late')!;
    expect(late).toBeDefined();
    expect(late.check(fake([{ era: 7 }, { era: 7 }, { era: 6 }]), st)).toBe(false);
    expect(late.check(fake([{ era: 8, alive: false }, { era: 7 }]), st)).toBe(false); // a fallen nation does not count
    expect(late.check(fake([{ era: 7 }, { era: 8 }]), st)).toBe(true);
  });
});
