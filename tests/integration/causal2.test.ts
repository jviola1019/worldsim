/**
 * Integration scenarios #3, #5, #8 and #10 from the original specification ("Integration tests":
 * 3 education → technology, 5 electricity → dependent industries, 8 trade interruption → dependent
 * cities, 10 advanced technology gated by prerequisites / credible transfer). Counterfactual method:
 * identical clones (asserted identical), one intervention, compare.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { BALANCE } from '../../src/config/balance';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import { makeTreaty } from '../../src/politics/diplomacy';
import { GOODS, Good } from '../../src/world/resources';
import { TECHS, TECH_BY_ID } from '../../src/technology/techData';
import { grantTech, researchYearly } from '../../src/technology/research';
import type { Civ } from '../../src/sim/types';
import { BUILDINGS } from '../../src/civilizations/buildings';

const clone = (s: Simulation) => { s.syncRng(); return new Simulation(decodeWorld(encodeWorld(s.w))); };

describe('#8 trade interruption hurts a dependent importer, and trade recovers', () => {
  // a world that trades: whether nations meet and open routes depends on the seed, so take the first
  // of a few seeds with an established route (the precondition below still demands real dependence)
  let base!: Simulation;
  // the most import-dependent (route, good): share of the importer's supply that arrives by this route
  let pick: { route: number; good: number; importer: number; exporter: number; dep: number } | null = null;
  for (const seed of ['int-trade', 'int-trade-2', 'int-trade-3', 'int-trade-4', 'int-trade-5', 'int-trade-6', 'int-trade-7', 'int-trade-8', 'int-trade-9', 'int-trade-10']) {
    base = makeSim(seed, 96, (c) => { c.settings.startEra = 4; });
    base.runYears(40);
    // routes that keep trading in an untouched copy (the control's own future) for the next three years:
    // nations can close trade by themselves (autarky, war), and that would be no test of an embargo
    const probe = (() => { base.syncRng(); return new Simulation(decodeWorld(encodeWorld(base.w))); })();
    const keeps = new Map<number, number>();
    for (let y = 0; y < 3; y++) { probe.runYears(1); for (const r of probe.w.routes.values()) if (r.active && r.volume > 0) keeps.set(r.id, (keeps.get(r.id) ?? 0) + 1); }
    for (const r of base.w.routes.values()) {
      if (!r.active || r.volume <= 0 || (keeps.get(r.id) ?? 0) < 3) continue;
      r.flows.forEach((f, g) => {
        if (!f || g === Good.GOLD || g === Good.LUXURY) return; // precious goods sit at a price ceiling with no stock either way
        const importer = f > 0 ? r.civB : r.civA;
        const exporter = f > 0 ? r.civA : r.civB;
        const imp = base.w.civs.get(importer)!;
        const dep = Math.abs(f) / (Math.abs(f) + imp.acc.prod[g] + 1e-9);
        if (!pick || dep > pick.dep) pick = { route: r.id, good: g, importer, exporter, dep };
      });
    }
    if (pick && (pick as { dep: number }).dep > 0.5) break;
    pick = null;
  }

  it('precondition: an established route the importer depends on', () => {
    expect(pick).toBeTruthy();
    expect(pick!.dep).toBeGreaterThan(0.5);
  });

  it('an embargo cuts the flow and leaves the importer with less of the good (or paying more) than the control', () => {
    const p = pick!;
    const A = clone(base), B = clone(base);
    expect(B.digest()).toBe(A.digest()); // cannot pass because the worlds were already different
    makeTreaty(B, B.w.civs.get(p.importer)!, B.w.civs.get(p.exporter)!, 'embargo', 30, true);
    // route volume fluctuates month to month: compare the total carried over three years (monthly samples)
    let carriedA = 0, carriedB = 0;
    // what the importer had of each good (stock on hand plus what it used so far this year), and what the
    // route actually delivered to it in the control world (trade mixes change from year to year)
    const hadA = new Array(GOODS.length).fill(0), hadB = new Array(GOODS.length).fill(0), delivered = new Array(GOODS.length).fill(0);
    for (let k = 0; k < 36; k++) {
      A.runTicks(10); B.runTicks(10);
      const ia0 = A.w.civs.get(p.importer)!, ib0 = B.w.civs.get(p.importer)!;
      const rA = A.w.routes.get(p.route);
      for (let g = 0; g < GOODS.length; g++) {
        hadA[g] += ia0.stock[g] + ia0.acc.use[g];
        hadB[g] += ib0.stock[g] + ib0.acc.use[g];
        const f = rA?.flows[g] ?? 0;
        if ((f > 0 && rA!.civB === p.importer) || (f < 0 && rA!.civA === p.importer)) delivered[g] += Math.abs(f);
      }
      carriedA += A.w.routes.get(p.route)?.volume ?? 0;
      if (k >= 12) carriedB += B.w.routes.get(p.route)?.volume ?? 0; // route volumes are recomputed yearly
    }
    expect(carriedA).toBeGreaterThan(0); // control keeps trading
    expect(carriedB).toBe(0); // the embargo cut the route
    expect(B.w.routes.get(p.route)!.volume).toBe(0);
    const ia = A.w.civs.get(p.importer)!, ib = B.w.civs.get(p.importer)!;
    // scarcer: lower stock, a higher price, or less access (domestic supply + imports vs need) -- a good
    // already at its price ceiling with zero stock can only show the loss in access
    // (access saturates at 1 because imports count as supply, so it cannot show dependence)
    const goods = GOODS.map((_, g) => g).filter((g) => delivered[g] > 0);
    expect(goods.length).toBeGreaterThan(0);
    const value = (had: number[]) => goods.reduce((a, g) => a + had[g] * GOODS[g].basePrice, 0);
    const pricier = goods.some((g) => ib.prices[g] > ia.prices[g] * 1.05);
    expect(value(hadB) < value(hadA) * 0.995 || pricier, `goods ${goods.map((g) => GOODS[g].key).join(',')}: had ${value(hadA).toFixed(0)} -> ${value(hadB).toFixed(0)}`).toBe(true);
    // recovery: lift the embargo and the route carries goods again
    for (const t of B.w.treaties.values()) if (t.kind === 'embargo' && [t.a, t.b].includes(p.importer) && [t.a, t.b].includes(p.exporter)) { t.active = false; t.end = B.year; }
    let after = 0;
    for (let k = 0; k < 24; k++) { B.runTicks(10); after += B.w.routes.get(p.route)?.volume ?? 0; }
    expect(after).toBeGreaterThan(0);
  }, 120000);
});

describe('#3 education investment raises long-run technological capability', () => {
  it('nations that fund schooling for 30 years out-research their identical twins (3 seeds, majority)', () => {
    let wins = 0, sumA = 0, sumB = 0, eduHigher = 0;
    for (const seed of ['int-edu', 'int-edu-2', 'int-edu-3']) {
      // a literate society (schooling scales with the literacy capability; near zero in early eras)
      const base = makeSim(seed, 96, (c) => { c.settings.startEra = 7; });
      base.runYears(2);
      // the largest literate nation (which nation that is depends on how the start was laid out)
      const literate = [...base.w.civs.values()].filter((c) => c.alive && c.settlements.length && c.caps.literacy > 0.3).sort((a, b) => b.population - a.population);
      expect(literate.length, 'precondition: a literate nation').toBeGreaterThan(0);
      const id = literate[0].id;
      const A = clone(base), B = clone(base);
      expect(B.digest()).toBe(A.digest());
      for (let y = 0; y < 30; y++) {
        // investment vs none (the effect saturates at a budget share of 1/8, which most nations already reach)
        const ca0 = A.w.civs.get(id)!, cb = B.w.civs.get(id)!;
        if (ca0.alive) ca0.budget.education = 0;
        if (cb.alive) cb.budget.education = 0.25;
        A.runYears(1);
        B.runYears(1);
      }
      const ca: Civ = A.w.civs.get(id)!, cb: Civ = B.w.civs.get(id)!;
      const avgEdu = (sim: Simulation, c: Civ) => { let e = 0, p = 0; for (const sid of c.settlements) { const s = sim.w.settlements.get(sid); if (s) { e += s.education * s.pop; p += s.pop; } } return p ? e / p : 0; };
      if (avgEdu(B, cb) > avgEdu(A, ca)) eduHigher++;
      // capability = knowledge-generation rate (scholars × education); the tech score itself moves
      // slowly in industrial eras, so it is only required not to fall behind
      if (cb.researchRate > ca.researchRate) wins++;
      sumA += ca.techScore; sumB += cb.techScore;
    }
    expect(eduHigher, 'investment raised schooling').toBeGreaterThanOrEqual(2);
    expect(wins, 'research capability higher in most worlds').toBeGreaterThanOrEqual(2);
    // Finding (docs/VALIDATION.md): within 30 industrial-era years the tech score itself shows no measurable
    // effect (|Δ| < 5%; observed −0.6%), because era-scaled tech costs make the extra research small
    expect(Math.abs(sumB / sumA - 1), 'no large effect on tech score within 30 years').toBeLessThan(0.05);
  }, 480000);
});

describe('#5 electricity adoption enables dependent industries', () => {
  it('granting electric power leads to power generation and energy use that the twin lacks', () => {
    const base = makeSim('int-elec', 96, (c) => { c.settings.startEra = 7; });
    base.runYears(2);
    const civ = [...base.w.civs.values()].find((c) => c.alive && c.settlements.length && c.caps.electrification === 0 && !c.techs.electric_power?.known);
    expect(civ, 'precondition: an industrial nation without electricity').toBeTruthy();
    const id = civ!.id;
    const A = clone(base), B = clone(base);
    expect(B.digest()).toBe(A.digest());
    const cb = B.w.civs.get(id)!;
    // credible path: all prerequisites first, then the technology itself
    const need = (t: string): void => { for (const p of TECH_BY_ID.get(t)!.prereqs) need(p); if (!cb.techs[t]?.known) grantTech(B, cb, t, 'god'); };
    need('electric_power');
    expect(cb.caps.electrification).toBeGreaterThan(0);
    // task 8 part C: energy is summed month by month over the 15 years. After that task's history change the nation
    // given electricity built 52 plants and used energy for years, then ran out of fuel at war in its last two years
    // (no coal of its own), so the old check of the final month alone read 0 against 0
    const ca = A.w.civs.get(id)!;
    let useA = 0, useB = 0, madeB = 0;
    for (let mo = 0; mo < 15 * 12; mo++) {
      A.runTicks(10);
      B.runTicks(10);
      useA += ca.econ.energyUse;
      useB += cb.econ.energyUse;
      madeB += cb.acc.prod[Good.ENERGY] ?? 0;
    }
    const plants = (sim: Simulation, c: Civ) => c.settlements.reduce((n, sid) => { const s = sim.w.settlements.get(sid); return n + (s ? s.bld.reduce((a, v, t) => a + (t > 0 && /POWER|HYDRO|SOLAR|WIND|FUSION/.test(String(BUILDINGS[t]?.key)) ? v : 0), 0) : 0); }, 0);
    expect(plants(B, cb)).toBeGreaterThan(plants(A, ca));
    expect(useB).toBeGreaterThan(useA);
    expect(madeB).toBeGreaterThan(0);
  }, 180000);
});

describe('#10 advanced technology stays unavailable without prerequisites or credible transfer', () => {
  it('across seeds and eras, every known technology has all of its prerequisites known', () => {
    for (const [seed, era, years] of [['int-tech-1', 1, 250], ['int-tech-2', 4, 120], ['int-tech-3', 9, 60]] as const) {
      const sim = makeSim(seed, 96, (c) => { c.settings.startEra = era; });
      sim.runYears(years);
      for (const c of sim.w.civs.values()) {
        for (const t of TECHS) {
          if (!c.techs[t.id]?.known) continue;
          for (const p of t.prereqs) expect(c.techs[p]?.known, `${c.name} knows ${t.id} without ${p} (${seed})`).toBe(true);
        }
      }
    }
  }, 240000);

  it('speculative technologies are never acquired unless the world allows them', () => {
    const sim = makeSim('int-tech-4', 96, (c) => { c.settings.startEra = 12; c.settings.realism = 'plausible'; c.laws.speculativeTech = false; });
    sim.runYears(60);
    for (const c of sim.w.civs.values()) for (const t of TECHS) if (t.realism === 'speculative') expect(c.techs[t.id]?.known ?? false, `${c.name}: ${t.id}`).toBe(false);
  }, 240000);

  it('knowledge diffuses only from nations a civilization has contacted (mechanism, with control)', () => {
    const base = makeSim('int-tech-5', 96, (c) => { c.settings.startEra = 4; });
    base.runYears(40);
    const civs = [...base.w.civs.values()].filter((c) => c.alive);
    const learnable = (c: Civ) => TECHS.filter((t) => !c.techs[t.id]?.known && c.knownCivs.some((o) => base.w.civs.get(o)?.techs[t.id]?.known && (base.w.civs.get(o)!.techs[t.id].adoption ?? 0) >= 0.5));
    const target = civs.filter((c) => c.knownCivs.length > 0).sort((a, b) => learnable(b).length - learnable(a).length)[0];
    expect(target && learnable(target).length, 'precondition: a nation with something to learn from its contacts').toBeGreaterThan(0);
    const ids = learnable(target).map((t) => t.id).filter((id) => id !== target.researchTarget);
    // own research goes only to the research target, which researchYearly may choose during the step (round 10
    // addendum: a nation with no target picked republicanism, a learnable technology, and the test counted its own
    // research as diffusion); compare everything except each arm's target after the step
    const progress = (c: Civ, skip = c.researchTarget) => ids.reduce((a, id) => a + (id === skip ? 0 : c.techs[id]?.progress ?? 0), 0);
    // same nation, same instant: once with its contacts, once without any
    const A = clone(base), B = clone(base);
    const ca = A.w.civs.get(target.id)!, cb = B.w.civs.get(target.id)!;
    cb.knownCivs = [];
    const snapA = Object.fromEntries(ids.map((id) => [id, ca.techs[id]?.progress ?? 0]));
    const snapB = Object.fromEntries(ids.map((id) => [id, cb.techs[id]?.progress ?? 0]));
    // serendipity (independent invention) is real but random; switch it off in both arms so only diffusion differs
    const keepSer = BALANCE.serendipity;
    try { BALANCE.serendipity = 0; researchYearly(A, ca); researchYearly(B, cb); } finally { BALANCE.serendipity = keepSer; }
    const pa0 = ids.reduce((a, id) => a + (id === ca.researchTarget ? 0 : snapA[id]), 0);
    const pb0 = ids.reduce((a, id) => a + (id === cb.researchTarget ? 0 : snapB[id]), 0);
    // contacts → diffusion: progress on a learnable technology, or its discovery (discovery resets
    // progress to the base cost, which can be below the effective cost it had to reach)
    expect(progress(ca) - pa0 > 0 || ids.some((id) => ca.techs[id]?.known)).toBe(true);
    expect(ids.some((id) => id !== cb.researchTarget && cb.techs[id]?.known)).toBe(false);
    expect(progress(cb) - pb0).toBe(0); // no contacts → none
  }, 120000);
});
