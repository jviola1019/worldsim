/** World state creation. */
import { normalizeReal } from '../powers/powerSet';
import type { WorldState } from './types';
import type { WorldConfig } from '../config/laws';
import { ENGINE_VERSION, SAVE_VERSION } from '../config/laws';
import { generateWorld, type WorldGenResult } from '../world/worldgen';
import { hashSeed } from '../core/rng';
import { initClimate } from '../world/environment';
import { emptySeries } from '../history/stats';

export const ID_KINDS = [
  'civ', 'settlement', 'person', 'dynasty', 'band', 'herd', 'subspecies', 'monster', 'agent', 'army', 'religion',
  'culture', 'language', 'disease', 'war', 'treaty', 'org', 'route', 'colony', 'event', 'outlet', 'ai', 'league',
] as const;

export function createWorldState(cfg: WorldConfig, gen?: WorldGenResult): WorldState {
  normalizeReal(cfg); // round 10 addendum: real-world worlds never generate fiction
  const g = gen ?? generateWorld(cfg.gen);
  const ids: Record<string, number> = {};
  for (const k of ID_KINDS) ids[k] = 0;
  return {
    meta: {
      name: cfg.name,
      seed: cfg.gen.seed,
      engineVersion: ENGINE_VERSION,
      saveVersion: SAVE_VERSION,
      createdAt: Date.now(),
      startYear: 0,
      latSpan: g.latSpan,
      gen: { ...cfg.gen },
      settings: { ...cfg.settings },
      scenario: cfg.scenario,
    },
    laws: { ...cfg.laws },
    tick: 0,
    rng: hashSeed('sim:' + cfg.gen.seed),
    map: g.map,
    ids,
    civs: new Map(),
    settlements: new Map(),
    persons: new Map(),
    dynasties: new Map(),
    bands: new Map(),
    herds: new Map(),
    subspecies: new Map(),
    monsters: new Map(),
    agents: new Map(),
    armies: new Map(),
    religions: new Map(),
    cultures: new Map(),
    languages: new Map(),
    diseases: new Map(),
    wars: new Map(),
    treaties: new Map(),
    orgs: new Map(),
    routes: new Map(),
    colonies: new Map(),
    outlets: new Map(),
    ais: new Map(),
    leagues: new Map(),
    relations: new Map(),
    events: [],
    stats: { global: emptySeries(), civs: {}, interval: 1, lastSample: -1e9 },
    climate: initClimate({ map: g.map }),
    milestones: {},
    interventions: [],
    knowledge: new Map(),
    speciesStatus: {},
  };
}
