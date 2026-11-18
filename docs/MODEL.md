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
