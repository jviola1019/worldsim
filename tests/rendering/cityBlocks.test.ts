/**
 * Round 6: close-up city blocks. The composer is pure: one tile's real data in, a 32×32 draw plan out.
 */
import { describe, it, expect } from 'vitest';
import {
  sizeBand, amenityShare, composeBlock, blockContext, isDetailTile, AMENITIES_BY_TIER, tierBand,
  type BlockContext, type Lot, type NeighbourKind, AMENITY_KINDS,
} from '../../src/rendering/cityBlocks';
import { B } from '../../src/civilizations/buildingTypes';
import { BLDF, TileMap } from '../../src/world/tilemap';
import { makeSim } from '../helpers';

const ALL_BUILT: NeighbourKind[] = ['built', 'built', 'built', 'built', 'built', 'built', 'built', 'built'];
const ctx = (o: Partial<BlockContext> = {}): BlockContext => ({ b: B.HOUSE, tier: 6, band: 'city', nb: [...ALL_BUILT], road: 0, h: 12345, ...o });
type Rect = { x: number; y: number; w: number; h: number };
const overlap = (a: Rect, b: Rect, gap = 0) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
const RESIDENTIAL = [B.HUT, B.HOUSE, B.TOWNHOUSE, B.TENEMENT, B.APARTMENT, B.SUBURB, B.TOWER, B.ARCOLOGY];

describe('size bands and amenity shares', () => {
  it('bands settlements by population', () => {
    expect(sizeBand(1999)).toBe('village');
    expect(sizeBand(2000)).toBe('town');
    expect(sizeBand(199999)).toBe('city');
    expect(sizeBand(2e5)).toBe('metropolis');
  });
  it('amenity share rises with size', () => {
    expect(amenityShare('village')).toBe(0.05);
    expect(amenityShare('town')).toBe(0.12);
    expect(amenityShare('city')).toBe(0.2);
    expect(amenityShare('metropolis')).toBe(0.3);
  });
});

