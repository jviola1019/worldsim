/**
 * Population accounting (R12.4): for the world and for every civilization,
 *   Δ boundary population == Σ signed ledger components
 * exactly (up to float rounding), across every way people are created, moved, transferred or removed.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { boundaryPopulation, ledgerNet, emptyLedger, residents, type PopLedger } from '../../src/population/ledger';
import { convertToCohorts, convertToIndividuals, addPeople } from '../../src/population/demography';
import { transferSettlement, destroySettlement } from '../../src/civilizations/settlement';
import { emigrate } from '../../src/population/migration';
import { explainPopulationChange } from '../../src/history/stats';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import type { Civ } from '../../src/sim/types';

type Snap = { world: number; wl: PopLedger; civs: Map<number, { p: number; l: PopLedger }> };
function snap(sim: Simulation): Snap {
  return {
    world: boundaryPopulation(sim),
    wl: { ...(sim.w.popLedger ?? emptyLedger()) },
    civs: new Map([...sim.w.civs.values()].map((c) => [c.id, { p: boundaryPopulation(sim, c.id), l: { ...(c.ledger ?? emptyLedger()) } }])),
  };
}
/** Largest |residual| between two snapshots across the world and all civs. */
function residual(sim: Simulation, a: Snap): number {
  const b = snap(sim);
  let worst = Math.abs(b.world - a.world - ledgerNet(a.wl, b.wl)) / Math.max(1, b.world);
  for (const [id, c] of b.civs) {
    const p = a.civs.get(id);
    worst = Math.max(worst, Math.abs(c.p - (p?.p ?? 0) - ledgerNet(p?.l, c.l)) / Math.max(1, c.p));
  }
  return worst;
}
const TOL = 1e-9; // relative; float rounding only
const livingCivs = (sim: Simulation): Civ[] => [...sim.w.civs.values()].filter((c) => c.alive && c.settlements.length > 0);

describe('population ledger reconciles', () => {
  const sim = makeSim('ledger-1', 96, (c) => { c.settings.startEra = 4; });
  sim.runYears(30);

  it('every tick for 10 years of a medieval world (world and each civ)', () => {
    for (let t = 0; t < 1200; t++) {
      const a = snap(sim);
      sim.step();
      expect(residual(sim, a)).toBeLessThan(TOL);
    }
  }, 120000);

  it('through cohort → individual → cohort conversion (rounding recorded, not hidden)', () => {
    const s = [...sim.w.settlements.values()].find((x) => x.mode === 'cohort' && residents(x) > 200)!;
    s.cohorts = s.cohorts.map((v) => v * (120 / residents(s))); // shrink to a convertible size
    const a = snap(sim);
    convertToIndividuals(sim, s);
    expect(Number.isInteger(residents(s))).toBe(true);
    expect(residual(sim, a)).toBeLessThan(TOL);
    const b = snap(sim);
    convertToCohorts(sim, s);
    expect(residual(sim, b)).toBeLessThan(TOL);
  });

  it('adding fractional people to an individual-mode town records the rounding', () => {
    const s = [...sim.w.settlements.values()].find((x) => x.mode === 'individual') ?? (() => { const x = [...sim.w.settlements.values()][0]; x.cohorts = x.cohorts.map(() => 5); convertToIndividuals(sim, x); return x; })();
    const a = snap(sim);
    addPeople(sim, s, 7.4, 0, 0);
    const b = snap(sim);
    // 7 whole people appear; the −0.4 rounding is recorded explicitly (the caller records where the 7.4 came from)
    expect(b.world - a.world).toBe(7);
    expect(b.wl.resolution - a.wl.resolution).toBeCloseTo(-0.4, 9);
  });

  it('annexation moves people between civs and is zero at world level', () => {
    const [x, y] = livingCivs(sim);
    const s = sim.w.settlements.get(x.settlements[x.settlements.length - 1])!;
    const moved = residents(s);
    const a = snap(sim);
    transferSettlement(sim, s, y, 'test annexation', true);
    expect(residual(sim, a)).toBeLessThan(TOL);
    const b = snap(sim);
    expect(b.civs.get(x.id)!.l.transferOut - a.civs.get(x.id)!.l.transferOut).toBeCloseTo(moved, 6);
    expect(b.civs.get(y.id)!.l.transferIn - a.civs.get(y.id)!.l.transferIn).toBeCloseTo(moved, 6);
    expect(ledgerNet(a.wl, b.wl)).toBe(0);
  });

  it('migration: source and destination civs and the world all reconcile, incl. arrival without a land route', () => {
    const civs = livingCivs(sim);
    const s = sim.w.settlements.get(civs[0].settlements[0])!;
    s.unrest = 1; // force distress so people leave
    s.routes = {}; // no cached corridors
    for (const o of sim.w.settlements.values()) if (o !== s) s.routes[o.id] = []; // pretend every destination is unreachable by land
    const a = snap(sim);
    emigrate(sim, s, civs[0], 0.2);
    expect(residual(sim, a)).toBeLessThan(TOL);
    // then let normal ticks deliver any agents that were spawned
    for (let t = 0; t < 240; t++) { const b = snap(sim); sim.step(); expect(residual(sim, b)).toBeLessThan(TOL); }
  }, 60000);

  it('settlement destruction records the residents as lost with the town', () => {
    const c = livingCivs(sim)[0];
    const s = sim.w.settlements.get(c.settlements[c.settlements.length - 1])!;
    const gone = residents(s);
    const a = snap(sim);
    destroySettlement(sim, s, 'divine wrath');
    expect(residual(sim, a)).toBeLessThan(TOL);
    expect(snap(sim).wl.destroyed - a.wl.destroyed).toBeCloseTo(gone, 6);
  });

  it('save/load in the middle of a reporting interval keeps the ledger and its reconciliation', () => {
    sim.runTicks(57);
    sim.syncRng();
    const b = new Simulation(decodeWorld(encodeWorld(sim.w)));
    expect(b.w.popLedger).toEqual(sim.w.popLedger);
    const a = snap(b);
    b.runYears(3);
    expect(residual(b, a)).toBeLessThan(TOL);
  }, 60000);
});

