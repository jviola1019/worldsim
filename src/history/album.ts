/**
 * The PHOTO ALBUM: every 50 years each nation's capital and its largest other city are recorded as
 * compact LAYOUT RECORDS (a few hundred bytes): for every column of the city from west to east, the
 * tallest building and the nearest building with their types and tiers, whether that column meets
 * the sea or a river, plus the nation's flag, era, values and population. Postcards are drawn from
 * these records alone (rendering/photos.ts), so the same save always shows the same pictures and
 * every building stands where it stood. The live postcard is a record taken now.
 */
import type { Sim } from '../sim/context';
import type { Civ, Settlement } from '../sim/types';
import { B, eraToTier } from '../civilizations/buildingTypes';
import { BLDF } from '../world/tilemap';

export interface CitySnapshot {
  year: number;
  civId: number;
  civName: string;
  sid: number;
  name: string;
  pop: number;
  era: number;
  tier: number;
  color: string;
  emblem: { shape: number; symbol: number; c2: string };
  ethos?: string;
  /** Per column (west to east), 5 bytes: back building id, back tier, front building id, front tier, water flags. Base64. */
  cols: string;
  /** Number of columns. */
  n: number;
}

const MAX_SNAPSHOTS = 600;

function b64(bytes: Uint8Array): string {
  let s = '';
  for (const v of bytes) s += String.fromCharCode(v);
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(bytes).toString('base64');
}

export function unb64(str: string): Uint8Array {
  const s = typeof atob === 'function' ? atob(str) : Buffer.from(str, 'base64').toString('binary');
  const out = new Uint8Array(s.length);
  for (let k = 0; k < s.length; k++) out[k] = s.charCodeAt(k) & 255;
  return out;
}

/** Height class of a building (for choosing the skyline's back row). */
export function heightOf(bld: number, tier: number): number {
  // homes rise with density (camp .. arcology); landmarks and launch towers stand out
  const homes: Record<number, number> = { [B.CAMP]: 1, [B.HUT]: 1.5, [B.HOUSE]: 2, [B.TOWNHOUSE]: 3, [B.TENEMENT]: 4, [B.APARTMENT]: 6, [B.SUBURB]: 2, [B.TOWER]: 10, [B.ARCOLOGY]: 14 };
  if (homes[bld] !== undefined) return homes[bld] + tier * 0.1;
  return 2 + tier * 0.3 + (bld === B.PALACE || bld === B.TEMPLE ? 2 : 0) + (bld === B.SPACEPORT ? 8 : 0);
}

/** A layout record of a city as it stands now. */
export function snapshotCity(sim: Sim, civ: Civ, s: Settlement): CitySnapshot {
  const m = sim.w.map;
  const r = Math.ceil(s.radius) + 1;
  const n = r * 2 + 1;
  const bytes = new Uint8Array(n * 5);
  for (let dx = -r; dx <= r; dx++) {
    const x = s.x + dx;
    let back = 0, backT = 0, backH = -1, front = 0, frontT = 0, frontY = -1, water = 0;
    if (x >= 0 && x < m.w) {
      for (let dy = -r; dy <= r; dy++) {
        const y = s.y + dy;
        if (y < 0 || y >= m.h) continue;
        const i = m.idx(x, y);
        if (dy >= r - 1 && m.isWater(i)) water |= 1; // the city's southern edge meets water
        if (m.river[i] > 0) water |= 2;
        if (m.settle[i] !== s.id) continue;
        const b = m.bld[i];
        if (!b || b === B.FARM) continue; // farmland is drawn as fields, not buildings
        const t = m.bldFlags[i] & BLDF.TIER_MASK;
        const h = heightOf(b, t);
        if (h > backH) { backH = h; back = b; backT = t; }
        if (dy > frontY) { frontY = dy; front = b; frontT = t; }
      }
    }
    const o = (dx + r) * 5;
    bytes[o] = back; bytes[o + 1] = backT; bytes[o + 2] = front === back && frontT === backT ? 0 : front; bytes[o + 3] = frontT; bytes[o + 4] = water;
  }
  return {
    year: sim.year, civId: civ.id, civName: civ.name, sid: s.id, name: s.name, pop: Math.round(s.pop), era: civ.era, tier: eraToTier(civ.era),
    color: civ.color, emblem: { ...civ.emblem }, ethos: civ.ethos?.key, cols: b64(bytes), n,
  };
}

/** The cities worth a postcard: the capital and the largest other city. */
export function albumCities(sim: Sim, civ: Civ): Settlement[] {
  const all = civ.settlements.map((id) => sim.w.settlements.get(id)).filter((s): s is Settlement => !!s && s.pop >= 50);
  all.sort((a, b) => b.pop - a.pop);
  const cap = sim.w.settlements.get(civ.capital);
  const out: Settlement[] = cap ? [cap] : [];
  for (const s of all) if (out.length < 2 && !out.includes(s)) out.push(s);
  return out;
}

/** Yearly: every 50 years, record postcards of every nation's main cities. */
export function albumYearly(sim: Sim): void {
  if (sim.year <= 0 || sim.year % 50 !== 0) return;
  const album = (sim.w.album ??= []);
  for (const civ of sim.w.civs.values()) {
    if (!civ.alive || !civ.settlements.length) continue;
    for (const s of albumCities(sim, civ)) album.push(snapshotCity(sim, civ, s));
  }
  // keep saves small: past the cap, thin the oldest half (every other record)
  if (album.length > MAX_SNAPSHOTS) {
    const half = Math.floor(album.length / 2);
    sim.w.album = album.slice(0, half).filter((_, k) => k % 2 === 0).concat(album.slice(half));
  }
}