describe('composeBlock', () => {
  it('is deterministic, and the hash changes the lots but not the streets', () => {
    expect(composeBlock(ctx())).toEqual(composeBlock(ctx()));
    const a = composeBlock(ctx({ h: 1 })), b = composeBlock(ctx({ h: 987654 }));
    expect(a.streets).toEqual(b.streets);
    expect(JSON.stringify(a.lots)).not.toBe(JSON.stringify(b.lots));
  });

  it('leaves open ground between buildings, inside the block, for every residential district and era', () => {
    for (const b of RESIDENTIAL)
      for (let tier = 0; tier <= 7; tier++)
        for (const h of [1, 77, 4242, 99999]) {
          const plan = composeBlock(ctx({ b, tier, h }));
          expect(plan.lots.length, `${b}/${tier}`).toBeGreaterThan(0);
          for (const l of plan.lots) {
            expect(l.x).toBeGreaterThanOrEqual(0);
            expect(l.y).toBeGreaterThanOrEqual(0);
            expect(l.x + l.w).toBeLessThanOrEqual(32);
            expect(l.y + l.h).toBeLessThanOrEqual(32);
            for (const s of plan.streets) expect(overlap(l, s), `lot in street ${b}/${tier}`).toBe(false);
          }
          for (let i = 0; i < plan.lots.length; i++)
            for (let j = i + 1; j < plan.lots.length; j++) {
              const p = plan.lots[i], q = plan.lots[j];
              const shared = p.kind === 'rowhouse' && q.kind === 'rowhouse';
              expect(overlap(p, q, shared ? 0 : 1), `${b}/${tier} lots ${i},${j} too close`).toBe(false);
            }
        }
  });

  it('puts a street on edges facing other blocks, a fence or hedge on open land, and a quay on water', () => {
    const e = (nb0: NeighbourKind) => composeBlock(ctx({ nb: [nb0, 'built', 'built', 'built', 'built', 'built', 'built', 'built'] }));
    const eastStreet = (p: ReturnType<typeof composeBlock>) => p.streets.some((s) => s.x + s.w === 32 && s.h >= 20);
    expect(eastStreet(e('built'))).toBe(true);
    const open = e('open');
    expect(eastStreet(open)).toBe(false);
    expect(open.edges.some((g) => g.side === 0 && (g.kind === 'fence' || g.kind === 'hedge'))).toBe(true);
    expect(e('water').edges.some((g) => g.side === 0 && g.kind === 'quay')).toBe(true);
  });

  it('streets follow the era: dirt lanes, then cobbles, then paved roads with sidewalks', () => {
    const w = (tier: number) => composeBlock(ctx({ tier })).streets.filter((s) => s.x + s.w === 32)[0];
    expect(w(1)).toMatchObject({ w: 3, surface: 'dirt', sidewalk: false });
    expect(w(3)).toMatchObject({ w: 4, surface: 'cobble', sidewalk: false });
    expect(w(6)).toMatchObject({ w: 6, surface: 'paved', sidewalk: true });
  });

  it('keeps cars and garages out of early eras, huts out of later ones, and amenities in their own era', () => {
    for (let tier = 0; tier <= 7; tier++)
      for (let h = 0; h < 200; h++)
        for (const b of [B.HOUSE, B.TOWNHOUSE, B.MARKET, B.APARTMENT]) {
          const plan = composeBlock(ctx({ b, tier, h, band: 'metropolis' }));
          for (const l of plan.lots) {
            if (tier <= 4) expect(l.sprite).not.toMatch(/car|garage/);
            if (tier >= 5 && b === B.HOUSE) expect(l.kind).not.toBe('hut');
            if ((AMENITY_KINDS as readonly string[]).includes(l.kind)) expect(AMENITIES_BY_TIER[tierBand(tier)]).toContain(l.kind);
          }
        }
  });

  const amenityFraction = (o: Partial<BlockContext>) => {
    let am = 0, all = 0;
    for (let h = 0; h < 400; h++) for (const l of composeBlock(ctx({ ...o, h: h * 7919 + 13 })).lots) {
      all++;
      if ((AMENITY_KINDS as readonly string[]).includes(l.kind)) am++;
    }
    return am / all;
  };
  it('bigger settlements have more shops, gyms and cafés among their homes', () => {
    const v = amenityFraction({ band: 'village' }), t = amenityFraction({ band: 'town' }), m = amenityFraction({ band: 'metropolis' });
    expect(m).toBeGreaterThan(t);
    expect(t).toBeGreaterThan(v);
  });

  it("a nation's values shift the mix: merchants get shops, egalitarians clinics and schools", () => {
    const count = (ethos: BlockContext['ethos'], kinds: string[]) => {
      let n = 0;
      for (let h = 0; h < 400; h++) for (const l of composeBlock(ctx({ ethos, band: 'metropolis', h: h * 104729 + 7 })).lots) if (kinds.includes(l.kind)) n++;
      return n;
    };
    expect(count('mercantile', ['shop', 'grocery', 'cafe'])).toBeGreaterThan(count('egalitarian', ['shop', 'grocery', 'cafe']));
    expect(count('egalitarian', ['clinic', 'school'])).toBeGreaterThan(count('mercantile', ['clinic', 'school']));
  });

  it('early towns are organic (plot shapes vary from block to block), industrial and later towns follow a grid', () => {
    const rects = (tier: number, h: number) => composeBlock(ctx({ tier, h, band: 'village' })).lots.map((l) => [l.x, l.y, l.w, l.h].join(',')).join('|');
    const organic = new Set<string>(), grid = new Set<string>();
    for (let h = 0; h < 40; h++) { organic.add(rects(2, h * 7919)); grid.add(rects(6, h * 7919)); }
    expect(organic.size).toBeGreaterThan(5);
    expect(grid.size).toBe(1);
    for (let h = 0; h < 50; h++) for (const l of composeBlock(ctx({ tier: 6, h })).lots) {
      expect(l.x % 2).toBe(0);
      expect(l.y % 2).toBe(0);
    }
  });
});

describe('which tiles get close-up detail', () => {
  const tile = (b: number, settle = 1, flags = 0) => {
    const m = new TileMap(4, 4);
    m.bld[5] = b;
    m.settle[5] = settle;
    m.bldFlags[5] = flags;
    return m;
  };
  it('city districts do; farms, mines, ruins, building sites, craters and tiles outside settlements do not', () => {
    for (const b of [B.HOUSE, B.APARTMENT, B.MARKET, B.TEMPLE, B.SCHOOL, B.FACTORY, B.POWER_FOSSIL, B.PARK]) expect(isDetailTile(tile(b), 5), String(b)).toBe(true);
    for (const b of [B.FARM, B.MINE, B.RUINS, B.CONSTRUCTION, B.CRATER, B.NONE]) expect(isDetailTile(tile(b), 5), String(b)).toBe(false);
    expect(isDetailTile(tile(B.HOUSE, 0), 5)).toBe(false);
  });
  it('the non-anchor tiles of multi-tile buildings are not composed separately', () => {
    expect(isDetailTile(tile(B.STATION, 1, BLDF.PART), 5)).toBe(false);
  });
  it('blockContext treats the map edge as open land and returns null for non-detail tiles', () => {
    const sim = makeSim('cityblocks', 32, (c) => { c.settings.startEra = 6; });
    const m = sim.w.map;
    const i = m.idx(0, 10);
    m.bld[i] = B.HOUSE;
    m.settle[i] = 1;
    m.bldFlags[i] = 5;
    const c = blockContext(sim, i)!;
    expect(c).toBeTruthy();
    expect(c.nb[4]).toBe('open'); // west of column 0
    m.bld[i] = B.RUINS;
    expect(blockContext(sim, i)).toBeNull();
  });
});
