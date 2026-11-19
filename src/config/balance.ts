/**
 * Balance parameters. Every gameplay coefficient lives here (not scattered as
 * magic numbers) so it can be tuned, tested for sensitivity and adjusted at
 * runtime from the developer panel.
 *
 * CLASSIFICATION (see docs/MODEL.md):
 *  [E] evidence-informed shape (e.g. mortality schedules, demographic transition direction)
 *  [S] stylized abstraction chosen for gameplay (most magnitudes)
 * No coefficient here is claimed to be empirically validated.
 */

export const AGE_BANDS = 17; // 0-4, 5-9, ..., 75-79, 80+
export const BAND_YEARS = 5;

/**
 * [E] Annual death probability by age band. PRE ~ life expectancy at birth
 * near 30 (high child mortality); MODERN ~ high-income country today. Shapes
 * follow the familiar U-shaped human mortality curve (Siler/Gompertz-Makeham);
 * values are rounded illustrative numbers, not a fitted life table.
 */
export const MORTALITY_PRE = [0.072, 0.012, 0.007, 0.009, 0.011, 0.012, 0.013, 0.015, 0.018, 0.022, 0.03, 0.04, 0.055, 0.08, 0.11, 0.16, 0.3];
export const MORTALITY_MODERN = [0.0012, 0.0001, 0.0001, 0.0004, 0.0006, 0.0007, 0.0009, 0.0012, 0.0018, 0.0028, 0.0042, 0.0065, 0.01, 0.016, 0.026, 0.045, 0.13];

/** [E] Shape of age-specific fertility across 15-19 .. 45-49 (sums to 1). */
export const FERTILITY_SHAPE = [0.08, 0.2, 0.22, 0.2, 0.15, 0.1, 0.05];

