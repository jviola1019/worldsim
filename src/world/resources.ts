/**
 * Natural resource deposits (per tile) and economic goods (stockpiled and traded).
 *
 * Deposits are geological/biological features of a tile. A deposit becomes an
 * economic good only when a settlement works it with an appropriate building
 * (mine, oil well, fishery...) AND its civilization has the capability needed
 * to extract it (e.g. coal needs deep mining, uranium needs uranium mining).
 */

export const Deposit = {
  NONE: 0,
  COPPER: 1,
  TIN: 2,
  IRON: 3,
  GOLD: 4,
  GEMS: 5,
  COAL: 6,
  OIL: 7,
  GAS: 8,
  URANIUM: 9,
  RARE: 10, // rare earths / lithium / strategic minerals
  SPICES: 11,
  FURS: 12,
  FISH: 13, // rich fishing grounds (water tiles)
  EXOTIC: 14, // fantasy / alien / god-created exotic matter
} as const;
export type DepositKey = keyof typeof Deposit;
export type DepositId = (typeof Deposit)[DepositKey];
export const DEPOSIT_COUNT = 15;

export const Good = {
  FOOD: 0,
  WOOD: 1,
  STONE: 2,
  COPPER: 3,
  TIN: 4,
  IRON: 5,
  GOLD: 6,
  COAL: 7,
  OIL: 8,
  GAS: 9,
  URANIUM: 10,
  RARE: 11,
  METAL: 12, // worked metal: bronze -> iron -> steel -> alloys (quality from metalTier)
  GOODS: 13, // consumer manufactures (pottery, textiles ... appliances)
  LUXURY: 14, // jewelry, spices, furs, fine goods
  MACHINERY: 15, // capital goods
  ARMS: 16, // military equipment
  ELECTRONICS: 17,
  ENERGY: 18, // electricity (not storable; produced and consumed each month)
  HORSES: 19, // domesticated mounts / draft animals
  EXOTIC: 20,
} as const;
export type GoodKey = keyof typeof Good;
export type GoodId = (typeof Good)[GoodKey];
export const GOOD_COUNT = 21;
export const GOOD_KEYS = Object.keys(Good) as GoodKey[];

export type GoodCategory = 'food' | 'material' | 'strategic' | 'precious' | 'manufactured' | 'energy';

export interface GoodDef {
  id: GoodId;
  key: GoodKey;
  name: string;
  /** Reference price in abstract value units ("crowns", ¤). Real prices float around this with scarcity. */
  basePrice: number;
  category: GoodCategory;
  /** Fraction of the stock lost per year in storage (before preservation technology). */
  spoilage: number;
  storable: boolean;
}

export const GOODS: readonly GoodDef[] = [
  { id: 0, key: 'FOOD', name: 'Food', basePrice: 1, category: 'food', spoilage: 0.35, storable: true },
  { id: 1, key: 'WOOD', name: 'Timber', basePrice: 1.2, category: 'material', spoilage: 0.05, storable: true },
  { id: 2, key: 'STONE', name: 'Stone', basePrice: 1.0, category: 'material', spoilage: 0, storable: true },
  { id: 3, key: 'COPPER', name: 'Copper', basePrice: 4, category: 'strategic', spoilage: 0, storable: true },
  { id: 4, key: 'TIN', name: 'Tin', basePrice: 6, category: 'strategic', spoilage: 0, storable: true },
  { id: 5, key: 'IRON', name: 'Iron ore', basePrice: 3, category: 'strategic', spoilage: 0, storable: true },
  { id: 6, key: 'GOLD', name: 'Gold', basePrice: 30, category: 'precious', spoilage: 0, storable: true },
  { id: 7, key: 'COAL', name: 'Coal', basePrice: 2, category: 'strategic', spoilage: 0, storable: true },
  { id: 8, key: 'OIL', name: 'Petroleum', basePrice: 5, category: 'strategic', spoilage: 0, storable: true },
  { id: 9, key: 'GAS', name: 'Natural gas', basePrice: 4, category: 'strategic', spoilage: 0, storable: true },
  { id: 10, key: 'URANIUM', name: 'Uranium', basePrice: 40, category: 'strategic', spoilage: 0, storable: true },
  { id: 11, key: 'RARE', name: 'Rare metals', basePrice: 25, category: 'strategic', spoilage: 0, storable: true },
  { id: 12, key: 'METAL', name: 'Metal', basePrice: 6, category: 'manufactured', spoilage: 0.01, storable: true },
  { id: 13, key: 'GOODS', name: 'Consumer goods', basePrice: 5, category: 'manufactured', spoilage: 0.05, storable: true },
  { id: 14, key: 'LUXURY', name: 'Luxuries', basePrice: 20, category: 'manufactured', spoilage: 0.03, storable: true },
  { id: 15, key: 'MACHINERY', name: 'Machinery', basePrice: 18, category: 'manufactured', spoilage: 0.04, storable: true },
  { id: 16, key: 'ARMS', name: 'Arms', basePrice: 12, category: 'manufactured', spoilage: 0.04, storable: true },
  { id: 17, key: 'ELECTRONICS', name: 'Electronics', basePrice: 40, category: 'manufactured', spoilage: 0.06, storable: true },
  { id: 18, key: 'ENERGY', name: 'Electricity', basePrice: 2, category: 'energy', spoilage: 1, storable: false },
  { id: 19, key: 'HORSES', name: 'Horses', basePrice: 8, category: 'strategic', spoilage: 0.08, storable: true },
  { id: 20, key: 'EXOTIC', name: 'Exotic matter', basePrice: 200, category: 'precious', spoilage: 0, storable: true },
];

