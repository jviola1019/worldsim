/**
 * Phase P5: war, nuclear weapons and technological overtaking. Counterfactual method: clone a world
 * exactly (save/load), check the clones are identical, intervene in one, compare.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import { ensureRelation, makeContact } from '../../src/civilizations/knowledge';
import { warUtility } from '../../src/politics/diplomacy';
import { forceExchange, deterrenceCost } from '../../src/military/nuclear';
import { globalCooling, coolingYieldMult } from '../../src/civilizations/endings';
import { boundaryPopulation, ledgerNet, emptyLedger } from '../../src/population/ledger';
import { researchYearly, researchOutput, techState, computeCaps } from '../../src/technology/research';
import { TECH_BY_ID } from '../../src/technology/techData';
import { Good } from '../../src/world/resources';
import { SECTOR } from '../../src/civilizations/buildings';
import type { Civ } from '../../src/sim/types';

const clone = (s: Simulation): Simulation => {
  s.syncRng();
  return new Simulation(decodeWorld(encodeWorld(s.w)));
};
const living = (sim: Simulation): Civ[] => [...sim.w.civs.values()].filter((c) => c.alive && c.settlements.length > 0);

describe('nuclear deterrence', () => {
  const base = makeSim('p5-deter', 64, (c) => { c.settings.startEra = 10; });
  base.runYears(2);

  it('nuclearDeterrenceLowersWarUtility: arming the target raises the cost of war, gains unchanged', () => {
    const A = clone(base);
    const B = clone(base);
    expect(B.digest()).toBe(A.digest());
    const [x, y] = living(A);
    for (const S of [A, B]) {
      makeContact(S, x.id, y.id);
      S.w.civs.get(y.id)!.nukes = 0;
    }
    B.w.civs.get(y.id)!.nukes = 20; // the only difference
    const ua = warUtility(A, A.w.civs.get(x.id)!, A.w.civs.get(y.id)!, ensureRelation(A, x.id, y.id));
    const ub = warUtility(B, B.w.civs.get(x.id)!, B.w.civs.get(y.id)!, ensureRelation(B, x.id, y.id));
    expect(ub.gain).toBeCloseTo(ua.gain, 9);
    expect(ua.deterrence).toBe(0);
    expect(ub.deterrence).toBeGreaterThan(1);
    expect(ub.cost - ua.cost).toBeCloseTo(ub.deterrence, 9);
    expect(ub.gain - ub.cost).toBeLessThan(ua.gain - ua.cost - 1);
    // mutual destruction: an armed attacker is deterred even more; no law, no deterrence
    const bx = B.w.civs.get(x.id)!;
    const by = B.w.civs.get(y.id)!;
    const alone = deterrenceCost(B, bx, by);
    bx.nukes = 10;
    expect(deterrenceCost(B, bx, by)).toBeGreaterThan(alone);
    B.w.laws.advancedWeapons = false;
    expect(deterrenceCost(B, bx, by)).toBe(0);
  });
});

describe('nuclear exchange', () => {
  const base = makeSim('p5-nuke', 64, (c) => { c.settings.startEra = 10; });
  base.runYears(2);

  it('kills people recorded in the ledger (war), lofts soot, cools the world and cuts crop yields', () => {
    const A = clone(base);
    const B = clone(base);
    expect(B.digest()).toBe(A.digest());
    const [x, y] = living(B);
    const pop0 = boundaryPopulation(B);
    const led0 = { ...(B.w.popLedger ?? emptyLedger()) };
    const hits = forceExchange(B, x, y, 6);
    expect(hits).toBeGreaterThan(0);
    const led1 = B.w.popLedger!;
    const warDead = led1.war - led0.war;
    expect(warDead).toBeGreaterThan(1000);
    // the population identity holds exactly through the exchange
    expect(Math.abs(boundaryPopulation(B) - pop0 - ledgerNet(led0, led1))).toBeLessThan(1e-6 * pop0);
    expect(boundaryPopulation(A) - boundaryPopulation(B)).toBeCloseTo(warDead, 3);
    // nuclear winter
    expect(B.w.climate.soot ?? 0).toBeGreaterThan(5);
    expect(globalCooling(B.w.climate)).toBeGreaterThan(1.5);
    expect(coolingYieldMult(B)).toBeLessThan(0.9);
    expect(coolingYieldMult(A)).toBeGreaterThan(0.97);
    // crop yields: food per farm worker in towns outside the fallout zones falls
    const struck = new Set(B.w.events.filter((e) => e.type === 'nuclear_strike').flatMap((e) => e.settlements));
    const far = (S: Simulation) => [...S.w.settlements.values()].filter((s) => [...struck].every((id) => {
      const t = B.w.settlements.get(id) ?? A.w.settlements.get(id);
      return !t || Math.hypot(t.x - s.x, t.y - s.y) > 8;
    }));
    A.runYears(1);
    B.runYears(1);
    const perWorker = (S: Simulation) => {
      let food = 0, work = 0;
      for (const s of far(S)) { food += s.output[Good.FOOD]; work += s.employment[SECTOR.FOOD]; }
      return food / Math.max(1, work);
    };
    expect(far(B).length).toBeGreaterThan(0);
    expect(perWorker(B)).toBeLessThan(perWorker(A) * 0.92);
  }, 60000);
});

describe('technological overtaking', () => {
  const base = makeSim('p5-leap', 64, (c) => { c.settings.startEra = 10; });
  base.runYears(1);

  /** `hi` uses mobile telephony; `lo` knows everything up to the internet but has built few landlines. */
  function setup(S: Simulation, contact: boolean): { lo: Civ; hi: Civ } {
    const [lo, hi] = living(S);
    const know = (c: Civ, id: string) => { const st = techState(c, id); st.known = true; st.adoption = 1; st.year = 0; };
    const need = (c: Civ, id: string) => { for (const p of TECH_BY_ID.get(id)!.prereqs) need(c, p); know(c, id); };
    need(hi, 'mobile_telecom');
    need(lo, 'internet');
    lo.techs['telephone'].adoption = 0.1;
    for (const id of ['mobile_telecom', 'machine_learning', 'global_finance']) delete lo.techs[id];
    computeCaps(lo);
    computeCaps(hi);
    if (contact) {
      makeContact(S, lo.id, hi.id);
      const rel = ensureRelation(S, lo.id, hi.id);
      rel.trade = 5000;
      rel.border = 20;
    } else {
      lo.knownCivs = lo.knownCivs.filter((id) => id !== hi.id);
    }
    return { lo, hi };
  }

  it('a laggard in contact with a user leapfrogs straight to mobile telephony, skipping landlines; without contact it does not', () => {
    const W = clone(base);
    const N = clone(base);
    expect(N.digest()).toBe(W.digest());
    const a = setup(W, true);
    const b = setup(N, false);
    let yearsW = -1;
    let atSkip = -1;
    for (let k = 0; k < 40; k++) {
      researchYearly(W, a.lo);
      researchYearly(N, b.lo);
      if (yearsW < 0 && a.lo.techs['telephone'].skipped) { yearsW = k; atSkip = a.lo.techs['telephone'].adoption; }
    }
    expect(yearsW).toBeGreaterThanOrEqual(0);
    expect(a.lo.techs['mobile_telecom']?.known).toBe(true);
    expect(W.w.events.some((e) => e.type === 'leapfrog' && e.civs[0] === a.lo.id && (e.causes?.length ?? 0) > 0)).toBe(true);
    // the landline stage is never built out; mobile telephony is adopted instead
    expect(atSkip).toBeLessThan(0.6);
    expect(a.lo.techs['telephone'].adoption).toBe(atSkip);
    expect(a.lo.techs['mobile_telecom'].adoption).toBeGreaterThan(0.5);
    // without contact: no leapfrog, and landlines get built
    expect(b.lo.techs['telephone'].skipped ?? false).toBe(false);
    expect(b.lo.techs['telephone'].adoption).toBeGreaterThan(0.5);
    expect(N.w.events.some((e) => e.type === 'leapfrog')).toBe(false);
  }, 60000);

  it('institutional sclerosis slows the research of an entrenched leader', () => {
    const A = clone(base);
    const B = clone(base);
    const id = living(A)[0].id;
    const ca = A.w.civs.get(id)!;
    const cb = B.w.civs.get(id)!;
    ca.sclerosis = 0;
    cb.sclerosis = 0.8;
    expect(researchOutput(B, cb)).toBeLessThan(researchOutput(A, ca) * 0.8);
  });
});
