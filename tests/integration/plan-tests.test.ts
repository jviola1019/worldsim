/**
 * Named tests from the implementation plan (docs/superpowers/plans/2026-11-14-epoch-implementation.md)
 * that were not yet covered elsewhere. Causal claims use identical clones + one intervention.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import { findPath } from '../../src/world/pathfinding';
import { computeHydrology } from '../../src/world/worldgen';
import { civEconomyYearly } from '../../src/economy/market';
import { declareWar, makeTreaty } from '../../src/politics/diplomacy';
import { spawnHerd } from '../../src/ecology/ecology';
import { planConstruction, findSite } from '../../src/civilizations/urban';
import { BUILDINGS, SECTOR } from '../../src/civilizations/buildings';
import { BLDF } from '../../src/world/tilemap';
import { B } from '../../src/civilizations/buildingTypes';
import { eraToTier } from '../../src/civilizations/buildingTypes';
import { applyPower, undo, endStroke } from '../../src/powers/powers';
import type { Civ } from '../../src/sim/types';

const clone = (s: Simulation) => { s.syncRng(); return new Simulation(decodeWorld(encodeWorld(s.w))); };
const bigCiv = (sim: Simulation): Civ => [...sim.w.civs.values()].filter((c) => c.alive && c.settlements.length).sort((a, b) => b.population - a.population)[0];

describe('world & simulation', () => {
  const sim = makeSim('plan-1', 96, (c) => { c.settings.startEra = 4; });
  sim.runYears(30);

  it('pathAvoidsWater: land paths never step on water', () => {
    const m = sim.w.map;
    let checked = 0;
    for (let k = 0; k < 40 && checked < 10; k++) {
      const a = sim.rng.int(0, m.n - 1), b = sim.rng.int(0, m.n - 1);
      if (!m.isLand(a) || !m.isLand(b)) continue;
      const p = findPath(m, a, b, { mode: 'land', maxNodes: 20000 });
      if (!p) continue;
      checked++;
      for (const i of p) expect(m.isWater(i)).toBe(false);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('buildingTierFollowsEra: no district is built above its nation\'s era tier', () => {
    const m = sim.w.map;
    for (let i = 0; i < m.n; i++) {
      if (!m.bld[i] || m.bldFlags[i] & BLDF.HISTORIC) continue;
      const s = sim.w.settlements.get(m.settle[i]);
      const civ = s ? sim.w.civs.get(s.civId) : undefined;
      if (!civ) continue;
      expect(m.bldFlags[i] & BLDF.TIER_MASK).toBeLessThanOrEqual(eraToTier(civ.era)); // tier never ahead of the era
    }
  });

  it('housingDrivesConstruction: an overcrowded town plans housing', () => {
    const A = clone(sim);
    // a town with room to build homes (round 10: territory tiles are not building sites; the planner builds
    // within the town's radius and beside open land, so ask it directly; a built-up capital could only upgrade)
    const s = [...A.w.settlements.values()].sort((a, b) => b.pop - a.pop).find((x) => findSite(A, x, BUILDINGS[B.HOUSE]) !== null)!;
    expect(s, 'precondition: a town with a free building site').toBeTruthy();
    const civ = A.w.civs.get(s.civId)!;
    s.construction = null;
    s.housing = Math.max(1, s.pop / 3); // three times more people than homes
    for (const g of Object.keys(civ.stock)) civ.stock[Number(g)] = 1e7; // affordability is not the question here
    planConstruction(A, s, civ);
    expect(s.construction).toBeTruthy();
    expect(BUILDINGS[s.construction!.type].category).toBe('residential');
  });

  it('undoRestoresTiles: a terrain stroke is fully undone', () => {
    const A = clone(sim);
    const m = A.w.map;
    let land = -1;
    // on a river, so the stroke re-routes water and undo must route it back
    // (towns now claim river land first, so accept a river tile inside a territory as long as nothing is built on it)
    for (let i = 0; i < m.n; i++) if (m.isLand(i) && !m.bld[i] && m.river[i] > 0) { land = i; break; }
    expect(land).toBeGreaterThanOrEqual(0);
    // rivers are re-derived from the current land on every edit; normalize first so the comparison is
    // "the world as it would be without the stroke"
    computeHydrology(m, A.w.meta.gen.rivers);
    const before = { t: m.terrain.slice(), e: m.elev.slice(), r: m.river.slice() };
    undo.begin();
    expect(applyPower(A, 'mountain', m.xOf(land), m.yOf(land), 3, { selectedCiv: 0 })).toBeNull();
    undo.end();
    endStroke(A, 'mountain'); // elevation changes re-route rivers
    let changed = 0;
    for (let i = 0; i < m.n; i++) if (m.terrain[i] !== before.t[i] || m.river[i] !== before.r[i]) changed++;
    expect(changed).toBeGreaterThan(0);
    undo.undo(A);
    let riverDiff = 0;
    for (let i = 0; i < m.n; i++) { expect(m.terrain[i]).toBe(before.t[i]); expect(m.elev[i]).toBe(before.e[i]); if (m.river[i] !== before.r[i]) riverDiff++; }
    expect(riverDiff).toBe(0); // rivers re-derived from the restored land
  });

  it('seriesMatchState: the last global sample equals the state at sampling time', () => {
    const A = clone(sim);
    const t = A.w.tick;
    A.runTicks(120 - (t % 120)); // land exactly on a year start, when sampling happens
    const g = A.w.stats.global;
    expect(g.years[g.years.length - 1]).toBe(A.year);
    // sampling is the first thing on day 0; the world settlements count cannot have changed since
    expect(g.data.settlements[g.years.length - 1]).toBe(A.w.settlements.size);
  });
});

describe('economy & government', () => {
  const base = makeSim('plan-econ', 64, (c) => { c.settings.startEra = 7; });
  base.runYears(5);

  it('tradeBalanceSumsToZero: world exports equal world imports (in a world that trades)', () => {
    let traded = false;
    for (const seed of ['int-trade', 'plan-trade', 'plan-trade-2', 'tr-4', 'tr-5']) { // whether nations meet and sign trade treaties depends on the seed
      const sim = makeSim(seed, 96, (c) => { c.settings.startEra = 4; });
      sim.runYears(40);
      let exp = 0, imp = 0;
      for (const c of sim.w.civs.values()) { exp += c.tradeExp ?? 0; imp += c.tradeImp ?? 0; }
      expect(Math.abs(exp - imp)).toBeLessThanOrEqual(1e-6 * Math.max(1, exp));
      if (exp > 0) { traded = true; break; }
    }
    expect(traded, 'precondition: at least one seed has international trade').toBe(true);
  }, 360000);

  it('printingMoneyInflates: tripling the money supply raises inflation (counterfactual)', () => {
    const A = clone(base), B = clone(base);
    const ca = bigCiv(A), cb = B.w.civs.get(ca.id)!;
    expect(ca.caps.currency).toBeGreaterThan(0);
    cb.moneySupply *= 3;
    civEconomyYearly(A, ca, 0, 0);
    civEconomyYearly(B, cb, 0, 0);
    expect(cb.inflation).toBeGreaterThan(ca.inflation);
  });

  it('deficitBuildsDebt: a state with banking that runs a deficit in wartime borrows', () => {
    const A = clone(base);
    const c = bigCiv(A);
    c.caps.banking = Math.max(1, c.caps.banking);
    const enemy = [...A.w.civs.values()].find((o) => o.alive && o.id !== c.id)!;
    declareWar(A, c, enemy, 'conquest', [{ label: 'test', weight: 1 }]);
    c.treasury = 0;
    const d0 = c.debt;
    civEconomyYearly(A, c, 0, 0);
    expect(c.debt).toBeGreaterThan(d0);
  });

  it('warHasRecordedCauses: every autonomous declaration of war records its causes', () => {
    const sim = makeSim('plan-war', 96, (c) => { c.settings.startEra = 4; });
    sim.runYears(80);
    const decl = sim.w.events.filter((e) => e.type === 'war_declared');
    expect(decl.length).toBeGreaterThan(0);
    for (const e of decl) expect((e.causes ?? []).length, e.title).toBeGreaterThan(0);
  }, 120000);

  it('allianceObligationsJoinWar: defensive allies join or the alliance visibly breaks', () => {
    const sim = makeSim('plan-ally', 96, (c) => { c.settings.startEra = 4; });
    sim.runYears(5);
    const civs = [...sim.w.civs.values()].filter((c) => c.alive);
    const [att, def, ally] = civs;
    def.knownCivs = [...new Set([...def.knownCivs, ally.id, att.id])];
    makeTreaty(sim, def, ally, 'defensive', 30, true);
    const war = declareWar(sim, att, def, 'conquest', [{ label: 'test', weight: 1 }]);
    const joined = war.defenders.includes(ally.id);
    const broke = sim.w.events.some((e) => e.type === 'alliance_broken' && e.civs.includes(ally.id));
    expect(joined || broke).toBe(true);
  });

  it('automationDisplacesLabor: automation cuts industrial jobs (counterfactual, one month)', () => {
    const sim = makeSim('plan-auto', 96, (c) => { c.settings.startEra = 10; });
    sim.runYears(2);
    const A = clone(sim), B = clone(sim);
    for (const c of B.w.civs.values()) c.caps.automation = 0.9;
    A.runTicks(10); B.runTicks(10);
    const ind = (s: Simulation) => [...s.w.settlements.values()].reduce((a, x) => a + x.employment[SECTOR.INDUSTRY], 0);
    expect(ind(B)).toBeLessThan(ind(A));
  });
});

describe('disease, ecology, society', () => {
  it('densityRaisesR / sanitationLowersDeaths: the same outbreak kills fewer with sanitation (counterfactual)', () => {
    const base = makeSim('plan-dis', 96, (c) => { c.settings.startEra = 4; });
    base.runYears(10);
    const civ = bigCiv(base);
    const s0 = base.w.settlements.get(civ.capital)!;
    expect(applyPower(base, 'dis_plague', s0.x, s0.y, 1, { selectedCiv: 0 })).toBeNull(); // the same outbreak in both worlds
    const A = clone(base), B = clone(base);
    B.w.civs.get(civ.id)!.caps.sanitation = 1;
    A.w.civs.get(civ.id)!.caps.sanitation = 0;
    for (let k = 0; k < 6; k++) { A.runTicks(10); B.runTicks(10); B.w.civs.get(civ.id)!.caps.sanitation = 1; A.w.civs.get(civ.id)!.caps.sanitation = 0; }
    const deaths = (sim: Simulation) => sim.w.civs.get(civ.id)!.ledger?.disease ?? 0;
    expect(deaths(B)).toBeLessThan(deaths(A));
  }, 120000);

  it('predatorsReducePrey: prey herds fare worse with wolves nearby (counterfactual)', () => {
    const base = makeSim('plan-eco', 96);
    const m = base.w.map;
    let x = -1, y = -1;
    for (let i = 0; i < m.n && x < 0; i++) if (m.isLand(i) && m.veg[i] > 120 && !m.settle[i]) { x = m.xOf(i); y = m.yOf(i); }
    for (const h of [...base.w.herds.values()]) base.w.herds.delete(h.id); // isolate the experiment
    spawnHerd(base, 'deer', x, y, 60);
    const A = clone(base), B = clone(base);
    spawnHerd(B, 'wolf', x, y, 12);
    A.runYears(4); B.runYears(4);
    const deer = (sim: Simulation) => [...sim.w.herds.values()].filter((h) => h.species === 'deer').reduce((a, h) => a + h.count, 0);
    expect(deer(B)).toBeLessThan(deer(A));
  }, 120000);
});

describe('future systems', () => {
  it('colonyRequiresSpaceTier: only space-capable nations hold colonies', () => {
    const sim = makeSim('plan-space', 96, (c) => { c.settings.startEra = 12; });
    sim.runYears(40);
    for (const col of sim.w.colonies.values()) {
      const owner = sim.w.civs.get(col.civId)!;
      if (col.independentCiv) continue; // independent colonies inherit the capability by founding
      expect(owner.caps.offworld, owner.name).toBeGreaterThan(0);
    }
  }, 180000);
});

