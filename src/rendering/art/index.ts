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

export const ALL_SPRITES: SpriteSheet = {
  ...TERRAIN_SPRITES,
  ...VEGETATION_SPRITES,
  ...UNIT_SPRITES,
  ...ANIMAL_SPRITES,
  ...VEHICLE_SPRITES,
  ...EFFECT_SPRITES,
  ...BUILDING_SPRITES,
  ...CIVIC_BUILDING_SPRITES,
  ...ICON_SPRITES,
};
