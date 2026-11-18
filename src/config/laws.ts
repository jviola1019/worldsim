import type { WorldLaws, WorldSettings } from '../sim/types';
import type { WorldGenParams } from '../world/worldgen';
import { DEFAULT_GEN } from '../world/worldgen';
import { mapShape, type MapShape } from '../world/mapShapes';

export const ENGINE_VERSION = '0.1.0';
export const SAVE_VERSION = 1;

export function defaultLaws(): WorldLaws {
  return {
    disasters: true,
    warfare: true,
    rebellions: true,
    migration: true,
    religiousChange: true,
    pollution: true,
    climateChange: true,
    advancedWeapons: true,
    speculativeTech: false,
    fantasyCreatures: false,
    evolution: true,
    resourceDepletion: true,
    diseases: true,
    populationCap: 0,
    researchSpeed: 1,
  };
}

export const LAW_LABELS: Record<keyof WorldLaws, string> = {
  disasters: 'Natural disasters',
  warfare: 'Warfare',
  rebellions: 'Rebellions & revolutions',
  migration: 'Migration',
  religiousChange: 'Religious change',
  pollution: 'Pollution',
  climateChange: 'Climate change',
  advancedWeapons: 'Advanced weapons',
  speculativeTech: 'Speculative technology',
  fantasyCreatures: 'Fantasy creatures',
  evolution: 'Biological evolution',
  resourceDepletion: 'Resource depletion',
  diseases: 'Epidemics',
  populationCap: 'Population cap',
  researchSpeed: 'Research speed',
};

export function defaultSettings(): WorldSettings {
  return {
    biodiversity: 1,
    disasterFrequency: 1,
    aggressiveness: 1,
    techSpeed: 1,
    startEra: 1,
    startCivs: 5,
    fantasy: false,
    realism: 'plausible',
    alien: false,
    empty: false,
  };
}

export interface WorldConfig {
  name: string;
  gen: WorldGenParams;
  settings: WorldSettings;
  laws: WorldLaws;
  scenario?: string;
}

export const WORLD_SIZES = [
  { key: 'small', label: 'Small', w: 128, h: 128 },
  { key: 'medium', label: 'Medium', w: 192, h: 192 },
  { key: 'large', label: 'Large', w: 256, h: 256 },
  { key: 'huge', label: 'Huge (desktop)', w: 320, h: 320 },
] as const;

export interface Preset {
  key: string;
  name: string;
  description: string;
  apply: (c: WorldConfig) => void;
}

export const PRESETS: Preset[] = [
  {
    key: 'realistic',
    name: 'Realistic (observer)',
    description: 'Earth-like world left entirely to itself: grounded technology, no fantasy, natural disasters and diseases on, and no god powers. Watch history happen.',
    apply: (c) => {
      c.settings.startEra = 1;
      c.settings.startCivs = 5;
      c.settings.realism = 'grounded';
      c.settings.fantasy = false;
      c.settings.alien = false;
      c.settings.disasterFrequency = 1;
      c.settings.observer = true;
      c.laws.fantasyCreatures = false;
      c.laws.speculativeTech = false;
      c.laws.disasters = true;
      c.laws.diseases = true;
    },
  },
  {
    key: 'primitive',
    name: 'Primitive Earth',
    description: 'Earth-like continents. A handful of hunter-gatherer bands begin the long road to civilization.',
    apply: (c) => {
      c.settings.startEra = 1;
      c.settings.startCivs = 5;
    },
  },
  {
    key: 'kingdoms',
    name: 'Age of Kingdoms',
    description: 'Bronze- and iron-age kingdoms with towns, temples and rivalries already in place.',
    apply: (c) => {
      c.settings.startEra = 4;
      c.settings.startCivs = 8;
    },
  },
  {
    key: 'industrial',
    name: 'Industrializing World',
    description: 'Gunpowder empires on the brink of the steam age. Coal decides the future.',
    apply: (c) => {
      c.settings.startEra = 7;
      c.settings.startCivs = 8;
      c.gen.resources = 1.1;
    },
  },
  {
    key: 'modern',
    name: 'Modern Geopolitics',
    description: 'Nation-states with industry, alliances and tense borders in the atomic age.',
    apply: (c) => {
      c.settings.startEra = 10;
      c.settings.startCivs = 10;
    },
  },
  {
    key: 'collapse',
    name: 'After the Collapse',
    description: 'A once-advanced world fell apart. Ruins, lost knowledge and scattered survivors.',
    apply: (c) => {
      c.settings.startEra = 3;
      c.settings.startCivs = 9;
      c.scenario = 'collapse';
    },
  },
  {
    key: 'alien',
    name: 'Alien Planet',
    description: 'Violet meadows and crystal spires on a strange world with several intelligent species.',
    apply: (c) => {
      c.gen.alien = true;
      c.settings.alien = true;
      c.settings.fantasy = true;
      c.gen.fantasy = true;
      c.laws.fantasyCreatures = true;
      c.settings.startEra = 1;
      c.settings.startCivs = 6;
    },
  },
  {
    key: 'random',
    name: 'Complete Randomization',
    description: 'Everything rolled at random — geography, climate, history and rules.',
    apply: () => {},
  },
];

