import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';

describe('deterministic simulation', () => {
  it('same seed and config give identical state after 60 years', () => {
    const a = makeSim('det-1');
    const b = makeSim('det-1');
    expect(a.digest()).toBe(b.digest());
    a.runYears(60);
    b.runYears(60);
    expect(a.digest()).toBe(b.digest());
    expect(a.w.events.length).toBe(b.w.events.length);
  }, 60000);

  it('different seeds diverge', () => {
    const a = makeSim('det-1');
    const b = makeSim('det-2');
    a.runYears(10);
    b.runYears(10);
    expect(a.digest()).not.toBe(b.digest());
  }, 60000);

  it('advance() is independent of frame slicing', () => {
    const a = makeSim('det-3');
    const b = makeSim('det-3');
    // a: one big step of 1200 ticks; b: many small frames totalling 1200 ticks
    let done = 0;
    while (done < 1200) done += b.advance(16, 600, 1e9);
    a.runTicks(done);
    expect(a.w.tick).toBe(b.w.tick);
    expect(a.digest()).toBe(b.digest());
  }, 60000);
});
