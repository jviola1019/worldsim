/**
 * Sprite selection rules: which sprite key the renderer should draw for a
 * building, venue, port, airport, vehicle or person, given its era, tier,
 * ethos style and a deterministic per-tile/per-agent hash.
 *
 * Pure functions with no DOM access, so they can be unit tested and used by
 * tools. Tiers are the architectural tiers of civilizations/buildingTypes.ts
 * (0 prehistoric, 1 ancient, 2 classical, 3 medieval, 4 renaissance,
 * 5 industrial, 6 modern, 7 future; eraToTier maps an era to one). Transport
 * capabilities are Civ.caps tiers (roadTier 0-4, railTier 0-4, navalTier
 * 0-7, airTier 0-3, spaceTier 0-7).
 *
 * Every key returned here exists in ALL_SPRITES (tests/rendering/sprites.test.ts
 * checks this for all inputs).
 */

/** Deterministic pick from a non-empty list. */
export function pick<T>(list: readonly T[], hash: number): T {
  const n = list.length;
  return list[((Math.floor(hash) % n) + n) % n];
}

// ───────────────────────────── housing / districts ─────────────────────────────

/** Ethos-driven housing looks. 'atomic' = retro-futurist, 'eco' = ecological. */
export type HousingStyle = 'atomic' | 'eco';
export const HOUSING_STYLES: readonly HousingStyle[] = ['atomic', 'eco'];

/** A style set only replaces the base look from this architectural tier upward (modern and later). */
export const HOUSING_STYLE_MIN_TIER: Readonly<Record<HousingStyle, number>> = { atomic: 6, eco: 6 };

/**
 * Map a civilization ethos id to a housing style (undefined = the normal era
 * look). Accepts the archetype names used in docs/ROADMAP.md (P2), in any
 * case, with '-', '_' or ' ' separators.
 */
export function housingStyleForEthos(ethos: string | null | undefined): HousingStyle | undefined {
  if (!ethos) return undefined;
  const e = ethos.toLowerCase().replace(/[\s_-]+/g, '');
  if (e === 'retrofuturist' || e === 'retrofuturism' || e === 'atomic' || e === 'atomicage') return 'atomic';
  if (e === 'ecological' || e === 'eco' || e === 'green') return 'eco';
  return undefined;
}

const BASE_RE = /^bld\.([A-Z_]+)\.(\d)$/;
const VARIANT_RE = /^bld\.([A-Z_]+)\.(\d)([b-z])$/;
const STYLE_RE = /^bld\.([A-Z_]+)\.(atomic|eco)\.(\d+)$/;

/**
 * Index of district building sprites by key, tier, variant letter and style.
 * Atlas.buildingId delegates here.
 *
 *  - bld.<KEY>.<tier>            base look for that architectural tier
 *  - bld.<KEY>.<tier><b|c|d...>  alternative looks of the same tier
 *  - bld.<KEY>.<style>.<n>       ethos style set (tier >= HOUSING_STYLE_MIN_TIER)
 */
export class BuildingSpriteIndex {
  private tiersByKey = new Map<string, number[]>();
  private variantsByKeyTier = new Map<string, string[]>();
  private styleIds = new Map<string, string[]>();

  constructor(ids: Iterable<string>) {
    for (const id of ids) {
      let m = BASE_RE.exec(id);
      if (m) {
        const arr = this.tiersByKey.get(m[1]) ?? [];
        arr.push(Number(m[2]));
        this.tiersByKey.set(m[1], arr);
        continue;
      }
      m = VARIANT_RE.exec(id);
      if (m) {
        const k = `${m[1]}.${m[2]}`;
        const arr = this.variantsByKeyTier.get(k) ?? [];
        arr.push(id);
        this.variantsByKeyTier.set(k, arr);
        continue;
      }
      m = STYLE_RE.exec(id);
      if (m) {
        const k = `${m[1]}|${m[2]}`;
        const arr = this.styleIds.get(k) ?? [];
        arr.push(id);
        this.styleIds.set(k, arr);
      }
    }
    for (const arr of this.tiersByKey.values()) arr.sort((a, b) => a - b);
    for (const arr of this.variantsByKeyTier.values()) arr.sort();
    for (const arr of this.styleIds.values()) arr.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  }

