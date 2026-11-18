/**
 * Civilizations: creation (from bands, splits, secessions or presets),
 * cultures and languages, identity (name, color, emblem), personality, and
 * extinction (kept in history).
 */
import type { Sim } from '../sim/context';
import type { Civ, Culture, CultureValues, Institutions, Language, Personality, SpeciesKey } from '../sim/types';
import { generatePhonology, mutatePhonology, makeName, adjectiveOf } from '../culture/language';
import { uniqueName } from '../culture/naming';
import { clamp, clamp01 } from '../core/math';
import { emptyCaps } from '../technology/types';
import { initTechs, computeCaps } from '../technology/research';
import { GOOD_COUNT, GOODS } from '../world/resources';
import { logEvent } from '../history/events';
import { deriveGovForm, civDisplayName } from '../politics/govforms';
import { TRAIT_BY_KEY } from '../population/traits';
import { revealAround } from './knowledge';

export const CIV_COLORS = [
  '#d64545', '#3f7fd6', '#e0b13a', '#3faa5c', '#9b4fd1', '#e07b39', '#2fb3b3', '#d14f9b', '#8a9c2e', '#5560c8',
  '#b5653b', '#3c9e8a', '#c94f6d', '#8f6bd6', '#d1a23c', '#4f9bd1', '#a83f3f', '#6bb84f', '#c47ad1', '#c9c13c',
  '#3f6e8c', '#8c3f6e', '#5e8c3f', '#d17a5e', '#3fd1a3', '#9a9a9a', '#6e3fd1', '#d13f9e', '#7fb3d1', '#b38f4f',
];

export function createLanguage(sim: Sim, parentId = 0): Language {
  const w = sim.w;
  const parent = parentId ? w.languages.get(parentId) : undefined;
  const phon = parent ? mutatePhonology(sim.rng, parent.phon) : generatePhonology(sim.rng);
  const lang: Language = {
    id: ++w.ids.language,
    name: '',
    parentId,
    rootId: parent ? parent.rootId : 0,
    founded: sim.year,
    phon,
  };
  if (!lang.rootId) lang.rootId = lang.id;
  lang.name = makeName(sim.rng, phon, 'word') + (sim.rng.chance(0.5) ? 'ic' : 'an');
  w.languages.set(lang.id, lang);
  return lang;
}

export function randomValues(sim: Sim, base?: CultureValues, spread = 0.5): CultureValues {
  const r = () => sim.rng.range(-spread, spread);
  const b = base ?? { tradition: 0, collectivism: 0, martial: 0, hierarchy: 0, mercantile: 0, seafaring: 0, piety: 0, nature: 0 };
  return {
    tradition: clamp(b.tradition + r(), -1, 1),
    collectivism: clamp(b.collectivism + r(), -1, 1),
    martial: clamp(b.martial + r(), -1, 1),
    hierarchy: clamp(b.hierarchy + r(), -1, 1),
    mercantile: clamp(b.mercantile + r(), -1, 1),
    seafaring: clamp(b.seafaring + r(), -1, 1),
    piety: clamp(b.piety + r(), -1, 1),
    nature: clamp(b.nature + r(), -1, 1),
  };
}

export function createCulture(sim: Sim, o: { languageId?: number; parentId?: number; originCiv: number; values?: CultureValues; name?: string; color?: string }): Culture {
  const w = sim.w;
  const parent = o.parentId ? w.cultures.get(o.parentId) : undefined;
  const langId = o.languageId ?? createLanguage(sim, parent?.languageId ?? 0).id;
  const lang = w.languages.get(langId)!;
  const name = o.name ?? adjectiveOf(makeName(sim.rng, lang.phon, 'civ'));
  const culture: Culture = {
    id: ++w.ids.culture,
    name,
    languageId: langId,
    parentId: o.parentId ?? 0,
    founded: sim.year,
    originCiv: o.originCiv,
    values: o.values ?? (parent ? randomValues(sim, parent.values, 0.2) : randomValues(sim)),
    color: o.color ?? CIV_COLORS[sim.rng.int(0, CIV_COLORS.length - 1)],
    archStyle: sim.rng.int(0, 3),
  };
  w.cultures.set(culture.id, culture);
  return culture;
}

function pickColor(sim: Sim): string {
  const used = new Map<string, number>();
  for (const c of sim.w.civs.values()) if (c.alive) used.set(c.color, (used.get(c.color) ?? 0) + 1);
  const free = CIV_COLORS.filter((c) => !used.has(c));
  if (free.length) return free[sim.rng.int(0, free.length - 1)];
  return CIV_COLORS[sim.rng.int(0, CIV_COLORS.length - 1)];
}

