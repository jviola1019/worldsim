/**
 * Round 9: WorldBox-style close zoom and the round-9 simulation changes (elder care, power urgency).
 */
import { describe, it, expect } from 'vitest';
import { readableScale, personSprite, personSize, peopleOf, crowdSize, herdShown, notablesBySettlement, workSprite, MAX_PEOPLE, READABLE_PX } from '../../src/rendering/closeup';
import { makeSim } from '../helpers';
import type { Person, Settlement } from '../../src/sim/types';
import { BALANCE } from '../../src/config/balance';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';

const clone = (s: Simulation) => { s.syncRng(); return new Simulation(decodeWorld(encodeWorld(s.w))); };
const person = (o: Partial<Person>): Person => ({ id: 1, name: 'A', female: false, born: 0, species: 'human', civId: 1, settlementId: 1, bandId: 0, cultureId: 1, religionId: 0, fatherId: 0, motherId: 0, spouseId: 0, children: [], dynastyId: 0, role: 'commoner', job: 'laborer', traits: [], ...o } as Person);

describe('readable sprites up close', () => {
  it('actors keep a readable size on screen: normal size until READABLE_PX screen px per art px, then constant', () => {
    expect(readableScale(1)).toBe(1);
    expect(readableScale(READABLE_PX)).toBe(1);
    for (const z of [4, 6, 12]) expect(readableScale(z) * z).toBeCloseTo(READABLE_PX, 9);
    expect(readableScale(1000)).toBe(0.2);
  });

  it('a real person is drawn by role, then age, then work; children smaller', () => {
    const work = () => 'char.farmer';
    expect(personSprite(person({ role: 'ruler' }), 300, 3, 3, work)).toBe('unit.ruler');
    expect(personSprite(person({ role: 'general' }), 300, 3, 3, work)).toBe('unit.general');
    expect(personSprite(person({ born: 295 }), 300, 3, 3, work)).toBe('unit.citizen.3');
    expect(personSprite(person({ born: 270 }), 300, 3, 3, work)).toBe('char.farmer');
    expect(personSize(person({ born: 295 }), 300)).toBeLessThan(1);
    expect(personSize(person({ born: 200 }), 300)).toBeLessThan(1);
    expect(personSize(person({ born: 270 }), 300)).toBe(1);
  });

  it('workers come from the real employment mix: an all-farming town shows farmers or townsfolk only', () => {
    for (let h = 0; h < 200; h++) expect(['char.farmer', 'unit.citizen.2']).toContain(workSprite([100, 0, 0, 0, 0, 0, 0], 2, 0, h));
  });

  it('small towns show their real members; big cities their notables plus a crowd', () => {
    const persons = new Map<number, Person>();
    for (let id = 1; id <= 60; id++) persons.set(id, person({ id, died: id === 3 ? 10 : undefined }));
    const small = { mode: 'individual', members: [...persons.keys()] } as unknown as Settlement;
    const shown = peopleOf(small, persons, []);
    expect(shown.length).toBe(MAX_PEOPLE);
    expect(shown.some((p) => p.id === 3)).toBe(false); // the dead are not drawn
    const big = { mode: 'cohort', members: [] } as unknown as Settlement;
    expect(peopleOf(big, persons, [5, 9]).map((p) => p.id)).toEqual([5, 9]);
    expect(crowdSize(1_000_000)).toBe(24);
    expect(crowdSize(10)).toBeGreaterThan(0);
    expect(herdShown(10000, true)).toBe(6);
    expect(herdShown(10000, false)).toBe(3);
  });

  it('notables are indexed by home settlement (rulers yes, commoners no)', () => {
    const persons = new Map<number, Person>([[1, person({ id: 1, role: 'ruler', settlementId: 7 })], [2, person({ id: 2, settlementId: 7 })], [3, person({ id: 3, role: 'general', settlementId: 7, died: 5 })]]);
    expect(notablesBySettlement(persons).get(7)).toEqual([1]);
  });
});

describe('round 9 simulation: elder care and power urgency', () => {
  it('the same ageing modern world employs more people with elder care than without (counterfactual)', () => {
    // a future world measured at 5.5% unemployment and 7.7% aged 65+ after 15 years
    const base = makeSim('r9-care2', 96, (c) => { c.settings.startEra = 13; });
    base.runYears(10);
    const on = clone(base), off = clone(base);
    const prev = BALANCE.careWorkersPerElder;
    const unemp = (sim: Simulation) => {
      let u = 0, w = 0;
      for (const s of sim.w.settlements.values()) { u += s.employment[6]; w += s.employment.reduce((a, b) => a + b, 0); }
      return u / Math.max(1, w);
    };
    let a = 0, b = 0;
    try {
      on.runYears(8); a = unemp(on);
      BALANCE.careWorkersPerElder = 0;
      off.runYears(8); b = unemp(off);
    } finally { BALANCE.careWorkersPerElder = prev; }
    expect(a).toBeLessThan(b);
  }, 300000);
});