  /** Tiers that have a base sprite for this building key (sorted). */
  tiers(key: string): readonly number[] {
    return this.tiersByKey.get(key) ?? [];
  }

  /** All looks (base first, then variants) for a key at an exact sprite tier. */
  looks(key: string, spriteTier: number): string[] {
    return [`bld.${key}.${spriteTier}`, ...(this.variantsByKeyTier.get(`${key}.${spriteTier}`) ?? [])];
  }

  /** Style-set sprites for a key (empty when the style has none for it). */
  styled(key: string, style: HousingStyle): readonly string[] {
    return this.styleIds.get(`${key}|${style}`) ?? [];
  }

  /**
   * Sprite id for a building key at a tier: the nearest base tier at or below
   * (else the lowest), then a look chosen by `variantHash` (use the tile hash
   * so a tile is stable and neighbours differ). With a style, and a tier at or
   * above its minimum, the style set replaces the era look where it has
   * sprites for this key.
   */
  resolve(key: string, tier: number, variantHash = 0, style?: HousingStyle): string | undefined {
    if (style && tier >= HOUSING_STYLE_MIN_TIER[style]) {
      const styled = this.styled(key, style);
      if (styled.length) return pick(styled, variantHash);
    }
    const tiers = this.tiersByKey.get(key);
    if (!tiers || !tiers.length) return undefined;
    let best = tiers[0];
    for (const t of tiers) if (t <= tier) best = t;
    return pick(this.looks(key, best), variantHash);
  }
}

// ───────────────────────────── sports venues ─────────────────────────────

export type Sport =
  | 'ballgame'
  | 'arena'
  | 'chariot'
  | 'joust'
  | 'football'
  | 'basketball'
  | 'baseball'
  | 'hockey'
  | 'athletics'
  | 'grav';

export interface VenueSprite {
  id: string;
  sport: Sport;
  /** Earliest architectural tier at which the venue looks right. */
  minTier: number;
  /** Athlete sprite for people at this venue. */
  athlete: string;
}

/** Sports venues in era order. All 2x2 footprints (fw = fh = 2). */
export const SPORTS_VENUES: readonly VenueSprite[] = [
  { id: 'bld.sport.ball_court', sport: 'ballgame', minTier: 1, athlete: 'char.athlete_runner' },
  { id: 'bld.sport.amphitheatre', sport: 'arena', minTier: 2, athlete: 'char.soldier_spear' },
  { id: 'bld.sport.hippodrome', sport: 'chariot', minTier: 2, athlete: 'veh.horse_rider' },
  { id: 'bld.sport.tourney', sport: 'joust', minTier: 3, athlete: 'unit.cavalry.4' },
  { id: 'bld.sport.stadium_football', sport: 'football', minTier: 5, athlete: 'char.athlete_football' },
  { id: 'bld.sport.ballpark', sport: 'baseball', minTier: 5, athlete: 'char.athlete_baseball' },
  { id: 'bld.sport.arena_basketball', sport: 'basketball', minTier: 6, athlete: 'char.athlete_basketball' },
  { id: 'bld.sport.ice_rink', sport: 'hockey', minTier: 6, athlete: 'char.athlete_hockey' },
  { id: 'bld.sport.games_stadium', sport: 'athletics', minTier: 6, athlete: 'char.athlete_runner' },
  { id: 'bld.sport.grav_dome', sport: 'grav', minTier: 7, athlete: 'char.athlete_grav' },
];

/** Venue sprite for a sport (the sport's own venue, whatever the tier). */
export function sportsVenueSprite(sport: Sport): string {
  return (SPORTS_VENUES.find((v) => v.sport === sport) ?? SPORTS_VENUES[0]).id;
}

