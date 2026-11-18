/**
 * EPOCH world state model.
 *
 * Everything that determines the future of a world lives in WorldState and is
 * serialized into saves. Entities are plain JSON-compatible objects (no class
 * instances), operated on by system functions; this keeps save/load exact and
 * lets systems stay decoupled. Entity maps are keyed by id; JavaScript Map
 * iteration is insertion-ordered, so iteration (and therefore simulation
 * order) is deterministic.
 *
 * Multi-resolution population: small groups (bands, villages below a size
 * threshold) are simulated as INDIVIDUAL persons with ages, parents and traits;
 * larger settlements switch to an aggregate COHORT model (age bands) while
 * notable people (rulers, heirs, generals, scholars, prophets...) remain
 * individuals with biographies.
 */
import type { RngState } from '../core/rng';
import type { TileMap } from '../world/tilemap';
import type { WorldGenParams } from '../world/worldgen';
import type { Caps } from '../technology/types';

export type SpeciesKey = 'human' | 'sylvan' | 'delver' | 'grakk';
export type RealismMode = 'grounded' | 'plausible' | 'unrestricted';

/** Toggleable sandbox rules (spec section 17). */
export interface WorldLaws {
  disasters: boolean;
  warfare: boolean;
  rebellions: boolean;
  migration: boolean;
  religiousChange: boolean;
  pollution: boolean;
  climateChange: boolean;
  advancedWeapons: boolean;
  speculativeTech: boolean;
  fantasyCreatures: boolean;
  evolution: boolean;
  resourceDepletion: boolean;
  diseases: boolean;
  /** Hard cap on total population (0 = unlimited). */
  populationCap: number;
  /** Multiplier on research output. */
  researchSpeed: number;
}

/** World-creation settings that shape the simulation (beyond geography). */
export interface WorldSettings {
  biodiversity: number; // 0..2
  disasterFrequency: number; // 0..2
  aggressiveness: number; // 0..2
  techSpeed: number; // 0.25..4
  startEra: number; // 1..12
  startCivs: number; // 0..24
  fantasy: boolean;
  realism: RealismMode;
  alien: boolean;
  empty: boolean;
  /** Observer mode: god powers are unavailable; history runs only on its own (Realistic preset). */
  observer?: boolean;
}

export interface WorldMeta {
  name: string;
  seed: string;
  engineVersion: string;
  saveVersion: number;
  createdAt: number;
  startYear: number;
  latSpan: number;
  gen: WorldGenParams;
  settings: WorldSettings;
  scenario?: string;
  /** Timeline lineage for branched saves. */
  branchOf?: { name: string; year: number; tick: number };
}

// ---------------------------------------------------------------- people

export type PersonRole =
  | 'commoner'
  | 'chief'
  | 'ruler'
  | 'heir'
  | 'consort'
  | 'general'
  | 'scholar'
  | 'prophet'
  | 'explorer'
  | 'merchant'
  | 'rebel'
  | 'founder'
  | 'religious_leader';

export interface Person {
  id: number;
  name: string;
  /** Family / dynasty name when known. */
  family?: string;
  female: boolean;
  born: number; // year
  died?: number;
  deathCause?: string;
  species: SpeciesKey;
  civId: number;
  settlementId: number; // 0 if in a band
  bandId: number; // 0 if settled
  cultureId: number;
  religionId: number;
  fatherId: number;
  motherId: number;
  spouseId: number;
  children: number[];
  dynastyId: number;
  role: PersonRole;
  /** Occupation for commoners in individual-mode groups. */
  job: string;
  /** Personality trait keys (see population/traits.ts). */
  traits: string[];
  /** Heritable genetic values 0..1: vigor, intellect, temperament, fertility. */
  genes: number[];
  skills: { admin: number; military: number; diplomacy: number; learning: number };
  health: number;
  /** Notable persons are kept after death for history/biographies. */
  notable: boolean;
  titles: string[];
  reigns: { civId: number; start: number; end?: number; title: string }[];
  events: number[];
  /** Development (notables): practice experience per skill. */
  xp?: { admin: number; military: number; diplomacy: number; learning: number };
  /** Accumulated strain 0..1 (wars, losses, illegitimacy); raises mortality, can change traits. */
  stress?: number;
  battles?: number;
  victories?: number;
  /** Life log for biographies: year + what happened (with cause). */
  deeds?: { y: number; t: string }[];
}