export function defaultInstitutions(sim: Sim, species: SpeciesKey, values?: CultureValues): Institutions {
  const v = values ?? randomValues(sim, undefined, 0);
  const r = () => sim.rng.range(-0.08, 0.08);
  const inst: Institutions = {
    centralization: clamp01(0.18 + 0.1 * v.hierarchy + r()),
    participation: clamp01(0.3 - 0.1 * v.hierarchy + r()),
    competition: clamp01(0.2 + r()),
    liberties: clamp01(0.4 - 0.1 * v.collectivism + r()),
    ruleOfLaw: clamp01(0.2 + r()),
    capacity: 0.05,
    religiousAuthority: clamp01(0.2 + 0.15 * v.piety + r()),
    militaryInfluence: clamp01(0.2 + 0.15 * v.martial + r()),
    hereditary: clamp01(0.35 + 0.25 * v.hierarchy + r() * 2),
    federalism: clamp01(0.3 + r()),
    stateEconomy: clamp01(0.2 + 0.1 * v.collectivism + r()),
    welfare: 0.05,
    techGovernance: 0,
  };
  if (species === 'grakk') {
    inst.militaryInfluence = clamp01(inst.militaryInfluence + 0.15);
    inst.hereditary = clamp01(inst.hereditary + 0.1);
  } else if (species === 'sylvan') inst.participation = clamp01(inst.participation + 0.1);
  else if (species === 'delver') inst.centralization = clamp01(inst.centralization + 0.1);
  return inst;
}

export interface NewCiv {
  species: SpeciesKey;
  x: number;
  y: number;
  cultureId?: number;
  languageId?: number;
  parentId?: number;
  name?: string;
  inheritFrom?: Civ;
  quiet?: boolean;
  cause?: string;
}

export function createCiv(sim: Sim, o: NewCiv): Civ {
  const w = sim.w;
  const id = ++w.ids.civ;
  let culture = o.cultureId ? w.cultures.get(o.cultureId) : undefined;
  if (!culture) culture = createCulture(sim, { originCiv: id, languageId: o.languageId });
  const lang = w.languages.get(culture.languageId)!;
  const base = o.name ?? uniqueName(sim, () => makeName(sim.rng, lang.phon, 'civ')); // no two nations share a name
  const g = new Array(GOOD_COUNT).fill(0);
  const civ: Civ = {
    id,
    baseName: base,
    adjective: adjectiveOf(base),
    name: base,
    color: pickColor(sim),
    emblem: { shape: sim.rng.int(0, 7), symbol: sim.rng.int(0, 11), c2: CIV_COLORS[sim.rng.int(0, CIV_COLORS.length - 1)] },
    species: o.species,
    alive: true,
    founded: sim.year,
    parentId: o.parentId ?? 0,
    capital: 0,
    settlements: [],
    bands: [],
    cultureId: culture.id,
    languageId: culture.languageId,
    stateReligion: 0,
    techs: {},
    researchTarget: '',
    researchRate: 0,
    caps: emptyCaps(),
    unlocked: [],
    era: 1,
    techScore: 0,
    stock: g.slice(),
    prices: GOODS.map((d) => d.basePrice),
    access: g.slice(),
    treasury: 0,
    debt: 0,
    taxRate: 0.06,
    budget: { admin: 0.25, military: 0.22, infrastructure: 0.15, education: 0.05, health: 0.05, research: 0.05, welfare: 0.03, religion: 0.2 },
    moneySupply: 0,
    priceLevel: 1,
    inflation: 0,
    credit: 0,
    crisis: 0,
    econ: { gdp: 0, gdpPerCapita: 0, consumption: 0, investment: 0, government: 0, exports: 0, imports: 0, revenue: 0, spending: 0, unemployment: 0, inequality: 0.3, livingStandard: 1, energyUse: 0, emissions: 0, sectors: [0, 0, 0, 0, 0, 0], laborProductivity: 0, growth: 0 },
    acc: { prod: g.slice(), use: g.slice(), want: g.slice(), cons: 0, inv: 0, va: 0, services: 0, workers: 0, unemployed: 0, foodNeed: 0, foodShort: 0, energyUse: 0, emissions: 0 },
    inst: defaultInstitutions(sim, o.species, culture.values),
    govForm: 'band',
    rulerId: 0,
    heirId: 0,
    dynastyId: 0,
    factions: [],
    legitimacy: 0.6,
    stability: 0.7,
    unrest: 0,
    corruption: 0.1,
    warExhaustion: 0,
    policies: { tolerance: 'tolerant', migration: 'open', trade: 'tariffs', environment: 'none', assimilation: 'encourage', conscription: false, aiRegulation: 'none', ubi: false },
    lastElection: sim.year,
    rulingFaction: '',
    regimeAge: 0,
    armies: [],
    militaryPower: 0,
    mobilization: 0,
    nukes: 0,
    overlord: 0,
    knownCivs: [],
    knownTiles: 0,
    personality: { expansion: 0.5, aggression: 0.4, trade: 0.5, science: 0.5, piety: 0.5, caution: 0.5 },
    space: { launches: 0, satellites: 0, stations: 0, lunarBase: false, colonies: [], orbitalIndustry: 0, investment: 0 },
    events: [],
    lastYearly: -1,
    peakPop: 0,
    prev: { pop: 0, gdp: 0, territory: 0 },
    population: 0,
    territory: 0,
  };
  if (o.inheritFrom) {
    // a successor state keeps its parent's knowledge and institutions (with drift)
    const p = o.inheritFrom;
    for (const [k, st] of Object.entries(p.techs)) civ.techs[k] = { ...st };
    civ.inst = { ...p.inst };
    civ.policies = { ...p.policies };
    civ.budget = { ...p.budget };
    civ.stateReligion = p.stateReligion;
    civ.taxRate = p.taxRate;
    computeCaps(civ);
  } else initTechs(civ);
  civ.personality = personalityOf(sim, civ);
  civ.govForm = deriveGovForm(civ, 0);
  civ.name = civDisplayName(civ);
  w.civs.set(civ.id, civ);
  w.knowledge.set(civ.id, new Uint32Array(Math.ceil(w.map.n / 32)));
  revealAround(sim, civ, o.x, o.y, 9);
  if (!o.quiet)
    logEvent(sim, {
      type: 'civ_founded',
      cat: 'founding',
      title: `The ${civ.adjective} people emerged as a distinct society`,
      civs: [civ.id],
      x: o.x,
      y: o.y,
      importance: 3,
      causes: o.cause ? [{ label: o.cause, weight: 1 }] : undefined,
    });
  return civ;
}

