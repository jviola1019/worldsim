import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { createPerson } from '../../src/population/persons';
import { developPerson, onBattle, gainTrait, potential, onKinDeath } from '../../src/population/development';
import { rollTraits } from '../../src/population/persons';
import { TRAIT_BY_KEY, TRAITS } from '../../src/population/traits';

function person(sim: ReturnType<typeof makeSim>, born: number, role: any = 'general') {
  const civ = [...sim.w.civs.values()][0];
  return createPerson(sim, { born, species: 'human', civId: civ?.id ?? 0, cultureId: civ?.cultureId ?? 0, religionId: 0, role, notable: true });
}

describe('character development', () => {
  it('skills grow in youth toward potential and military declines in old age', () => {
    const sim = makeSim('dev-1');
    const p = person(sim, sim.year - 14);
    p.skills.military = 1;
    const civ = sim.w.civs.get(p.civId);
    for (let a = 14; a < 30; a++) developPerson(sim, p, civ, a);
    expect(p.skills.military).toBeGreaterThan(3);
    expect(p.skills.military).toBeLessThanOrEqual(10);
    const peak = p.skills.military;
    for (let a = 70; a < 85; a++) developPerson(sim, p, civ, a);
    expect(p.skills.military).toBeLessThan(peak);
  });

  it('potential rises with education for learning', () => {
    const sim = makeSim('dev-2');
    const p = person(sim, sim.year - 20, 'scholar');
    expect(potential(p, 'learning', 1)).toBeGreaterThan(potential(p, 'learning', 0));
  });

  it('battles grant veteran, record deeds, and same-place repeats collapse', () => {
    const sim = makeSim('dev-3');
    const p = person(sim, sim.year - 30);
    onBattle(sim, p.id, true, 'Alpha', false);
    onBattle(sim, p.id, true, 'Alpha', false);
    expect(p.battles).toBe(1);
    expect(p.deeds!.at(-1)!.t).toContain('×2');
    onBattle(sim, p.id, true, 'Beta', false);
    onBattle(sim, p.id, false, 'Gamma', false);
    expect(p.battles).toBe(3);
    expect(p.traits).toContain('veteran');
    expect(p.stress).toBeGreaterThan(0);
  });

  it('gaining a trait removes its opposite', () => {
    const sim = makeSim('dev-4');
    const p = person(sim, sim.year - 30);
    p.traits = ['brave'];
    gainTrait(sim, p, 'craven', 'test');
    expect(p.traits).toEqual(['craven']);
  });

  it('acquired traits are never rolled at birth or inherited', () => {
    const sim = makeSim('dev-5');
    const parent = person(sim, sim.year - 30);
    parent.traits = ['veteran', 'conqueror', 'scholar'];
    for (let k = 0; k < 300; k++) for (const t of rollTraits(sim, parent, parent)) expect(TRAIT_BY_KEY[t].kind).not.toBe('acquired');
  });

  it('grief stresses notable kin', () => {
    const sim = makeSim('dev-6');
    const a = person(sim, sim.year - 40);
    const b = person(sim, sim.year - 38);
    a.spouseId = b.id;
    b.spouseId = a.id;
    onKinDeath(sim, a);
    expect(b.stress).toBeGreaterThan(0.2);
  });

  it('every trait has a valid opposite pair', () => {
    for (const t of TRAITS) if (t.opposite) expect(TRAIT_BY_KEY[t.opposite]?.opposite).toBe(t.key);
  });

  it('notables accumulate life logs over a real run', () => {
    const sim = makeSim('dev-7', 96);
    sim.runYears(150);
    const withLife = [...sim.w.persons.values()].filter((p) => p.notable && (p.deeds?.length ?? 0) >= 2);
    expect(withLife.length).toBeGreaterThan(0);
  }, 90000);
});