export interface DepositDef {
  id: DepositId;
  key: DepositKey;
  name: string;
  /** Good produced when worked. */
  good: GoodId;
  /** Capability that must be > 0 for the civ to extract it (see technology/types.ts CapKey). */
  extractCap: string;
  /** Renewable deposits regrow toward their initial amount; finite ones deplete. */
  renewable: boolean;
  /** Units of good produced per worked tile per year at base productivity. */
  baseYield: number;
  /** Initial amount range (in units of good). */
  amount: [number, number];
  /** Deposit on water tiles (fish) instead of land. */
  water?: boolean;
}

export const DEPOSITS: readonly DepositDef[] = [
  { id: 0, key: 'NONE', name: 'None', good: Good.FOOD, extractCap: 'never', renewable: true, baseYield: 0, amount: [0, 0] },
  { id: 1, key: 'COPPER', name: 'Copper', good: Good.COPPER, extractCap: 'mining', renewable: false, baseYield: 60, amount: [6000, 16000] },
  { id: 2, key: 'TIN', name: 'Tin', good: Good.TIN, extractCap: 'mining', renewable: false, baseYield: 40, amount: [3000, 9000] },
  { id: 3, key: 'IRON', name: 'Iron', good: Good.IRON, extractCap: 'mining', renewable: false, baseYield: 80, amount: [12000, 40000] },
  { id: 4, key: 'GOLD', name: 'Gold', good: Good.GOLD, extractCap: 'mining', renewable: false, baseYield: 6, amount: [600, 2000] },
  { id: 5, key: 'GEMS', name: 'Gems', good: Good.LUXURY, extractCap: 'mining', renewable: false, baseYield: 10, amount: [800, 2400] },
  { id: 6, key: 'COAL', name: 'Coal', good: Good.COAL, extractCap: 'deepMining', renewable: false, baseYield: 150, amount: [30000, 90000] },
  { id: 7, key: 'OIL', name: 'Oil', good: Good.OIL, extractCap: 'oilExtraction', renewable: false, baseYield: 120, amount: [20000, 80000] },
  { id: 8, key: 'GAS', name: 'Natural gas', good: Good.GAS, extractCap: 'oilExtraction', renewable: false, baseYield: 120, amount: [20000, 70000] },
  { id: 9, key: 'URANIUM', name: 'Uranium', good: Good.URANIUM, extractCap: 'uraniumMining', renewable: false, baseYield: 8, amount: [1500, 5000] },
  { id: 10, key: 'RARE', name: 'Rare metals', good: Good.RARE, extractCap: 'rareExtraction', renewable: false, baseYield: 12, amount: [1500, 6000] },
  { id: 11, key: 'SPICES', name: 'Spices', good: Good.LUXURY, extractCap: 'farming', renewable: true, baseYield: 10, amount: [400, 800] },
  { id: 12, key: 'FURS', name: 'Furs', good: Good.LUXURY, extractCap: 'forage', renewable: true, baseYield: 8, amount: [300, 700] },
  { id: 13, key: 'FISH', name: 'Fishing grounds', good: Good.FOOD, extractCap: 'forage', renewable: true, baseYield: 0, amount: [100, 255], water: true },
  { id: 14, key: 'EXOTIC', name: 'Exotic matter', good: Good.EXOTIC, extractCap: 'mining', renewable: false, baseYield: 2, amount: [200, 600] },
];
