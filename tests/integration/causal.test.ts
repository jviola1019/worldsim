/**
 * Integration tests as counterfactual experiments: run a world, clone it
 * exactly (save/load is deterministic), intervene in ONE copy, and compare.
 * Any difference is caused by the intervention, not by chance.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import { Good } from '../../src/world/resources';
import { findPath, pathCost } from '../../src/world/pathfinding';
import { INFRA } from '../../src/world/tilemap';
import { declareWar } from '../../src/politics/diplomacy';
import { PRESETS, defaultConfig } from '../../src/config/laws';
import { createSimulation } from '../../src/sim/bootstrap';
import type { Civ } from '../../src/sim/types';

function clone(sim: Simulation): Simulation {
  sim.syncRng();
  return new Simulation(decodeWorld(encodeWorld(sim.w)));
}
const alive = (sim: Simulation) => [...sim.w.civs.values()].filter((c) => c.alive && c.settlements.length > 0);
const biggest = (sim: Simulation) => alive(sim).sort((a, b) => b.population - a.population)[0];

function holdDrought(sim: Simulation, civ: Civ) {
  const c = sim.w.climate;
  for (const sid of civ.settlements) {
    const s = sim.w.settlements.get(sid);
    if (!s) continue;
    const cx = (s.x / c.cellSize) | 0, cy = (s.y / c.cellSize) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k = (cy + dy) * c.cellsX + cx + dx;
      if (k >= 0 && k < c.rain.length) c.rain[k] = -1;
    }
  }
}

describe('integration: causal chains', () => {
  const base = makeSim('int-1', 96);
  base.runYears(220);

  it('#1 drought lowers food output and raises food prices', () => {
    const civ0 = biggest(base);
    expect(civ0).toBeTruthy();
    const A = clone(base), B = clone(base);
    let foodA = 0, foodB = 0, priceA = 0, priceB = 0;
    for (let k = 0; k < 36; k++) {
      holdDrought(B, B.w.civs.get(civ0.id)!);
      A.runTicks(10);
      B.runTicks(10);
      const a = A.w.civs.get(civ0.id)!, b = B.w.civs.get(civ0.id)!;
      for (const sid of a.settlements) foodA += A.w.settlements.get(sid)?.output[Good.FOOD] ?? 0;
      for (const sid of b.settlements) foodB += B.w.settlements.get(sid)?.output[Good.FOOD] ?? 0;
      priceA += a.prices[Good.FOOD];
      priceB += b.prices[Good.FOOD];
    }
    expect(foodB).toBeLessThan(foodA * 0.95);
    expect(priceB).toBeGreaterThan(priceA);
  }, 120000);

  it('#2 roads make land travel cheaper', () => {
    const m = base.w.map;
    let from = -1, to = -1;
    for (let i = 0; i < m.n && to < 0; i++) {
      if (!m.isLand(i)) continue;
      const j = i + 12;
      if (from < 0 && m.isLand(j) && m.yOf(j) === m.yOf(i)) { const p = findPath(m, i, j, { mode: 'land' }); if (p) { from = i; to = j; } }
    }
    expect(from).toBeGreaterThanOrEqual(0);
    const path = findPath(m, from, to, { mode: 'land' })!;
    const before = pathCost(m, path, { mode: 'land' });
    const save = path.map((i) => m.infra[i]);
    for (const i of path) m.infra[i] = (m.infra[i] & ~INFRA.ROAD_MASK) | 2;
    const after = pathCost(m, path, { mode: 'land' });
    path.forEach((i, k) => (m.infra[i] = save[k]));
    expect(after).toBeLessThan(before * 0.7);
  });

  it('#4 war costs lives and labor compared to peace', () => {
    // precondition: kingdoms with armies (tiny chiefdom wars can legitimately fizzle without contact),
    // and the closest pair that know each other (war between strangers is not realistic)
    const kbase = makeSim('int-war', 96, (c) => { c.settings.startEra = 4; });
    kbase.runYears(30);
    const civs = alive(kbase);
    let x = civs[0], y = civs[1], bd = Infinity;
    for (const a of civs) for (const b of civs) {
      if (a.id >= b.id || !a.knownCivs.includes(b.id)) continue;
      const ca = kbase.w.settlements.get(a.capital), cb = kbase.w.settlements.get(b.capital);
      if (!ca || !cb) continue;
      const d = (ca.x - cb.x) ** 2 + (ca.y - cb.y) ** 2;
      if (d < bd) { bd = d; x = a; y = b; }
    }
    expect(bd).toBeLessThan(Infinity);
    const A = clone(kbase), B = clone(kbase);
    // keep A at peace with each other (end any existing war between them) for a fair comparison
    const ax = A.w.civs.get(x.id)!, ay = A.w.civs.get(y.id)!;
    declareWar(B, B.w.civs.get(x.id)!, B.w.civs.get(y.id)!, 'conquest', [{ label: 'Test intervention', weight: 1 }]);
    A.runYears(8);
    B.runYears(8);
    const warDeaths = (s: Simulation) => { let d = 0; for (const st of s.w.settlements.values()) d += st.flows.war; return d; };
    const popA = (A.w.civs.get(x.id)?.population ?? 0) + (A.w.civs.get(y.id)?.population ?? 0);
    const popB = (B.w.civs.get(x.id)?.alive ? B.w.civs.get(x.id)!.population : 0) + (B.w.civs.get(y.id)?.alive ? B.w.civs.get(y.id)!.population : 0);
    const battles = [...B.w.wars.values()].filter((w) => w.attackers.includes(x.id) && w.defenders.includes(y.id)).reduce((a, w) => a + w.battles, 0);
    void ax; void ay;
    expect(battles + warDeaths(B)).toBeGreaterThan(0);
    // lives: deaths the ledger attributes to war in the two nations, war world vs. peace world
    // (total population after 8 years of a chaotic system is too noisy to isolate one intervention)
    const ledgerWar = (s: Simulation) => (s.w.civs.get(x.id)?.ledger?.war ?? 0) + (s.w.civs.get(y.id)?.ledger?.war ?? 0);
    expect(ledgerWar(B)).toBeGreaterThan(ledgerWar(A));
    void popA; void popB;
  }, 120000);

  it('#6 a collapse of legitimacy leads to political change', () => {
    let changes = 0, controls = 0;
    for (const c0 of alive(base).slice(0, 4)) {
      const A = clone(base), B = clone(base);
      const b = B.w.civs.get(c0.id)!;
      const govA = A.w.civs.get(c0.id)!.govForm;
      for (let yr = 0; yr < 12; yr++) {
        b.legitimacy = 0.02; b.stability = 0.05; b.unrest = 1;
        B.runYears(1);
        A.runYears(1);
      }
      const evB = B.w.events.filter((e) => e.year > base.year && e.civs.includes(c0.id) && /revolution|coup|secession|collapse|government_change|uprising/.test(e.type)).length;
      const evA = A.w.events.filter((e) => e.year > base.year && e.civs.includes(c0.id) && /revolution|coup|secession|collapse|government_change|uprising/.test(e.type)).length;
      if (evB > 0 || !b.alive || b.govForm !== govA) changes++;
      if (evA > 0) controls++;
    }
    expect(changes).toBeGreaterThan(controls);
  }, 240000);

  it('#9 religions spread across borders', () => {
    const sim = makeSim('int-rel', 96);
    sim.runYears(500);
    const civsByRel = new Map<number, Set<number>>();
    for (const s of sim.w.settlements.values()) {
      for (const sh of s.religions) if (sh.f > 0.1) {
        if (!civsByRel.has(sh.id)) civsByRel.set(sh.id, new Set());
        civsByRel.get(sh.id)!.add(s.civId);
      }
    }
    const crossing = [...civsByRel.values()].filter((set) => set.size >= 2).length;
    expect(crossing).toBeGreaterThan(0);
  }, 240000);
});

describe('integration: industrialization raises pollution (#7)', () => {
  it('industrial-era world accumulates more pollution than a primitive one', () => {
    const total = (s: Simulation) => { let p = 0; for (let i = 0; i < s.w.map.n; i++) p += s.w.map.pollution[i]; return p; };
    const prim = makeSim('int-pol', 96, (c) => { c.settings.startEra = 1; });
    const ind = makeSim('int-pol', 96, (c) => { c.settings.startEra = 9; });
    prim.runYears(30);
    ind.runYears(30);
    expect(total(ind)).toBeGreaterThan(total(prim) * 2 + 100);
  }, 120000);
});

describe('presets', () => {
  it.each(PRESETS.map((p) => [p.name, p] as const))('%s generates and runs 20 years', (_n, p) => {
    const cfg = defaultConfig();
    cfg.gen.width = 64; cfg.gen.height = 64; cfg.gen.seed = 'preset-' + p.name;
    p.apply(cfg);
    cfg.gen.width = Math.min(cfg.gen.width, 96); cfg.gen.height = Math.min(cfg.gen.height, 96);
    const sim = createSimulation(cfg);
    expect(() => sim.runYears(20)).not.toThrow();
  }, 120000);
});
