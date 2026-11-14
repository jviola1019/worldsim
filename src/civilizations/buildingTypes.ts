/**
 * Numeric building type ids (stored per tile in TileMap.bld) and their keys.
 * Detailed functional definitions (jobs, housing, production, placement)
 * live in civilizations/buildings.ts.
 *
 * Architectural tier (0..7) records the style a building was BUILT in, so a
 * city that modernizes keeps older districts and monuments until they are
 * individually rebuilt:
 *   0 prehistoric, 1 ancient (eras 2-3), 2 classical (era 4), 3 medieval (era 5),
 *   4 renaissance (era 6), 5 industrial (eras 7-8), 6 modern (eras 9-11), 7 future (12+)
 */
export const B = {
  NONE: 0,
  // residential
  CAMP: 1,
  HUT: 2,
  HOUSE: 3,
  TOWNHOUSE: 4,
  TENEMENT: 5,
  APARTMENT: 6,
  SUBURB: 7,
  TOWER: 8,
  ARCOLOGY: 9,
  // food
  FARM: 10,
  PASTURE: 11,
  FISHERY: 12,
  PLANTATION: 13,
  GREENHOUSE: 14,
  // extraction
  LUMBER: 15,
  QUARRY: 16,
  MINE: 17,
  OIL_WELL: 18,
  // industry
  WORKSHOP: 19,
  SMITHY: 20,
  MILL: 21,
  FACTORY: 22,
  STEEL_MILL: 23,
  REFINERY: 24,
  CHIP_FAB: 25,
  ROBOT_FACTORY: 26,
  // energy
  POWER_FOSSIL: 27,
  POWER_NUCLEAR: 28,
  SOLAR: 29,
  WIND: 30,
  FUSION: 31,
  HYDRO: 32,
  // commerce
  MARKET: 33,
  HARBOR: 34,
  WAREHOUSE: 35,
  BANK: 36,
  OFFICE: 37,
  // civic
  PALACE: 38,
  TEMPLE: 39,
  SCHOOL: 40,
  LIBRARY: 41,
  UNIVERSITY: 42,
  HOSPITAL: 43,
  LAB: 44,
  ARENA: 45,
  MONUMENT: 46,
  PARK: 47,
  GRANARY: 48,
  AQUEDUCT: 49,
  // military
  BARRACKS: 50,
  WALL: 51,
  FORT: 52,
  MILITARY_BASE: 53,
  AIRBASE: 54,
  NAVAL_BASE: 55,
  SILO: 56,
  // transport
  STATION: 57,
  AIRPORT: 58,
  SPACEPORT: 59,
  // special
  RUINS: 60,
  CONSTRUCTION: 61,
  CRATER: 62,
  DATA_CENTER: 63,
  MEGASTRUCTURE: 64,
} as const;

export type BuildingKey = keyof typeof B;
export type BuildingId = (typeof B)[BuildingKey];
export const BUILDING_COUNT = 65;
export const BUILDING_KEYS = Object.keys(B) as BuildingKey[];
export const BUILDING_KEY_BY_ID: readonly BuildingKey[] = (() => {
  const arr: BuildingKey[] = [];
  for (const k of BUILDING_KEYS) arr[B[k]] = k;
  return arr;
})();

/** Map a civilization era (1..15) to an architectural tier (0..7). */
export function eraToTier(era: number): number {
  if (era <= 1) return 0;
  if (era <= 3) return 1;
  if (era === 4) return 2;
  if (era === 5) return 3;
  if (era === 6) return 4;
  if (era <= 8) return 5;
  if (era <= 11) return 6;
  return 7;
}

export const TIER_NAMES = ['Prehistoric', 'Ancient', 'Classical', 'Medieval', 'Renaissance', 'Industrial', 'Modern', 'Future'];
