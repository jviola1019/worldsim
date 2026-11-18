import { describe, expect, it } from 'vitest';
import { TECHS, TECH_BY_ID, STARTING_TECHS } from '../../src/technology/techData';
import { CAP_KEYS, isTierCap, type CapKey } from '../../src/technology/types';
import { B, BUILDING_KEYS } from '../../src/civilizations/buildingTypes';
import { median } from '../../src/core/math';

describe('tech tree data', () => {
  it('has unique ids and valid prereqs', () => {
    expect(new Set(TECHS.map((t) => t.id)).size).toBe(TECHS.length);
    for (const t of TECHS) for (const p of t.prereqs) {
      const d = TECH_BY_ID.get(p);
      expect(d, `${t.id} -> ${p}`).toBeDefined();
      expect(d!.era).toBeLessThanOrEqual(t.era);
    }
  });
  it('is acyclic and fully reachable from starting techs', () => {
    const known = new Set(STARTING_TECHS);
    let changed = true;
    while (changed) {
      changed = false;
      for (const t of TECHS) if (!known.has(t.id) && t.prereqs.every((p) => known.has(p))) { known.add(t.id); changed = true; }
    }
    expect(TECHS.filter((t) => !known.has(t.id)).map((t) => t.id)).toEqual([]);
  });
  it('covers all 15 eras with enough techs', () => {
    for (let e = 1; e <= 15; e++) expect(TECHS.filter((t) => t.era === e).length, `era ${e}`).toBeGreaterThanOrEqual(7);
    expect(TECHS.length).toBeGreaterThanOrEqual(150);
  });
  it('uses only valid capability and building keys and unlocks all buildings', () => {
    const unlocked = new Set<string>();
    for (const t of TECHS) {
      for (const k of Object.keys(t.effects)) expect(CAP_KEYS as readonly string[], `${t.id}.${k}`).toContain(k);
      for (const b of t.unlocks?.buildings ?? []) { expect(BUILDING_KEYS).toContain(b); unlocked.add(b); }
    }
    const exempt = ['NONE', 'CAMP', 'RUINS', 'CONSTRUCTION', 'CRATER'];
    expect(BUILDING_KEYS.filter((k) => !exempt.includes(k) && !unlocked.has(k))).toEqual([]);
    expect(B.CAMP).toBe(1);
  });
  it('costs rise by era; starting techs are free', () => {
    for (const id of STARTING_TECHS) expect(TECH_BY_ID.get(id)!.cost).toBe(0);
    let prev = 0;
    for (let e = 2; e <= 15; e++) {
      const m = median(TECHS.filter((t) => t.era === e).map((t) => t.cost));
      expect(m).toBeGreaterThan(prev);
      prev = m;
    }
  });
  it('follows realism rules and flags strategic weapons', () => {
    for (const t of TECHS) {
      if (t.era <= 11) expect(t.realism).toBe('historical');
      if (t.era === 15) expect(t.realism).toBe('speculative');
    }
    expect(TECH_BY_ID.get('nuclear_weapons')!.advancedWeapon).toBe(true);
    expect(TECH_BY_ID.get('ballistic_missiles')!.advancedWeapon).toBe(true);
  });
  it('introduces tier capabilities in non-decreasing era order', () => {
    for (const k of CAP_KEYS.filter((c) => isTierCap(c))) {
      const firstEra = new Map<number, number>();
      for (const t of TECHS) {
        const v = t.effects[k as CapKey];
        if (v === undefined) continue;
        firstEra.set(v, Math.min(firstEra.get(v) ?? 99, t.era));
      }
      const tiers = [...firstEra.keys()].sort((a, b) => a - b);
      for (let i = 1; i < tiers.length; i++) expect(firstEra.get(tiers[i])!, `${k} tier ${tiers[i]}`).toBeGreaterThanOrEqual(firstEra.get(tiers[i - 1])!);
    }
  });
});

describe('no single regional resource gates industrialization (regression: domestication locked 146 of 207 techs)', () => {
  it('without domesticable animals only animal-based techs stay out of reach', async () => {
    const { TECHS } = await import('../../src/technology/techData');
    const locked = new Set(['domestication']);
    let grew = true;
    while (grew) {
      grew = false;
      for (const t of TECHS) if (!locked.has(t.id) && t.prereqs.some((p) => locked.has(p))) { locked.add(t.id); grew = true; }
    }
    for (const id of ['steam_engine', 'electric_power', 'watermills', 'chemical_fertilizer', 'green_revolution']) expect(locked.has(id), id).toBe(false);
    expect(locked.size - 1).toBeLessThanOrEqual(10);
  });
});
