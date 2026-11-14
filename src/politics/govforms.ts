/**
 * Government forms are LABELS derived from a continuous institution vector
 * (see Institutions in sim/types.ts) plus scale and era. Two "democracies" can
 * differ widely in competitiveness, liberties or corruption — the label only
 * summarizes. Forms are never unlocked by a timer.
 */
import type { Civ } from '../sim/types';

export type GovFormKey =
  | 'band'
  | 'tribe'
  | 'chiefdom'
  | 'monarchy'
  | 'empire'
  | 'city_state'
  | 'republic'
  | 'oligarchy'
  | 'democracy'
  | 'constitutional_monarchy'
  | 'federation'
  | 'theocracy'
  | 'junta'
  | 'dictatorship'
  | 'one_party'
  | 'technocracy'
  | 'network_commonwealth';

export interface GovFormDef {
  label: string;
  title: [string, string]; // [male/neutral, female]
  name: (base: string, adj: string) => string;
  description: string;
}

export const GOV_FORMS: Record<GovFormKey, GovFormDef> = {
  band: { label: 'Wandering band', title: ['Elder', 'Elder'], name: (b, a) => `${a} Band`, description: 'A mobile kin group led informally by elders.' },
  tribe: { label: 'Tribal council', title: ['Chieftain', 'Chieftain'], name: (b, a) => `${a} Tribe`, description: 'Decisions by a council of elders; leadership by consent.' },
  chiefdom: { label: 'Chiefdom', title: ['Chief', 'Chief'], name: (b) => `${b} Chiefdom`, description: 'A paramount chief rules several villages; rank is often inherited.' },
  monarchy: { label: 'Monarchy', title: ['King', 'Queen'], name: (b) => `Kingdom of ${b}`, description: 'Hereditary rulers with centralized authority.' },
  empire: { label: 'Empire', title: ['Emperor', 'Empress'], name: (b, a) => `${a} Empire`, description: 'A large multi-ethnic realm under hereditary rule.' },
  city_state: { label: 'City-state', title: ['Archon', 'Archon'], name: (b) => `City-State of ${b}`, description: 'A single dominant city and its hinterland.' },
  republic: { label: 'Republic', title: ['Consul', 'Consul'], name: (b) => `Republic of ${b}`, description: 'Elected magistrates; participation limited to an elite.' },
  oligarchy: { label: 'Oligarchy', title: ['Magistrate', 'Magistrate'], name: (b, a) => `${a} Oligarchy`, description: 'A narrow circle of wealthy families holds power.' },
  democracy: { label: 'Democracy', title: ['President', 'President'], name: (b) => `Commonwealth of ${b}`, description: 'Broad suffrage, competitive elections and civil liberties.' },
  constitutional_monarchy: { label: 'Constitutional monarchy', title: ['King', 'Queen'], name: (b) => `Kingdom of ${b}`, description: 'A hereditary head of state with an elected government.' },
  federation: { label: 'Federation', title: ['Chancellor', 'Chancellor'], name: (b) => `Federation of ${b}`, description: 'Self-governing member regions under a shared government.' },
  theocracy: { label: 'Theocracy', title: ['High Priest', 'High Priestess'], name: (b) => `Holy State of ${b}`, description: 'Religious authorities hold political power.' },
  junta: { label: 'Military junta', title: ['General', 'General'], name: (b, a) => `${a} Military Directorate`, description: 'Military officers rule directly.' },
  dictatorship: { label: 'Authoritarian regime', title: ['Supreme Leader', 'Supreme Leader'], name: (b) => `State of ${b}`, description: 'Concentrated, unaccountable power without hereditary rule.' },
  one_party: { label: 'One-party state', title: ['Chair', 'Chair'], name: (b, a) => `${a} Union`, description: 'A single mass party controls state and economy.' },
  technocracy: { label: 'Technocracy', title: ['Director', 'Director'], name: (b, a) => `${a} Technate`, description: 'Expert and AI-assisted administration with limited participation.' },
  network_commonwealth: { label: 'Network commonwealth', title: ['Coordinator', 'Coordinator'], name: (b, a) => `${a} Network Commonwealth`, description: 'Continuous digital participation with AI-assisted deliberation.' },
};

export function deriveGovForm(civ: Civ, nSettlements: number, nCultures = 1): GovFormKey {
  const i = civ.inst;
  if (nSettlements === 0) return 'band';
  const small = civ.population < 600 || (civ.era <= 2 && nSettlements <= 2);
  if (small) return i.hereditary > 0.5 && i.centralization > 0.35 ? 'chiefdom' : 'tribe';
  if (i.religiousAuthority > 0.68) return 'theocracy';
  if (i.militaryInfluence > 0.68 && i.participation < 0.3) return 'junta';
  if (i.participation >= 0.55 && i.competition >= 0.5 && i.liberties >= 0.45) {
    if (i.techGovernance > 0.6) return 'network_commonwealth';
    if (i.hereditary > 0.5) return 'constitutional_monarchy';
    if (i.federalism > 0.6 && nSettlements >= 4) return 'federation';
    return 'democracy';
  }
  if (i.hereditary >= 0.5) {
    if (nSettlements === 1 && civ.population > 3000) return 'city_state';
    if (nSettlements >= 8 && nCultures >= 2) return 'empire';
    if (nSettlements >= 14) return 'empire';
    if (i.centralization < 0.35 && civ.era <= 3) return 'chiefdom';
    return 'monarchy';
  }
  if (i.participation >= 0.12) {
    if (i.techGovernance > 0.6) return 'technocracy';
    if (i.competition >= 0.3) return nSettlements === 1 ? 'city_state' : 'republic';
    return 'oligarchy';
  }
  if (i.stateEconomy > 0.6 && civ.era >= 8) return 'one_party';
  if (i.techGovernance > 0.6) return 'technocracy';
  return 'dictatorship';
}

export function civDisplayName(civ: Civ): string {
  const def = GOV_FORMS[(civ.govForm as GovFormKey) ?? 'tribe'] ?? GOV_FORMS.tribe;
  return def.name(civ.baseName, civ.adjective);
}

export function rulerTitle(civ: Civ, female: boolean): string {
  const def = GOV_FORMS[(civ.govForm as GovFormKey) ?? 'tribe'] ?? GOV_FORMS.tribe;
  return female ? def.title[1] : def.title[0];
}

export function isHereditary(civ: Civ): boolean {
  return civ.inst.hereditary >= 0.5;
}

export function isDemocratic(civ: Civ): boolean {
  return civ.inst.participation >= 0.5 && civ.inst.competition >= 0.45;
}
