/**
 * Sprite registry: merges every sheet into one id -> SpriteDef map.
 * Sheets live in separate files so they can be authored independently.
 */
import type { SpriteSheet } from './types';
import { TERRAIN_SPRITES } from './terrain';
import { VEGETATION_SPRITES } from './vegetation';
import { UNIT_SPRITES } from './units';
import { ANIMAL_SPRITES } from './animals';
import { VEHICLE_SPRITES } from './vehicles';
import { EFFECT_SPRITES } from './effects';
import { BUILDING_SPRITES } from './buildings';
import { CIVIC_BUILDING_SPRITES } from './buildings_civic';
import { ICON_SPRITES } from './icons';
import { BUILDING_VENUE_SPRITES } from './buildings_venues';
import { HOUSING_VARIANT_SPRITES } from './buildings_housing';
import { ERA_VEHICLE_SPRITES } from './vehicles_era';
import { CHARACTER_SPRITES } from './characters';
import { CITY_LOT_SPRITES } from './city_lots';

/** Every sheet, in registration order (also used by tests to detect duplicate ids). */
export const SPRITE_SHEETS: Readonly<Record<string, SpriteSheet>> = {
  terrain: TERRAIN_SPRITES,
  vegetation: VEGETATION_SPRITES,
  units: UNIT_SPRITES,
  characters: CHARACTER_SPRITES,
  animals: ANIMAL_SPRITES,
  vehicles: VEHICLE_SPRITES,
  vehiclesEra: ERA_VEHICLE_SPRITES,
  effects: EFFECT_SPRITES,
  buildings: BUILDING_SPRITES,
  housing: HOUSING_VARIANT_SPRITES,
  civic: CIVIC_BUILDING_SPRITES,
  venues: BUILDING_VENUE_SPRITES,
  icons: ICON_SPRITES,
  cityLots: CITY_LOT_SPRITES,
};

export const ALL_SPRITES: SpriteSheet = Object.assign({}, ...Object.values(SPRITE_SHEETS)) as SpriteSheet;