export interface Dynasty {
  id: number;
  name: string;
  founderId: number;
  civId: number;
  founded: number;
  members: number[];
  extinct?: number;
}

// ---------------------------------------------------------------- groups

export interface Band {
  id: number;
  civId: number;
  species: SpeciesKey;
  x: number;
  y: number;
  tx: number;
  ty: number;
  members: number[];
  food: number;
  cultureId: number;
  languageId: number;
  religionId: number;
  /** Ticks until the next re-evaluation of the wandering target. */
  think: number;
  founded: number;
}

export interface Herd {
  id: number;
  species: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  count: number;
  hunger: number;
  /** Genes 0..1: size, speed, cold tolerance, aggression, fertility. */
  genes: number[];
  subspeciesId: number;
  /** Civ that domesticated this herd (0 = wild). */
  owner: number;
}

export interface Subspecies {
  id: number;
  species: string;
  name: string;
  parentId: number;
  genes: number[];
  emerged: number;
  extinct?: number;
}

export interface Monster {
  id: number;
  kind: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  hp: number;
  rage: number;
  name: string;
}

export type AgentKind = 'settler' | 'explorer' | 'missionary' | 'refugee' | 'migrant' | 'colonist';

export interface Agent {
  id: number;
  kind: AgentKind;
  civId: number;
  x: number;
  y: number;
  path: number[];
  pathPos: number;
  targetX: number;
  targetY: number;
  fromSettlement: number;
  /** People carried (settlers, refugees, migrants). */
  pop: number;
  cultureId: number;
  religionId: number;
  speciesKey: SpeciesKey;
  /** Person leading the group (explorer, missionary...), 0 if none. */
  leaderId: number;
  ttl: number; // ticks to live
  data?: Record<string, number>;
}

// ---------------------------------------------------------------- settlements

export interface Share {
  id: number;
  f: number; // fraction 0..1
}

export interface Construction {
  type: number; // building id
  tile: number;
  progress: number; // 0..1
  /** Remaining material needs (good id -> amount). */
  need: number[];
  labor: number; // remaining person-years of labor
  upgrade: boolean;
  /** Remaining amount of each good that concrete may still stand in for (fixed when work starts). */
  subLeft?: number[];
}

export interface Epidemic {
  diseaseId: number;
  s: number; // susceptible fraction
  i: number; // infected fraction
  r: number; // recovered/immune fraction
  deaths: number;
}

export interface Settlement {
  /** Cached production-site survey for the current year (see economy/production getSites). Serialized so saves resume exactly. */
  sites?: import("../economy/production").Sites;
  id: number;
  name: string;
  civId: number;
  x: number;
  y: number;
  founded: number;
  founderCiv: number;
  species: SpeciesKey;
  /** 'individual' below a size threshold, 'cohort' above (with hysteresis). */
  mode: 'individual' | 'cohort';
  /** Person ids of residents in individual mode. */
  members: number[];
  /** Population by 5-year age band (17 bands, 80+ last) in cohort mode. */
  cohorts: number[];
  pop: number;
  cultures: Share[];
  religions: Share[];
  /** Local food stock (person-years). */
  food: number;
  housing: number;
  /** Count of each building type controlled by this settlement. */
  bld: number[];
  construction: Construction | null;
  radius: number;
  /** Tiles currently controlled. */
  territory: number;
  education: number; // 0..1 share with schooling
  health: number; // 0..1 general health
  prosperity: number; // living-standard index ~0..2
  unrest: number; // 0..1 local unrest
  loyalty: number; // 0..1 loyalty to the civ
  epidemics: Epidemic[];
  immunity: Record<number, number>;
  /** Market access to the national market (0..1), from transport connectivity. */
  access: number;
  coastal: boolean;
  river: boolean;
  /** Employment by sector (last month), see economy SECTORS. */
  employment: number[];
  /** Production by good (last month, annualized). */
  output: number[];
  /** Occupying civ during war (0 = none). */
  occupiedBy: number;
  wallTier: number;
  garrison: number;
  /** Monthly demographic accounting (annualized, reset yearly). */
  flows: DemographicFlows;
  events: number[];
  capital: boolean;
  /** Years of continuous decline (abandonment pressure). */
  decline: number;
  /** Last tick its territory was recomputed. */
  lastTerritory: number;
  /** Nearest settlements with a trade/road connection (cached ids). */
  links: number[];
  /** Planned land routes to linked settlements (target id -> tile path), kept so road building resumes identically after a load. */
  routes?: Record<number, number[]>;
  /** Household goods (incl. food) consumption value per capita per year, last month (drives service demand). */
  goodsPerCap?: number;
  /** Tick before which construction planning is skipped (set after a pass that found nothing to build). */
  planRetryTick?: number;
  abandoned?: number;
}

