import { describe, it, expect } from 'vitest';
import { ALL_SPRITES, SPRITE_SHEETS } from '../../src/rendering/art/index';
import { PALETTE, teamShades } from '../../src/rendering/art/palette';
import { validateSheet } from '../../src/rendering/art/types';
import { rasterizeSprite, opaquePixels } from '../../src/rendering/art/raster';
import {
  BuildingSpriteIndex,
  HOUSING_STYLES,
  HOUSING_STYLE_MIN_TIER,
  SPORTS_VENUES,
  airportSprite,
  athleteSprite,
  characterSprite,
  eraVenueSprite,
  housingStyleForEthos,
  portSprite,
  soldierSprite,
  sportsVenueSprite,
  vehicleSprite,
  type Job,
  type TransportMode,
} from '../../src/rendering/art/select';
import { BUILDING_SPRITES } from '../../src/rendering/art/buildings';
import { HOUSING_VARIANT_SPRITES } from '../../src/rendering/art/buildings_housing';
import { BUILDING_VENUE_SPRITES } from '../../src/rendering/art/buildings_venues';
import { ERA_VEHICLE_SPRITES } from '../../src/rendering/art/vehicles_era';
import { CHARACTER_SPRITES } from '../../src/rendering/art/characters';

const ids = Object.keys(ALL_SPRITES);

describe('sprite atlas registry', () => {
  it('validates against the palette (row lengths, frame heights, keys)', () => {
    expect(validateSheet(ALL_SPRITES, PALETTE)).toEqual([]);
  });

  it('has no id defined in two sheets (a later sheet would silently override)', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const [sheet, sprites] of Object.entries(SPRITE_SHEETS))
      for (const id of Object.keys(sprites)) {
        if (seen.has(id)) dupes.push(`${id} in ${seen.get(id)} and ${sheet}`);
        seen.set(id, sheet);
      }
    expect(dupes).toEqual([]);
    expect(seen.size).toBe(ids.length);
  });

  it('every registered sprite rasterizes every frame with non-empty pixels', () => {
    const empty: string[] = [];
    for (const id of ids) {
      const def = ALL_SPRITES[id];
      const img = rasterizeSprite(def);
      expect(img.width).toBe(def.w * def.frames.length);
      expect(img.height).toBe(def.h);
      for (let f = 0; f < def.frames.length; f++) if (opaquePixels(img, def, f) === 0) empty.push(`${id}[${f}]`);
    }
    expect(empty).toEqual([]);
  });

  it('team-colour slots take the civilization colour when tinted', () => {
    const team = teamShades('#2266dd');
    for (const id of ids) {
      const def = ALL_SPRITES[id];
      const usesTeam = def.frames.some((fr) => fr.some((r) => /[TUV]/.test(r)));
      if (!usesTeam) continue;
      const plain = rasterizeSprite(def);
      const tinted = rasterizeSprite(def, team);
      expect(Buffer.from(tinted.data).equals(Buffer.from(plain.data)), id).toBe(false);
    }
  });

  it('includes the new families with the expected sizes and animation frames', () => {
    const venues = Object.keys(BUILDING_VENUE_SPRITES);
    expect(venues.filter((k) => k.startsWith('bld.sport.')).length).toBeGreaterThanOrEqual(8);
    expect(venues.filter((k) => k.startsWith('bld.port.')).length).toBe(5);
    expect(venues.filter((k) => k.startsWith('bld.air.')).length).toBe(5);
    for (const [id, def] of Object.entries(BUILDING_VENUE_SPRITES)) {
      // a 2x2 venue fills its 16 px footprint; single-tile ones stay within ~one tile of width
      if (def.fw === 2) expect(def.w, id).toBe(16);
      else expect(def.w, id).toBeLessThanOrEqual(10);
    }
    for (const [id, def] of Object.entries(ERA_VEHICLE_SPRITES)) {
      expect(def.frames.length, id).toBeGreaterThanOrEqual(2);
      expect(def.frames.length, id).toBeLessThanOrEqual(4);
    }
    for (const [id, def] of Object.entries(CHARACTER_SPRITES)) {
      expect(def.frames.length, id).toBe(4);
      expect(def.w, id).toBeLessThanOrEqual(8);
      expect(def.h, id).toBe(9);
      // the walk cycle really moves: stride frames differ from the standing frames
      expect(def.frames[1].join(''), id).not.toBe(def.frames[0].join(''));
      expect(def.frames[3].join(''), id).not.toBe(def.frames[1].join(''));
    }
  });

  it('housing variants and style sets extend existing residential districts at tiers that have a base sprite', () => {
    for (const id of Object.keys(HOUSING_VARIANT_SPRITES)) {
      const m = /^bld\.([A-Z_]+)\.(?:(\d)[b-z]|(atomic|eco)\.\d+)$/.exec(id);
      expect(m, id).not.toBeNull();
      if (m![2] !== undefined) expect(BUILDING_SPRITES[`bld.${m![1]}.${m![2]}`], id).toBeDefined();
    }
  });
});

