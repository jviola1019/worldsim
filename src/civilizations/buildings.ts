/**
 * Functional building definitions. Buildings are not decoration: each one
 * houses people, provides jobs in a sector, converts inputs to outputs (see
 * economy/production.ts), costs materials and labor to build, may pollute,
 * and has placement rules tied to terrain and resources.
 *
 * Availability: a building can be built when an adopted technology unlocks it
 * (Civ.unlocked) — CAMP is always available. Residential types additionally
 * follow the civ's housingTier capability.
 *
 * Units: housing in persons per tile; jobs in workers per building at the
 * pre-automation baseline; costs in goods units; labor in person-years.
 */
import { B, type BuildingId, type BuildingKey } from './buildingTypes';
import type { GoodKey } from '../world/resources';

export type BuildingCategory = 'residential' | 'food' | 'extraction' | 'industry' | 'energy' | 'commerce' | 'civic' | 'military' | 'transport' | 'special';

/** Employment sectors (index order is used in Settlement.employment). */
export const SECTOR = { FOOD: 0, RESOURCES: 1, INDUSTRY: 2, CONSTRUCTION: 3, SERVICES: 4, MILITARY: 5, UNEMPLOYED: 6 } as const;
export const SECTOR_NAMES = ['Agriculture', 'Resources', 'Industry', 'Construction', 'Services', 'Military', 'Unemployed'];

export type Placement =
  | 'center' // the settlement's central tile area (palaces, markets, temples)
  | 'urban' // near the center, ring growth
  | 'farmland' // flat fertile land, outer ring
  | 'coast' // land tile adjacent to ocean or lake
  | 'river' // land tile with a river
  | 'deposit' // tile with a mineable deposit
  | 'oil' // tile with oil/gas
  | 'forest' // tile with high vegetation
  | 'hills' // hills/mountain adjacent
  | 'edge' // outskirts
  | 'open'; // large open land (airports, solar)

export interface BuildingDef {
  id: BuildingId;
  key: BuildingKey;
  name: string;
  category: BuildingCategory;
  /** Residential capacity in persons. */
  housing: number;
  /** Required housingTier capability (residential only). */
  housingTier?: number;
  jobs: number;
  sector: number;
  cost: Partial<Record<GoodKey, number>>;
  labor: number;
  footprint: 1 | 2;
  placement: Placement;
  /** Minimum settlement population before it is considered. */
  minPop: number;
  /** Max count per settlement (0 = unlimited). */
  max: number;
  /** Pollution emitted per year at full operation (0..255 scale per tile). */
  pollution: number;
  /** Can become a protected historic landmark. */
  landmark: boolean;
  /** Architectural tiers that have their own sprites (renderer falls back to nearest). */
  tiers: number[];
}

const D = (
  key: BuildingKey,
  name: string,
  category: BuildingCategory,
  o: Partial<Omit<BuildingDef, 'id' | 'key' | 'name' | 'category'>>,
): BuildingDef => ({
  id: B[key],
  key,
  name,
  category,
  housing: 0,
  jobs: 0,
  sector: SECTOR.SERVICES,
  cost: {},
  labor: 5,
  footprint: 1,
  placement: 'urban',
  minPop: 0,
  max: 0,
  pollution: 0,
  landmark: false,
  tiers: [0],
  ...o,
});