export interface DemographicFlows {
  births: number;
  deaths: number;
  famine: number;
  disease: number;
  war: number;
  disaster: number;
  emigration: number;
  immigration: number;
}

// ---------------------------------------------------------------- civs

export interface Institutions {
  centralization: number;
  participation: number; // share of adults with political voice
  competition: number; // electoral competitiveness
  liberties: number;
  ruleOfLaw: number;
  capacity: number; // bureaucratic state capacity
  religiousAuthority: number;
  militaryInfluence: number;
  hereditary: number; // 1 = hereditary succession, 0 = elective
  federalism: number;
  stateEconomy: number; // 0 market .. 1 command
  welfare: number;
  techGovernance: number; // AI-assisted governance (future)
}

export interface Faction {
  key: string; // nobles, clergy, merchants, peasants, workers, military, intelligentsia, technologists, regionalists
  name: string;
  size: number; // share of population
  power: number; // share of political influence
  satisfaction: number; // -1..1
  /** Preferred institution values (partial). */
  ideal: Partial<Institutions>;
  /** For regionalist factions: culture they represent. */
  cultureId?: number;
}

export interface Budget {
  admin: number;
  military: number;
  infrastructure: number;
  education: number;
  health: number;
  research: number;
  welfare: number;
  religion: number;
}

export interface Policies {
  tolerance: 'persecution' | 'state_faith' | 'tolerant' | 'secular';
  migration: 'open' | 'restricted' | 'closed';
  trade: 'free' | 'tariffs' | 'autarky';
  environment: 'none' | 'basic' | 'strict';
  assimilation: 'none' | 'encourage' | 'forced';
  conscription: boolean;
  aiRegulation: 'none' | 'light' | 'strict';
  ubi: boolean;
}

export interface TechState {
  known: boolean;
  progress: number;
  adoption: number;
  year: number; // discovery year (or -1)
  /** Number of independent knowledge carriers lost-risk counter. */
  lost?: number;
}

export interface Personality {
  expansion: number;
  aggression: number;
  trade: number;
  science: number;
  piety: number;
  caution: number;
}