/** Geography knobs a map shape may set; reset to defaults when a shape is chosen. */
const SHAPE_KNOBS = ['landmass', 'oceanCoverage', 'fragmentation', 'mountains', 'rivers', 'climateVariation', 'temperature', 'moisture'] as const;

/** Select a map shape: geography knobs go back to defaults, then take the shape's values. */
export function applyMapShape(gen: WorldGenParams, key: MapShape): WorldGenParams {
  const defaults = Object.fromEntries(SHAPE_KNOBS.map((k) => [k, DEFAULT_GEN[k]]));
  return Object.assign(gen, defaults, mapShape(key).knobs, { shape: key });
}

export function defaultConfig(): WorldConfig {
  return {
    name: 'New World',
    gen: { ...DEFAULT_GEN, seed: randomSeedString() },
    settings: defaultSettings(),
    laws: defaultLaws(),
  };
}

export function randomSeedString(): string {
  const words = ['amber', 'basalt', 'cedar', 'dawn', 'ember', 'fjord', 'glade', 'harbor', 'iris', 'jade', 'kestrel', 'lumen', 'meadow', 'nimbus', 'onyx', 'pine', 'quartz', 'river', 'sable', 'tundra', 'umber', 'vale', 'willow', 'zephyr'];
  const r = () => Math.floor(Math.random() * words.length);
  return `${words[r()]}-${words[r()]}-${Math.floor(Math.random() * 1000)}`;
}

/** Fill a config with random values (Complete Randomization preset). Uses Math.random: UI only, never in simulation. */
export function randomizeConfig(c: WorldConfig): void {
  const R = Math.random;
  const lm = ['continents', 'pangaea', 'archipelago', 'islands'] as const;
  c.gen.landmass = lm[Math.floor(R() * lm.length)];
  c.gen.oceanCoverage = 0.35 + R() * 0.45;
  c.gen.fragmentation = R();
  c.gen.mountains = R();
  c.gen.rivers = 0.2 + R() * 0.8;
  c.gen.climateVariation = R();
  c.gen.temperature = R() * 1.4 - 0.7;
  c.gen.moisture = R() * 1.4 - 0.7;
  c.gen.resources = 0.4 + R() * 1.4;
  c.settings.biodiversity = 0.3 + R() * 1.5;
  c.settings.disasterFrequency = R() * 2;
  c.settings.aggressiveness = 0.3 + R() * 1.5;
  c.settings.techSpeed = 0.5 + R() * 2;
  c.settings.startEra = R() < 0.6 ? 1 : 1 + Math.floor(R() * 10);
  c.settings.startCivs = 2 + Math.floor(R() * 12);
  c.settings.fantasy = R() < 0.3;
  c.gen.fantasy = c.settings.fantasy;
  c.laws.fantasyCreatures = c.settings.fantasy;
}
