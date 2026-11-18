/**
 * Sports, world games and visitor accords (round 5, P4). Counterfactuals on identical clones.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import { SPORT_BY_KEY, sportsYearly } from '../../src/culture/sports';
import { visitorsYearly } from '../../src/economy/visitors';
import { declareWar, makeTreaty } from '../../src/politics/diplomacy';
import { ensureRelation } from '../../src/civilizations/knowledge';

const clone = (s: Simulation) => { s.syncRng(); return new Simulation(decodeWorld(encodeWorld(s.w))); };
const alive = (sim: Simulation) => [...sim.w.civs.values()].filter((c) => c.alive && c.settlements.length);

describe('sports', () => {
  const sim = makeSim('sport-3', 96, (c) => { c.settings.startEra = 11; });
  sim.runYears(60);

  it('leagues play sports their nation could have invented by then', () => {
    expect(sim.w.leagues.size).toBeGreaterThan(0);
    for (const lg of sim.w.leagues.values()) {
      const def = SPORT_BY_KEY[lg.sport];
      const ev = sim.w.events.find((e) => e.type === 'league_founded' && e.title.includes(lg.name))!;
      expect(ev).toBeTruthy();
      if (def.tech) expect(sim.w.civs.get(lg.civId)!.techs[def.tech]?.known).toBe(true);
      expect(lg.teams.length).toBeGreaterThanOrEqual(2);
    }
    const names = [...sim.w.leagues.values()].map((l) => l.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('world games are held every four years with a medal table', () => {
    const held = sim.w.sports!.held;
    expect(held.length).toBeGreaterThan(5);
    for (let k = 1; k < held.length; k++) expect(held[k].year - held[k - 1].year).toBe(4);
    for (const g of held) expect(Object.values(g.medals).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it('leagues and games survive a save exactly', () => {
    const B = clone(sim);
    expect(B.digest()).toBe(sim.digest());
    sim.runYears(8); B.runYears(8);
    expect(B.digest()).toBe(sim.digest());
    expect(B.w.sports!.held.length).toBe(sim.w.sports!.held.length);
  });

  it('nations at war with the host boycott the games, win nothing, and think less of the host', () => {
    const B = clone(sim);
    // put every nation at war with every other, so whoever hosts faces enemies
    const cs = alive(B);
    for (let i = 1; i < cs.length; i++) declareWar(B, cs[i], cs[0], 'conquest', [{ label: 'Test intervention', weight: 1 }]);
    for (const c of cs) c.stability = 1; // all may bid
    const before = new Map(cs.map((c) => [c.id, cs.map((o) => (o.id === c.id ? 0 : ensureRelation(B, c.id, o.id).opinion))]));
    B.w.sports!.next = B.year;
    sportsYearly(B);
    const g = B.w.sports!.held.at(-1)!;
    const enemies = cs.filter((c) => c.id !== g.hostCiv && [...B.w.wars.values()].some((w) => !w.end && ((w.attackers.includes(c.id) && w.defenders.includes(g.hostCiv)) || (w.attackers.includes(g.hostCiv) && w.defenders.includes(c.id)))));
    expect(enemies.length).toBeGreaterThan(0);
    for (const e of enemies) {
      expect(g.boycotts).toContain(e.id);
      expect(g.medals[e.id] ?? 0).toBe(0);
      const k = cs.findIndex((o) => o.id === g.hostCiv);
      expect(ensureRelation(B, e.id, g.hostCiv).opinion).toBeLessThan(before.get(e.id)![k]);
    }
  });

  it('hosting brings prestige beyond what medals give', () => {
    const A = clone(sim);
    A.w.sports!.next = A.year;
    const before = new Map(alive(A).map((c) => [c.id, c.prestige ?? 0]));
    sportsYearly(A);
    const g = A.w.sports!.held.at(-1)!;
    const host = A.w.civs.get(g.hostCiv)!;
    // yearly decay is 5%; hosting adds 0.15 on top of any medal prestige
    const gain = (host.prestige ?? 0) - before.get(host.id)! * 0.95;
    expect(gain).toBeGreaterThanOrEqual(0.15 - 1e-9);
  });

  it('ancient worlds play ancient games, not esports', () => {
    const old = makeSim('sport-2', 96, (c) => { c.settings.startEra = 3; });
    old.runYears(100);
    for (const lg of old.w.leagues.values()) expect(['wrestling', 'ballgame', 'chariot']).toContain(lg.sport);
  }, 120000);
});

describe('visitor accords', () => {
  it('bring visitor spending, and war ends them (counterfactual)', () => {
    const base = makeSim('sport-3', 96, (c) => { c.settings.startEra = 11; });
    base.runYears(10);
    const [a, b] = alive(base);
    const A = clone(base), B = clone(base);
    makeTreaty(B, B.w.civs.get(a.id)!, B.w.civs.get(b.id)!, 'visitors', 25);
    const tA = A.w.civs.get(a.id)!.treasury, tB = B.w.civs.get(a.id)!.treasury;
    visitorsYearly(A); visitorsYearly(B);
    // in A, an accord may form by chance this year but pays from next year; B's accord pays now
    expect(B.w.civs.get(a.id)!.treasury - tB).toBeGreaterThan(A.w.civs.get(a.id)!.treasury - tA);
    declareWar(B, B.w.civs.get(a.id)!, B.w.civs.get(b.id)!, 'conquest', [{ label: 'Test intervention', weight: 1 }]);
    // declaring war already cancels treaties; the accord module must also refuse to run one in wartime
    for (const t of B.w.treaties.values()) if (t.kind === 'visitors' && [t.a, t.b].includes(a.id) && [t.a, t.b].includes(b.id)) t.active = true;
    visitorsYearly(B);
    expect([...B.w.treaties.values()].some((t) => t.kind === 'visitors' && t.active && [t.a, t.b].includes(a.id) && [t.a, t.b].includes(b.id))).toBe(false);
  });
});