export interface Civ {
  id: number;
  baseName: string;
  adjective: string;
  name: string; // e.g. "Kingdom of Veyra" (recomputed when government changes)
  color: string;
  emblem: { shape: number; symbol: number; c2: string };
  species: SpeciesKey;
  alive: boolean;
  founded: number;
  fell?: number;
  fellCause?: string;
  parentId: number;
  capital: number;
  settlements: number[];
  bands: number[];
  cultureId: number;
  languageId: number;
  stateReligion: number;
  // --- technology
  techs: Record<string, TechState>;
  researchTarget: string;
  researchRate: number;
  caps: Caps;
  /** Building type ids unlocked by adopted technologies. */
  unlocked: number[];
  era: number;
  techScore: number;
  // --- economy (national market)
  stock: number[];
  prices: number[];
  /** Strategic availability per good (0..1): domestic + imports vs needs. */
  access: number[];
  treasury: number;
  debt: number;
  taxRate: number;
  budget: Budget;
  moneySupply: number;
  priceLevel: number;
  inflation: number;
  credit: number; // private leverage index (financial cycle)
  crisis: number; // years remaining of an economic crisis
  econ: EconStats;
  /** Running accumulators for the current year (serialized so mid-year saves are exact). */
  acc: EconAcc;
  /** Last year's market stock value and money supply (for ΔInventory and inflation). */
  prevStockValue?: number; // legacy (pre-0.1 saves); superseded by prevStock
  /** Market stock quantities at the last yearly accounting (for ΔInventories). */
  prevStock?: number[];
  prevMoney?: number;
  /** This year's trade totals (computed at year start, used by the civ's yearly economy). */
  tradeExp?: number;
  /** Cumulative population ledger for this civilization's boundary (see population/ledger.ts). */
  ledger?: import('../population/ledger').PopLedger;
  tradeImp?: number;
  // --- politics
  inst: Institutions;
  govForm: string;
  rulerId: number;
  heirId: number;
  dynastyId: number;
  factions: Faction[];
  legitimacy: number;
  stability: number;
  unrest: number;
  corruption: number;
  warExhaustion: number;
  policies: Policies;
  lastElection: number;
  rulingFaction: string;
  /** Years since last regime change. */
  regimeAge: number;
  // --- military
  armies: number[];
  militaryPower: number;
  mobilization: number; // 0..1 share of manpower mobilized
  nukes: number;
  // --- diplomacy
  overlord: number;
  knownCivs: number[];
  /** Number of tiles known (exploration). */
  knownTiles: number;
  personality: Personality;
  // --- future
  space: SpaceProgram;
  // --- media & AI (absent in saves from before round 4; created on first use)
  media?: CivMedia;
  // --- values and goals (round 5; absent in older saves)
  ethos?: import('../civilizations/ethos').CivEthos;
  mission?: import('../civilizations/missions').Mission;
  missionLog?: { kind: import('../civilizations/missions').MissionKind; start: number; end: number; ok: boolean }[];
  /** Standing from sport, games and spectacle (decays; adds a little legitimacy). */
  prestige?: number;
  // --- bookkeeping
  events: number[];
  lastYearly: number;
  /** Peak population ever (for collapse detection). */
  peakPop: number;
  /** Previous-year values used to explain changes. */
  prev: { pop: number; gdp: number; territory: number };
  population: number;
  territory: number;
}

// ---------------------------------------------------------------- media & AI

/** The medium a civilization's news travels through, by era and technology. */
export type Medium = 'carving' | 'tablet' | 'scroll' | 'broadsheet' | 'newspaper' | 'broadcast' | 'social' | 'holo';

export type OutletKind = 'chronicle' | 'press' | 'newspaper' | 'broadcaster' | 'platform' | 'holonet';

/** A named outlet: chronicle house, printing press, newspaper, broadcaster, social platform or holonet. */
export interface MediaOutlet {
  id: number;
  civId: number;
  kind: OutletKind;
  name: string;
  founded: number;
  closed?: number;
  closedCause?: string;
  /** Settlement it was founded in. */
  settlementId: number;
  /** Share of the nation's people it reaches (0..1). */
  reach: number;
  /** Public trust in it (0..1). */
  trust: number;
  /** State control: state outlets repeat the government line. */
  stateRun: boolean;
  /** Platforms: strength of content moderation (0..1). */
  moderation: number;
  /** Platforms: years since launch drive a rise-and-fade life cycle. */
  peak: number;
}

export type AIRole = 'research' | 'assistant' | 'governance' | 'defense' | 'general';

