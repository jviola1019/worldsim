/**
 * Round 10 (mode audit): "Realms of Legend" promises a monster can be slain by a settlement. Before the fix,
 * a monster regained 2% of its health every month even while fighting, more than any town could deal,
 * so none was ever slain (0 of 3 audited worlds in 200 years).
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { spawnMonster, monstersMonthly } from '../../src/ecology/ecology';

const fantasyTown = (seed: string, pop: number) => {
  const sim = makeSim(seed, 64, (c) => { c.settings.fantasy = true; c.gen.fantasy = true; c.laws.fantasyCreatures = true; c.settings.startEra = 4; c.settings.startCivs = 2; });
  for (const id of [...sim.w.monsters.keys()]) sim.w.monsters.delete(id);
  const s = [...sim.w.settlements.values()].sort((a, b) => b.pop - a.pop)[0];
  s.pop = pop; s.garrison = 0;
  return { sim, s };
};

describe('monsters can be slain', () => {
  it('a town of 2,000 slays a giant camped at its gates within three years', () => {
    const { sim, s } = fantasyTown('mon-1', 2000);
    const m = spawnMonster(sim, 'giant', s.x + 1, s.y)!;
    let months = 0;
    while (sim.w.monsters.has(m.id) && months < 36) { m.x = s.x + 1.5; m.y = s.y + 0.5; monstersMonthly(sim); s.pop = Math.max(s.pop, 2000); months++; }
    expect(sim.w.monsters.has(m.id), `after ${months} months hp ${Math.round(m.hp)}`).toBe(false);
    expect(sim.w.events.some((e) => e.type === 'monster_slain')).toBe(true);
  });

  it('a hamlet of 150 cannot slay a giant in a year', () => {
    const { sim, s } = fantasyTown('mon-2', 150);
    const m = spawnMonster(sim, 'giant', s.x + 1, s.y)!;
    for (let k = 0; k < 12; k++) { m.x = s.x + 1.5; m.y = s.y + 0.5; monstersMonthly(sim); }
    expect(sim.w.monsters.has(m.id)).toBe(true);
  });

  it('a wounded monster heals only when no settlement is fighting it', () => {
    const { sim } = fantasyTown('mon-3', 2000);
    // the spot farthest from every settlement, so no one is fighting it
    let best = [2, 2], far = -1;
    for (let y = 1; y < sim.w.map.h - 1; y += 2) for (let x = 1; x < sim.w.map.w - 1; x += 2) {
      const d = Math.min(...[...sim.w.settlements.values()].map((t) => (t.x - x) ** 2 + (t.y - y) ** 2));
      if (d > far) { far = d; best = [x, y]; }
    }
    expect(far).toBeGreaterThan(9);
    const m = spawnMonster(sim, 'giant', best[0], best[1])!;
    m.hp = 100;
    monstersMonthly(sim);
    expect(m.hp).toBeGreaterThan(100);
  });
});
