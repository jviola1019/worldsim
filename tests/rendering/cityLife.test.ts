/**
 * Round 7: streets and parks at real-world rates, homes in many forms past huts and caves,
 * traffic from demand over street capacity, and highways on simulated roads.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { composeBlock, blockContext, isDetailTile, streetShare, dwellingMix, homeForms, DWELLING_FORMS, type BlockContext } from '../../src/rendering/cityBlocks';
import { STREET_SHARE, PARK_SHARE, streetBand, trafficOf, trafficLevel } from '../../src/economy/traffic';
import { B } from '../../src/civilizations/buildingTypes';
import { eraToTier } from '../../src/civilizations/buildingTypes';
import type { Settlement, Civ } from '../../src/sim/types';

const ctx = (o: Partial<BlockContext> = {}): BlockContext => ({ b: B.HOUSE, tier: 6, band: 'city', nb: Array(8).fill('built'), road: 0, h: 12345, ...o });

describe('streets at real-world shares', () => {
  it('a block between built neighbours gives the street share of its era (within 5 points)', () => {
    for (const tier of [1, 3, 5, 6, 7]) {
      const got = streetShare(composeBlock(ctx({ tier })));
      expect(Math.abs(got - STREET_SHARE[streetBand(tier)]), `tier ${tier}: ${got.toFixed(3)}`).toBeLessThanOrEqual(0.05);
    }
  });

  it('a district on a paved road gets a wider arterial with lanes; on a highway, a divided road with a median', () => {
    const plain = composeBlock(ctx({ tier: 6 })).streets[0];
    const paved = composeBlock(ctx({ tier: 6, road: 3 })).streets[0];
    const hwy = composeBlock(ctx({ tier: 6, road: 4 })).streets[0];
    expect(paved.w).toBeGreaterThan(plain.w);
    expect(paved.lanes).toBe(2);
    expect(hwy.lanes).toBe(4);
  });
});

describe('parks at real-world shares', () => {
  it("a grown modern city's green space (park districts and pocket parks) lands near its era's park share", () => {
    const sim = makeSim('life-parks', 96, (c) => { c.settings.startEra = 10; });
    sim.runYears(40);
    const m = sim.w.map;
    const s = [...sim.w.settlements.values()].sort((a, b) => b.pop - a.pop)[0];
    const civ = sim.w.civs.get(s.civId)!;
    let green = 0, all = 0, districts = 0;
    for (let i = 0; i < m.n; i++) {
      if (m.settle[i] !== s.id || !isDetailTile(m, i)) continue;
      const c = blockContext(sim, i)!;
      all += 1;
      if (c.b === B.PARK) { green += 1; districts += 1; continue; }
      const plan = composeBlock(c);
      for (const l of plan.lots) if (l.kind === 'park') green += (l.w * l.h) / (32 * 32);
    }
    expect(all).toBeGreaterThan(8);
    const target = PARK_SHARE[streetBand(eraToTier(civ.era))];
    // pocket parks fill the gap up to the era's share; simulated park districts are never taken away
    const want = Math.max(target, districts / all);
    expect(Math.abs(green / all - want), `green ${(green / all).toFixed(3)} vs ${want.toFixed(3)} (parks ${districts}/${all})`).toBeLessThanOrEqual(0.04);
  }, 180000);
});

describe('homes past huts and caves', () => {
  const forms = (o: Partial<BlockContext>, n = 200) => {
    const seen = new Map<string, number>();
    for (let h = 0; h < n; h++) for (const l of composeBlock(ctx({ ...o, h: h * 7919 + 3 })).lots) if (l.form) seen.set(l.form, (seen.get(l.form) ?? 0) + 1);
    return seen;
  };

  it('each era past the first shows several forms of home, and huts only in the earliest', () => {
    for (const tier of [2, 4, 6, 7]) {
      const f = forms({ tier });
      expect(f.size, `tier ${tier}: ${[...f.keys()]}`).toBeGreaterThanOrEqual(3);
      expect(f.has('hut')).toBe(false);
    }
    expect([...forms({ tier: 1 }).keys()]).toEqual(['hut']);
  });

  it('villas, manors and mansions take double plots, and are commoner in rich, unequal nations', () => {
    const equal = forms({ tier: 6, wealth: 0, ineq: 0 }), unequal = forms({ tier: 6, wealth: 3, ineq: 4 });
    expect(unequal.get('mansion') ?? 0).toBeGreaterThan(equal.get('mansion') ?? 0);
    const plan = [...Array(200).keys()].map((h) => composeBlock(ctx({ tier: 6, wealth: 3, ineq: 4, h: h * 31 }))).find((p) => p.lots.some((l) => l.form === 'mansion'))!;
    const mansion = plan.lots.find((l) => l.form === 'mansion')!;
    const detached = plan.lots.find((l) => l.form === 'detached' || l.form === 'duplex');
    if (detached) expect(mansion.w).toBeGreaterThan(detached.w);
  });

  it('dense districts show dense forms: apartments as mid-rise flats, towers as high-rises', () => {
    expect(Object.keys(dwellingMix(B.APARTMENT, 6))).toContain('midrise');
    expect(Object.keys(dwellingMix(B.TOWER, 6))).toContain('highrise');
    expect(Object.keys(dwellingMix(B.ARCOLOGY, 7))).toContain('terraced_tower');
    for (const f of Object.keys(dwellingMix(B.HOUSE, 3))) expect(DWELLING_FORMS).toContain(f);
  });

  it("a settlement's home mix adds up to one", () => {
    const bld = new Array(80).fill(0);
    bld[B.HOUSE] = 5; bld[B.APARTMENT] = 2; bld[B.TOWER] = 1;
    const mix = homeForms(bld, 6, 1, 2);
    expect(mix.reduce((a, m) => a + m.share, 0)).toBeCloseTo(1, 9);
    expect(mix.length).toBeGreaterThan(3);
  });
});

describe('traffic from demand over street capacity', () => {
  const town = (pop: number, districts: number, era: number): [Settlement, Civ] => {
    const bld = new Array(80).fill(0);
    bld[B.APARTMENT] = districts;
    return [{ pop, bld } as unknown as Settlement, { era } as unknown as Civ];
  };
  it('more people mean more load; more districts and better roads mean less', () => {
    const a = trafficOf(...town(100000, 10, 10)), b = trafficOf(...town(200000, 10, 10)), c = trafficOf(...town(200000, 20, 10));
    expect(b.load).toBeGreaterThan(a.load);
    expect(c.load).toBeLessThan(b.load);
    expect(trafficOf(...town(200000, 10, 10), 0.4).load).toBeLessThan(b.load);
  });
  it('before carts there is foot traffic only; levels follow the load', () => {
    expect(trafficOf(...town(5000, 3, 1)).level).toBe('on foot');
    expect(trafficLevel(0.3, 3)).toBe('free-flowing');
    expect(trafficLevel(0.7, 3)).toBe('busy');
    expect(trafficLevel(1.0, 3)).toBe('congested');
    expect(trafficLevel(1.5, 3)).toBe('gridlocked');
  });
  it('modern cars outnumber future pods per person (shared autonomous vehicles)', () => {
    expect(trafficOf(...town(100000, 10, 10)).tripsPerDay).toBeGreaterThan(trafficOf(...town(100000, 10, 13)).tripsPerDay);
  });
});