/** A named artificial-intelligence system built by a lab in a nation. */
export interface AISystem {
  id: number;
  civId: number;
  name: string;
  lab: string;
  version: number;
  role: AIRole;
  founded: number;
  retired?: number;
  status: 'active' | 'retired' | 'shutdown';
  /** Grows with the nation's computing and AI capability. */
  capability: number;
  /** How reliably it does what its operators intend (0..1); regulation raises it. */
  alignment: number;
  /** How much it acts without human sign-off (0..1). */
  autonomy: number;
  incidents: number;
}

/** A civilization's information environment (yearly; serialized). */
export interface CivMedia {
  /** Political polarization (0..1): raises unrest, weakens legitimacy, sharpens elections. */
  polarization: number;
  /** Prevalence of false claims (0..1): undermines public-health compliance and trust. */
  misinformation: number;
  /** Trust in news and institutions (0..1). */
  trust: number;
  /** Press freedom (0..1): exposes corruption; censorship lowers it. */
  freedom: number;
  /** Share of people on social or neural platforms (0..1). */
  online: number;
  /** Combined capability of active AI systems by role. */
  aiResearch: number;
  aiGovernance: number;
  aiDefense: number;
  /** Year of the last AI incident (or -1). */
  lastIncident: number;
  /** Year of the last online protest movement (or -1). */
  lastProtest?: number;
}

export interface EconAcc {
  prod: number[]; // goods produced (units)
  use: number[]; // goods consumed by industry, households, construction, military
  want: number[]; // goods requested (met or not) — reveals unmet demand for trade
  cons: number; // household consumption value
  inv: number; // construction investment value
  va: number; // value added (production side)
  services: number; // services value added
  workers: number; // worker-months
  unemployed: number; // unemployed worker-months
  foodNeed: number;
  foodShort: number;
  energyUse: number;
  emissions: number;
}

export interface EconStats {
  gdp: number;
  gdpPerCapita: number;
  consumption: number;
  investment: number;
  government: number;
  exports: number;
  imports: number;
  revenue: number;
  spending: number;
  unemployment: number;
  inequality: number;
  livingStandard: number;
  energyUse: number;
  emissions: number;
  /** GDP by sector (value added), see economy SECTORS order. */
  sectors: number[];
  laborProductivity: number;
  growth: number;
}

export interface SpaceProgram {
  launches: number;
  satellites: number;
  stations: number;
  lunarBase: boolean;
  colonies: number[];
  orbitalIndustry: number;
  investment: number;
}

export interface Colony {
  id: number;
  civId: number;
  name: string;
  body: 'Moon' | 'Mars' | 'Belt' | 'Orbit' | 'Outer';
  pop: number;
  founded: number;
  independence: number; // drive toward independence 0..1
  /** If it became independent, the new civ id. */
  independentCiv: number;
  output: number;
  cultureId: number;
}

// ---------------------------------------------------------------- culture & belief

export interface CultureValues {
  tradition: number; // -1 open/innovative .. +1 traditional
  collectivism: number;
  martial: number;
  hierarchy: number;
  mercantile: number;
  seafaring: number;
  piety: number;
  nature: number;
}

export interface Culture {
  id: number;
  name: string;
  languageId: number;
  parentId: number;
  founded: number;
  originCiv: number;
  values: CultureValues;
  color: string;
  archStyle: number;
  extinct?: number;
  /** Blended from (for hybrid cultures). */
  blendOf?: [number, number];
}

export interface Phonology {
  onsets: string[];
  vowels: string[];
  codas: string[];
  /** Syllable count weights for names [1,2,3,4]. */
  syll: number[];
  placeSuffix: string[];
  civSuffix: string[];
  personEnd: string[];
}

export interface Language {
  id: number;
  name: string;
  parentId: number;
  rootId: number;
  founded: number;
  phon: Phonology;
  extinct?: number;
}

export interface Religion {
  id: number;
  name: string;
  founded: number;
  founderId: number;
  originSettlement: number;
  originCiv: number;
  holySite: number; // tile index
  parentId: number;
  kind: string; // animism, ancestor, polytheism, monotheism, dualism, philosophy, mystery, cosmism
  deity: string;
  doctrines: string[];
  myth: string;
  color: string;
  symbol: number;
  cohesion: number; // 0..1
  headId: number;
  extinct?: number;
  syncreticOf?: [number, number];
  adherents: number;
}