export const BALANCE = {
  // ---------------- demography
  /** [E] Natural-fertility total fertility rate before the transition. */
  tfrMax: 6.4,
  /** [S] Floor of TFR in fully developed societies. */
  tfrMin: 1.45,
  /** [S] Development index at which the fertility transition begins. */
  transitionOnset: 0.25,
  /** [S] Development index at which the transition is complete (TFR reaches its floor given contraception). */
  transitionFull: 0.85,
  /** Population thresholds for individual <-> cohort representation (hysteresis). */
  individualMax: 150,
  individualMin: 60,
  /** [S] Famine: mortality multiplier slope (q * (1 + k * hunger * vulnerability)). Severe famine ~15-20%/yr deaths. */
  famineMortality: 6,
  /** [S] Starvation: additive annual death probability slope (k * hunger² * vulnerability); a 35% shortfall kills ~6%/yr of average adults. */
  starvationMortality: 0.5,
  /** [S] Max yearly emigration share under distress. */
  maxEmigration: 0.06,
  bandSplitSize: 90,
  bandMinSize: 8,

  // ---------------- food & subsistence (units: person-years of food)
  foodNeedPerCapita: 0.9,
  /** [S] Food gathered per forager per year when wild food is plentiful. */
  foragerProductivity: 2.6,
  /** [S] Base farm tile yield (person-years/year) at fertility 255, no tech bonus. */
  farmYield: 1300,
  /** [S] Workers needed per farm tile before mechanization. */
  farmLabor: 520,
  pastureYield: 420,
  pastureLabor: 140,
  fisheryYield: 260,
  fisheryLabor: 90,
  /** Spoilage per year at foodPreservation 0. */
  foodSpoilage: 0.35,
  /** Target food reserve in years of need. */
  foodReserveYears: 0.6,

  // ---------------- materials & industry (units of goods per building per year)
  lumberYield: 320,
  lumberLabor: 60,
  quarryYield: 260,
  quarryLabor: 60,
  mineLabor: 90,
  mineYieldMult: 1,
  /** [S] Reserve growth: recoverable reserves scale by 1 + k * (deepMining + robotics). */
  reserveGrowth: 1.5,
  /** [S] Industrial extraction multiplier per unit of industry capability (scales both mine output and recoverable reserves). */
  industrialExtraction: 5,
  /** [S] Minimum construction priority for a full city to replace old housing with another use. */
  redevelopScore: 3,
  // planning rule (round 6): new city buildings keep an open neighbour; parks for large cities
  streetAccess: true,
  parkPerResidential: 8,
  parkMinPop: 2000,
  urbanAdjBonus: 1.0,
  enclosedPenalty: 2.0,
  /** Housing pressure (people / homes) above which homes may fill the gaps between blocks. */
  infillPressure: 1.5,
  /** Round 7: priority of renovating a home district two or more era styles out of date (below most needs). */
  renovateScore: 1.1,
  /** Round 7: materials a renovation needs, as a share of building new (labour is 40%, as for farm upgrades). */
  renovateCost: 0.4,
  /** [S] Per-capita stock of construction materials industry leaves for builders (industrial eras). */
  constructionReserve: 0.002,
  /** [S] Maximum market-service jobs per capita at high goods income. */
  serviceDemandMax: 0.42,
  /** [E] Round 8: public-service jobs per person in industrial eras: base, per unit of welfare, per budget share on schooling and health, cap. */
  publicJobsBase: 0.02,
  publicJobsWelfare: 0.05,
  publicJobsBudget: 0.25,
  publicJobsMax: 0.12,
  /** [E] Round 8: global warming (°C) at which nations that can act adopt basic, then strict, environment policy. */
  climateBasicAt: 1.5,
  climateStrictAt: 2.5,
  /** [E] Round 8: priority of rebuilding a fossil plant as a solar or wind farm under a strict climate policy. */
  cleanPowerScore: 2.2,
  /** [E] Round 8: share of steel made with electricity, by environment policy (renewables add 0.1). */
  steelGreenNone: 0.1,
  steelGreenBasic: 0.35,
  steelGreenStrict: 0.65,
  /** [E] Reduction of full-time-equivalent labor supply per unit of automation (working-time decline). */
  hoursPerAutomation: 0.35,
  /** [E] Scrap share of factory metal input per unit of industry capability (capped at 45%; real steel is ~30-40% scrap). */
  scrapPerIndustry: 0.12,
  smithyOutput: 450,
  smithyLabor: 20,
  workshopOutput: 450,
  workshopLabor: 30,
  factoryOutput: 14000,
  factoryLabor: 400,
  /** Gather rate for wood/stone by general laborers without dedicated buildings. */
  informalMaterials: 0.6,

  // ---------------- energy (units/year)
  powerFossilOutput: 30000,
  powerNuclearOutput: 90000,
  solarOutput: 9000,
  windOutput: 9000,
  hydroOutput: 26000,
  fusionOutput: 200000,
  /** Fuel per energy unit for fossil plants (coal-equivalent). */
  fossilFuelPerEnergy: 0.22,
  uraniumPerEnergy: 0.0011,

  // ---------------- housing (persons per tile)
  housing: {
    CAMP: 60,
    HUT: 160,
    HOUSE: 650,
    TOWNHOUSE: 2200,
    TENEMENT: 9000,
    APARTMENT: 40000,
    SUBURB: 5000,
    TOWER: 140000,
    ARCOLOGY: 400000,
  } as Record<string, number>,

  // ---------------- research
  /** [S] Research points per "effective researcher". */
  researchPerScholar: 0.02,
  /** [S] Research from general population (folk innovation), per capita. */
  folkResearch: 0.22,
  /** Multiplier applied to all tech costs (global pacing knob). */
  techCostMult: 1,
  /** Extra cost growth per era on top of the data's 1.9x (pacing). */
  techEraScale: 1.4,
  /** [S] Diffusion rate per contact intensity. */
  diffusionRate: 0.18,
  /** Annual chance scale for accidental discoveries. */
  serendipity: 0.02,
  /** Knowledge loss: annual chance per tech when literacy/institutions collapse. */
  knowledgeLoss: 0.02,

  // ---------------- economy
  baseTax: 0.08,
  /** [S] Investment share of surplus channeled to construction. */
  investmentShare: 0.12,
  /** [S] Interest premium per unit debt/GDP. */
  debtPremium: 0.04,
  priceAdjust: 0.25,

  // ---------------- politics
  electionInterval: 5,
  revolutionThreshold: 0.78,
  coupThreshold: 0.7,
  secessionThreshold: 0.72,

  // ---------------- military
  /** [S] Lanchester attrition coefficient per tick. */
  attrition: 0.012,
  moraleBreak: 0.25,
  /** Share of working-age men in a full mobilization (pre-modern ~0.1). */
  maxMobilization: 0.18,
  armyBaseSpeed: 0.11, // tiles per tick on foot
  siegeBaseTicks: 180,

  // ---------------- diplomacy
  /** [S] Base annual chance multiplier for war consideration. */
  warPropensity: 1,
  peaceExhaustion: 0.55,

  // ---------------- environment
  vegRegrowth: 0.012, // fraction of gap per month
  fireSpread: 0.22,
  /** [E] CO2 forcing coefficient (W/m^2 per ln(C/C0)), Myhre et al. 1998. */
  co2Forcing: 5.35,
  /** [S] Equilibrium warming per W/m^2 (~3 C per CO2 doubling, IPCC AR6 central). */
  climateSensitivity: 0.8,
  /** [S] Emission units -> ppm conversion for the 128x128 reference world (scaled by map area). Recalibrated when industrial extraction made fossil supply ~10x larger. */
  emissionToPpm: 6e-11,
  /** [E] Round 8: CO2 (ppm) the climate's own feedbacks (permafrost, forests, ice) can release in total. */
  feedbackPoolPpm: 300,

  // ---------------- disease
  /** [S] Base annual chance of a new pathogen per settlement at reference density. */
  pathogenEmergence: 0.00025,

  // ---------------- pacing
  /** Max ticks simulated per rendered frame (adaptive cap). */
  maxTicksPerFrame: 40,
};

export type Balance = typeof BALANCE;
