/**
 * Scenario worlds: preset configurations with OPTIONAL objectives. Objectives
 * are checked against real simulation state; they never change the rules and
 * the sandbox continues after they are met.
 */
import type { WorldConfig } from '../config/laws';
import type { Sim } from '../sim/context';

export interface Objective {
  id: string;
  label: string;
  check: (sim: Sim) => boolean;
}

export interface Scenario {
  key: string;
  name: string;
  description: string;
  apply: (c: WorldConfig) => void;
  objectives: Objective[];
}

const anyCivKnows = (sim: Sim, tech: string) => [...sim.w.civs.values()].some((c) => c.alive && c.techs[tech]?.known);

export const SCENARIOS: Scenario[] = [
  {
    key: 'cradles',
    name: 'Cradles of Civilization',
    description: 'A dry world where life clings to great rivers. Will farming and writing arise in the valleys?',
    apply: (c) => {
      c.gen.moisture = -0.6;
      c.gen.rivers = 0.95;
      c.gen.landmass = 'pangaea';
      c.gen.oceanCoverage = 0.45;
      c.settings.startEra = 1;
      c.settings.startCivs = 6;
      c.scenario = 'cradles';
    },
    objectives: [
      { id: 'agri', label: 'A people discovers agriculture', check: (s) => anyCivKnows(s, 'agriculture') },
      { id: 'writing', label: 'Writing is invented', check: (s) => anyCivKnows(s, 'writing') },
      { id: 'city', label: 'A settlement reaches 10,000 people', check: (s) => [...s.w.settlements.values()].some((x) => x.pop >= 10000) },
    ],
  },
  {
    key: 'islands',
    name: 'Island Realms',
    description: 'Scattered islands. Seafaring decides who thrives.',
    apply: (c) => {
      c.gen.landmass = 'archipelago';
      c.gen.oceanCoverage = 0.72;
      c.settings.startEra = 2;
      c.settings.startCivs = 8;
      c.scenario = 'islands';
    },
    objectives: [
      { id: 'sail', label: 'Ocean navigation is mastered', check: (s) => anyCivKnows(s, 'navigation') },
      { id: 'sea_trade', label: 'A sea trade route opens', check: (s) => [...s.w.routes.values()].some((r) => r.mode === 'sea' && r.active) },
    ],
  },
  {
    key: 'standoff',
    name: 'The Long Standoff',
    description: 'Rival industrial powers on the brink of the atomic age. Can the world avoid catastrophe?',
    apply: (c) => {
      c.settings.startEra = 10;
      c.settings.startCivs = 6;
      c.settings.aggressiveness = 1.4;
      c.scenario = 'standoff';
    },
    objectives: [
      { id: 'org', label: 'An international organization is founded', check: (s) => s.w.orgs.size > 0 },
      { id: 'no_nukes', label: '100 years pass without a nuclear strike', check: (s) => s.year - s.w.meta.startYear >= 100 && !s.w.events.some((e) => e.type === 'nuclear_strike' || e.type === 'god_nuke') },
    ],
  },
  {
    key: 'space_race',
    name: 'Space Race',
    description: 'Digital-age nations with rockets on the pad. Who settles another world first?',
    apply: (c) => {
      c.settings.startEra = 11;
      c.settings.startCivs = 5;
      c.settings.realism = 'unrestricted';
      c.laws.speculativeTech = true;
      c.scenario = 'space_race';
    },
    objectives: [
      { id: 'station', label: 'A space station is built', check: (s) => [...s.w.civs.values()].some((c) => c.space.stations > 0) },
      { id: 'colony', label: 'A permanent off-world colony is founded', check: (s) => s.w.colonies.size > 0 },
    ],
  },
  {
    key: 'fantasy',
    name: 'Realms of Legend',
    description: 'Humans, Sylvans, Delvers and Grakk share a land of monsters and crystal fields.',
    apply: (c) => {
      c.settings.fantasy = true;
      c.gen.fantasy = true;
      c.laws.fantasyCreatures = true;
      c.settings.startEra = 1;
      c.settings.startCivs = 8;
      c.scenario = 'fantasy';
    },
    objectives: [{ id: 'slay', label: 'A monster is slain by a settlement', check: (s) => s.w.events.some((e) => e.type === 'monster_slain') }],
  },
];

export function scenarioObjectives(key?: string): Objective[] {
  return SCENARIOS.find((s) => s.key === key)?.objectives ?? [];
}
