/**
 * Round 5, P2: what societies value (ethos), the missions they pursue, how much they differ, and
 * where they settle. Counterfactuals on identical clones where behaviour is claimed.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import { ethosYearly, ethosAdoptionMult, ethosResearchMult, ETHOS } from '../../src/civilizations/ethos';
import { missionsYearly, assignMission, startMission, missionMetric } from '../../src/civilizations/missions';
import { B } from '../../src/civilizations/buildingTypes';
import { planConstruction } from '../../src/civilizations/urban';
import type { Civ } from '../../src/sim/types';

const clone = (s: Simulation) => { s.syncRng(); return new Simulation(decodeWorld(encodeWorld(s.w))); };
const big = (sim: Simulation): Civ => [...sim.w.civs.values()].filter((c) => c.alive && c.settlements.length).sort((a, b) => b.population - a.population)[0];

describe('ethos', () => {
  it('follows measured institutions: a priest-led state turns theocratic, an expert-led one technocratic', () => {
    const base = makeSim('eth-inst', 64, (c) => { c.settings.startEra = 8; });
    const A = clone(base), B2 = clone(base);
    const a = big(A), b = B2.w.civs.get(a.id)!;
    // both start with a long-established mercantile identity: the measured conditions must overturn it
    a.ethos = { key: 'mercantile', since: -100, strength: 0.5 };
    b.ethos = { key: 'mercantile', since: -100, strength: 0.5 };
    for (let k = 0; k < 40; k++) {
      Object.assign(a.inst, { religiousAuthority: 1, techGovernance: 0, liberties: 0.2 }); a.personality.piety = 1; a.personality.science = 0; a.personality.trade = 0;
      Object.assign(b.inst, { religiousAuthority: 0, techGovernance: 1 }); b.personality.science = 1; b.personality.piety = 0; b.personality.trade = 0;
      ethosYearly(A, a); ethosYearly(B2, b);
      (A as any).w.tick += 120; (B2 as any).w.tick += 120; // let the hysteresis clock run
    }
    expect(a.ethos?.key).toBe('theocratic');
    expect(b.ethos?.key).toBe('technocratic');
  });

  it('the atomic-age ethos needs the atom, speeds nuclear adoption and slows the digital and green transition', () => {
    const sim = makeSim('eth-atomic', 64, (c) => { c.settings.startEra = 8; });
    const civ = big(sim);
    civ.ethos = { key: 'atomic', since: 0, strength: 1 };
    expect(ethosAdoptionMult(civ, 'nuclear_power')).toBeGreaterThan(1.3);
    expect(ethosAdoptionMult(civ, 'internet')).toBeLessThan(0.7);
    expect(ethosResearchMult(civ, 'computing')).toBeLessThan(1);
    // a centralized, militarized, scientific state turns atomic only once it has the atom
    const prime = (c: Civ) => { Object.assign(c.inst, { centralization: 1, militaryInfluence: 1, religiousAuthority: 0.3 }); c.personality.science = 1; c.ethos = undefined; };
    for (const k of ['nuclear_power', 'nuclear_weapons']) delete civ.techs[k];
    prime(civ);
    ethosYearly(sim, civ);
    expect((civ as Civ).ethos?.key).not.toBe('atomic');
    civ.techs['nuclear_power'] = { known: true, progress: 1, adoption: 1, year: 0 };
    prime(civ);
    ethosYearly(sim, civ);
    expect((civ as Civ).ethos?.key).toBe('atomic');
  });

  it('a theocratic society builds more temples than its identical twin (counterfactual)', () => {
    const base = makeSim('eth-temple', 96, (c) => { c.settings.startEra = 5; });
    base.runYears(2);
    const A = clone(base), Bw = clone(base);
    expect(Bw.digest()).toBe(A.digest());
    const id = big(base).id;
    const temples = (sim: Simulation) => sim.w.civs.get(id)!.settlements.reduce((n, sid) => n + (sim.w.settlements.get(sid)?.bld[B.TEMPLE] ?? 0), 0);
    for (let y = 0; y < 40; y++) {
      A.w.civs.get(id)!.ethos = { key: 'mercantile', since: 0, strength: 1 };
      Bw.w.civs.get(id)!.ethos = { key: 'theocratic', since: 0, strength: 1 };
      A.runYears(1); Bw.runYears(1);
    }
    expect(temples(Bw)).toBeGreaterThan(temples(A));
  }, 120000);

  it('values reshape construction priorities directly (one planning pass, identical towns)', () => {
    const base = makeSim('eth-plan', 96, (c) => { c.settings.startEra = 5; });
    base.runYears(3);
    const id = big(base).id;
    let templesA = 0, templesB = 0;
    for (const sid of base.w.civs.get(id)!.settlements) {
      const A = clone(base), Bw = clone(base);
      const a = A.w.civs.get(id)!, b = Bw.w.civs.get(id)!;
      a.ethos = { key: 'mercantile', since: 0, strength: 1 };
      b.ethos = { key: 'theocratic', since: 0, strength: 1 };
      const sa = A.w.settlements.get(sid)!, sb = Bw.w.settlements.get(sid)!;
      sa.construction = null; sb.construction = null; sa.planRetryTick = 0; sb.planRetryTick = 0;
      planConstruction(A, sa, a); planConstruction(Bw, sb, b);
      if ((sa.construction as { type: number } | null)?.type === B.TEMPLE) templesA++;
      if ((sb.construction as { type: number } | null)?.type === B.TEMPLE) templesB++;
    }
    expect(templesB).toBeGreaterThan(templesA);
  });

  it('every ethos is defined with a name, blurb and at least one effect', () => {
    for (const d of Object.values(ETHOS)) {
      expect(d.name.length).toBeGreaterThan(2);
      expect(d.blurb.length).toBeGreaterThan(10);
      expect(Object.keys(d.research).length + Object.keys(d.build).length).toBeGreaterThan(0);
    }
  });
});

describe('missions', () => {
  it('start with recorded reasons, end in success when the measured target is met, and adjust legitimacy', () => {
    const sim = makeSim('mis-1', 64, (c) => { c.settings.startEra = 6; });
    const civ = big(sim);
    startMission(sim, civ, 'expansion', 'Open land beyond the frontier', false);
    const m = civ.mission!;
    expect(m.target).toBe(missionMetric(sim, civ, 'expansion') + 2);
    const before = civ.legitimacy;
    m.target = missionMetric(sim, civ, 'expansion'); // pretend the goal was met
    missionsYearly(sim, civ);
    expect(civ.mission).toBeUndefined();
    expect(civ.missionLog?.at(-1)?.ok).toBe(true);
    expect(civ.legitimacy).toBeGreaterThan(before);
    const ev = sim.w.events.filter((e) => e.type === 'mission_success').at(-1)!;
    expect(ev.causes?.[0].label).toMatch(/Measured/);
  });

  it('fail at the deadline when the target is missed', () => {
    const sim = makeSim('mis-2', 64, (c) => { c.settings.startEra = 6; });
    const civ = big(sim);
    startMission(sim, civ, 'culture', 'Peace and prosperity invite the arts', false);
    civ.mission!.until = sim.year;
    missionsYearly(sim, civ);
    expect(civ.missionLog?.at(-1)?.ok).toBe(false);
  });

  it('god mode can decree a mission; observer worlds cannot', () => {
    const god = makeSim('mis-god', 64, (c) => { c.settings.startEra = 6; });
    expect(assignMission(god, big(god), 'space')).toBe(true);
    expect(big(god).mission?.assigned).toBe(true);
    const obs = makeSim('mis-obs', 64, (c) => { c.settings.startEra = 6; c.settings.observer = true; });
    expect(assignMission(obs, big(obs), 'space')).toBe(false);
  });
});

describe('divergence and settlement', () => {
  it('developed worlds hold nations with different values and governments', () => {
    const ethos = new Set<string>(), gov = new Set<string>();
    for (const seed of ['div-a', 'div-b', 'div-c']) {
      const sim = makeSim(seed, 96, (c) => { c.settings.startEra = 8; });
      sim.runYears(100);
      for (const c of sim.w.civs.values()) if (c.alive && c.settlements.length) { if (c.ethos) ethos.add(c.ethos.key); gov.add(c.govForm); }
    }
    expect(ethos.size).toBeGreaterThanOrEqual(4);
    expect(gov.size).toBeGreaterThanOrEqual(3);
  }, 180000);

  it('most settlements stand on or beside water (rivers, lakes, coasts)', () => {
    let near = 0, total = 0;
    for (const seed of ['wat-1', 'wat-2']) {
      const sim = makeSim(seed, 96);
      sim.runYears(250);
      const m = sim.w.map;
      for (const s of sim.w.settlements.values()) {
        total++;
        let n = false;
        m.forRadius(s.x, s.y, 1.5, (i) => { if (m.hasFreshWater(i) || m.isCoastal(i) || !m.isLand(i)) n = true; });
        if (n) near++;
      }
    }
    expect(total).toBeGreaterThan(20);
    expect(near / total).toBeGreaterThan(0.87); // measured 0.905 with water-seeking settlement, 0.836 without
  }, 180000);
});