export interface Disease {
  id: number;
  name: string;
  /** Basic reproduction factor at baseline density/sanitation. */
  r0: number;
  /** Case fatality fraction. */
  lethality: number;
  /** Mean duration in months. */
  duration: number;
  /** Months of immunity after recovery (Infinity-like large = lifelong). */
  immunity: number;
  origin: number; // settlement id
  emerged: number;
  zoonotic: boolean;
  totalDeaths: number;
  ended?: number;
}

// ---------------------------------------------------------------- relations

export type TreatyKind = 'trade' | 'nonaggression' | 'defensive' | 'alliance' | 'vassal' | 'ceasefire' | 'peace' | 'federation' | 'embargo' | 'research' | 'visitors';

export interface Treaty {
  id: number;
  kind: TreatyKind;
  a: number;
  b: number;
  start: number;
  end: number; // year it expires (Infinity -> 1e9)
  active: boolean;
  terms?: string;
}

export interface Relation {
  a: number;
  b: number;
  opinion: number; // -100..100
  trust: number; // 0..1
  contact: number; // year of first contact
  trade: number; // annual trade value
  border: number; // shared border tiles
  disputes: number; // disputed/claimed tiles
  grievAB: number; // grievance of a toward b
  grievBA: number;
  lastWar: number; // year of last war end (-1e9 if never)
  rival: boolean;
  treaties: number[];
}

export interface Cause {
  label: string;
  weight: number;
}

export interface War {
  id: number;
  name: string;
  attackers: number[];
  defenders: number[];
  leaderA: number;
  leaderD: number;
  start: number;
  end?: number;
  goal: string; // conquest, independence, resources, revenge, subjugation, holy, succession, revolution, colonial
  targets: number[]; // target settlement ids
  causes: Cause[];
  score: number; // -100..100 attacker perspective
  casualties: Record<number, number>;
  battles: number;
  outcome?: string;
  nuclear: boolean;
  exhaustionA: number;
  exhaustionD: number;
  occupied: number[]; // settlements occupied during the war
}

export interface Army {
  id: number;
  civId: number;
  kind: 'army' | 'fleet';
  x: number;
  y: number;
  path: number[];
  pathPos: number;
  targetKind: 'none' | 'settlement' | 'army' | 'tile' | 'home';
  targetId: number;
  manpower: number;
  equipment: number; // 0..1 equipment readiness
  training: number; // 0..1
  morale: number; // 0..1
  supply: number; // 0..1
  tier: number; // land or naval tier at raising
  generalId: number;
  warId: number;
  state: 'idle' | 'moving' | 'sieging' | 'battle' | 'retreating' | 'garrison' | 'embarked';
  home: number; // settlement id
  siege: number; // siege progress 0..1
  /** Ticks spent in the current siege (sieges are lifted after ~3 years or when hopeless). */
  siegeTicks?: number;
  /** Settlement whose siege this army last abandoned, and when (prevents march/abandon loops). */
  liftedTarget?: number;
  liftedYear?: number;
  battleWith: number; // army id engaged
  /** Composition weights: infantry, cavalry, artillery, armor, air. */
  comp: number[];
  carried: number; // army id carried (fleets)
  raised: number; // year
}

export interface IntlOrg {
  id: number;
  name: string;
  kind: 'league' | 'trade_bloc' | 'alliance' | 'world_body';
  founded: number;
  founder: number;
  members: number[];
  dissolved?: number;
}

export interface TradeRoute {
  id: number;
  a: number; // settlement
  b: number;
  civA: number;
  civB: number;
  path: number[];
  mode: 'land' | 'sea' | 'mixed';
  length: number;
  cost: number; // per-unit transport cost factor
  capacity: number;
  volume: number; // value traded last year
  flows: number[]; // signed good flows a->b last year
  established: number;
  active: boolean;
  blockedUntil: number;
}

// ---------------------------------------------------------------- history & stats

