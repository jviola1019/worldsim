/**
 * Technology system contracts.
 *
 * DISCOVERY vs ADOPTION: a civilization first *discovers* a technology
 * (knows it exists, through research, diffusion, conquest or espionage) and
 * then *adopts* it gradually (0..1). Adoption progresses only while the tech's
 * material/geographic requirements are met and is paid for with investment;
 * it can regress when requirements disappear (lost oil access, collapse) and
 * knowledge itself can be lost when literacy and institutions break down.
 *
 * EFFECTS are expressed as contributions to CAPABILITIES. A civ's capability
 * vector is recomputed from its adopted techs:
 *   - normal keys:  cap[k] = sum over techs of effect[k] * adoption
 *   - *Tier keys:   cap[k] = max over techs with adoption >= 0.5 of effect[k]
 * Simulation systems read capabilities (never tech ids directly), which keeps
 * the tech tree data-driven and lets partial adoption have partial effects.
 */
import type { BuildingKey } from '../civilizations/buildingTypes';
import type { GoodKey } from '../world/resources';

export const CAP_KEYS = [
  // --- subsistence & food ---
  'forage', //            >0 foraging/hunting/fishing known; value = yield bonus fraction
  'fishing', //           fishing yield bonus (boats, nets); >0 enables fisheries
  'farming', //           >0 enables farms; value = farm yield bonus fraction
  'herding', //           >0 enables pastures (needs domesticable animals nearby)
  'irrigation', //        >0 allows farming dry tiles near water; yield bonus in dry climates
  'foodPreservation', //  reduces food spoilage (fraction)
  'farmMechanization', // reduces farm labor needed per tile (fraction, up to ~0.97)
  // --- extraction & production ---
  'woodcutting', //       wood yield bonus fraction
  'quarrying', //         >0 enables quarries; stone yield bonus
  'mining', //            >0 enables mines on surface ore deposits; yield bonus
  'deepMining', //        >0 enables coal & deep deposits; yield bonus
  'oilExtraction', //     >0 enables oil & gas wells
  'uraniumMining', //     >0 enables uranium mines
  'rareExtraction', //    >0 enables rare metal mines
  'metalTier', //         MAX: 0 none, 1 copper, 2 bronze, 3 iron, 4 early steel, 5 industrial steel, 6 alloys, 7 advanced materials
  'crafts', //            craft/workshop productivity bonus
  'industry', //          >0 enables factories; industrial productivity bonus
  'automation', //        share of manufacturing/service labor replaced by machines (0..~0.95)
  'robotics', //          extends automation to construction, mining and agriculture
  // --- energy & environment ---
  'energyTier', //        MAX: 0 muscle/biomass, 1 water/wind mills, 2 steam/coal, 3 electricity, 4 oil & gas, 5 nuclear, 6 advanced renewables+storage, 7 fusion
  'electrification', //   >0 enables power grids & electric buildings
  'nuclearPower', //      >0 enables nuclear plants
  'renewables', //        >0 enables solar/wind; value = efficiency bonus
  'fusionPower', //       >0 enables fusion plants (plausible/speculative)
  'energyStorage', //     smooths renewable supply; reduces energy shortages
  'energyEfficiency', //  reduces energy needed per unit output (fraction)
  'pollutionControl', //  reduces pollution emitted per unit output (fraction)
  'carbonCapture', //     removes atmospheric carbon
  // --- settlement & construction ---
  'housingTier', //       MAX residential tier: 0 tents, 1 huts, 2 houses, 3 townhouses, 4 tenements, 5 apartments, 6 suburbs, 7 towers, 8 arcologies
  'construction', //      construction speed bonus
  'urbanCapacity', //     bonus to max settlement size / urban services
  'sanitation', //        reduces urban disease and mortality (fraction)
  'fortification', //     MAX: 0 none, 1 palisade, 2 stone walls, 3 castles, 4 star forts, 5 modern fortifications
  // --- transport ---
  'roadTier', //          MAX: 0 none, 1 trails, 2 roads, 3 paved roads, 4 highways
  'railTier', //          MAX: 0 none, 1 railways, 2 electric rail, 3 high-speed rail, 4 maglev/vactrain
  'navalTier', //         MAX: 0 none, 1 rafts/canoes, 2 coastal galleys, 3 sailing ships, 4 ocean navigation, 5 steamships, 6 modern shipping, 7 future shipping
  'airTier', //           MAX: 0 none, 1 early flight, 2 airliners, 3 jets, 4 advanced aviation
  'spaceTier', //         MAX: 0 none, 1 rocketry, 2 satellites, 3 crewed flight, 4 stations, 5 lunar base, 6 off-world colonies, 7 megastructures
  'landSpeed', //         movement speed bonus fraction (armies, settlers, trade)
  'logistics', //         supply range & trade capacity bonus
  'tradeEfficiency', //   reduces transport/transaction cost (fraction)
  // --- knowledge & culture ---
  'research', //          research output bonus fraction
  'literacy', //          raises achievable education level (0..1 scale contributions)
  'diffusion', //         bonus to absorbing foreign technology
  'communication', //     information reach: governance range, knowledge spread, coordination
  'mediaReach', //        mass media: public opinion, propaganda, assimilation speed
  'culturalOutput', //    cultural influence (border pressure, assimilation, prestige)
  // --- health & demography ---
  'healthcare', //        general mortality reduction (fraction)
  'infantCare', //        child mortality reduction (fraction)
  'contraception', //     enables fertility decline with development
  'lifespan', //          old-age mortality reduction (fraction)
  'diseaseControl', //    epidemic transmission/lethality reduction (fraction)
  // --- governance & economy ---
  'adminCapacity', //     state capacity: administration reach & effectiveness
  'taxEfficiency', //     tax collection efficiency bonus
  'ruleOfLaw', //         legal institutions: lowers corruption baseline
  'currency', //          >0 money economy (coinage); enables markets
  'banking', //           >0 credit & public debt
  'centralBanking', //    >0 fiat money & monetary policy
  'finance', //           financial sector productivity
  'markets', //           market/trade productivity bonus
  'welfare', //           >0 enables welfare state policies
  'participation', //     >0 enables representative institutions; value = pressure toward participation
  'internationalOrgs', // >0 enables international organizations
  // --- military ---
  'landTier', //          MAX weapons tier: 0 clubs, 1 spears, 2 bronze swords, 3 iron legions, 4 knights, 5 pike & shot, 6 muskets, 7 rifles, 8 machine guns, 9 mechanized, 10 modern combined arms, 11 robotic, 12 exo/advanced
  'cavalry', //           >0 mounted units (needs HORSES)
  'militaryAttack', //    attack bonus fraction
  'militaryDefense', //   defense bonus fraction
  'siege', //             bonus vs fortifications
  'navalPower', //        naval combat bonus
  'airPower', //          air combat/support bonus
  'mobility', //          army operational speed bonus
  'intelligence', //      espionage, information quality about others
  'nuclearWeapons', //    >0 strategic nuclear capability (ADVANCED WEAPON)
  'missiles', //          long-range strike capability
  'autonomousWeapons', // robotic/drone warfare
  // --- future ---
  'computing', //         computing capacity (multiplies research, finance, automation)
  'ai', //                AI capability level (productivity, governance, research)
  'biotech', //           biotechnology (yields, medicine)
  'orbitalIndustry', //   orbital manufacturing/energy
  'offworld', //          >0 enables off-world settlements
  'lifeExtension', //     radical longevity
] as const;

