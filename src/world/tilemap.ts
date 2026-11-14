/**
 * TileMap: the geographic state of the world in data-oriented typed arrays
 * (one array per attribute, index = y * w + x). Typed arrays keep memory
 * compact on phones (~40 bytes/tile) and serialize directly into saves.
 */
import { T, TERRAIN, isWaterTerrain } from './terrain';
import { DX8, DY8 } from '../core/math';

/** Bit layout of TileMap.infra (Uint16). */
export const INFRA = {
  ROAD_MASK: 0b111, // bits 0-2: road tier 0..4 (trail, road, paved, highway)
  RAIL_SHIFT: 3,
  RAIL_MASK: 0b111 << 3, // bits 3-5: rail tier 0..4
  GRID: 1 << 6, // electricity transmission
  BRIDGE: 1 << 7,
  CANAL: 1 << 8,
  TELECOM: 1 << 9, // telegraph/cable/fiber
  PIPELINE: 1 << 10,
} as const;

/** Bit flags of TileMap.hazard. */
export const HAZARD = {
  RADIATION: 1,
  FLOODED: 2,
  QUAKE: 4,
  VENT: 8, // active volcanic vent (eruptions originate here)
  SACRED: 16, // sacred site (religion)
  ANOMALY: 32, // technological anomaly placed by player
  BATTLEFIELD: 64,
} as const;

/** Bit flags of TileMap.bldFlags. */
export const BLDF = {
  TIER_MASK: 0b111, // architectural tier the building was built in
  PART: 1 << 3, // non-anchor tile of a multi-tile building
  HISTORIC: 1 << 4, // protected landmark (survives modernization)
  DAMAGED: 1 << 5,
  ABANDONED: 1 << 6,
} as const;

