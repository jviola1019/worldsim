/**
 * Round 10: the HUD's nation count is honest. A nation has at least one settlement; a people with only
 * wandering bands is a tribe.
 */
import { describe, it, expect } from 'vitest';
import { countPeoples, peoplesLine } from '../../src/sim/peoples';
import { makeSim } from '../helpers';

describe('nation and tribe count', () => {
  it('primitive year 0 is tribes, not nations', () => {
    const sim = makeSim('pc-1', 64, (c) => { c.settings.startEra = 1; c.settings.startCivs = 5; });
    const c = countPeoples(sim.w);
    expect(c.nations).toBe(0);
    expect(c.tribes).toBe(5);
    expect(c.people).toBeGreaterThan(0);
  });

  it('kingdoms are nations', () => {
    const sim = makeSim('pc-2', 64, (c) => { c.settings.startEra = 4; c.settings.startCivs = 5; });
    const c = countPeoples(sim.w);
    expect(c.nations).toBe(5);
    expect(c.tribes).toBe(0);
  });

  it('reads in the singular and plural, leaving out zero parts (numbers kept with their word)', () => {
    const sp = (t: string) => t.replace(/\u00a0/g, ' ');
    expect(sp(peoplesLine({ nations: 1, tribes: 0, people: 1200 }, 'Medieval'))).toBe('Medieval · 1.2k people · 1 nation');
    expect(sp(peoplesLine({ nations: 0, tribes: 3, people: 120 }, 'Stone Age'))).toBe('Stone Age · 120 people · 3 tribes');
    expect(sp(peoplesLine({ nations: 9, tribes: 1, people: 1.2e6 }, 'Medieval'))).toBe('Medieval · 1.2M people · 9 nations · 1 tribe');
    expect(peoplesLine({ nations: 0, tribes: 0, people: 0 }, 'Stone Age')).toBe('No people yet');
    expect(peoplesLine({ nations: 8, tribes: 0, people: 1e6 }, 'Iron')).toContain('8\u00a0nations');
  });
});
