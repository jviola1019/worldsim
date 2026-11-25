/**
 * Round 10 addendum (life audit): placed people and animals reproduce where they could live. The full audit is
 * scripts/life-audit.ts (docs/data/round10/life-audit.txt); these are its core cases.
 */
import { describe, it, expect } from 'vitest';
import { defaultConfig, PRESETS } from '../../src/config/laws';
import { createSimulation } from '../../src/sim/bootstrap';
import { applyPower } from '../../src/powers/powers';
import { T } from '../../src/world/terrain';

const empty = (seed: string) => {
  const c = defaultConfig();
  PRESETS.find((p) => p.key === 'realistic')!.apply(c);
  c.gen.seed = seed; c.gen.width = 96; c.gen.height = 96; c.settings.empty = true;
  return createSimulation(c);
};
type S = ReturnType<typeof empty>;
const patch = (sim: S, ok: (i: number) => boolean) => {
  const m = sim.w.map;
  let best = -1, bestN = 0;
  for (let i = 0; i < m.n; i += 2) {
    if (!ok(i)) continue;
    let n = 0;
    m.forRadius(m.xOf(i), m.yOf(i), 3, (j) => { if (ok(j)) n++; });
    if (n > bestN) { bestN = n; best = i; }
  }
  if (best < 0) throw new Error('no patch');
  return best;
};
const people = (sim: S) => [...sim.w.bands.values()].reduce((t, b) => t + b.members.length, 0) + [...sim.w.settlements.values()].reduce((t, s) => t + s.pop, 0);
const herd = (sim: S, key: string) => [...sim.w.herds.values()].filter((h) => h.species === key).reduce((t, h) => t + h.count, 0);
const ctx = { selectedCiv: 0 };

describe('placed life', () => {
  it('a band dropped on grassland grows within 50 years', () => {
    const sim = empty('life-0');
    const m = sim.w.map;
    const i = patch(sim, (j) => m.terrain[j] === T.GRASS);
    expect(applyPower(sim, 'spawn_human', m.xOf(i), m.yOf(i), 1, ctx)).toBeNull();
    const start = people(sim);
    sim.runYears(50);
    expect(people(sim)).toBeGreaterThan(start * 1.25);
  }, 120000);

  it('deer dropped in a temperate forest grow', () => {
    const sim = empty('life-0');
    const m = sim.w.map;
    const i = patch(sim, (j) => m.terrain[j] === T.FOREST && m.temp[j] >= 0 && m.temp[j] <= 22);
    expect(applyPower(sim, 'animal_deer', m.xOf(i), m.yOf(i), 1, ctx)).toBeNull();
    const start = herd(sim, 'deer');
    sim.runYears(25);
    expect(herd(sim, 'deer')).toBeGreaterThan(start * 1.25);
  }, 120000);

  it('elephants dropped in the far cold die out (they cannot live there and the cold reaches far)', () => {
    const sim = empty('life-0');
    const m = sim.w.map;
    const i = patch(sim, (j) => !m.isWater(j) && m.temp[j] < -15);
    expect(applyPower(sim, 'animal_elephant', m.xOf(i), m.yOf(i), 1, ctx)).toBeNull();
    sim.runYears(25);
    expect(herd(sim, 'elephant')).toBe(0);
  }, 120000);

  it('fish cannot be dropped on land, and deer cannot be dropped into the sea', () => {
    const sim = empty('life-0');
    const m = sim.w.map;
    const land = patch(sim, (j) => m.terrain[j] === T.GRASS);
    const sea = patch(sim, (j) => m.terrain[j] === T.OCEAN);
    expect(applyPower(sim, 'animal_fish', m.xOf(land), m.yOf(land), 1, ctx)).toBe('Fish need water');
    expect(applyPower(sim, 'animal_deer', m.xOf(sea), m.yOf(sea), 1, ctx)).toBe('Deer need dry land');
    expect(sim.w.herds.size).toBe(0);
  });
});
