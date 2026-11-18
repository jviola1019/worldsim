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
  const base = makeSim('int-trade', 96, (c) => { c.settings.startEra = 4; });
  base.runYears(40);
  // the most import-dependent (route, good): share of the importer's supply that arrives by this route
  let pick: { route: number; good: number; importer: number; exporter: number; dep: number } | null = null;
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

  it('precondition: an established route the importer depends on', () => {
    expect(pick).toBeTruthy();
    expect(pick!.dep).toBeGreaterThan(0.5);
  });

  it('an embargo cuts the flow and leaves the importer scarcer (lower stock or higher price) than the control', () => {
    const p = pick!;
    const A = clone(base), B = clone(base);
    expect(B.digest()).toBe(A.digest()); // cannot pass because the worlds were already different
    makeTreaty(B, B.w.civs.get(p.importer)!, B.w.civs.get(p.exporter)!, 'embargo', 30, true);
    A.runYears(3);
    B.runYears(3);
    expect(A.w.routes.get(p.route)!.volume).toBeGreaterThan(0); // control still trades
    expect(B.w.routes.get(p.route)!.volume).toBe(0); // intervention cut it
    const ia = A.w.civs.get(p.importer)!, ib = B.w.civs.get(p.importer)!;
    const scarcer = ib.stock[p.good] < ia.stock[p.good] * 0.9 || ib.prices[p.good] > ia.prices[p.good] * 1.05;
    expect(scarcer, `${GOODS[p.good].key}: stock ${ia.stock[p.good].toFixed(0)}→${ib.stock[p.good].toFixed(0)}, price ${ia.prices[p.good].toFixed(2)}→${ib.prices[p.good].toFixed(2)}`).toBe(true);
    // recovery: lift the embargo and the route carries goods again
    for (const t of B.w.treaties.values()) if (t.kind === 'embargo' && [t.a, t.b].includes(p.importer) && [t.a, t.b].includes(p.exporter)) { t.active = false; t.end = B.year; }
    B.runYears(2);
    expect(B.w.routes.get(p.route)!.volume).toBeGreaterThan(0);
  }, 120000);
});

describe('#3 education investment raises long-run technological capability', () => {
  it('a nation that funds schooling for 40 years out-researches its identical twin', () => {
    const base = makeSim('int-edu', 96, (c) => { c.settings.startEra = 4; });
    base.runYears(10);
    const id = [...base.w.civs.values()].filter((c) => c.alive && c.settlements.length).sort((a, b) => b.population - a.population)[0].id;
    const A = clone(base), B = clone(base);
    expect(B.digest()).toBe(A.digest());
    const eduA: number[] = [], eduB: number[] = [];
    for (let y = 0; y < 40; y++) {
      const cb = B.w.civs.get(id)!;
      if (cb.alive) cb.budget.education = Math.max(cb.budget.education, 0.25); // sustained investment (≥ policy max of the control)
      A.runYears(1);
      B.runYears(1);
    }
    const ca: Civ = A.w.civs.get(id)!, cb: Civ = B.w.civs.get(id)!;
    const avgEdu = (sim: Simulation, c: Civ) => { let e = 0, p = 0; for (const sid of c.settlements) { const s = sim.w.settlements.get(sid); if (s) { e += s.education * s.pop; p += s.pop; } } return p ? e / p : 0; };
    eduA.push(avgEdu(A, ca)); eduB.push(avgEdu(B, cb));
    expect(eduB[0]).toBeGreaterThan(eduA[0]); // the investment did raise schooling
    expect(cb.techScore).toBeGreaterThan(ca.techScore); // and, decades later, capability
  }, 180000);
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
