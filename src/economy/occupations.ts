/**
 * Round 7: what people do for a living. Named occupations are a breakdown of the sector employment
 * the economy already computes each month (`Settlement.employment`). Each sector's workers are split
 * by what the place has (its districts) and what the nation knows (its capabilities), so the same
 * people are named differently as concepts turn: foragers become farmers, farmhands become
 * agronomists, clerks give way to programmers and AI supervisors.
 *
 * A job is only a name and a count: no wages, perks or costumes. Pure and derived from saved state.
 */
import type { Civ, Settlement } from '../sim/types';
import { B, eraToTier } from '../civilizations/buildingTypes';
import { SECTOR } from '../civilizations/buildings';

export type JobGroup = 'foraging' | 'farming' | 'fishing' | 'agritech' | 'extraction' | 'crafts' | 'factory' | 'hightech' | 'building' | 'commerce' | 'care' | 'knowledge' | 'digital' | 'culture' | 'military' | 'unemployed';

export interface JobDef { key: string; label: string; sector: number; group: JobGroup }
export interface Job extends JobDef { count: number }

const J = (key: string, label: string, sector: number, group: JobGroup): JobDef => ({ key, label, sector, group });
const S = SECTOR;

/** Every occupation the game can show (labels in plural, plain words). */
export const JOBS: readonly JobDef[] = [
  J('gatherers', 'Gatherers', S.FOOD, 'foraging'), J('hunters', 'Hunters', S.FOOD, 'foraging'),
  J('farmers', 'Farmers', S.FOOD, 'farming'), J('herders', 'Herders', S.FOOD, 'farming'), J('farmhands', 'Farmhands', S.FOOD, 'farming'),
  J('fishers', 'Fishers', S.FOOD, 'fishing'),
  J('machine_farmers', 'Farm machine operators', S.FOOD, 'agritech'), J('agronomists', 'Agronomists', S.FOOD, 'agritech'), J('vertical_farmers', 'Vertical-farm technicians', S.FOOD, 'agritech'),
  J('woodcutters', 'Woodcutters', S.RESOURCES, 'extraction'), J('quarry_workers', 'Quarry workers', S.RESOURCES, 'extraction'),
  J('miners', 'Miners', S.RESOURCES, 'extraction'), J('oil_workers', 'Oil and gas workers', S.RESOURCES, 'extraction'),
  J('artisans', 'Artisans', S.INDUSTRY, 'crafts'), J('smiths', 'Smiths', S.INDUSTRY, 'crafts'), J('millers', 'Millers', S.INDUSTRY, 'crafts'),
  J('factory_workers', 'Factory workers', S.INDUSTRY, 'factory'), J('steelworkers', 'Steelworkers', S.INDUSTRY, 'factory'), J('refinery_workers', 'Refinery workers', S.INDUSTRY, 'factory'),
  J('chip_technicians', 'Chip technicians', S.INDUSTRY, 'hightech'), J('robot_technicians', 'Robot technicians', S.INDUSTRY, 'hightech'), J('automation_engineers', 'Automation engineers', S.INDUSTRY, 'hightech'),
  J('builders', 'Builders', S.CONSTRUCTION, 'building'),
  J('traders', 'Traders and shopkeepers', S.SERVICES, 'commerce'), J('porters', 'Porters and servants', S.SERVICES, 'commerce'),
  J('clerks', 'Clerks', S.SERVICES, 'commerce'), J('bankers', 'Bankers', S.SERVICES, 'commerce'), J('drivers', 'Drivers and transport crews', S.SERVICES, 'commerce'),
  J('priests', 'Priests', S.SERVICES, 'care'), J('healers', 'Healers', S.SERVICES, 'care'), J('doctors', 'Doctors and nurses', S.SERVICES, 'care'),
  J('teachers', 'Teachers', S.SERVICES, 'knowledge'), J('scholars', 'Scholars and researchers', S.SERVICES, 'knowledge'),
  J('programmers', 'Programmers', S.SERVICES, 'digital'), J('ai_supervisors', 'AI supervisors', S.SERVICES, 'digital'),
  J('entertainers', 'Entertainers and athletes', S.SERVICES, 'culture'),
  J('warriors', 'Warriors', S.MILITARY, 'military'), J('soldiers', 'Soldiers', S.MILITARY, 'military'),
  J('job_seekers', 'Looking for work', S.UNEMPLOYED, 'unemployed'),
];
export const JOB_BY_KEY: Readonly<Record<string, JobDef>> = Object.fromEntries(JOBS.map((j) => [j.key, j]));
export const JOB_GROUPS: readonly JobGroup[] = ['foraging', 'farming', 'fishing', 'agritech', 'extraction', 'crafts', 'factory', 'hightech', 'building', 'commerce', 'care', 'knowledge', 'digital', 'culture', 'military', 'unemployed'];
export const GROUP_LABEL: Readonly<Record<JobGroup, string>> = {
  foraging: 'Foraging', farming: 'Farming', fishing: 'Fishing', agritech: 'Farm technology', extraction: 'Mining and forestry', crafts: 'Crafts',
  factory: 'Factories', hightech: 'High-tech industry', building: 'Building', commerce: 'Trade and offices', care: 'Faith and health',
  knowledge: 'Teaching and research', digital: 'Software and AI', culture: 'Culture and sport', military: 'Military', unemployed: 'Looking for work',
};

