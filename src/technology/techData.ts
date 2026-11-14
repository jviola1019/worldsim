/**
 * TEMPORARY STUB — replaced by the full tech tree (160–200 techs) authored on
 * the tech-data branch. Kept minimal so the research pipeline can be developed
 * and tested before the merge. Do not extend this file.
 */
import type { TechDef } from './types';

const t = (
  id: string,
  name: string,
  era: number,
  category: TechDef['category'],
  prereqs: string[],
  effects: TechDef['effects'],
  extra: Partial<TechDef> = {},
): TechDef => ({
  id,
  name,
  era,
  category,
  prereqs,
  cost: prereqs.length ? Math.round(40 * Math.pow(1.9, era - 1)) : 0,
  realism: era <= 11 ? 'historical' : era <= 13 ? 'plausible' : 'speculative',
  effects,
  adoptionYears: 10 + era * 2,
  description: name,
  ...extra,
});

export const TECHS: readonly TechDef[] = [
  t('fire_control', 'Fire control', 1, 'subsistence', [], { forage: 0.1 }),
  t('stone_tools', 'Stone tools', 1, 'materials', [], { forage: 0.1, landTier: 0, housingTier: 0 }),
  t('foraging', 'Foraging', 1, 'subsistence', [], { forage: 0.2 }),
  t('shelter', 'Shelter building', 1, 'subsistence', ['stone_tools'], { housingTier: 1 }, { unlocks: { buildings: ['HUT'] } }),
  t('hunting', 'Organized hunting', 1, 'subsistence', ['stone_tools'], { forage: 0.2, landTier: 1 }),
  t('fishing', 'Fishing', 1, 'subsistence', ['foraging'], { fishing: 1 }, { requires: { features: ['coast', 'river'] }, unlocks: { buildings: ['FISHERY'] } }),
  t('oral_tradition', 'Oral tradition', 1, 'culture', ['fire_control'], { culturalOutput: 0.1 }, { unlocks: { buildings: ['TEMPLE', 'MONUMENT'] } }),
  t('agriculture', 'Agriculture', 2, 'agriculture', ['foraging', 'stone_tools'], { farming: 1 }, { unlocks: { buildings: ['FARM'] } }),
  t('domestication', 'Animal domestication', 2, 'agriculture', ['agriculture'], { herding: 1 }, { requires: { features: ['domesticable'] }, unlocks: { buildings: ['PASTURE'] } }),
  t('pottery', 'Pottery', 2, 'materials', ['agriculture'], { foodPreservation: 0.15, crafts: 0.1 }, { unlocks: { buildings: ['WORKSHOP', 'GRANARY', 'LUMBER'] } }),
  t('masonry', 'Masonry', 2, 'materials', ['shelter'], { housingTier: 2, fortification: 1 }, { unlocks: { buildings: ['HOUSE', 'QUARRY', 'WALL'] } }),
  t('chiefdom', 'Chieftainship', 2, 'civic', ['oral_tradition'], { adminCapacity: 0.3 }, { unlocks: { buildings: ['PALACE'] } }),
  t('copper_working', 'Copper working', 3, 'materials', ['pottery'], { metalTier: 1, mining: 1, landTier: 1 }, { requires: { resources: ['COPPER'] }, unlocks: { buildings: ['MINE', 'SMITHY'] } }),
  t('bronze_working', 'Bronze working', 3, 'materials', ['copper_working'], { metalTier: 2, landTier: 2 }, { requires: { resources: ['COPPER', 'TIN'] } }),
  t('writing', 'Writing', 3, 'science', ['chiefdom'], { literacy: 0.05, adminCapacity: 0.4, research: 0.2 }, { unlocks: { buildings: ['LIBRARY'] } }),
  t('currency', 'Currency', 3, 'economy', ['writing'], { currency: 1, markets: 0.2 }, { unlocks: { buildings: ['MARKET'] } }),
  t('sailing', 'Sailing', 3, 'maritime', ['fishing'], { navalTier: 2 }, { requires: { features: ['coast'] }, unlocks: { buildings: ['HARBOR'] } }),
  t('iron_working', 'Iron working', 4, 'materials', ['bronze_working'], { metalTier: 3, landTier: 3 }, { requires: { resources: ['IRON'] }, unlocks: { buildings: ['BARRACKS'] } }),
  t('roads', 'Road building', 4, 'transport', ['masonry', 'writing'], { roadTier: 2, landSpeed: 0.2 }),
  t('philosophy', 'Philosophy', 4, 'science', ['writing'], { research: 0.3, literacy: 0.05 }),
  t('universities', 'Universities', 5, 'science', ['philosophy'], { research: 0.4, literacy: 0.05 }, { unlocks: { buildings: ['UNIVERSITY'] } }),
  t('printing', 'Printing press', 6, 'communication', ['universities'], { literacy: 0.15, research: 0.4, mediaReach: 0.3 }),
  t('steam_engine', 'Steam engine', 7, 'energy', ['printing', 'iron_working'], { energyTier: 2, industry: 1, deepMining: 1 }, { requires: { resources: ['COAL', 'IRON'] }, unlocks: { buildings: ['FACTORY'] } }),
  t('electricity', 'Electricity', 8, 'energy', ['steam_engine'], { energyTier: 3, electrification: 1 }, { unlocks: { buildings: ['POWER_FOSSIL'] } }),
];

export const TECH_BY_ID: ReadonlyMap<string, TechDef> = new Map(TECHS.map((x) => [x.id, x]));
export const STARTING_TECHS: readonly string[] = ['fire_control', 'stone_tools', 'foraging'];
export const ERA_NAMES: readonly string[] = [
  '', 'Prehistoric', 'Agricultural', 'Bronze & Early Urban', 'Iron & Classical', 'Medieval', 'Renaissance & Exploration',
  'Early Industrial', 'Late Industrial', 'Early Modern', 'Atomic & Space', 'Digital', 'Near Future', 'Advanced Future',
  'Spacefaring', 'Speculative',
];