describe('building sprite index (variants and ethos styles)', () => {
  const index = new BuildingSpriteIndex(ids);
  const residential = ['HUT', 'HOUSE', 'TOWNHOUSE', 'TENEMENT', 'APARTMENT', 'SUBURB', 'TOWER', 'ARCOLOGY'];

  it('falls back to the nearest tier at or below, else the lowest', () => {
    expect(index.resolve('HOUSE', 9)).toBe('bld.HOUSE.4');
    expect(index.resolve('HOUSE', 0)).toBe('bld.HOUSE.1');
    expect(index.resolve('TOWER', 6)).toBe('bld.TOWER.6');
    expect(index.resolve('NOT_A_BUILDING', 3)).toBeUndefined();
  });

  it('keeps the original two-look behaviour where only a b variant exists (even hash = base, odd = b)', () => {
    // FARM has no variants: always the base
    for (let h = 0; h < 6; h++) expect(index.resolve('FARM', 1, h)).toBe('bld.FARM.1');
    const two = new BuildingSpriteIndex(['bld.X.1', 'bld.X.1b', 'bld.X.3']);
    for (let h = 0; h < 6; h++) expect(two.resolve('X', 2, h)).toBe(h % 2 ? 'bld.X.1b' : 'bld.X.1');
    expect(two.resolve('X', 5, 1)).toBe('bld.X.3');
  });

  it('gives every residential district and tier at least three looks, all reachable by hash', () => {
    for (const key of residential) {
      if (key === 'CAMP') continue;
      for (const t of index.tiers(key)) {
        const looks = index.looks(key, t);
        expect(looks.length, `${key}.${t}`).toBeGreaterThanOrEqual(key === 'ARCOLOGY' ? 2 : 3);
        const got = new Set<string>();
        for (let h = 0; h < 64; h++) got.add(index.resolve(key, t, h)!);
        expect([...got].sort()).toEqual([...looks].sort());
        for (const id of looks) expect(ALL_SPRITES[id], id).toBeDefined();
      }
    }
  });

  it('is deterministic per tile hash', () => {
    for (let h = 0; h < 50; h++) expect(index.resolve('APARTMENT', 6, h)).toBe(index.resolve('APARTMENT', 6, h));
  });

  it('applies ethos style sets only from the modern tier and only where the style has sprites', () => {
    for (const style of HOUSING_STYLES) {
      const min = HOUSING_STYLE_MIN_TIER[style];
      for (const key of ['HOUSE', 'TOWNHOUSE', 'APARTMENT', 'SUBURB', 'TOWER', 'ARCOLOGY']) {
        const set = index.styled(key, style);
        expect(set.length, `${key} ${style}`).toBeGreaterThan(0);
        for (let h = 0; h < 8; h++) {
          expect(set).toContain(index.resolve(key, min, h, style));
          expect(set).not.toContain(index.resolve(key, min - 1, h, style));
        }
      }
      // no style set for tenements: the era look stays
      expect(index.resolve('TENEMENT', 7, 0, style)).toBe('bld.TENEMENT.5');
    }
  });

  it('maps ethos names to housing styles', () => {
    expect(housingStyleForEthos('retro-futurist')).toBe('atomic');
    expect(housingStyleForEthos('Retro Futurism')).toBe('atomic');
    expect(housingStyleForEthos('ecological')).toBe('eco');
    expect(housingStyleForEthos('militarist')).toBeUndefined();
    expect(housingStyleForEthos(undefined)).toBeUndefined();
  });
});