/** Weights of each occupation within its sector for this place and nation. */
function weights(s: Settlement, civ: Civ | undefined): Record<string, number> {
  const b = (t: number) => s.bld[t] ?? 0;
  const c = civ?.caps;
  const cap = (k: keyof NonNullable<typeof c>) => (c ? (c[k] as number) || 0 : 0);
  const tier = civ ? eraToTier(civ.era) : 0;
  const mech = Math.min(0.97, cap('farmMechanization'));
  const auto = Math.min(0.95, cap('automation'));
  const ai = Math.min(1, cap('ai'));
  const farms = b(B.FARM) + b(B.PLANTATION);
  const industrial = cap('industry') >= 0.5;
  const w: Record<string, number> = {};
  // food: before farming everyone forages; mechanization turns farmhands into machine operators and agronomists
  if (cap('farming') <= 0) {
    w.gatherers = 0.6;
    w.hunters = 0.4;
  } else {
    w.farmers = farms * (1 - mech) + 0.05;
    w.farmhands = farms * (1 - mech) * (tier >= 3 && tier <= 5 ? 0.6 : 0.2);
    w.herders = b(B.PASTURE) * (1 - mech * 0.8);
    w.machine_farmers = farms * mech * 0.7;
    w.agronomists = farms * mech * 0.3 + cap('biotech') * farms * 0.2;
    w.vertical_farmers = b(B.GREENHOUSE) * 3;
    w.gatherers = 0.02;
  }
  w.fishers = b(B.FISHERY);
  // resources (before industry, household gathering of wood and stone counts here too)
  w.woodcutters = b(B.LUMBER) + (industrial ? 0 : 0.6);
  w.quarry_workers = b(B.QUARRY) + (industrial ? 0 : 0.3);
  w.miners = b(B.MINE);
  w.oil_workers = b(B.OIL_WELL);
  // industry: crafts give way to factories, factories to robots and the engineers who run them
  w.artisans = b(B.WORKSHOP) + (industrial ? 0 : 0.2);
  w.smiths = b(B.SMITHY);
  w.millers = b(B.MILL);
  w.factory_workers = b(B.FACTORY) * 3 * (1 - auto * 0.7);
  w.steelworkers = b(B.STEEL_MILL) * 3 * (1 - auto * 0.5);
  w.refinery_workers = b(B.REFINERY) * 2;
  w.chip_technicians = b(B.CHIP_FAB) * 3;
  w.robot_technicians = b(B.ROBOT_FACTORY) * 3;
  w.automation_engineers = (b(B.FACTORY) + b(B.STEEL_MILL) + b(B.ROBOT_FACTORY)) * auto * 2;
  if (!Object.entries(w).some(([k, v]) => JOB_BY_KEY[k].sector === S.INDUSTRY && v > 0)) w.artisans = 0.01;
  w.builders = 1;
  // services
  w.traders = 0.6 + b(B.MARKET) * 2 + b(B.HARBOR) + b(B.WAREHOUSE) * 0.5;
  w.porters = industrial ? 0.05 : 0.8; // household and informal service before the industrial age
  w.clerks = (b(B.OFFICE) * 2 + b(B.BANK) + b(B.PALACE) + (industrial ? 0.5 : 0)) * (1 - ai * 0.6);
  w.bankers = b(B.BANK) * 1.5 * (1 - ai * 0.3);
  w.drivers = (b(B.STATION) + b(B.AIRPORT) + b(B.HARBOR) * 0.5 + (cap('roadTier') >= 3 ? 1 : 0)) * (1 - ai * 0.5);
  w.priests = b(B.TEMPLE) * 1.5 + 0.1;
  w.healers = tier < 5 ? b(B.HOSPITAL) * 2 + 0.2 : 0;
  w.doctors = tier >= 5 ? b(B.HOSPITAL) * 2 + 0.3 : 0;
  w.teachers = b(B.SCHOOL) * 2 + b(B.UNIVERSITY);
  w.scholars = b(B.LIBRARY) + b(B.UNIVERSITY) * 2 + b(B.LAB) * 2;
  w.programmers = cap('computing') > 0 ? b(B.DATA_CENTER) * 2 + (b(B.OFFICE) + 1) * Math.min(1, cap('computing') * 0.5) : 0;
  w.ai_supervisors = ai > 0 ? (b(B.DATA_CENTER) + b(B.OFFICE) + 0.5) * ai : 0;
  w.entertainers = b(B.ARENA) * 1.5 + b(B.MONUMENT) * 0.3 + 0.1;
  // military
  w.warriors = tier <= 1 ? 1 : 0;
  w.soldiers = tier >= 2 ? 1 : 0;
  w.job_seekers = 1;
  return w;
}

