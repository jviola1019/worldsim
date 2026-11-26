/**
 * Round-4 fixes that let modern civilizations keep building, go to space and govern themselves
 * plausibly. Each was found by instrumenting 1000-year natural runs (docs/VALIDATION.md §6b).
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { TECHS } from '../../src/technology/techData';
import { BUILDINGS } from '../../src/civilizations/buildings';
import { B } from '../../src/civilizations/buildingTypes';
import { findSite } from '../../src/civilizations/urban';
import { IDEALS } from '../../src/politics/government';
import { Deposit } from '../../src/world/resources';
import { T } from '../../src/world/terrain';

/** Techs reachable when the given ones can never be researched. */
function reachableWithout(ban: Set<string>): Set<string> {
  const ok = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of TECHS) if (!ok.has(t.id) && !ban.has(t.id) && t.prereqs.every((p) => ok.has(p))) { ok.add(t.id); changed = true; }
  }
  return ok;
}
const gatedOn = (g: string) => new Set(TECHS.filter((t) => ((t.requires?.resources ?? []) as string[]).includes(g)).map((t) => t.id));

describe('round-4 modern civilizations', () => {
  it('no production chain needs its own output to start: chip fabs need no chips, steel mills almost no steel', () => {
    expect(BUILDINGS[B.CHIP_FAB].cost.ELECTRONICS ?? 0).toBe(0);
    expect(BUILDINGS[B.STEEL_MILL].cost.METAL ?? 0).toBeLessThanOrEqual(50);
  });

  it('the digital age and spaceflight are not locked behind owning rare metals or oil (they are traded, or substituted)', () => {
    for (const g of ['RARE', 'OIL']) {
      const ok = reachableWithout(gatedOn(g));
      for (const key of ['internet', 'advanced_ai', 'rocketry', 'satellites', 'space_stations']) expect(ok.has(key), `${key} without ${g}`).toBe(true);
    }
  });

  it('every contested institution has more than one faction with a view on it (no one-faction ratchet)', () => {
    const holders = new Map<string, Set<number>>();
    for (const ideal of Object.values(IDEALS)) for (const [k, v] of Object.entries(ideal)) {
      if (!holders.has(k)) holders.set(k, new Set());
      holders.get(k)!.add(v as number);
    }
    // hereditary rule and military influence must be pulled in opposite directions
    for (const k of ['hereditary', 'militaryInfluence']) {
      const vals = [...holders.get(k)!];
      expect(Math.max(...vals) - Math.min(...vals), k).toBeGreaterThan(0.5);
    }
  });

  it('mines are dug where the ore is, even in mountains', () => {
    const sim = makeSim('m4-mine-mtn', 64, (c) => { c.settings.startEra = 8; });
    const civ = [...sim.w.civs.values()].find((c) => c.settlements.length)!;
    const s = sim.w.settlements.get(civ.capital)!;
    const m = sim.w.map;
    let target = -1;
    m.forRadius(s.x, s.y, s.radius, (i) => { if (target < 0 && m.settle[i] === s.id && !m.bld[i] && m.isLand(i)) target = i; });
    expect(target).toBeGreaterThanOrEqual(0);
    // clear other deposits so the only candidate is a mountain lode
    m.forRadius(s.x, s.y, s.radius + 1, (i) => { if (m.dep[i] && i !== target) { m.dep[i] = 0; m.depAmt[i] = 0; } });
    m.terrain[target] = T.MOUNTAIN;
    m.dep[target] = Deposit.IRON;
    m.depAmt[target] = 20000;
    expect(findSite(sim, s, BUILDINGS[B.MINE])).toBe(target);
  });

  it('a space-capable nation builds a launch site and goes to space on its own', () => {
    const sim = makeSim('m4-space', 96, (c) => { c.settings.startEra = 11; });
    sim.runYears(40);
    const launched = [...sim.w.civs.values()].some((c) => c.space.launches > 0);
    const ports = [...sim.w.settlements.values()].reduce((a, s) => a + s.bld[B.SPACEPORT], 0);
    expect(ports).toBeGreaterThan(0);
    expect(launched).toBe(true);
    expect(sim.w.events.some((e) => e.cat === 'space')).toBe(true);
  }, 180000);
  it('an atomic-age economy can make electronics: chip fabs come with transistors (Task 8d)', async () => {
    // Era-10 buildings need electronics (spaceport 300, airport, lab, nuclear plant) and era-10 households buy them,
    // but the only producer, the chip fab, was unlocked by microprocessors (era 11). In Space Race world 1 no nation
    // had a fab for 40 years, every electronics stock ran to 0, and the first spaceport waited until year ~205.
    const { configFor } = await import('../../scripts/mode-audit');
    const { createSimulation } = await import('../../src/sim/bootstrap');
    const { hasUnlocked } = await import('../../src/technology/research');
    const sim = createSimulation(configFor('space_race', 'audit-space_race-1'));
    const withTransistors = [...sim.w.civs.values()].filter((c) => c.alive && (c.techs.transistors?.adoption ?? 0) >= 0.25);
    expect(withTransistors.length).toBeGreaterThan(0);
    for (const c of withTransistors) expect(hasUnlocked(c, B.CHIP_FAB), c.name).toBe(true);
    sim.runYears(15);
    const fabs = [...sim.w.settlements.values()].reduce((a, s) => a + s.bld[B.CHIP_FAB], 0);
    expect(fabs, 'chip fabs in an era-10 world after 15 years').toBeGreaterThan(0);
  }, 180000);
});
