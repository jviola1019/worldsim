/**
 * Animal species. Habitat suitability, diet and growth parameters are
 * stylized; predator–prey coupling follows Lotka–Volterra-style dynamics
 * (prey growth limited by vegetation, predators by prey encounters).
 */
import { T } from '../world/terrain';

export interface SpeciesDef {
  key: string;
  name: string;
  sprite: string;
  diet: 'herbivore' | 'predator' | 'omnivore';
  /** Terrain ids with good habitat. */
  biomes: number[];
  temp: [number, number];
  /** Food yielded per individual when hunted (person-years). */
  meat: number;
  /** Movement in tiles per tick. */
  speed: number;
  maxHerd: number;
  start: [number, number];
  /** Max annual growth rate in good conditions. */
  growth: number;
  /** Vegetation consumed per individual per month (0..255 scale summed over tiles). */
  graze: number;
  domesticable: boolean;
  /** Danger to people (0..1). */
  danger: number;
  aquatic?: boolean;
  flying?: boolean;
  /** Only placed at world start in prehistoric eras (megafauna). */
  megafauna?: boolean;
  /** Predators: share of a warm-blooded predator's monthly prey need (default 1). Task 5: cold-blooded hunters eat far less
   *  for their size: wild juvenile Nile crocodiles 0.2-0.5% of body mass a day (Okavango), wolves about 6% (Minnesota
   *  winter); research-notes.md §1. */
  upkeep?: number;
  /** Task 8 part C: a land predator that also takes fish shoals from the water in its territory. Nile crocodiles live
   *  mainly on fish until they are large (Okavango stomach study, research-notes.md §1); without fish they competed with
   *  wolves and great cats for land prey and were lost in 18 of 30 hand-placed drops. */
  fishes?: boolean;
  alien?: boolean;
}

const G = [T.GRASS, T.STEPPE, T.SAVANNA];
// Task 8 part C: the great cat stands for lion, tiger, leopard and jaguar; three of the four are forest animals (IUCN Red
// List habitat accounts), so warm forest is its home ground too. Without it, cats dropped on cold grass beside forest
// lost their prey to wolves living in that forest (research-notes.md §1).
const FOREST = [T.FOREST, T.TAIGA, T.JUNGLE, T.HILLS];