/** A venue that suits an architectural tier, varied by hash among the newest generation available. */
export function eraVenueSprite(tier: number, hash = 0): string {
  const ok = SPORTS_VENUES.filter((v) => v.minTier <= tier);
  if (!ok.length) return SPORTS_VENUES[0].id;
  const newest = Math.max(...ok.map((v) => v.minTier));
  return pick(ok.filter((v) => v.minTier === newest), hash).id;
}

/** Athlete sprite for a sport. */
export function athleteSprite(sport: Sport): string {
  return (SPORTS_VENUES.find((v) => v.sport === sport) ?? SPORTS_VENUES[0]).athlete;
}

// ───────────────────────────── ports and airports ─────────────────────────────

/** Port by architectural tier: jetty, sailing harbour, steam port, container port; sea launch with spaceflight. */
export function portSprite(tier: number, spaceTier = 0): string {
  if (tier >= 7 && spaceTier >= 1) return 'bld.port.sea_launch';
  if (tier >= 6) return 'bld.port.container';
  if (tier >= 5) return 'bld.port.steam';
  if (tier >= 3) return 'bld.port.sail_harbour';
  return 'bld.port.jetty';
}

/**
 * Airport by air capability and architectural tier: airfield (airTier 1),
 * regional (2), international (3); vertiport or spaceplane port in the future
 * tier (spaceplane port once spaceTier >= 4). Returns undefined without flight.
 */
export function airportSprite(airTier: number, tier: number, spaceTier = 0, hash = 0): string | undefined {
  if (airTier <= 0) return undefined;
  if (tier >= 7) return spaceTier >= 4 ? pick(['bld.air.spaceplane', 'bld.air.vertiport'], hash) : 'bld.air.vertiport';
  if (airTier >= 3) return 'bld.air.international';
  if (airTier >= 2) return 'bld.air.regional';
  return 'bld.air.airfield';
}

// ───────────────────────────── transport ─────────────────────────────

export interface TransportCaps {
  roadTier: number;
  railTier: number;
  navalTier: number;
  airTier: number;
  spaceTier: number;
}

export type TransportMode = 'road' | 'rail' | 'water' | 'air';

const ROAD_BY_TIER: readonly (readonly string[])[] = [
  ['char.walker_porter'],
  ['veh.cart', 'char.walker_porter'],
  ['veh.cart', 'veh.horse_rider', 'char.walker_porter'],
  ['veh.wagon', 'veh.horse_rider', 'veh.cart'],
  ['veh.carriage', 'veh.buggy', 'veh.horse_rider', 'veh.wagon'],
  ['veh.buggy', 'veh.carriage', 'veh.bicycle', 'veh.car_early', 'veh.lorry', 'veh.tram'],
  ['veh.car_modern', 'veh.car', 'veh.bus_modern', 'veh.semi_truck', 'veh.bicycle', 'veh.truck', 'veh.bus'],
  ['veh.flying_car', 'veh.hovercar', 'veh.hoverboard', 'veh.bus_modern', 'veh.car_modern'],
];
const ROAD_ATOMIC: readonly string[] = ['veh.car_atomic', 'veh.car_atomic', 'veh.bus', 'veh.truck', 'veh.flying_car'];

const RAIL_BY_TIER: readonly (readonly string[])[] = [
  [],
  ['veh.train_steam'],
  ['veh.train_electric', 'veh.tram', 'veh.train_diesel'],
  ['veh.train_hsr', 'veh.train_diesel', 'veh.tram'],
  ['veh.maglev', 'veh.train_hsr'],
];

const WATER_BY_TIER: readonly (readonly string[])[] = [
  ['veh.raft'],
  ['veh.raft', 'veh.canoe'],
  ['veh.galley', 'veh.longship'],
  ['veh.cog', 'veh.caravel'],
  ['veh.galleon', 'veh.caravel', 'veh.clipper'],
  ['veh.steamship', 'veh.paddle_steamer', 'veh.clipper'],
  ['veh.container_ship', 'veh.cargo', 'veh.tanker'],
  ['veh.hover_ferry', 'veh.container_ship'],
];

