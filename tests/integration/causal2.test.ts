/**
 * Integration scenarios #3, #5, #8 and #10 from the original specification ("Integration tests":
 * 3 education → technology, 5 electricity → dependent industries, 8 trade interruption → dependent
 * cities, 10 advanced technology gated by prerequisites / credible transfer). Counterfactual method:
 * identical clones (asserted identical), one intervention, compare.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
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
  for (const seed of ['int-trade', 'int-trade-2', 'int-trade-3', 'int-trade-4', 'int-trade-5']) {
    base = makeSim(seed, 96, (c) => { c.settings.startEra = 4; });
    base.runYears(40);
    for (const r of base.w.routes.values()) {
      if (!r.active || r.volume <= 0) continue;
      r.flows.forEach((f, g) => {
        if (!f) return;
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

  it('an embargo cuts the flow and leaves the importer scarcer (lower stock or higher price) than the control', () => {
    const p = pick!;
    const A = clone(base), B = clone(base);
    expect(B.digest()).toBe(A.digest()); // cannot pass because the worlds were already different
    makeTreaty(B, B.w.civs.get(p.importer)!, B.w.civs.get(p.exporter)!, 'embargo', 30, true);
    // route volume fluctuates month to month: compare the total carried over three years (monthly samples)
    let carriedA = 0, carriedB = 0;
    for (let k = 0; k < 36; k++) {
      A.runTicks(10); B.runTicks(10);
      carriedA += A.w.routes.get(p.route)?.volume ?? 0;
      if (k >= 12) carriedB += B.w.routes.get(p.route)?.volume ?? 0; // route volumes are recomputed yearly
    }
    expect(carriedA).toBeGreaterThan(0); // control keeps trading
    expect(carriedB).toBe(0); // the embargo cut the route
    expect(B.w.routes.get(p.route)!.volume).toBe(0);
    const ia = A.w.civs.get(p.importer)!, ib = B.w.civs.get(p.importer)!;
    // scarcer: lower stock, a higher price, or less access (domestic supply + imports vs need) -- a good
    // already at its price ceiling with zero stock can only show the loss in access
    const scarcer = ib.stock[p.good] < ia.stock[p.good] * 0.9 || ib.prices[p.good] > ia.prices[p.good] * 1.05 || ib.access[p.good] < ia.access[p.good] - 0.02;
    expect(scarcer, `${GOODS[p.good].key}: stock ${ia.stock[p.good].toFixed(0)}→${ib.stock[p.good].toFixed(0)}, price ${ia.prices[p.good].toFixed(2)}→${ib.prices[p.good].toFixed(2)}, access ${ia.access[p.good].toFixed(2)}→${ib.access[p.good].toFixed(2)}`).toBe(true);
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
      const id = [...base.w.civs.values()].filter((c) => c.alive && c.settlements.length).sort((a, b) => b.population - a.population)[0].id;
      expect(base.w.civs.get(id)!.caps.literacy).toBeGreaterThan(0.3);
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
    A.runYears(15);
    B.runYears(15);
    const ca = A.w.civs.get(id)!;
    const plants = (sim: Simulation, c: Civ) => c.settlements.reduce((n, sid) => { const s = sim.w.settlements.get(sid); return n + (s ? s.bld.reduce((a, v, t) => a + (t > 0 && /POWER|HYDRO|SOLAR|WIND|FUSION/.test(String(BUILDINGS[t]?.key)) ? v : 0), 0) : 0); }, 0);
    expect(plants(B, cb)).toBeGreaterThan(plants(A, ca));
    expect(cb.econ.energyUse).toBeGreaterThan(ca.econ.energyUse);
    expect(cb.stock[Good.ENERGY] + cb.acc.prod[Good.ENERGY] + cb.econ.energyUse).toBeGreaterThan(0);
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
    const progress = (c: Civ) => ids.reduce((a, id) => a + (c.techs[id]?.progress ?? 0), 0);
    // same nation, same instant: once with its contacts, once without any
    const A = clone(base), B = clone(base);
    const ca = A.w.civs.get(target.id)!, cb = B.w.civs.get(target.id)!;
    cb.knownCivs = [];
    const pa0 = progress(ca), pb0 = progress(cb);
    researchYearly(A, ca);
    researchYearly(B, cb);
    expect(progress(ca) - pa0).toBeGreaterThan(0); // contacts → diffusion progress
    expect(progress(cb) - pb0).toBe(0); // no contacts → none
  }, 120000);
});
