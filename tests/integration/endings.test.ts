/**
 * Round 5, P5: endings, catastrophes, horrors and technological overtaking. Counterfactuals on
 * identical clones; every death must stay in the population ledger.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import { unleashHorror, horrorsAllowed } from '../../src/powers/horrors';
import { asteroidImpact, eruption } from '../../src/world/catastrophes';
import { forceAITakeover } from '../../src/future/risks';
import { killCiv } from '../../src/civilizations/civ';
import { globalCooling, coolingYieldMult } from '../../src/civilizations/endings';
import { boundaryPopulation, ledgerNet, emptyLedger } from '../../src/population/ledger';
import type { Civ } from '../../src/sim/types';

const clone = (s: Simulation) => { s.syncRng(); return new Simulation(decodeWorld(encodeWorld(s.w))); };
const big = (sim: Simulation): Civ => [...sim.w.civs.values()].filter((c) => c.alive && c.settlements.length).sort((a, b) => b.population - a.population)[0];


describe('god-mode horrors', () => {
  it('a zombie outbreak spreads within and beyond the town and kills people recorded in the ledger', () => {
    const base = makeSim('horror-1', 96, (c) => { c.settings.startEra = 6; });
    base.runYears(2);
    const civ = big(base);
    const s = base.w.settlements.get(civ.capital)!;
    const A = clone(base), B = clone(base);
    expect(unleashHorror(B, B.w.settlements.get(s.id)!, 'zombie')).toBe(true);
    A.runYears(2); B.runYears(2);
    const disease = (sim: Simulation) => sim.w.civs.get(civ.id)?.ledger?.disease ?? 0;
    expect(disease(B)).toBeGreaterThan(disease(A)); // bites are counted as deaths by disease
    const infested = [...B.w.settlements.values()].filter((x) => x.horror).length;
    expect(infested + B.w.events.filter((e) => /dead rose|zombie/i.test(e.title)).length).toBeGreaterThan(0);
  });

  it('observer (Realistic) worlds never host god-mode horrors', () => {
    const obs = makeSim('horror-obs', 64, (c) => { c.settings.startEra = 6; c.settings.observer = true; });
    expect(horrorsAllowed(obs)).toBe(false);
    const s = obs.w.settlements.get(big(obs).capital)!;
    expect(unleashHorror(obs, s, 'zombie')).toBe(false);
    s.horror = { kind: 'ghoul', level: 50, since: 0 }; // even if smuggled in, it is removed
    obs.runYears(1);
    expect(s.horror).toBeUndefined();
  });
});

describe('catastrophes', () => {
  it('a major impact kills people (ledger: disaster) and cools the planet relative to its twin', () => {
    const base = makeSim('cat-1', 96, (c) => { c.settings.startEra = 8; });
    base.runYears(2);
    const s = base.w.settlements.get(big(base).capital)!;
    const A = clone(base), B = clone(base);
    asteroidImpact(B, s.x, s.y, 'major', [{ label: 'Test impact', weight: 1 }]);
    A.runYears(1); B.runYears(1);
    expect(B.w.popLedger!.disaster).toBeGreaterThan(A.w.popLedger!.disaster);
    // an impact winter: stratospheric dust cools the world (tracked apart from greenhouse warming) and cuts harvests
    expect(globalCooling(B.w.climate)).toBeGreaterThan(globalCooling(A.w.climate) + 0.1);
    expect(coolingYieldMult(B)).toBeLessThan(coolingYieldMult(A));
  });

  it('a supervolcano cools the world and cuts harvests (volcanic winter), and the cooling fades', () => {
    const base = makeSim('cat-2', 96, (c) => { c.settings.startEra = 8; });
    base.runYears(2);
    const A = clone(base), B = clone(base);
    eruption(B, 8);
    A.runYears(1); B.runYears(1);
    const first = globalCooling(B.w.climate);
    expect(first).toBeGreaterThan(globalCooling(A.w.climate) + 0.1);
    expect(coolingYieldMult(B)).toBeLessThan(coolingYieldMult(A));
    B.runYears(5);
    expect(globalCooling(B.w.climate)).toBeLessThan(first);
  });

  it('the population ledger still reconciles exactly after catastrophes and horrors', () => {
    const sim = makeSim('cat-ledger', 96, (c) => { c.settings.startEra = 8; });
    sim.runYears(2);
    const s = sim.w.settlements.get(big(sim).capital)!;
    const p0 = boundaryPopulation(sim), l0 = { ...(sim.w.popLedger ?? emptyLedger()) };
    asteroidImpact(sim, s.x, s.y, 'airburst');
    unleashHorror(sim, s, 'zombie');
    sim.runYears(3);
    // change in population == signed sum of every recorded flow, exactly (float rounding only)
    const p1 = boundaryPopulation(sim);
    expect(Math.abs(p1 - p0 - ledgerNet(l0, sim.w.popLedger!)) / Math.max(1, p1)).toBeLessThan(1e-9);
  });
});

describe('endings', () => {
  it('an AI takeover replaces a nation with a machine-run successor, and the ending is recorded with causes', () => {
    const sim = makeSim('end-ai', 64, (c) => { c.settings.startEra = 12; });
    sim.runYears(1);
    const civ = big(sim);
    const succ = forceAITakeover(sim, civ);
    expect(succ).toBeTruthy();
    expect(civ.alive).toBe(false);
    expect(civ.ending?.type).toBe('ai_takeover');
    expect(civ.ending!.causes.length).toBeGreaterThan(0);
    expect(civ.ending!.by).toBe(succ!.id);
  });

  it('every nation that falls in a long run carries a typed ending with recorded causes', () => {
    const sim = makeSim('end-run', 96, (c) => { c.settings.startEra = 4; });
    sim.runYears(250);
    const fallen = [...sim.w.civs.values()].filter((c) => !c.alive && c.fell !== undefined);
    for (const c of fallen) {
      expect(c.ending, c.name).toBeTruthy();
      expect(c.ending!.year).toBe(c.fell);
    }
  }, 180000);

  it('killing a nation directly still records an ending (defaults when none is given)', () => {
    const sim = makeSim('end-kill', 64, (c) => { c.settings.startEra = 4; });
    const civ = big(sim);
    killCiv(sim, civ, 'Test removal');
    expect(civ.ending).toBeTruthy();
  });
});

describe('technological overtaking', () => {
  it('a latecomer that skipped a legacy technology adopts its successor faster (leapfrogging, counterfactual)', () => {
    const base = makeSim('leap-1', 64, (c) => { c.settings.startEra = 10; });
    base.runYears(1);
    const id = big(base).id;
    const A = clone(base), B = clone(base);
    for (const sim of [A, B]) {
      const c = sim.w.civs.get(id)!;
      c.techs['mobile_telecom'] = { known: true, progress: 1, adoption: 0.05, year: sim.year };
      c.techs['telephone'] = { known: true, progress: 1, adoption: 0, year: sim.year };
    }
    (B.w.civs.get(id)!.techs['telephone'] as any).skipped = true;
    A.runYears(1); B.runYears(1);
    expect(B.w.civs.get(id)!.techs['mobile_telecom'].adoption).toBeGreaterThan(A.w.civs.get(id)!.techs['mobile_telecom'].adoption);
  });

  it('the world records who leads in technology and when the lead changes', () => {
    const sim = makeSim('lead-1', 96, (c) => { c.settings.startEra = 4; });
    sim.runYears(150);
    const lead = sim.w.endings!.techLead;
    expect(sim.w.civs.get(lead.civ)).toBeTruthy();
    expect(lead.history.length).toBeGreaterThanOrEqual(2);
  }, 120000);
});
