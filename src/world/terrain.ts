/**
 * Terrain (biome) definitions. Values here are STYLIZED ABSTRACTIONS chosen for
 * coherent gameplay; relative orderings (e.g. grassland more fertile than
 * tundra, mountains costly to cross) follow common geographic knowledge.
 * See docs/MODEL.md for the scale assumptions (1 tile ~ 100 km^2).
 */
export const T = {
  DEEP: 0,
  OCEAN: 1,
  SHALLOW: 2,
  LAKE: 3,
  BEACH: 4,
  GRASS: 5,
  STEPPE: 6,
  SAVANNA: 7,
  DESERT: 8,
  FOREST: 9,
  TAIGA: 10,
  JUNGLE: 11,
  SWAMP: 12,
  TUNDRA: 13,
  SNOW: 14,
  GLACIER: 15,
  HILLS: 16,
  MOUNTAIN: 17,
  VOLCANIC: 18,
  ASH: 19,
  ALIEN: 20,
  ALIEN_GRASS: 21,
  CORRUPT: 22,
  CRYSTAL: 23,
} as const;
export type TerrainKey = keyof typeof T;
export type TerrainId = (typeof T)[TerrainKey];
export const TERRAIN_COUNT = 24;

export interface TerrainDef {
  id: TerrainId;
  key: TerrainKey;
  name: string;
  water: boolean;
  /** Overview / minimap color. */
  color: string;
  /** Sprite base id: `ter.<sprite>.<variant>` */
  sprite: string;
  /** Land movement cost multiplier (Infinity = impassable on foot). */
  move: number;
  /** Base soil fertility 0..255 before moisture and river modifiers. */
  fertility: number;
  /** Vegetation carrying capacity 0..255 (forest biomass). */
  vegCap: number;
  /** Wild food available to foragers, person-years per tile per year at full vegetation. */
  forage: number;
  /** Desirability for settlement 0..1 (shelter, water, building ground). */
  habitability: number;
  /** Can buildings be placed (ignores special placement rules like harbors). */
  buildable: boolean;
  /** Tree sprite family drawn for vegetation on this terrain. */
  trees: string[];
}

const D = (
  id: TerrainId,
  key: TerrainKey,
  name: string,
  water: boolean,
  color: string,
  sprite: string,
  move: number,
  fertility: number,
  vegCap: number,
  forage: number,
  habitability: number,
  buildable: boolean,
  trees: string[] = [],
): TerrainDef => ({ id, key, name, water, color, sprite, move, fertility, vegCap, forage, habitability, buildable, trees });

export const TERRAIN: readonly TerrainDef[] = [
  D(0, 'DEEP', 'Deep ocean', true, '#122c5a', 'deep', Infinity, 0, 0, 2, 0, false),
  D(1, 'OCEAN', 'Ocean', true, '#1d4f8c', 'ocean', Infinity, 0, 0, 4, 0, false),
  D(2, 'SHALLOW', 'Shallow sea', true, '#3584c4', 'coast', Infinity, 0, 0, 8, 0, false),
  D(3, 'LAKE', 'Lake', true, '#3d8cc2', 'lake', Infinity, 0, 0, 10, 0, false),
  D(4, 'BEACH', 'Beach', false, '#e3cf8e', 'beach', 1.1, 50, 20, 8, 0.75, true, ['palm']),
  D(5, 'GRASS', 'Grassland', false, '#5f9f42', 'grass', 1, 205, 70, 12, 1, true, ['oak', 'birch', 'bush']),
  D(6, 'STEPPE', 'Steppe', false, '#8f9a55', 'steppe', 1, 165, 30, 8, 0.8, true, ['shrub_dry', 'bush']),
  D(7, 'SAVANNA', 'Savanna', false, '#a9a256', 'savanna', 1.1, 135, 60, 12, 0.85, true, ['acacia', 'shrub_dry']),
  D(8, 'DESERT', 'Desert', false, '#dcc184', 'desert', 1.6, 15, 6, 1, 0.3, true, ['cactus']),
  D(9, 'FOREST', 'Forest', false, '#2f7535', 'forest', 1.6, 175, 225, 10, 0.75, true, ['oak', 'birch', 'pine']),
  D(10, 'TAIGA', 'Taiga', false, '#2e5a43', 'taiga', 1.8, 85, 205, 6, 0.55, true, ['pine', 'snowpine']),
  D(11, 'JUNGLE', 'Tropical forest', false, '#1f6a33', 'jungle', 2.4, 140, 255, 12, 0.55, true, ['jungle', 'palm']),
  D(12, 'SWAMP', 'Wetland', false, '#4d6a49', 'swamp', 2.6, 125, 130, 10, 0.35, true, ['reeds', 'mangrove', 'deadtree']),
  D(13, 'TUNDRA', 'Tundra', false, '#99a382', 'tundra', 1.6, 35, 18, 3, 0.3, true, ['shrub_dry']),
  D(14, 'SNOW', 'Snowfield', false, '#e9eef0', 'snow', 2.5, 0, 8, 0.5, 0.1, true, ['snowpine']),
  D(15, 'GLACIER', 'Glacier', false, '#c3e6f2', 'glacier', 4, 0, 0, 0, 0, false),
  D(16, 'HILLS', 'Hills', false, '#7d9a4f', 'hills', 2, 125, 70, 6, 0.7, true, ['oak', 'pine', 'bush']),
  D(17, 'MOUNTAIN', 'Mountains', false, '#8a8070', 'mountain', 5, 20, 25, 1, 0.12, false, ['pine']),
  D(18, 'VOLCANIC', 'Volcanic land', false, '#3d3542', 'volcanic', 2.5, 215, 40, 4, 0.35, true, ['deadtree']),
  D(19, 'ASH', 'Ashen waste', false, '#6e6976', 'ash', 1.5, 10, 4, 1, 0.15, true, ['deadtree']),
  D(20, 'ALIEN', 'Alien soil', false, '#7a4f9c', 'alien', 1.2, 140, 50, 6, 0.6, true, ['alien']),
  D(21, 'ALIEN_GRASS', 'Alien meadow', false, '#9a6fc6', 'alien_grass', 1.4, 190, 160, 10, 0.8, true, ['alien']),
  D(22, 'CORRUPT', 'Blighted land', false, '#4a2f56', 'corrupt', 2, 20, 40, 2, 0.15, true, ['corrupt']),
  D(23, 'CRYSTAL', 'Crystal fields', false, '#b49ee0', 'crystal', 2, 30, 30, 2, 0.25, true, ['crystal']),
];

export const isWaterTerrain = (t: number): boolean => t <= 3;
export const isOceanTerrain = (t: number): boolean => t <= 2;

/** Biomes a player can paint with the biome brush (land only). */
export const PAINTABLE_BIOMES: TerrainKey[] = [
  'GRASS', 'FOREST', 'JUNGLE', 'DESERT', 'STEPPE', 'SAVANNA', 'SNOW', 'TUNDRA', 'TAIGA',
  'SWAMP', 'VOLCANIC', 'BEACH', 'HILLS', 'ALIEN', 'ALIEN_GRASS', 'CORRUPT', 'CRYSTAL', 'ASH',
];
