# Simulation model and assumptions

Each system is labeled with one of three tags:

- **Evidence-informed:** the *direction* and rough *shape* follow a documented regularity (sources in
  [research/simulation-grounding.md](research/simulation-grounding.md)). Magnitudes are tuned for play.
- **Stylized:** a deliberate game-design simplification. It is plausible, but no claim of empirical fit is made.
- **Speculative:** systems for the future, with no empirical basis by definition.

Tunable constants live in `src/config/balance.ts` (`BALANCE`) and can be changed in-game from the
World laws panel. No number shown in the UI is invented: every statistic is computed from simulation state.

## Scale

A tile represents about 100 km², a tick about 3 days, and a year 120 ticks. Population densities are scaled down
uniformly: a 128² map of roughly 1.6 M km² peaks at a few million people in industrial eras, so absolute
numbers are not comparable with Earth. Ratios such as urban share, farm share of labor and growth rates are
the meaningful outputs. *Stylized.*

## Population

| System | Implementation | Tag |
|---|---|---|
| Mortality | 17 five-year age bands. Each civilization interpolates geometrically between a pre-modern and a modern schedule using health indices (food adequacy, sanitation, medicine). | Evidence-informed (shape); magnitudes stylized |
| Fertility and the demographic transition | TFR falls from `tfrMax` 6.4 toward `tfrMin` 1.45, driven by child survival, urbanization, education and living standards, with a lag. Mortality falls first, so booms happen. | Evidence-informed |
| Famine | Food adequacy below 1 raises mortality (×`famineMortality` at zero adequacy) and emigration. | Evidence-informed (direction) |
| Migration | Quarterly, in proportion to distress (hunger, unrest, overcrowding); at most about 6% of a settlement per year. Destinations are chosen by attractiveness. | Stylized |
| Two resolutions | Individuals under 150 people, cohorts above. Notables are always individuals. | Design choice |
| Disease | SIR per settlement. Transmission rises with density and falls with sanitation and medicine. Spreads along routes and with armies; immunity remains after an outbreak. | Evidence-informed (SIR structure) |

## Characters