export type EventCategory =
  | 'founding'
  | 'politics'
  | 'war'
  | 'diplomacy'
  | 'technology'
  | 'religion'
  | 'culture'
  | 'economy'
  | 'disaster'
  | 'demography'
  | 'nature'
  | 'space'
  | 'god';

export interface HistoryEvent {
  id: number;
  tick: number;
  year: number;
  type: string;
  cat: EventCategory;
  title: string;
  text: string;
  civs: number[];
  settlements: number[];
  persons: number[];
  x: number;
  y: number;
  importance: number; // 1 minor .. 5 world-shaking
  causes?: Cause[];
  headline?: string;
  /** How the news travelled when it happened (fixed then; later technology does not rewrite it). */
  medium?: Medium;
}

export interface SeriesStore {
  years: number[];
  data: Record<string, number[]>;
}

export interface StatsStore {
  global: SeriesStore;
  civs: Record<number, SeriesStore>;
  /** Sample interval in years (doubles when the store is decimated). */
  interval: number;
  lastSample: number;
  /** Territory snapshots for the historical-territory overlay: owner per 2×2 block, run-length encoded [owner, count, ...]. */
  territory?: TerritorySnapshot[];
}

export interface TerritorySnapshot {
  year: number;
  w: number;
  h: number;
  rle: number[];
}

export interface ClimateState {
  co2: number; // ppm-equivalent
  baseCo2: number;
  anomaly: number; // global mean temperature anomaly, deg C
  seaLevel: number; // meters of rise
  cellSize: number;
  cellsX: number;
  cellsY: number;
  /** Regional precipitation anomaly per climate cell (-1..1). */
  rain: number[];
  /** Regional temperature anomaly per cell (deg C). */
  heat: number[];
  /** Global cooling from volcanic/impact/nuclear aerosols (deg C, decays). */
  aerosol: number;
  cumulativeEmissions: number;
}

export interface Intervention {
  tick: number;
  power: string;
  x: number;
  y: number;
  r: number;
  arg?: string | number;
  target?: number;
}

export interface Milestones {
  [key: string]: number; // milestone key -> year achieved
}

export interface WorldState {
  meta: WorldMeta;
  laws: WorldLaws;
  tick: number;
  rng: RngState;
  map: TileMap;
  ids: Record<string, number>;
  civs: Map<number, Civ>;
  settlements: Map<number, Settlement>;
  persons: Map<number, Person>;
  dynasties: Map<number, Dynasty>;
  bands: Map<number, Band>;
  herds: Map<number, Herd>;
  subspecies: Map<number, Subspecies>;
  monsters: Map<number, Monster>;
  agents: Map<number, Agent>;
  armies: Map<number, Army>;
  religions: Map<number, Religion>;
  cultures: Map<number, Culture>;
  languages: Map<number, Language>;
  diseases: Map<number, Disease>;
  wars: Map<number, War>;
  treaties: Map<number, Treaty>;
  orgs: Map<number, IntlOrg>;
  routes: Map<number, TradeRoute>;
  colonies: Map<number, Colony>;
  outlets: Map<number, MediaOutlet>;
  ais: Map<number, AISystem>;
  leagues: Map<number, import('../culture/sports').League>;
  /** Postcard layout records every 50 years (absent before round 5). */
  album?: import('../history/album').CitySnapshot[];
  /** World games and cups (absent before round 5). */
  sports?: import('../culture/sports').SportsState;
  relations: Map<string, Relation>;
  events: HistoryEvent[];
  stats: StatsStore;
  climate: ClimateState;
  milestones: Milestones;
  interventions: Intervention[];
  /** Cumulative world population ledger (see population/ledger.ts). */
  popLedger?: import('../population/ledger').PopLedger;
  /** Per-civ known-tile bitsets (exploration / information). */
  knowledge: Map<number, Uint32Array>;
  /** Global species population totals (key -> count) and extinction years. */
  speciesStatus: Record<string, { count: number; extinct?: number; introduced?: number }>;
}