export class TileMap {
  readonly w: number;
  readonly h: number;
  readonly n: number;
  /** Elevation: < 0 water depth, > 0 land height (1 ~ 5 km). */
  elev: Float32Array;
  terrain: Uint8Array;
  /** Annual precipitation index 0..255. */
  moist: Uint8Array;
  /** Baseline annual mean temperature in deg C (before climate change). */
  temp: Int8Array;
  /** Soil fertility 0..255 (depletes with overuse, recovers when fallow). */
  fert: Uint8Array;
  /** Vegetation biomass 0..255 (forests ~200+). */
  veg: Uint8Array;
  /** River flow accumulation (0 = no river). */
  river: Uint16Array;
  /** D8 downstream direction 0..7, or -1 (sink / water). */
  flow: Int8Array;
  /** Natural deposit id (see resources.ts Deposit). */
  dep: Uint8Array;
  /** Remaining deposit amount (units of the deposit's good). */
  depAmt: Float32Array;
  /** Owning civilization id (0 = none). */
  owner: Uint16Array;
  /** Controlling settlement id (0 = none). */
  settle: Uint16Array;
  /** Infrastructure bitfield (see INFRA). */
  infra: Uint16Array;
  /** Building type id (see buildingTypes.ts B). */
  bld: Uint8Array;
  /** Building flags & tier (see BLDF). */
  bldFlags: Uint8Array;
  /** Local pollution 0..255. */
  pollution: Uint8Array;
  /** Fire intensity 0..255 (0 = not burning). */
  fire: Uint8Array;
  /** Hazard / marker flags (see HAZARD). */
  hazard: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.n = w * h;
    const n = this.n;
    this.elev = new Float32Array(n);
    this.terrain = new Uint8Array(n);
    this.moist = new Uint8Array(n);
    this.temp = new Int8Array(n);
    this.fert = new Uint8Array(n);
    this.veg = new Uint8Array(n);
    this.river = new Uint16Array(n);
    this.flow = new Int8Array(n).fill(-1);
    this.dep = new Uint8Array(n);
    this.depAmt = new Float32Array(n);
    this.owner = new Uint16Array(n);
    this.settle = new Uint16Array(n);
    this.infra = new Uint16Array(n);
    this.bld = new Uint8Array(n);
    this.bldFlags = new Uint8Array(n);
    this.pollution = new Uint8Array(n);
    this.fire = new Uint8Array(n);
    this.hazard = new Uint8Array(n);
  }

  /** Names of all typed-array fields, used by serialization. */
  static readonly FIELDS = [
    'elev', 'terrain', 'moist', 'temp', 'fert', 'veg', 'river', 'flow', 'dep', 'depAmt',
    'owner', 'settle', 'infra', 'bld', 'bldFlags', 'pollution', 'fire', 'hazard',
  ] as const;

  idx(x: number, y: number): number {
    return y * this.w + x;
  }
  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  xOf(i: number): number {
    return i % this.w;
  }
  yOf(i: number): number {
    return (i / this.w) | 0;
  }
  isWater(i: number): boolean {
    return isWaterTerrain(this.terrain[i]);
  }
  isLand(i: number): boolean {
    return !isWaterTerrain(this.terrain[i]);
  }
  isOcean(i: number): boolean {
    return this.terrain[i] <= T.SHALLOW;
  }
  isRiver(i: number): boolean {
    return this.river[i] > 0 && this.isLand(i);
  }
  roadTier(i: number): number {
    return this.infra[i] & INFRA.ROAD_MASK;
  }
  railTier(i: number): number {
    return (this.infra[i] & INFRA.RAIL_MASK) >> INFRA.RAIL_SHIFT;
  }
  setRoad(i: number, tier: number): void {
    this.infra[i] = (this.infra[i] & ~INFRA.ROAD_MASK) | (tier & 7);
  }
  setRail(i: number, tier: number): void {
    this.infra[i] = (this.infra[i] & ~INFRA.RAIL_MASK) | ((tier & 7) << INFRA.RAIL_SHIFT);
  }
  bldTier(i: number): number {
    return this.bldFlags[i] & BLDF.TIER_MASK;
  }

  /** True if any 8-neighbor is ocean/sea water. */
  isCoastal(i: number): boolean {
    const x = this.xOf(i);
    const y = this.yOf(i);
    for (let d = 0; d < 8; d++) {
      const nx = x + DX8[d];
      const ny = y + DY8[d];
      if (!this.inBounds(nx, ny)) continue;
      if (this.isOcean(ny * this.w + nx)) return true;
    }
    return false;
  }

  /** True if any 8-neighbor (or itself) is fresh water (river or lake). */
  hasFreshWater(i: number): boolean {
    if (this.river[i] > 0 || this.terrain[i] === T.LAKE) return true;
    const x = this.xOf(i);
    const y = this.yOf(i);
    for (let d = 0; d < 8; d++) {
      const nx = x + DX8[d];
      const ny = y + DY8[d];
      if (!this.inBounds(nx, ny)) continue;
      const j = ny * this.w + nx;
      if (this.terrain[j] === T.LAKE || (this.river[j] > 0 && this.isLand(j))) return true;
    }
    return false;
  }

  /** Absolute latitude in degrees for a row (map spans +-latSpan). */
  latitude(y: number, latSpan = 70): number {
    return ((y / (this.h - 1)) * 2 - 1) * latSpan;
  }

  /** Iterate tile indices within a radius (Euclidean) of (cx, cy). */
  forRadius(cx: number, cy: number, r: number, fn: (i: number, x: number, y: number, d2: number) => void): void {
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d2 <= r2) fn(y * this.w + x, x, y, d2);
      }
  }

  /** Movement cost on foot for tile i (Infinity for water). */
  landMoveCost(i: number): number {
    const def = TERRAIN[this.terrain[i]];
    let c = def.move;
    if (!Number.isFinite(c)) return c;
    const road = this.roadTier(i);
    if (road > 0) c = Math.min(c, [1, 0.7, 0.5, 0.35, 0.22][road]);
    if (this.river[i] > 0 && !(this.infra[i] & INFRA.BRIDGE) && road === 0) c += 1.2;
    return c;
  }
}