/**
 * The occupations of one settlement. Counts are whole people and add up exactly to the rounded
 * total of each employment sector (largest-remainder rounding).
 */
export function occupations(s: Settlement, civ: Civ | undefined): Job[] {
  const w = weights(s, civ);
  const out: Job[] = [];
  for (let sec = 0; sec < s.employment.length; sec++) {
    const total = Math.round(Math.max(0, s.employment[sec] || 0));
    if (!total) continue;
    const defs = JOBS.filter((j) => j.sector === sec && (w[j.key] ?? 0) > 0);
    const sum = defs.reduce((a, j) => a + w[j.key], 0);
    if (!defs.length || sum <= 0) continue;
    const exact = defs.map((j) => (total * w[j.key]) / sum);
    const counts = exact.map(Math.floor);
    let left = total - counts.reduce((a, b) => a + b, 0);
    const order = exact.map((v, k) => [v - counts[k], k] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (let n = 0; left > 0; n = (n + 1) % order.length, left--) counts[order[n][1]]++;
    defs.forEach((j, k) => counts[k] > 0 && out.push({ ...j, count: counts[k] }));
  }
  return out.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** Share of a nation's workers in each job group (for the yearly statistics). */
export function jobGroupShares(settlements: Iterable<Settlement>, civ: Civ): Record<JobGroup, number> {
  const tot = Object.fromEntries(JOB_GROUPS.map((g) => [g, 0])) as Record<JobGroup, number>;
  let all = 0;
  for (const s of settlements) for (const j of occupations(s, civ)) {
    tot[j.group] += j.count;
    all += j.count;
  }
  if (all > 0) for (const g of JOB_GROUPS) tot[g] /= all;
  return tot;
}