| System | Implementation | Tag |
|---|---|---|
| Innate traits | 31 personality and physical traits in opposite pairs. They are inherited with trait-specific probability and rolled at birth. Rulers' traits shift national decision weights (aggression, expansion, science, piety, trade, caution, corruption, legitimacy, tolerance, reform). | Stylized |
| Genes | Four heritable values (vigor, intellect, temperament, fertility): the mean of the parents plus noise. They feed skills, health and fertility. | Stylized |
| Skill development | Each skill moves toward a personal potential set by genes, innate traits and schooling (the nation's `literacy` capability). Growth is fast from ages 12 to 30 and slow from 30 to 55; skills decline after 60, military first. Role practice (ruler: administration and diplomacy; general: military; scholar: learning) builds experience, which raises the ceiling. | Stylized |
| Stress | Rises from war leadership, illegitimate rule, lost battles, grief and defeat, and decays 0.12 per year. Chronic stress raises mortality and can produce melancholy, paranoia or cruelty. | Stylized |
| Acquired traits | Twelve traits earned from recorded events: veteran, scarred, conqueror, tactician, scholar, silver-tongued, statesman, beloved, tyrant, melancholic, survivor, venerable. They are never inherited. Each has a stated cause in the person's life log. | Stylized |

## Economy

| System | Implementation | Tag |
|---|---|---|
| Production | Per settlement and month. Labor is allocated to food sources by productivity, then to districts by priority; each district has jobs, inputs and outputs. | Stylized |
| National market | One stock per nation; prices adjust to the stock-to-demand ratio (`priceAdjust`). Unmet demand (`want`) is recorded and drives trade and building plans. | Stylized |
| Food market | Farms produce for local need plus a margin. When the national reserve falls below about 4 months, farms everywhere produce at capacity and surplus moves to the national pool, from which cities draw. | Stylized (a market abstraction) |
| Land-use competition | When a settlement is hungry and has no free land, its outermost surplus industrial, military, commercial or extraction district is converted to farmland. | Stylized |
| Market services | In industrial eras, service jobs per person rise with household *goods* income (structural change: from about 4% of the population at subsistence to about 34% when prosperous). Automation reduces them. Building-based service staff count first. Remaining workers do informal work or are unemployed; a welfare safety net raises measured unemployment. | Evidence-informed (direction: Clark–Fisher structural change); magnitudes stylized |
| Developed starts | Era-preset nations are sized to their land's carrying capacity (a third of arable land farmed at their technology level) before building, and start with the farmland that feeds them. | Design choice (consistent starting conditions) |
| National accounts | GDP = C + I + G + (X − M) + ΔInventories. ΔInventories values *quantity* changes at current prices: price changes are holding gains, and spoilage is an other change in volume, so neither counts as output. Crises reduce C and I, never GDP after the fact. A test checks the identity. | Accounting identity (exact) |
| Public debt | Interest equals debt × min(25%, 3% + a risk premium that rises with debt/income). Debt above 3× income is restructured to 1× income. | Stylized (a bounded risk premium is evidence-informed) |
| Money and prices | Money supply grows with real growth; inflation comes from money growth above real growth plus crisis shocks. A credit cycle, given finance technology, can produce financial crises. | Stylized |
| Agricultural yields | Pre-modern farming roughly doubles foraging output. Chemical fertilizer (+1.4) and the Green Revolution (+2.0) raise modern yields to about 3× medieval levels. OWID reports cereal output per area roughly tripling since 1961 alone, so this is conservative. | Evidence-informed (direction and order of magnitude) |

## Known model limitation

Organic late-era worlds reach a Malthusian equilibrium: population grows until famine mortality balances births, and the fertility transition does not lower births enough. Measured in a year-800 snapshot: food production at 41% of need, 26 births and 17 famine deaths per 1,000 per year.

Two levers were tested and rejected:
- Doubling yields: food rose to 59% of need, but births rose to 30 per 1,000.
- Denser schools: births did not change.

Recalibrating the fertility transition is the documented next step. See VALIDATION §3.

## Technology

207 technologies in 15 eras. Discovery and adoption are separate, as in R7.3: adoption costs resources and
needs prerequisites. Research comes from folk innovation (∝ population^0.62), scholars, institutions and diffusion
through contact and trade. Effective cost = base × `techCostMult` × 1.4^(era−1). Knowledge can be lost
when literacy and institutions collapse. *Stylized; the direction of the population–innovation link is evidence-informed.*

## Politics and war

| System | Implementation | Tag |
|---|---|---|
| Government | An institution vector (participation, centralization, rule of law, religious authority, and so on) drifts under faction pressure. The label (chiefdom, monarchy, republic, …) is *derived* from the vector. State formation needs administrative capacity ≥ 0.5. | Stylized |
| Instability | Low legitimacy and stability plus unrest lead to coups, revolutions, secession or collapse. A counterfactual test confirms the link. | Evidence-informed (direction) |
| War decisions | Considered yearly, with recorded causes (grievances, opportunity, ideology, resources) and propensity scaled by leader personality. Nuclear deterrence lowers war utility. | Stylized |
| Battles | Lanchester laws: linear before tier 5, square after. Modified by equipment, training, morale, supply, generalship, terrain and fortifications. | Evidence-informed (Lanchester); magnitudes stylized |
| Sieges | Progress rate is attack over defense. A siege is lifted when attack is below 20% of defense or after 3 years. | Stylized |

## Environment and ecology

Climate cells follow an AR(1) process for rain and temperature anomalies. CO₂ from emissions produces forcing, then warming,
then sea-level rise. Disasters can occur naturally or be triggered by the player. Herds reproduce and graze, predators hunt, and species
speciate into subspecies under isolation (rate-limited). *Mostly stylized; the CO₂ → warming direction is evidence-informed.*

## Future systems

Automation displacement, space programs, orbital stations, colonies and fusion are **speculative**. They are gated
on technology and resources, and their consequences are modeled, not scripted.

## War, nuclear weapons and endings

Design for phase P5. Code: `military/weapons.ts`, `military/nuclear.ts`, `technology/overtaking.ts`, `civilizations/endings.ts`, `world/catastrophes.ts`, `future/risks.ts` and `powers/horrors.ts`. All new state lives on `Civ`, `Settlement`, `Disease`, `ClimateState` or the optional `WorldState.endings`, so it is saved, and older saves load with defaults.

### Weapons and doctrine by era

| System | Implementation | Tag |
|---|---|---|
| Weapon concepts | Fielded systems are derived from adopted technology, not bought: massed artillery (gunpowder, then rifled guns), chemical weapons (industrial chemistry plus machine guns), strategic bombing (military aviation), missile defence (radar plus precision weapons), drones (precision weapons plus machine learning), cyberwarfare (internet), hypersonic missiles (precision weapons plus strategic missiles), autonomous swarms (autonomous weapons), high-altitude EMP (nuclear weapons plus missiles), orbital strike platforms (orbital industry), engineered bioweapons (synthetic biology). Strategic systems need the *advanced weapons* law. Each adds to attack, defence or siege strength. | Stylized |
| Land doctrine | Each nation holds one: *massed* (manpower, morale), *firepower* (artillery, siege), *maneuver* (mobility, armour) or *networked* (precision, drones, cyber). It follows culture, institutions and era, and changes after defeats. | Stylized |
| Special operations | Yearly, in each active war: cyberattacks cut the enemy's energy stock and can cause an economic crisis; chemical attacks kill soldiers and civilians but cause world outrage and lead to a ban; drone and orbital strikes kill without risking soldiers; an EMP blacks out an electrified enemy. Rule-of-law states keep the chemical ban. Desperate states may break it. | Stylized |
| Arms races | An *arms race* index rises when a rival or enemy is stronger, raises military spending, and makes military research more likely. | Evidence-informed (direction: Richardson arms-race dynamics) |

### Nuclear weapons

| System | Implementation | Tag |
|---|---|---|
| Arsenal | A programme starts once a nation has nuclear weapons technology, uranium and a reason (a nuclear rival, an enemy or an aggressive leadership). Warheads accumulate with industry. The target size grows with rivals' arsenals and shrinks under arms-control treaties and after any nuclear use (the taboo). | Stylized |
| Doctrine | *No first use* (participatory, law-bound, cautious states), *assured retaliation* (the default) or *first strike* (aggressive or military-led states). It is derived yearly from institutions and personality. | Stylized |
| Deterrence | War utility (`warUtility`) adds a cost that grows with the target's warheads and its means of delivery, plus a mutual-destruction term when the attacker is armed too. Allies' arsenals add extended deterrence. Test: `nuclearDeterrenceLowersWarUtility`. | Evidence-informed (direction) |
| Escalation | Use is considered only in desperate wars: losing badly, or with the capital occupied. Doctrine, institutional restraint and autonomous defence AI change the odds. A struck nuclear state retaliates with high probability, so a first use can become an exchange. Missile defence intercepts some warheads; hypersonic missiles evade it. | Stylized |
| Effects | Blast deaths (ledger `war`), destroyed districts, a crater, a radiation hazard, pollution and fallout deaths and illness in nearby towns. Burning cities loft stratospheric soot (`climate.soot`), which decays with an e-folding time of about 5.5 years. Soot cooling is about 2.5·ln(1 + soot/5) °C, so about 1.7 °C for 5 units and about 8.6 °C for 150 units. That shape follows published nuclear-winter studies (5 Tg about 1.5 °C, 150 Tg about 8 °C), with stylized magnitudes. | Evidence-informed (shape); magnitudes stylized |
| Nuclear winter | Global cooling (volcanic, impact and nuclear aerosols plus soot) now cuts farm, pasture and forage yields: ×(1 − 0.09·(cooling − 0.3)), floored at 0.08. It also cools the regional temperatures that herds and vegetation use. Famine deaths during strong cooling are attributed to the cooling source. | Evidence-informed (direction: crop-model studies of nuclear winter) |
| Treaties | Nuclear states on good terms with international organizations sign arms-control treaties that halve their target arsenals and dismantle the surplus. | Stylized |

### Technological overtaking

| System | Implementation | Tag |
|---|---|---|
| Leapfrogging | A technology in a leapfrog category (communication, energy, computing, medicine, economy, transport) can diffuse from a contact that uses it even when the receiver lacks one generation of prerequisites. The missing prerequisites become *known but skipped*, so the stage is never built, and adoption of the new technology is faster for latecomers with no legacy infrastructure. An example is going straight to mobile telephony or solar power. Prerequisites stay known, so the invariant "every known technology has its prerequisites known" still holds. | Evidence-informed (direction: latecomer advantage, Gerschenkron) |
| Institutional sclerosis | A long-lived, uncontested regime builds *sclerosis*: interest groups entrench, corruption grows, and the regime is the technological leader. Sclerosis lowers research and adoption speed by up to 35%. Revolutions, defeats and crises reset it. | Evidence-informed (direction: Olson, *The Rise and Decline of Nations*) |
| Measurement | `WorldState.endings.techLead` records the technology leader and every change of lead. `scripts/endings-rarity.ts` reports lead changes per run. | Measurement |

### Endings

Every civilization that falls gets a structured `Civ.ending` record: type, year, recorded causes and the nation that absorbed it, if any. `fellCause` keeps its plain-language text. Endings come from mechanisms, not dice rolls on the ending itself:

- **Direct endings.** A mechanism ends the state outright: conquest or annexation, civil war (a parent state annexed by its breakaway), federation, cultural assimilation (a small, peaceful state whose people already share a larger neighbour's culture joins it), fragmentation and economic or systemic collapse (a failing state that dissolves into successor states), and AI takeover (a misaligned, autonomous AI system seizes infrastructure; its people pass to a machine-run state).
- **Depopulation endings.** Every death source also adds *existential pressure* of a typed kind to the civilization: `nuclear_war`, `war`, `famine`, `nuclear_winter`, `pandemic`, `engineered_pandemic`, `infertility`, `climate_runaway`, `asteroid`, `supervolcano`, `cosmic`, `ecological_collapse`, `grey_goo`, `disaster`, `demographic_collapse` (births far below deaths) and the god-only horrors. Pressure decays by 10% a year. When the last people die out, the ending is the dominant recent pressure, and the top pressures are recorded as its causes. A shrunken civilization dominated by demographic-collapse pressure can also be absorbed peacefully by a neighbour, with ending type `demographic_collapse`.

Base yearly rates in Realistic mode, scaled by disaster frequency:

| Threat | Rate (per world-year unless stated) | Basis |
|---|---|---|
| Regional airburst (about 50–100 m) | 1/800 | Order of magnitude of Tunguska-class impact rates |
| Major asteroid impact (about 1 km) | 1/300,000 | NASA/NEO impact-frequency estimates |
| Extinction-class impact (about 10 km) | 1/100,000,000 | Same |
| VEI-7 eruption | 1/1,000 | Ice-core eruption records (order of magnitude) |
| Supervolcano (VEI-8) | 1/60,000 | Published VEI-8 recurrence estimates (order of magnitude) |
| Severe geomagnetic storm (affects electrified nations only) | 1/150 | Carrington-class recurrence estimates |
| Solar superflare | 1/20,000 | Stellar superflare statistics (order of magnitude) |
| Nearby gamma-ray burst | 1/100,000,000 | Astrophysical estimates of lethal-range bursts |
| Natural infertility pathogen | 1/40,000 | No recorded instance; a deliberately tiny rate |
| Engineered pandemic (per nation with synthetic biology) | about 1/1,500 × biotech × weak rule of law | Speculative; stylized |
| AI takeover (per misaligned, autonomous, highly capable AI system) | about 0.4% × capability excess × alignment deficit | Speculative; stylized |
| Grey goo (per nation with molecular manufacturing) | about 1/3,000 | Speculative; possible only with speculative technology |
| Climate runaway | Not rolled: above 3 °C of warming, feedbacks add CO₂, and lethal heat raises deaths in hot regions | Stylized tipping-point feedback |

Rare things stay rare, so most 1,000-year histories see none of the cosmic or geological catastrophes. The measured frequencies are in VALIDATION.md.

### God-mode-only threats

These are never present in Realistic or observer worlds. The powers refuse to apply, and random outbreaks need the *Fictional horrors* law, which the Realistic preset forces off:

- **Zombie outbreak.** A horde grows in a settlement by turning the living (ledger `disease`). It is fought by garrisons and armies, scaled by weapons tier and walls. It spreads along road and trade links. Survivors flee to the nearest uninfected town. Nations with medicine research a cure, which stops new infections. An outbreak is contained when every horde is destroyed.
- **Ghoul packs.** Nocturnal scavengers rise from battlefields and ruins and raid nearby towns (ledger `disaster`). Garrisons and the light of electrified cities drive them off.
- **The Creeping Blight.** A fungal rot spreads between neighbouring settlements and destroys crops. Famine during a blight is attributed to it. It burns out over time or can be contained by agricultural science.

## Round 10 mechanisms: assumptions and limits

Each entry gives the mechanism, its assumption, its evidence class (see [PARAMETERS.md](PARAMETERS.md)) and what it does not claim. Measurements are in VALIDATION §R10, methods in [METHODS.md](METHODS.md).

- **Nations and tribes.**
  - **Mechanism:** a people with at least one settlement counts as a nation; a people of wandering bands only counts as a tribe.
  - **Note:** this is a definition, not a parameter.
- **Slow pace** [C].
  - **Mechanism:** four multipliers (settle, research, build, births in settlements). Round 10 addendum: a band makes no permanent camp in its first 30 years on new land, then its settle chance ramps up over 60 years.
  - **Calibration target:** a first village around year 100 and a first city of 10,000 around year 1,000 after a band of 24 is placed beside fresh water.
  - **Assumption:** settling waits until people know the land, and early settled growth is slower than standard play.
  - **Limit:** calibrated to the simulation's own milestones, not to archaeological dates. Real sedentism took millennia, so Slow is still compressed.
- **Developed starts** (era ≥ 2).
  - **Mechanism:** granted technology is topped up so the promised era is actually reached (the era threshold is 35% of that era's techs adopted).
  - **Assumption:** a preset that says "atomic age" means atomic age.
- **Diplomatic past** (era ≥ 9) [S].
  - **Mechanism:** full contact; two blocs formed around the two most different cultures, by value distance; friends with defensive pacts inside a bloc; the most distant pairs across blocs start cold; a treaty organization from era 10.
  - **Assumption:** modern state systems start with alliances and rivalries (a cold-war structure), not as strangers.
  - **Limit:** stylized: always exactly two blocs; opinions are drawn from fixed ranges.
- **Exploration** [S].
  - **Mechanism:** sailing nations (naval tier ≥ 2) send at most one water-only voyage at a time, at 15% a year, to an uncharted coast 20–60 tiles away. Deep ocean needs naval tier 4.
  - **Assumption:** first contact across water comes from voyages.
  - **Limit:** no land explorers; overland contact still comes from expansion, bands and trade routes.
- **Sea trade** [S].
  - **Mechanism:** between two ports, a water-only voyage is chosen when its cost (0.6 of land per tile) beats the overland route.
  - **Limit:** no ports-of-call network and no piracy.
- **Monsters** (fantasy worlds only) [C].
  - **Mechanism:** a settlement deals 0.5 × defence a month to a monster at its gates (defence = garrison + 1% of people). Monsters heal only away from a fight.
- **Realistic: real world only (addendum).**
  - **Mechanism:** Realistic and Observer worlds can never hold fantasy peoples, monsters, god-only horrors, alien land or wildlife, or exotic matter. This is enforced when the world is created and when a save loads.
  - **Technology:** every science-based technology is allowed in Realistic, era 15 included (superhuman AI, molecular manufacturing, megastructures, terraforming, mind uploading, antimatter drives). Whether each is achievable in reality is uncertain, but none is supernatural.
  - **Events:** every catastrophe and ending marked realistic is driven by world laws, which Realistic opens. That covers natural disasters at natural rates, pandemics, engineered pandemics, nuclear, chemical and biological war, AI takeover and runaway nanotechnology. Only the four fictional endings (monsters, zombies, ghouls, the Blight) never happen.
  - **The player:** places only humans and real animals; nature and history do the rest.
- **Species (addendum)** [E where sourced, else S].
  - **Mechanism:** 24 real species. New this round: elephants (savanna and jungle), water buffalo (swamp), llamas (mountains; can be domesticated), seals (cold coasts).
  - **Evidence:** maximum growth rates are set from sourced ranges where a source exists: elephant 0.07, buffalo 0.12, seals 0.10 ([research notes](data/round10/research-notes.md) §1). Others are stylized, with a plausible ordering (small, fast breeders highest).
  - **Habitat:** home biomes count in full and other biomes at a quarter, scaled down outside the species' temperature range. Sea animals follow the same rule in water (addendum; it used to be all-or-nothing, so whales bled out in shallow water).
- **Predators and prey (addendum)** [S].
  - **Mechanism:** a pack hunts every herbivore herd within 5 tiles. In a month it takes at most 2% of a herd, and never more than that prey species' own monthly growth, so slow breeders are not hunted down. It needs 0.3 prey units per predator a month to be fully fed, and heads for the richest prey in country it can live in. Seeded predators start within reach of prey.
  - **Assumption:** predators take a minority of their prey each year, and packs follow prey.
  - **Limit:** herd counts are population units, not headcounts, so the predator-to-prey ratio (about 1 to 15) is stylized; real wolf-to-deer ratios are near 1 to 100 or lower. There is no ambush predation (crocodiles chase like wolves), and packs do not range between prey herds, so a pack dropped by hand lives on the one herd in reach and dies out over decades (0 of 9 in the life audit, STATUS 11). Predators stay rare in natural worlds.
- **Fuel for power plants (addendum).**
  - **Mechanism:** power buildings are staffed first and burn fuel after the month's mining, ahead of industry. They used to draw fuel before the mines produced it, so a nation could own dozens of idle fossil plants while mining coal.
  - **Effect:** industrial energy supply, energy use and emissions now follow the plants that exist. The clean-power and electric-steel levers cut emissions in every audited warmed world over 3 years (5–38%).
- **Start sites (addendum).** People begin beside a river, lake or sea. A dry site is taken only when the map has no wet land left (dry sites used to be accepted 30% of the time).
- **Explicitly not modelled, and why.**
  - **Wild animals attacking people:** predators hunt herds; people hunt animals. Wild-animal deaths are small worldwide next to disease, famine and war.
  - **Mutants:** radiation causes illness, cancer and birth defects, which the fallout model represents as deaths and sickness, not new creatures.
  - **Robot armies:** AI risk is represented as the AI-takeover ending (`future/risks.ts`), driven by AI capability, alignment and autonomy.