describe('decomposition over long histories', () => {
  it('a world with no civilizations has zero population and an empty ledger', () => {
    const sim = makeSim('ledger-empty', 64, (c) => { c.settings.startCivs = 0; });
    for (const b of [...sim.w.bands.values()]) sim.w.bands.delete(b.id);
    for (const c of sim.w.civs.values()) c.bands = [];
    const a = snap(sim);
    sim.runYears(20);
    expect(boundaryPopulation(sim)).toBe(0);
    expect(residual(sim, a)).toBeLessThan(TOL);
  }, 60000);

  it('explainPopulationChange reconciles exactly across many years and after decimation', () => {
    const sim = makeSim('ledger-long', 48);
    sim.runYears(460); // > 400 samples: the global series is decimated and the interval doubles
    expect(sim.w.stats.interval).toBeGreaterThan(1);
    const g = sim.w.stats.global;
    const n = g.years.length;
    expect(n).toBeGreaterThan(20);
    for (const [y0, y1] of [[g.years[0], g.years[n - 1]], [g.years[5], g.years[Math.floor(n / 2)]], [g.years[Math.floor(n / 2)], g.years[n - 1]]]) {
      const e = explainPopulationChange(g, y0, y1)!;
      expect(e).toBeTruthy();
      expect(e.contributors.find((c) => c.label.startsWith('Unreconciled'))).toBeUndefined();
      const sum = e.contributors.reduce((a, c) => a + c.value, 0);
      expect(Math.abs(e.to - e.from - sum)).toBeLessThan(Math.max(1, 1e-6 * e.to));
    }
    for (const c of sim.w.civs.values()) {
      const st = sim.w.stats.civs[c.id];
      if (!st || st.years.length < 3) continue;
      const e = explainPopulationChange(st, st.years[0], st.years[st.years.length - 1])!;
      expect(e.contributors.find((k) => k.label.startsWith('Unreconciled'))).toBeUndefined();
    }
  }, 120000);
});
