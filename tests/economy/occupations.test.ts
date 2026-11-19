/**
 * Round 7: jobs are tracked and shown. Occupations are an exact split of the sector employment the
 * economy computes, and their names follow the nation's technology.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { occupations, jobGroupShares, JOBS, JOB_GROUPS } from '../../src/economy/occupations';
import { B } from '../../src/civilizations/buildingTypes';
import type { Civ, Settlement } from '../../src/sim/types';

describe('occupations add up', () => {
  it('in every settlement of a grown world, each sector splits into named jobs that sum to its workers', () => {
    const sim = makeSim('jobs-sum', 64, (c) => { c.settings.startEra = 6; });
    sim.runYears(5);
    let checked = 0;
    for (const s of sim.w.settlements.values()) {
      const civ = sim.w.civs.get(s.civId);
      const jobs = occupations(s, civ);
      for (let sec = 0; sec < 7; sec++) {
        const want = Math.round(Math.max(0, s.employment[sec]));
        const got = jobs.filter((j) => j.sector === sec).reduce((a, j) => a + j.count, 0);
        expect(got, `${s.name} sector ${sec}`).toBe(want);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(3);
  }, 60000);

  it('every job has a unique key, a label and a group', () => {
    expect(new Set(JOBS.map((j) => j.key)).size).toBe(JOBS.length);
    for (const j of JOBS) {
      expect(j.label.length).toBeGreaterThan(3);
      expect(JOB_GROUPS).toContain(j.group);
    }
  });
});

describe('jobs change as technology turns', () => {
  /** A town with fixed workers per sector and the given districts and capabilities. */
  const town = (caps: Record<string, number>, bld: [number, number][] = [], era = 6): { s: Settlement; civ: Civ } => {
    const sim = makeSim('jobs-town', 32, (c) => { c.settings.startEra = era; });
    const s = [...sim.w.settlements.values()][0];
    const civ = sim.w.civs.get(s.civId)!;
    s.employment = [1000, 300, 600, 200, 1500, 100, 50];
    s.bld = s.bld.map(() => 0);
    for (const [t, n] of bld) s.bld[t] = n;
    civ.caps = { ...civ.caps, farming: 0, farmMechanization: 0, industry: 0, automation: 0, computing: 0, ai: 0, ...caps };
    return { s, civ };
  };
  const count = (jobs: ReturnType<typeof occupations>, key: string) => jobs.find((j) => j.key === key)?.count ?? 0;

  it('before farming people forage; with farming they farm; mechanization moves farm work to machines', () => {
    let { s, civ } = town({}, [[B.FARM, 6]]);
    let jobs = occupations(s, civ);
    expect(count(jobs, 'gatherers') + count(jobs, 'hunters')).toBe(1000);
    ({ s, civ } = town({ farming: 1 }, [[B.FARM, 6]]));
    jobs = occupations(s, civ);
    expect(count(jobs, 'farmers')).toBeGreaterThan(count(jobs, 'machine_farmers'));
    ({ s, civ } = town({ farming: 1, farmMechanization: 0.9 }, [[B.FARM, 6]]));
    jobs = occupations(s, civ);
    expect(count(jobs, 'machine_farmers') + count(jobs, 'agronomists')).toBeGreaterThan(count(jobs, 'farmers'));
  });

  it('crafts give way to factories, and automation brings engineers', () => {
    const before = occupations(...Object.values(town({}, [[B.WORKSHOP, 3], [B.SMITHY, 1]])) as [Settlement, Civ]);
    expect(count(before, 'artisans') + count(before, 'smiths')).toBe(600);
    const after = occupations(...Object.values(town({ industry: 1, automation: 0.7 }, [[B.FACTORY, 4], [B.WORKSHOP, 1]])) as [Settlement, Civ]);
    expect(count(after, 'factory_workers')).toBeGreaterThan(count(after, 'artisans'));
    expect(count(after, 'automation_engineers')).toBeGreaterThan(0);
  });

  it('power plants employ power plant workers (review finding: they were listed as artisans); resource work always has a name', () => {
    const jobs = occupations(...Object.values(town({ industry: 1 }, [[B.POWER_FOSSIL, 2], [B.SOLAR, 1]])) as [Settlement, Civ]);
    expect(count(jobs, 'power_workers')).toBe(600);
    expect(count(jobs, 'artisans')).toBe(0);
    expect(jobs.filter((j) => j.sector === 1).reduce((a, j) => a + j.count, 0)).toBe(300); // no extraction districts: laborers
  });

  it('computing creates programmers, and AI creates supervisors while clerk work shrinks', () => {
    const offices: [number, number][] = [[B.OFFICE, 4], [B.BANK, 1], [B.DATA_CENTER, 2]];
    const pre = occupations(...Object.values(town({ industry: 1 }, offices)) as [Settlement, Civ]);
    const ai = occupations(...Object.values(town({ industry: 1, computing: 2, ai: 1 }, offices)) as [Settlement, Civ]);
    expect(count(pre, 'programmers')).toBe(0);
    expect(count(ai, 'programmers')).toBeGreaterThan(0);
    expect(count(ai, 'ai_supervisors')).toBeGreaterThan(0);
    expect(count(ai, 'clerks')).toBeLessThan(count(pre, 'clerks'));
  });
});

describe('job history', () => {
  it('nations record yearly job-group shares that add up to one', () => {
    const sim = makeSim('jobs-hist', 64, (c) => { c.settings.startEra = 5; });
    sim.runYears(4);
    const civ = [...sim.w.civs.values()].find((c) => c.alive)!;
    const st = sim.w.stats.civs[civ.id];
    const last = st.years.length - 1;
    const sum = JOB_GROUPS.reduce((a, g) => a + (st.data['job_' + g]?.[last] ?? 0), 0);
    expect(sum).toBeCloseTo(1, 5);
    const live = jobGroupShares(civ.settlements.map((id) => sim.w.settlements.get(id)!).filter(Boolean), civ);
    expect(Object.values(live).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  }, 60000);
});