export const SPECIES: SpeciesDef[] = [
  { key: 'deer', name: 'Deer', sprite: 'ani.deer', diet: 'herbivore', biomes: [T.FOREST, T.GRASS, T.HILLS, T.TAIGA], temp: [-8, 26], meat: 0.12, speed: 0.07, maxHerd: 40, start: [8, 24], growth: 0.35, graze: 0.25, domesticable: false, danger: 0 },
  { key: 'elk', name: 'Elk', sprite: 'ani.elk', diet: 'herbivore', biomes: [T.TAIGA, T.TUNDRA, T.FOREST], temp: [-20, 14], meat: 0.25, speed: 0.06, maxHerd: 30, start: [6, 18], growth: 0.25, graze: 0.4, domesticable: false, danger: 0.05 },
  { key: 'bison', name: 'Bison', sprite: 'ani.bison', diet: 'herbivore', biomes: [T.STEPPE, T.GRASS], temp: [-12, 24], meat: 0.45, speed: 0.05, maxHerd: 80, start: [20, 50], growth: 0.22, graze: 0.6, domesticable: false, danger: 0.05 },
  { key: 'horse', name: 'Wild horse', sprite: 'ani.horse', diet: 'herbivore', biomes: [T.STEPPE, T.GRASS, T.SAVANNA], temp: [-10, 28], meat: 0.25, speed: 0.1, maxHerd: 50, start: [10, 30], growth: 0.25, graze: 0.45, domesticable: true, danger: 0 },
  { key: 'goat', name: 'Wild goat', sprite: 'ani.goat', diet: 'herbivore', biomes: [T.HILLS, T.MOUNTAIN, T.STEPPE], temp: [-10, 28], meat: 0.06, speed: 0.06, maxHerd: 40, start: [8, 22], growth: 0.4, graze: 0.15, domesticable: true, danger: 0 },
  { key: 'sheep', name: 'Wild sheep', sprite: 'ani.sheep', diet: 'herbivore', biomes: [T.HILLS, T.STEPPE, T.GRASS], temp: [-12, 24], meat: 0.06, speed: 0.05, maxHerd: 50, start: [10, 26], growth: 0.38, graze: 0.15, domesticable: true, danger: 0 },
  { key: 'cow', name: 'Aurochs', sprite: 'ani.cow', diet: 'herbivore', biomes: [T.GRASS, T.FOREST, T.SAVANNA], temp: [-4, 28], meat: 0.5, speed: 0.04, maxHerd: 40, start: [8, 20], growth: 0.2, graze: 0.6, domesticable: true, danger: 0.08 },
  { key: 'boar', name: 'Boar', sprite: 'ani.boar', diet: 'omnivore', biomes: [T.FOREST, T.JUNGLE, T.SWAMP], temp: [-6, 32], meat: 0.1, speed: 0.06, maxHerd: 30, start: [6, 18], growth: 0.5, graze: 0.2, domesticable: true, danger: 0.1 },
  { key: 'chicken', name: 'Junglefowl', sprite: 'ani.chicken', diet: 'herbivore', biomes: [T.JUNGLE, T.FOREST, T.SAVANNA], temp: [14, 36], meat: 0.01, speed: 0.05, maxHerd: 60, start: [15, 40], growth: 0.9, graze: 0.02, domesticable: true, danger: 0 },
  { key: 'camel', name: 'Camel', sprite: 'ani.camel', diet: 'herbivore', biomes: [T.DESERT, T.STEPPE, T.SAVANNA], temp: [0, 40], meat: 0.35, speed: 0.06, maxHerd: 30, start: [6, 16], growth: 0.15, graze: 0.2, domesticable: true, danger: 0 },
  { key: 'rabbit', name: 'Hare', sprite: 'ani.rabbit', diet: 'herbivore', biomes: [T.GRASS, T.STEPPE, T.TUNDRA, T.FOREST], temp: [-20, 30], meat: 0.005, speed: 0.08, maxHerd: 120, start: [30, 80], growth: 1.2, graze: 0.02, domesticable: false, danger: 0 },
  { key: 'mammoth', name: 'Mammoth', sprite: 'ani.mammoth', diet: 'herbivore', biomes: [T.TUNDRA, T.STEPPE, T.TAIGA, T.SNOW], temp: [-30, 8], meat: 3, speed: 0.035, maxHerd: 20, start: [4, 12], growth: 0.06, graze: 1.6, domesticable: false, danger: 0.15, megafauna: true },
  { key: 'crocodile', name: 'Crocodile', sprite: 'ani.crocodile', diet: 'predator', biomes: [T.SWAMP, T.JUNGLE], temp: [18, 40], meat: 0.2, speed: 0.03, maxHerd: 10, start: [2, 6], growth: 0.12, graze: 0, domesticable: false, danger: 0.4, upkeep: 0.1, fishes: true },
  { key: 'wolf', name: 'Wolf', sprite: 'ani.wolf', diet: 'predator', biomes: [T.FOREST, T.TAIGA, T.STEPPE, T.TUNDRA, T.HILLS], temp: [-30, 26], meat: 0.05, speed: 0.09, maxHerd: 14, start: [4, 10], growth: 0.3, graze: 0, domesticable: true, danger: 0.3 },
  { key: 'bear', name: 'Bear', sprite: 'ani.bear', diet: 'omnivore', biomes: [T.FOREST, T.TAIGA, T.HILLS, T.MOUNTAIN], temp: [-25, 22], meat: 0.4, speed: 0.05, maxHerd: 4, start: [1, 3], growth: 0.12, graze: 0.3, domesticable: false, danger: 0.5 },
  { key: 'bigcat', name: 'Great cat', sprite: 'ani.bigcat', diet: 'predator', biomes: [T.SAVANNA, T.JUNGLE, T.GRASS, T.FOREST], temp: [12, 38], meat: 0.15, speed: 0.08, maxHerd: 8, start: [2, 6], growth: 0.2, graze: 0, domesticable: false, danger: 0.6 },
  { key: 'penguin', name: 'Penguin', sprite: 'ani.penguin', diet: 'herbivore', biomes: [T.SNOW, T.GLACIER, T.TUNDRA, T.BEACH], temp: [-40, 4], meat: 0.04, speed: 0.04, maxHerd: 80, start: [20, 60], growth: 0.25, graze: 0, domesticable: false, danger: 0 },
  { key: 'fish', name: 'Fish shoal', sprite: 'ani.fish', diet: 'herbivore', biomes: [T.SHALLOW, T.LAKE, T.OCEAN], temp: [-4, 32], meat: 0.01, speed: 0.06, maxHerd: 300, start: [80, 200], growth: 0.8, graze: 0, domesticable: false, danger: 0, aquatic: true },
  { key: 'whale', name: 'Whale', sprite: 'ani.whale', diet: 'herbivore', biomes: [T.DEEP, T.OCEAN], temp: [-4, 30], meat: 5, speed: 0.07, maxHerd: 8, start: [2, 6], growth: 0.05, graze: 0, domesticable: false, danger: 0, aquatic: true },
  { key: 'bird', name: 'Birds', sprite: 'ani.bird', diet: 'herbivore', biomes: [...G, ...FOREST, T.SWAMP, T.BEACH], temp: [-15, 38], meat: 0.002, speed: 0.12, maxHerd: 60, start: [15, 40], growth: 0.9, graze: 0, domesticable: false, danger: 0, flying: true },
  // round 10 addendum: real species that fill biome gaps; growth from docs/data/round10/research-notes.md
  { key: 'elephant', name: 'Elephant', sprite: 'ani.elephant', diet: 'herbivore', biomes: [T.SAVANNA, T.JUNGLE, T.GRASS], temp: [14, 40], meat: 3, speed: 0.04, maxHerd: 25, start: [6, 14], growth: 0.07, graze: 1.4, domesticable: false, danger: 0.15 },
  { key: 'buffalo', name: 'Water buffalo', sprite: 'ani.buffalo', diet: 'herbivore', biomes: [T.SWAMP, T.GRASS, T.JUNGLE], temp: [10, 38], meat: 0.5, speed: 0.04, maxHerd: 40, start: [8, 20], growth: 0.12, graze: 0.6, domesticable: true, danger: 0.1 },
  { key: 'llama', name: 'Llama', sprite: 'ani.llama', diet: 'herbivore', biomes: [T.MOUNTAIN, T.HILLS, T.STEPPE], temp: [-15, 25], meat: 0.1, speed: 0.06, maxHerd: 30, start: [6, 18], growth: 0.15, graze: 0.15, domesticable: true, danger: 0 },
  { key: 'seal', name: 'Seals', sprite: 'ani.seal', diet: 'predator', biomes: [T.SHALLOW, T.OCEAN], temp: [-30, 16], meat: 0.15, speed: 0.05, maxHerd: 60, start: [10, 30], growth: 0.1, graze: 0, domesticable: false, danger: 0, aquatic: true },
  { key: 'alienbeast', name: 'Glimmerback', sprite: 'ani.alienbeast', diet: 'herbivore', biomes: [T.ALIEN, T.ALIEN_GRASS, T.CRYSTAL], temp: [-20, 40], meat: 0.3, speed: 0.05, maxHerd: 40, start: [8, 20], growth: 0.3, graze: 0.4, domesticable: true, danger: 0.05, alien: true },
  { key: 'alienflyer', name: 'Veilwing', sprite: 'ani.alienflyer', diet: 'predator', biomes: [T.ALIEN, T.ALIEN_GRASS], temp: [-20, 40], meat: 0.1, speed: 0.1, maxHerd: 10, start: [3, 8], growth: 0.25, graze: 0, domesticable: false, danger: 0.3, flying: true, alien: true },
];

