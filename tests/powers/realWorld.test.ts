/**
 * Round 10 addendum: Realistic and Observer worlds contain only what could exist in the real world: no
 * fantasy peoples or monsters, no god-only horrors, no alien land or wildlife, no exotic matter. Enforced
 * in the simulation (creation and load), not only on the New World screen.
 */
import { describe, it, expect } from 'vitest';
import { defaultConfig, PRESETS, START_VARIANTS, type WorldConfig } from '../../src/config/laws';
import { SCENARIOS } from '../../src/scenarios/scenarios';
import { createSimulation } from '../../src/sim/bootstrap';
import { realWorld, normalizeReal } from '../../src/powers/powerSet';
import { SPECIES_BY_KEY } from '../../src/ecology/species';
import { Deposit } from '../../src/world/resources';
import { T } from '../../src/world/terrain';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import type { WorldState } from '../../src/sim/types';
import type { PowerSet } from '../../src/sim/types';

const FICTION_TERRAIN = new Set<number>([T.ALIEN, T.ALIEN_GRASS, T.CORRUPT, T.CRYSTAL]);

function fiction(w: WorldState): string[] {
  const out: string[] = [];
  if (w.monsters.size) out.push(`${w.monsters.size} monsters`);
  for (const h of w.herds.values()) if (SPECIES_BY_KEY[h.species]?.alien) { out.push(`alien herd ${h.species}`); break; }
  for (const c of w.civs.values()) if (c.species !== 'human') { out.push(`people ${c.species}`); break; }
  for (const s of w.settlements.values()) if (s.horror) { out.push(`horror ${s.horror.kind}`); break; }
  const m = w.map;
  for (let i = 0; i < m.n; i++) {
    if (m.dep[i] === Deposit.EXOTIC) { out.push('exotic matter'); break; }
  }
  for (let i = 0; i < m.n; i++) {
    if (FICTION_TERRAIN.has(m.terrain[i])) { out.push(`terrain ${m.terrain[i]}`); break; }
  }
  return out;
}

const godVariants = START_VARIANTS.map((v) => ({ key: 'god + ' + v.key, apply: (c: WorldConfig) => { PRESETS.find((p) => p.key === 'god')!.apply(c); v.apply(c); } }));
const SOURCES = [...PRESETS.map((p) => ({ key: p.key, apply: p.apply })), ...godVariants, ...SCENARIOS.map((s) => ({ key: 'scenario ' + s.key, apply: s.apply }))];

describe('real-world lock', () => {
  it('realWorld is true for Realistic and Observer, false for god mode', () => {
    const c = defaultConfig();
    expect(realWorld(c.settings)).toBe(false);
    PRESETS.find((p) => p.key === 'realistic')!.apply(c);
    expect(realWorld(c.settings)).toBe(true);
    const o = defaultConfig();
    PRESETS.find((p) => p.key === 'observer')!.apply(o);
    expect(realWorld(o.settings)).toBe(true);
  });

  for (const src of SOURCES) {
    for (const set of ['grounded', 'none'] as PowerSet[]) {
      it(`${src.key} with power set '${set}' contains no fiction, at creation or after 50 years`, () => {
        const c = defaultConfig();
        c.name = 'Lock';
        c.gen.seed = 'lock-' + src.key;
        c.gen.width = 64;
        c.gen.height = 64;
        src.apply(c);
        c.settings.powerSet = set;
        if (src.key === 'fantasy' || src.key === 'scenario fantasy') c.settings.startCivs = Math.max(4, c.settings.startCivs);
        const sim = createSimulation(c);
        expect(fiction(sim.w)).toEqual([]);
        sim.runYears(50);
        expect(fiction(sim.w)).toEqual([]);
      }, 120000);
    }
  }

  it('a save that claims to be Realistic but holds fiction loads as a god-mode world, intact (review fix)', () => {
    const c = defaultConfig();
    c.name = 'Forged';
    c.gen.seed = 'forged-1';
    c.gen.width = 64;
    c.gen.height = 64;
    SCENARIOS.find((s) => s.key === 'fantasy')!.apply(c);
    c.settings.startCivs = 6;
    const sim = createSimulation(c);
    expect(sim.w.monsters.size).toBeGreaterThan(0); // the fantasy world really has monsters
    expect([...sim.w.civs.values()].some((x) => x.species !== 'human')).toBe(true); // and fantasy peoples
    const monsters = sim.w.monsters.size;
    sim.w.meta.settings.powerSet = 'grounded'; // forge: claim to be Realistic
    sim.syncRng();
    const w = decodeWorld(encodeWorld(sim.w));
    expect(realWorld(w.meta.settings)).toBe(false); // it is not a Realistic world, whatever it claims
    expect(w.monsters.size).toBe(monsters); // nothing is destroyed
    expect(fiction(w).length).toBeGreaterThan(0);
  });

  it('a clean Realistic save stays Realistic', () => {
    const c = defaultConfig();
    c.name = 'Clean'; c.gen.seed = 'clean-1'; c.gen.width = 64; c.gen.height = 64;
    PRESETS.find((p) => p.key === 'realistic')!.apply(c);
    const sim = createSimulation(c);
    sim.runYears(5);
    sim.syncRng();
    const w = decodeWorld(encodeWorld(sim.w));
    expect(realWorld(w.meta.settings)).toBe(true);
    expect(fiction(w)).toEqual([]);
  });

  it('normalizeReal is idempotent and leaves god mode alone', () => {
    const god = defaultConfig();
    SCENARIOS.find((s) => s.key === 'fantasy')!.apply(god);
    const before = JSON.stringify(god);
    normalizeReal(god);
    expect(JSON.stringify(god)).toBe(before);
    const real = defaultConfig();
    SCENARIOS.find((s) => s.key === 'fantasy')!.apply(real);
    real.settings.powerSet = 'grounded';
    normalizeReal(real);
    const once = JSON.stringify(real);
    normalizeReal(real);
    expect(JSON.stringify(real)).toBe(once);
    expect(real.settings.fantasy || real.gen.fantasy || real.laws.fantasyCreatures || real.settings.alien || real.gen.alien).toBe(false);
  });
});