export type CapKey = (typeof CAP_KEYS)[number];
export type Caps = Record<CapKey, number>;

export function emptyCaps(): Caps {
  const c = {} as Caps;
  for (const k of CAP_KEYS) c[k] = 0;
  return c;
}

/** True for capability keys aggregated with MAX instead of SUM. */
export function isTierCap(k: CapKey): boolean {
  return k.endsWith('Tier') || k === 'fortification';
}

export type TechCategory =
  | 'subsistence'
  | 'agriculture'
  | 'materials'
  | 'industry'
  | 'energy'
  | 'transport'
  | 'maritime'
  | 'science'
  | 'medicine'
  | 'civic'
  | 'economy'
  | 'military'
  | 'communication'
  | 'computing'
  | 'space'
  | 'culture';

/**
 * historical  - happened in real history
 * plausible   - credible extrapolation (near future; not inevitable)
 * speculative - hypothetical / science fiction; only with speculative tech enabled
 */
export type Realism = 'historical' | 'plausible' | 'speculative';

export type GeoFeature = 'coast' | 'river' | 'mountain' | 'forest' | 'domesticable' | 'horses' | 'desert';

export interface TechRequirement {
  /** Goods the civ must have access to (own extraction or imports) for ADOPTION to progress. */
  resources?: GoodKey[];
  /** At least one of these goods must be available. */
  anyResources?: GoodKey[];
  /** Geographic features required somewhere in the civ's territory (for discovery AND adoption). */
  features?: GeoFeature[];
  /** Minimum total civ population for discovery to be possible. */
  minPopulation?: number;
}

export interface TechDef {
  id: string;
  name: string;
  /** Era 1..15 (descriptive grouping, NOT a global timer). */
  era: number;
  category: TechCategory;
  prereqs: string[];
  /** Research points needed to discover. */
  cost: number;
  realism: Realism;
  /** Strategic weapons; disabled when the 'advanced weapons' world law is off. */
  advancedWeapon?: boolean;
  requires?: TechRequirement;
  effects: Partial<Caps>;
  unlocks?: { buildings?: BuildingKey[] };
  /** Typical years from discovery to full adoption when requirements are met. */
  adoptionYears: number;
  /** One-sentence plain-language description shown in the UI. */
  description: string;
}