const LIST: BuildingDef[] = [
  D('NONE', 'Empty', 'special', {}),
  // residential
  D('CAMP', 'Camp', 'residential', { housing: 60, housingTier: 0, cost: { WOOD: 3 }, labor: 1, placement: 'urban', tiers: [0] }),
  D('HUT', 'Huts', 'residential', { housing: 160, housingTier: 1, cost: { WOOD: 14 }, labor: 6, tiers: [0, 1] }),
  D('HOUSE', 'Houses', 'residential', { housing: 650, housingTier: 2, cost: { WOOD: 25, STONE: 40 }, labor: 22, tiers: [1, 2, 3, 4] }),
  D('TOWNHOUSE', 'Townhouses', 'residential', { housing: 2200, housingTier: 3, cost: { WOOD: 60, STONE: 130, METAL: 6 }, labor: 70, tiers: [3, 4] }),
  D('TENEMENT', 'Tenements', 'residential', { housing: 9000, housingTier: 4, cost: { WOOD: 100, STONE: 320, METAL: 40 }, labor: 220, tiers: [5] }),
  D('APARTMENT', 'Apartment blocks', 'residential', { housing: 40000, housingTier: 5, cost: { STONE: 1500, METAL: 600, MACHINERY: 50 }, labor: 1100, tiers: [6] }),
  D('SUBURB', 'Suburbs', 'residential', { housing: 5000, housingTier: 6, cost: { WOOD: 350, STONE: 260, METAL: 90 }, labor: 300, placement: 'edge', tiers: [6] }),
  D('TOWER', 'Residential towers', 'residential', { housing: 140000, housingTier: 7, cost: { STONE: 5000, METAL: 3000, MACHINERY: 400, ELECTRONICS: 20 }, labor: 3800, tiers: [6, 7] }),
  D('ARCOLOGY', 'Arcology', 'residential', { housing: 400000, housingTier: 8, cost: { STONE: 15000, METAL: 10000, MACHINERY: 2000, ELECTRONICS: 500 }, labor: 9000, footprint: 2, tiers: [7] }),
  // food
  D('FARM', 'Farmland', 'food', { jobs: 0, sector: SECTOR.FOOD, cost: { WOOD: 4 }, labor: 10, placement: 'farmland', tiers: [0, 1, 3, 5, 6] }),
  D('PASTURE', 'Pasture', 'food', { sector: SECTOR.FOOD, cost: { WOOD: 8 }, labor: 8, placement: 'farmland', tiers: [1, 5] }),
  D('FISHERY', 'Fishery', 'food', { sector: SECTOR.FOOD, cost: { WOOD: 12 }, labor: 8, placement: 'coast', tiers: [0, 3, 6] }),
  D('PLANTATION', 'Plantation', 'food', { sector: SECTOR.FOOD, cost: { WOOD: 20 }, labor: 25, placement: 'farmland', tiers: [4] }),
  D('GREENHOUSE', 'Vertical farm', 'food', { jobs: 60, sector: SECTOR.FOOD, cost: { STONE: 400, METAL: 300, MACHINERY: 80, ELECTRONICS: 10 }, labor: 300, placement: 'urban', minPop: 20000, tiers: [6, 7] }),
  // extraction
  D('LUMBER', 'Lumber camp', 'extraction', { jobs: 60, sector: SECTOR.RESOURCES, cost: { WOOD: 6 }, labor: 6, placement: 'forest', tiers: [1, 5] }),
  D('QUARRY', 'Quarry', 'extraction', { jobs: 60, sector: SECTOR.RESOURCES, cost: { WOOD: 10 }, labor: 12, placement: 'hills', tiers: [1] }),
  D('MINE', 'Mine', 'extraction', { jobs: 90, sector: SECTOR.RESOURCES, cost: { WOOD: 30, STONE: 10 }, labor: 25, placement: 'deposit', tiers: [1, 5, 6], pollution: 2 }),
  D('OIL_WELL', 'Oil field', 'extraction', { jobs: 80, sector: SECTOR.RESOURCES, cost: { METAL: 80 }, labor: 60, placement: 'oil', tiers: [5, 6], pollution: 4 }),
  // industry
  D('WORKSHOP', 'Workshop', 'industry', { jobs: 30, sector: SECTOR.INDUSTRY, cost: { WOOD: 20, STONE: 10 }, labor: 12, minPop: 150, tiers: [1, 3] }),
  D('SMITHY', 'Smithy', 'industry', { jobs: 20, sector: SECTOR.INDUSTRY, cost: { WOOD: 15, STONE: 20 }, labor: 12, minPop: 150, tiers: [1, 3], pollution: 1 }),
  D('MILL', 'Mill', 'industry', { jobs: 15, sector: SECTOR.INDUSTRY, cost: { WOOD: 40, STONE: 30 }, labor: 25, minPop: 400, max: 3, tiers: [3, 4] }),
  D('FACTORY', 'Factory', 'industry', { jobs: 400, sector: SECTOR.INDUSTRY, cost: { STONE: 300, METAL: 150 }, labor: 300, minPop: 3000, tiers: [5, 6, 7], pollution: 14 }),
  D('STEEL_MILL', 'Steel mill', 'industry', { jobs: 300, sector: SECTOR.INDUSTRY, cost: { STONE: 900, METAL: 40 }, labor: 350, minPop: 5000, max: 2, tiers: [5], pollution: 22 }),
  D('REFINERY', 'Refinery', 'industry', { jobs: 150, sector: SECTOR.INDUSTRY, cost: { METAL: 400, MACHINERY: 120 }, labor: 400, minPop: 8000, max: 2, tiers: [6], pollution: 18 }),
  D('CHIP_FAB', 'Chip fabrication plant', 'industry', { jobs: 250, sector: SECTOR.INDUSTRY, cost: { STONE: 600, METAL: 400, MACHINERY: 400 }, labor: 900, minPop: 50000, max: 2, tiers: [6], pollution: 3 }),
  D('ROBOT_FACTORY', 'Automated factory', 'industry', { jobs: 60, sector: SECTOR.INDUSTRY, cost: { METAL: 800, MACHINERY: 600, ELECTRONICS: 200 }, labor: 900, minPop: 50000, tiers: [7], pollution: 4 }),
  // energy
  D('POWER_FOSSIL', 'Power station', 'energy', { jobs: 120, sector: SECTOR.INDUSTRY, cost: { STONE: 400, METAL: 300, MACHINERY: 20 }, labor: 400, placement: 'edge', minPop: 3000, tiers: [5, 6], pollution: 30 }),
  D('POWER_NUCLEAR', 'Nuclear plant', 'energy', { jobs: 150, sector: SECTOR.INDUSTRY, cost: { STONE: 1500, METAL: 1000, MACHINERY: 500, ELECTRONICS: 30 }, labor: 1500, placement: 'edge', minPop: 30000, max: 2, tiers: [6] }),
  D('SOLAR', 'Solar farm', 'energy', { jobs: 10, sector: SECTOR.INDUSTRY, cost: { METAL: 150, ELECTRONICS: 40 }, labor: 100, placement: 'open', minPop: 2000, tiers: [6, 7] }),
  D('WIND', 'Wind farm', 'energy', { jobs: 10, sector: SECTOR.INDUSTRY, cost: { METAL: 200, MACHINERY: 40 }, labor: 100, placement: 'open', minPop: 2000, tiers: [6] }),
  D('FUSION', 'Fusion plant', 'energy', { jobs: 200, sector: SECTOR.INDUSTRY, cost: { METAL: 3000, MACHINERY: 1500, ELECTRONICS: 400 }, labor: 3000, placement: 'edge', minPop: 80000, max: 1, tiers: [7] }),
  D('HYDRO', 'Hydroelectric dam', 'energy', { jobs: 40, sector: SECTOR.INDUSTRY, cost: { STONE: 2000, METAL: 300, MACHINERY: 100 }, labor: 1500, placement: 'river', minPop: 5000, max: 1, tiers: [6] }),
  // commerce
  D('MARKET', 'Market', 'commerce', { jobs: 40, cost: { WOOD: 20, STONE: 10 }, labor: 10, placement: 'center', minPop: 300, max: 3, tiers: [1, 3, 6] }),
  D('HARBOR', 'Harbor', 'commerce', { jobs: 80, cost: { WOOD: 60, STONE: 40 }, labor: 40, placement: 'coast', minPop: 300, max: 2, tiers: [1, 4, 6] }),
  D('WAREHOUSE', 'Warehouse', 'commerce', { jobs: 60, cost: { STONE: 100, METAL: 30 }, labor: 60, minPop: 5000, max: 3, tiers: [5] }),
  D('BANK', 'Bank', 'commerce', { jobs: 80, cost: { STONE: 120, METAL: 20 }, labor: 80, placement: 'center', minPop: 5000, max: 3, tiers: [4, 6] }),
  D('OFFICE', 'Office towers', 'commerce', { jobs: 3000, cost: { STONE: 2500, METAL: 1500, MACHINERY: 200, ELECTRONICS: 60 }, labor: 2500, placement: 'center', minPop: 50000, tiers: [6, 7] }),
  // civic
  D('PALACE', 'Seat of government', 'civic', { jobs: 30, cost: { WOOD: 30, STONE: 60 }, labor: 40, placement: 'center', max: 1, landmark: true, footprint: 1, tiers: [0, 1, 2, 3, 4, 5, 6, 7] }),
  D('TEMPLE', 'Temple', 'civic', { jobs: 15, cost: { WOOD: 15, STONE: 40 }, labor: 30, placement: 'center', minPop: 120, max: 4, landmark: true, tiers: [0, 1, 2, 3, 4, 6, 7] }),
  D('SCHOOL', 'School', 'civic', { jobs: 60, cost: { WOOD: 20, STONE: 60 }, labor: 40, minPop: 1000, tiers: [4, 6] }),
  D('LIBRARY', 'Library', 'civic', { jobs: 15, cost: { STONE: 80 }, labor: 50, placement: 'center', minPop: 1500, max: 2, landmark: true, tiers: [2, 4] }),
  D('UNIVERSITY', 'University', 'civic', { jobs: 120, cost: { STONE: 300, METAL: 20 }, labor: 200, minPop: 8000, max: 3, landmark: true, tiers: [3, 6] }),
  D('HOSPITAL', 'Hospital', 'civic', { jobs: 120, cost: { STONE: 150, METAL: 40 }, labor: 120, minPop: 3000, tiers: [2, 5, 6] }),
  D('LAB', 'Research laboratory', 'civic', { jobs: 200, cost: { STONE: 300, METAL: 200, MACHINERY: 80, ELECTRONICS: 20 }, labor: 300, minPop: 20000, tiers: [6, 7] }),
  D('ARENA', 'Arena', 'civic', { jobs: 40, cost: { STONE: 600 }, labor: 400, minPop: 20000, max: 1, footprint: 2, landmark: true, tiers: [2, 6] }),
  D('MONUMENT', 'Monument', 'civic', { jobs: 2, cost: { STONE: 120 }, labor: 80, placement: 'center', minPop: 2000, max: 2, landmark: true, tiers: [0, 1, 2, 4, 6, 7] }),
  D('PARK', 'Park', 'civic', { jobs: 5, cost: { WOOD: 10 }, labor: 20, minPop: 2000, max: 12, tiers: [5] }),
  D('GRANARY', 'Granary', 'civic', { jobs: 6, cost: { WOOD: 20, STONE: 20 }, labor: 12, minPop: 250, max: 3, tiers: [1, 5] }),
  D('AQUEDUCT', 'Aqueduct', 'civic', { jobs: 6, cost: { STONE: 300 }, labor: 200, minPop: 6000, max: 1, landmark: true, tiers: [2] }),
  // military
  D('BARRACKS', 'Barracks', 'military', { jobs: 30, sector: SECTOR.MILITARY, cost: { WOOD: 30, STONE: 30 }, labor: 30, minPop: 800, max: 2, tiers: [1, 3, 6] }),
  D('WALL', 'Walls', 'military', { cost: { WOOD: 20, STONE: 60 }, labor: 40, placement: 'edge', minPop: 300, landmark: true, tiers: [0, 1, 2, 3, 4] }),
  D('FORT', 'Fortress', 'military', { jobs: 60, sector: SECTOR.MILITARY, cost: { STONE: 400, WOOD: 50 }, labor: 300, placement: 'edge', minPop: 1500, max: 1, landmark: true, tiers: [1, 3, 4, 6] }),
  D('MILITARY_BASE', 'Military base', 'military', { jobs: 500, sector: SECTOR.MILITARY, cost: { STONE: 600, METAL: 400, MACHINERY: 100 }, labor: 500, placement: 'edge', minPop: 30000, max: 1, tiers: [6] }),
  D('AIRBASE', 'Air base', 'military', { jobs: 400, sector: SECTOR.MILITARY, cost: { STONE: 800, METAL: 500, MACHINERY: 150 }, labor: 600, placement: 'open', minPop: 30000, max: 1, footprint: 2, tiers: [6] }),
  D('NAVAL_BASE', 'Naval base', 'military', { jobs: 400, sector: SECTOR.MILITARY, cost: { STONE: 600, METAL: 400 }, labor: 500, placement: 'coast', minPop: 20000, max: 1, tiers: [5, 6] }),
  D('SILO', 'Missile silo', 'military', { jobs: 50, sector: SECTOR.MILITARY, cost: { STONE: 1000, METAL: 1000, MACHINERY: 300, ELECTRONICS: 100 }, labor: 1000, placement: 'open', minPop: 0, max: 1, tiers: [6] }),
  // transport
  D('STATION', 'Railway station', 'transport', { jobs: 80, cost: { STONE: 200, METAL: 120 }, labor: 150, placement: 'urban', minPop: 2000, max: 1, tiers: [5, 6, 7] }),
  D('AIRPORT', 'Airport', 'transport', { jobs: 600, cost: { STONE: 1500, METAL: 600, MACHINERY: 200, ELECTRONICS: 20 }, labor: 1200, placement: 'open', minPop: 80000, max: 1, footprint: 2, tiers: [6] }),
  D('SPACEPORT', 'Spaceport', 'transport', { jobs: 800, cost: { STONE: 3000, METAL: 3000, MACHINERY: 1000, ELECTRONICS: 300 }, labor: 3000, placement: 'open', minPop: 20000, max: 1, footprint: 2, tiers: [6, 7] }),
  // special
  D('RUINS', 'Ruins', 'special', { tiers: [0, 5] }),
  D('CONSTRUCTION', 'Construction site', 'special', { tiers: [0] }),
  D('CRATER', 'Crater', 'special', { tiers: [0] }),
  D('DATA_CENTER', 'Data center', 'commerce', { jobs: 100, cost: { STONE: 400, METAL: 300, ELECTRONICS: 300 }, labor: 400, placement: 'edge', minPop: 50000, max: 2, tiers: [6] }),
  D('MEGASTRUCTURE', 'Space elevator', 'transport', { jobs: 2000, cost: { METAL: 50000, MACHINERY: 10000, ELECTRONICS: 3000 }, labor: 30000, placement: 'open', minPop: 500000, max: 1, footprint: 2, landmark: true, tiers: [7] }),
];

/**
 * A building tile is a district (~100 km^2): non-agricultural districts employ
 * thousands. Base job numbers above are per-unit figures scaled here.
 */
const DISTRICT_JOB_SCALE = 10;
const SCALED: BuildingCategory[] = ['industry', 'energy', 'commerce', 'civic', 'military', 'transport'];

export const BUILDINGS: readonly BuildingDef[] = (() => {
  const arr: BuildingDef[] = [];
  for (const d of LIST) {
    if (SCALED.includes(d.category) && d.key !== 'WALL') d.jobs *= DISTRICT_JOB_SCALE;
    arr[d.id] = d;
  }
  return arr;
})();

export const RESIDENTIAL: readonly BuildingDef[] = LIST.filter((d) => d.category === 'residential').sort((a, b) => (a.housingTier ?? 0) - (b.housingTier ?? 0));

export function isResidential(id: number): boolean {
  return BUILDINGS[id]?.category === 'residential';
}

/** Buildings that physically block others but do not count as a district (special). */
export function isPlaceholder(id: number): boolean {
  return id === B.CONSTRUCTION || id === B.RUINS || id === B.CRATER;
}