export const SPECIES_BY_KEY: Record<string, SpeciesDef> = Object.fromEntries(SPECIES.map((s) => [s.key, s]));

export interface MonsterDef {
  kind: string;
  name: string;
  sprite: string;
  hp: number;
  speed: number;
  biomes: number[];
  aquatic?: boolean;
  flying?: boolean;
  /** People killed per attack at full strength. */
  harm: number;
}

export const MONSTERS: MonsterDef[] = [
  { kind: 'dragon', name: 'Dragon', sprite: 'mon.dragon', hp: 400, speed: 0.12, biomes: [T.MOUNTAIN, T.VOLCANIC, T.HILLS], flying: true, harm: 60 },
  { kind: 'giant', name: 'Giant', sprite: 'mon.giant', hp: 220, speed: 0.04, biomes: [T.HILLS, T.MOUNTAIN, T.TUNDRA], harm: 25 },
  { kind: 'wyrm', name: 'Sand wyrm', sprite: 'mon.wyrm', hp: 260, speed: 0.05, biomes: [T.DESERT], harm: 35 },
  { kind: 'kraken', name: 'Kraken', sprite: 'mon.kraken', hp: 350, speed: 0.05, biomes: [T.DEEP, T.OCEAN], aquatic: true, harm: 30 },
  { kind: 'treant', name: 'Treant', sprite: 'mon.treant', hp: 180, speed: 0.03, biomes: [T.FOREST, T.JUNGLE, T.TAIGA], harm: 10 },
  { kind: 'spirit', name: 'Restless spirit', sprite: 'mon.spirit', hp: 120, speed: 0.06, biomes: [T.SWAMP, T.CORRUPT, T.TUNDRA], flying: true, harm: 12 },
  { kind: 'slime', name: 'Great slime', sprite: 'mon.slime', hp: 90, speed: 0.03, biomes: [T.SWAMP, T.JUNGLE, T.CORRUPT], harm: 6 },
];
