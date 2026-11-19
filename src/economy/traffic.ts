/**
 * Round 7: street traffic at real-world rates, derived (never saved, never changes history).
 *
 * Demand: vehicle trips per day = people × vehicles per 1,000 people (by era) × trips per vehicle.
 * Capacity: the street network the city's districts carry (street share and lanes by era), raised by
 * the paved roads and highways the simulation built through the city. Load = demand / capacity.
 * The rates are rough targets from general urban-planning figures, not measured data.
 */
import type { Civ, Settlement } from '../sim/types';
import type { TileMap } from '../world/tilemap';
import { eraToTier } from '../civilizations/buildingTypes';
import { BUILDINGS } from '../civilizations/buildings';

/** Era street band: 0 = tiers 0–2 (lanes), 1 = 3–4 (carts), 2 = 5 (industrial), 3 = 6 (modern), 4 = 7 (future). */
export function streetBand(tier: number): 0 | 1 | 2 | 3 | 4 {
  return tier <= 2 ? 0 : tier <= 4 ? 1 : tier === 5 ? 2 : tier === 6 ? 3 : 4;
}

/** Share of a city block given to streets, by street band (a block between built neighbours). */
export const STREET_SHARE = [0.1, 0.15, 0.22, 0.28, 0.25] as const;
/** Share of urban land in parks a city aims for, by street band. */
export const PARK_SHARE = [0.01, 0.03, 0.06, 0.09, 0.14] as const;
/** Vehicles per 1,000 people, by street band (carts, then trams and cars, then shared autonomous vehicles). */
export const VEHICLES_PER_1000 = [0, 20, 80, 450, 250] as const;
const TRIPS_PER_VEHICLE = 2.5;
/** Vehicle trips per day one city district's streets carry comfortably, by street band. */
const DISTRICT_CAPACITY = [1, 600, 3000, 16000, 26000] as const;

export type TrafficLevel = 'on foot' | 'free-flowing' | 'busy' | 'congested' | 'gridlocked';

export interface Traffic {
  level: TrafficLevel;
  /** Demand over capacity (0 when there are no vehicles). */
  load: number;
  tripsPerDay: number;
  capacity: number;
  vehicles: { label: string; share: number }[];
}

const MIX: readonly { label: string; share: number }[][] = [
  [{ label: 'People on foot', share: 0.85 }, { label: 'Pack animals', share: 0.15 }],
  [{ label: 'Carts and wagons', share: 0.6 }, { label: 'Carriages and riders', share: 0.4 }],
  [{ label: 'Trams', share: 0.35 }, { label: 'Carts and carriages', share: 0.35 }, { label: 'Early cars and lorries', share: 0.3 }],
  [{ label: 'Cars', share: 0.78 }, { label: 'Buses', share: 0.07 }, { label: 'Trucks and vans', share: 0.15 }],
  [{ label: 'Shared autonomous pods', share: 0.6 }, { label: 'Transit', share: 0.3 }, { label: 'Freight drones and vans', share: 0.1 }],
];

const CITY_CATS = new Set(['residential', 'commerce', 'civic', 'industry', 'energy']);

export function trafficLevel(load: number, band: number): TrafficLevel {
  if (band === 0) return 'on foot';
  return load < 0.5 ? 'free-flowing' : load < 0.85 ? 'busy' : load < 1.15 ? 'congested' : 'gridlocked';
}

/**
 * Traffic of one settlement. `roadBonus` is the extra capacity the simulation's roads add through the
 * city (see roadBonusOf): paved roads +15%, highways +40%.
 */
export function trafficOf(s: Settlement, civ: Civ | undefined, roadBonus = 0): Traffic {
  const band = streetBand(civ ? eraToTier(civ.era) : 0);
  let districts = 0;
  for (let t = 0; t < s.bld.length; t++) if (s.bld[t] && BUILDINGS[t] && CITY_CATS.has(BUILDINGS[t].category)) districts += s.bld[t];
  const tripsPerDay = Math.max(0, s.pop) * (VEHICLES_PER_1000[band] / 1000) * TRIPS_PER_VEHICLE;
  const capacity = Math.max(1, districts) * DISTRICT_CAPACITY[band] * (1 + roadBonus);
  const load = tripsPerDay > 0 ? tripsPerDay / capacity : 0;
  return { level: trafficLevel(load, band), load, tripsPerDay, capacity, vehicles: MIX[band] };
}

/** Extra street capacity from the best road through the settlement's centre (simulated road tiers). */
export function roadBonusOf(m: TileMap, s: Settlement): number {
  let best = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = s.x + dx, y = s.y + dy;
    if (m.inBounds(x, y)) best = Math.max(best, m.roadTier(m.idx(x, y)));
  }
  return best >= 4 ? 0.4 : best >= 3 ? 0.15 : 0;
}