/** Decision weights from culture values, ruler traits and world aggressiveness. */
export function personalityOf(sim: Sim, civ: Civ): Personality {
  const v = sim.w.cultures.get(civ.cultureId)?.values;
  const p: Personality = {
    expansion: 0.45 + (v ? 0.15 * v.martial + 0.1 * v.collectivism : 0),
    aggression: 0.35 + (v ? 0.25 * v.martial - 0.1 * v.mercantile : 0),
    trade: 0.4 + (v ? 0.35 * v.mercantile + 0.15 * v.seafaring : 0),
    science: 0.45 - (v ? 0.25 * v.tradition : 0),
    piety: 0.4 + (v ? 0.4 * v.piety : 0),
    caution: 0.5 + (v ? 0.15 * v.tradition : 0),
  };
  const ruler = sim.w.persons.get(civ.rulerId);
  if (ruler) {
    for (const t of ruler.traits) {
      const lead = TRAIT_BY_KEY[t]?.lead;
      if (!lead) continue;
      for (const k of Object.keys(p) as (keyof Personality)[]) p[k] += (lead as Record<string, number>)[k] ?? 0;
    }
  }
  p.aggression *= sim.w.meta.settings.aggressiveness;
  for (const k of Object.keys(p) as (keyof Personality)[]) p[k] = clamp(p[k], 0.02, 1.5);
  return p;
}

export function killCiv(sim: Sim, civ: Civ, cause: string, by?: Civ): void {
  if (!civ.alive) return;
  civ.alive = false;
  civ.fell = sim.year;
  civ.fellCause = cause;
  civ.capital = 0;
  const ruler = sim.w.persons.get(civ.rulerId);
  if (ruler) for (const r of ruler.reigns) if (r.civId === civ.id && r.end === undefined) r.end = sim.year;
  for (const t of sim.w.treaties.values()) if (t.active && (t.a === civ.id || t.b === civ.id)) t.active = false;
  for (const aid of civ.armies) sim.w.armies.delete(aid);
  civ.armies = [];
  logEvent(sim, {
    type: 'civ_fell',
    cat: 'politics',
    title: `${civ.name} has fallen`,
    text: by ? `It was absorbed by ${by.name}.` : cause,
    civs: by ? [civ.id, by.id] : [civ.id],
    importance: civ.peakPop > 50000 ? 4 : 3,
    causes: [{ label: cause, weight: 1 }],
  });
}