/**
 * Civilian vehicle for a mode. Road traffic follows the architectural tier
 * (an atomic-style civ drives finned cruisers from tier 6); rail follows
 * railTier, water navalTier (tier 7 adds hover-ferries), air airTier with
 * personal flyers in tier 7. Returns undefined when the mode is unavailable.
 */
export function vehicleSprite(mode: TransportMode, caps: TransportCaps, tier: number, hash = 0, style?: HousingStyle): string | undefined {
  const t = Math.max(0, Math.min(7, Math.floor(tier)));
  switch (mode) {
    case 'road':
      if (style === 'atomic' && t >= 6) return pick(ROAD_ATOMIC, hash);
      return pick(ROAD_BY_TIER[t], hash);
    case 'rail': {
      const r = Math.max(0, Math.min(4, caps.railTier));
      return r ? pick(RAIL_BY_TIER[r], hash) : undefined;
    }
    case 'water': {
      const n = t >= 7 ? 7 : Math.max(0, Math.min(6, caps.navalTier));
      return pick(WATER_BY_TIER[n], hash);
    }
    case 'air':
      if (t >= 7) return pick(caps.spaceTier >= 4 ? ['veh.air_taxi', 'veh.jumbo', 'veh.spaceplane'] : ['veh.air_taxi', 'veh.jumbo'], hash);
      if (caps.airTier >= 3) return pick(['veh.jumbo', 'veh.airliner', 'veh.helicopter'], hash);
      if (caps.airTier >= 2) return pick(['veh.prop_airliner', 'veh.prop_airliner', 'veh.helicopter'], hash);
      if (caps.airTier >= 1) return 'veh.biplane';
      return undefined;
  }
}

// ───────────────────────────── people ─────────────────────────────

/** Soldier on foot by military land tier (0-12, as unit.soldier.<n>). */
export function soldierSprite(landTier: number): string {
  if (landTier >= 11) return 'char.soldier_power_armour';
  if (landTier >= 9) return 'char.soldier_modern';
  if (landTier >= 7) return 'char.soldier_rifle';
  if (landTier >= 5) return 'char.soldier_musket';
  return 'char.soldier_spear';
}

export type Job =
  | 'farmer'
  | 'miner'
  | 'smith'
  | 'merchant'
  | 'scholar'
  | 'priest'
  | 'sailor'
  | 'pilot'
  | 'astronaut'
  | 'robot'
  | 'walker';

/**
 * Person sprite for a job at an architectural tier. Scholars become
 * scientists from tier 5; walkers are porters (tiers 0-4), commuters (5-6)
 * or future citizens (7); pilots need tier 5+ and astronauts tier 6+ (earlier
 * tiers fall back to a sailor and a scholar). In tier 7 a share of farmers,
 * miners and smiths are robots (by hash).
 */
export function characterSprite(job: Job, tier: number, hash = 0): string {
  const robotShare = tier >= 7 && pick([true, false, false], hash);
  switch (job) {
    case 'farmer':
      return robotShare ? 'char.robot_worker' : 'char.farmer';
    case 'miner':
      return robotShare ? 'char.robot_worker' : 'char.miner';
    case 'smith':
      return robotShare ? 'char.robot_worker' : 'char.smith';
    case 'merchant':
      return tier >= 6 ? 'char.walker_commuter' : 'char.merchant';
    case 'scholar':
      return tier >= 5 ? 'char.scientist' : 'char.scholar';
    case 'priest':
      return 'char.priest';
    case 'sailor':
      return 'char.sailor';
    case 'pilot':
      return tier >= 5 ? 'char.pilot' : 'char.sailor';
    case 'astronaut':
      return tier >= 6 ? 'char.astronaut' : 'char.scholar';
    case 'robot':
      return 'char.robot_worker';
    case 'walker':
      return tier >= 7 ? 'char.walker_future' : tier >= 5 ? 'char.walker_commuter' : 'char.walker_porter';
  }
}