describe('selection helpers return registered sprites', () => {
  const has = (id: string | undefined) => id === undefined || id in ALL_SPRITES;

  it('venues, athletes, ports and airports', () => {
    for (const v of SPORTS_VENUES) {
      expect(ALL_SPRITES[v.id], v.id).toBeDefined();
      expect(ALL_SPRITES[v.id].fw, v.id).toBe(2);
      expect(ALL_SPRITES[v.athlete], v.athlete).toBeDefined();
      expect(sportsVenueSprite(v.sport)).toBe(v.id);
      expect(has(athleteSprite(v.sport))).toBe(true);
    }
    for (let t = 0; t <= 7; t++)
      for (let h = 0; h < 6; h++) {
        expect(has(eraVenueSprite(t, h))).toBe(true);
        expect(SPORTS_VENUES.find((v) => v.id === eraVenueSprite(t, h))!.minTier).toBeLessThanOrEqual(Math.max(1, t));
        for (let s = 0; s <= 7; s++) {
          expect(has(portSprite(t, s))).toBe(true);
          for (let a = 0; a <= 3; a++) expect(has(airportSprite(a, t, s, h))).toBe(true);
        }
      }
    expect(portSprite(0)).toBe('bld.port.jetty');
    expect(portSprite(4)).toBe('bld.port.sail_harbour');
    expect(portSprite(5)).toBe('bld.port.steam');
    expect(portSprite(6)).toBe('bld.port.container');
    expect(portSprite(7, 0)).toBe('bld.port.container');
    expect(portSprite(7, 1)).toBe('bld.port.sea_launch');
    expect(airportSprite(0, 6)).toBeUndefined();
    expect(airportSprite(1, 5)).toBe('bld.air.airfield');
    expect(airportSprite(2, 6)).toBe('bld.air.regional');
    expect(airportSprite(3, 6)).toBe('bld.air.international');
    expect(airportSprite(3, 7, 0)).toBe('bld.air.vertiport');
  });

  it('vehicles for every mode, tier and capability', () => {
    const modes: TransportMode[] = ['road', 'rail', 'water', 'air'];
    for (const mode of modes)
      for (let t = 0; t <= 7; t++)
        for (let c = 0; c <= 7; c++)
          for (let h = 0; h < 8; h++) {
            const caps = { roadTier: c, railTier: c, navalTier: c, airTier: Math.min(3, c), spaceTier: c };
            expect(has(vehicleSprite(mode, caps, t, h)), `${mode} t${t} c${c}`).toBe(true);
            expect(has(vehicleSprite(mode, caps, t, h, 'atomic'))).toBe(true);
          }
    const none = { roadTier: 0, railTier: 0, navalTier: 0, airTier: 0, spaceTier: 0 };
    expect(vehicleSprite('rail', none, 5)).toBeUndefined();
    expect(vehicleSprite('air', none, 5)).toBeUndefined();
    expect(vehicleSprite('road', none, 6, 0, 'atomic')).toBe('veh.car_atomic');
  });

  it('people for every job and tier, soldiers for every land tier', () => {
    const jobs: Job[] = ['farmer', 'miner', 'smith', 'merchant', 'scholar', 'priest', 'sailor', 'pilot', 'astronaut', 'robot', 'walker'];
    for (const j of jobs) for (let t = 0; t <= 7; t++) for (let h = 0; h < 6; h++) expect(has(characterSprite(j, t, h)), `${j} ${t}`).toBe(true);
    const seen = new Set<string>();
    for (let lt = 0; lt <= 12; lt++) {
      const id = soldierSprite(lt);
      expect(has(id)).toBe(true);
      seen.add(id);
    }
    expect(seen.size).toBe(5);
    expect(soldierSprite(0)).toBe('char.soldier_spear');
    expect(soldierSprite(12)).toBe('char.soldier_power_armour');
  });
});
