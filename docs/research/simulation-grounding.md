# Simulation grounding: real-world principles behind EPOCH's abstractions

Research for **EPOCH: Civilizations Unbound**. This file is documentation, not code.

- **Research date:** 2026-11-14
- **Purpose:** For each real-world principle that the simulation abstracts, this file states what the principle says, gives a source I actually located, suggests how a mobile god-sim could use it, and says candidly how solid the principle is.

## How to read this file

**Source status** is marked on every citation:

- **retrieved**: I opened the page, abstract or PDF during this research and checked the claim against its text.
- **search-result only**: I saw it in web-search results, with a title and summary snippet, but could not open it, usually because of paywalls, 403 errors or bot checks. Claims resting only on these are flagged.

**Classification:**

- **evidence-informed**: a documented empirical relationship. It can still be uncertain or vary between contexts.
- **stylized abstraction**: a simplifying modeling convention. Useful for mechanics, but its empirical fit is weak, contested or not the point.
- Several topics are **mixed**: a real effect wrapped in a stylized functional form. I say so where it applies.

**Design rule of thumb for EPOCH:** evidence-informed relationships can set default parameters and serve as sanity checks, for example on emergent city-size distributions and population curves. Stylized abstractions should sit behind **world-law toggles** or tunable sliders, and the UI should not present them as "how the world works".

## Summary table

| # | Principle | Classification | One-line game use |
|---|---|---|---|
| 1 | Demographic transition | evidence-informed (regularity); the stage model is stylized | Mortality responds fast to development and fertility responds with a lag, giving temporary population booms |
| 2 | Malthusian equilibrium (pre-industrial) | evidence-informed | Before industry, technology raises population density, not living standards |
| 3 | Gompertz–Makeham / Siler mortality; life tables | evidence-informed (fitted curves) | An age-specific death hazard per unit; life expectancy computed from survivorship |
| 4 | Forager vs farmer densities | evidence-informed (order of magnitude) | Carrying capacity per tile depends on subsistence mode and biome productivity |
| 5 | Population size drives technology (Kremer) | mixed (empirical support, stylized form) | Research rate grows with connected population |
| 6 | Diffusion lags; S-curves (Comin–Hobijn, Rogers, Bass) | evidence-informed (Bass form stylized) | Technologies spread between civilizations with lags, and inside each one along S-curves |
| 7 | Gravity model of trade | evidence-informed (very robust) | Trade between kingdoms ∝ size product ÷ trade cost |
| 8 | Lanchester's laws | stylized abstraction | Fast auto-resolution of off-screen battles |
| 9 | SIR epidemics; density and sanitation | mixed (SIR stylized; threshold and sanitation effects evidence-informed) | Infection compartments per settlement; sanitation lowers transmission |
| 10 | Democratic and commercial peace | evidence-informed correlation; mechanism contested | Probabilistic opinion bonuses for shared regime type and trade |
| 11 | Resource curse | evidence-informed but conditional and contested | Optional modifier: resource rents weaken state building |
| 12 | Secularization and existential security | evidence-informed at macro level; mechanism contested | Religious fervor rises with insecurity |
| 13 | Structural-demographic theory | stylized abstraction (contested theory) | A political-stress index drives dynastic cycles |
| 14 | Log CO₂ forcing; climate sensitivity | evidence-informed (physics plus assessed range) | Late-game climate model with a sensitivity slider |
| 15 | Urban scaling; Zipf's law | mixed (contested exponents; robust Zipf tail) | Superlinear city output; rank-size used as a validation check |
| 16 | Lotka–Volterra predator–prey | stylized abstraction | Aggregate wildlife cycles off-screen |
| 17 | Axelrod culture model; language divergence | Axelrod stylized; constant-rate glottochronology discredited; frequency-dependent change evidence-informed | Cultural homophily; languages drift at word-specific rates |
| 18 | Agent-based precedents (Sugarscape, Cederman); state capacity | ABMs are methodological precedents; state capacity is theory with preliminary evidence | Simple local rules; emergent states; fiscal and legal capacity as stocks |
| 19 | Acemoglu–Robinson franchise extension | stylized abstraction (formal model) | Elites choose repression, temporary redistribution or reform under revolt threat |
| 20 | Railroads and market access | evidence-informed (one country, historical) | Transport technology raises land value and growth through market access |
| 21 | Yield history (Green Revolution, Haber–Bosch) | evidence-informed | Agricultural technology multiplies carrying capacity |
| 22 | Nuclear deterrence (IR theory only) | stylized abstraction (contested theory) | Mutual deterrence suppresses total war but may permit proxy conflict |

---

## 1. Demographic transition

**(a) Principle.** As societies develop, death rates, especially among children, fall first and birth rates fall later. The gap between the two produces a temporary population boom; growth ends once both rates are low. Our World in Data (OWID) describes four observed stages plus an uncertain fifth. It says the sequence "is something we observe with great regularity and is largely independent of the culture or religion of the population". OWID's summary of why fertility falls: lower child mortality, children becoming less economically valuable as the economy changes, and greater power for women.

**(b) Source.** Our World in Data, "Demographic transition: Why is rapid population growth a temporary phenomenon?", https://ourworldindata.org/demographic-transition (**retrieved**).

**(c) Game use.** Give each settlement a "development" vector made of food security, sanitation, medicine knowledge and literacy.
- Mortality parameters (topic 3) respond to it quickly.
- Fertility responds slowly, with a lag of one or two generations (for example exponential smoothing of child survival and urbanization).
- The result is a population boom after sanitation or medicine technologies, which creates pressure for migration, expansion and war, and then levels off.
- Population pyramids, which WorldBox already shows, make the transition visible.

**(d) Classification.** **Evidence-informed** as a macro regularity. The discrete "stage" model is a descriptive stylization; timing and levels differ widely, and OWID itself calls stage 5 uncertain. Scholarly debate over cultural versus economic drivers of fertility decline was not researched here (**unverified**).

## 2. Malthusian dynamics (pre-industrial population–resource equilibrium)

**(a) Principle.** In the pre-industrial world, better technology or land raised population size and density, while income per person stayed roughly constant, so gains were "temporary". Ashraf & Galor (2011) test this across countries for 1–1500 CE. They find that "technological superiority and higher land productivity had significant positive effects on population density but insignificant effects on the standard of living".

**(b) Sources.**
- Ashraf, Q. & Galor, O. (2011), "Dynamics and Stagnation in the Malthusian Epoch", *American Economic Review* 101(5): 2003–41. EconPapers abstract: https://econpapers.repec.org/RePEc:aea:aecrev:v:101:y:2011:i:5:p:2003-41 (**retrieved**).
- NBER WP 17037 record: https://ideas.repec.org/p/nbr/nberwo/17037.html (**retrieved**).
- Gregory Clark's work was not retrieved and is not cited.

**(c) Game use.**
- Before an industrial technology threshold, each region has a carrying capacity K = f(land quality, farming technology, age or climate). Population moves toward K, and surplus per person stays small.
- A technology gain shows up as "more people", which feeds topic 5, not "richer people".
- Shocks such as ages, droughts and plagues lower K, causing famine and unrest (topic 13).
- An industrial or demographic-transition technology breaks the link (topic 1).
- The HUD can show a "Malthusian pressure" gauge (population ÷ K).

**(d) Classification.** **Evidence-informed** for the pre-industrial era. The logistic growth curve one would use to implement it is a stylized convenience.

## 3. Age-specific mortality: Gompertz–Makeham and Siler; life tables

**(a) Principle.**
- Human death risk by age is U-shaped. It is high in infancy, falls through childhood, stays nearly flat until about 40, then rises exponentially (Gompertz). Gompertz–Makeham adds a constant, age-independent term.
- The Siler model adds a declining juvenile term: **h(x) = a₁·e^(−b₁x) + a₂ + a₃·e^(b₃x)**. Here a₂ is "age-independent mortality ... usually interpreted as exogenous mortality due to environmental conditions", and the mortality-rate doubling time is ln2/b₃.
- Gurven & Kaplan (2007) fit Siler models to hunter-gatherer and horticulturalist data. They find that "the adult mortality rate doubles every 7–10 years" and that "the modal age of adult death is about seven decades". For comparison, life expectancy at birth in Sweden in 1751 was 34.
- Survivorship l(x) is the product of the three components' survival terms, found by integrating the hazard. Life expectancy at birth is the area under l(x), a standard life-table identity. The paper itself notes that Gompertz "is not derived from first biological principles".

**(b) Source.** Gurven, M. & Kaplan, H. (2007), "Longevity Among Hunter-Gatherers: A Cross-Cultural Examination", *Population and Development Review* 33(2): 321–365. Author-hosted PDF: https://gurven.anth.ucsb.edu/sites/secure.lsit.ucsb.edu.anth.d7_gurven/files/sitefiles/papers/GurvenKaplan2007pdr.pdf (**retrieved**; formula and quotes checked). The Wikipedia article "Gompertz–Makeham law of mortality" (https://en.wikipedia.org/wiki/Gompertz%E2%80%93Makeham_law_of_mortality) was **search-result only**.

**(c) Game use.** Replace WorldBox-style "max age plus a yearly death chance" with a per-tick hazard h(age):
- a₁ and b₁ (infant and child mortality) improve with sanitation and medicine.
- a₂ rises with war, famine, plague and harsh Ages.
- b₃ (the aging rate) is a species parameter, for example lower for long-lived elves.
- A life table built from the simulation (sum of survivorship) gives each kingdom's "life expectancy" stat.

A useful design consequence: low pre-modern life expectancy mostly reflects child deaths. Adults in pre-modern worlds often reach their 60s and 70s, so grandparents and elders should exist.

**(d) Classification.** **Evidence-informed:** the curves are fitted to real populations. The functional forms are curve-fitting conventions, so parameters for fantasy species are **stylized**.

## 4. Hunter-gatherer vs agricultural population densities

**(a) Principle.**
- Foragers usually live at far lower densities than farmers. The highest recorded forager density, the Chumash, is about 21.6 persons per square mile, roughly 8 per km².
- A secondary encyclopedia states that farmland supports densities "60 to 100 times greater than land left uncultivated".
- Forager density is limited by net primary productivity. Biodiversity matters most in low-productivity regions and pathogen stress in high-productivity ones. Subtropical and temperate forests support the most foragers (Tallavaara et al. 2018).
- The area each forager uses shrinks as the group grows, through sublinear scaling of space use (Hamilton et al. 2007).
- The shift to farming coincides with a "Neolithic Demographic Transition": a rise in the share of juvenile skeletons, read as roughly +2 births per woman (Bocquet-Appel 2011; search-result only).
- Commonly quoted typical values are about 0.01–1 person/km² for foragers and about 20–30/km² for shifting cultivation. These come from search-result summaries of a Vaclav Smil book that I could not open (403), so they are **unverified orders of magnitude**.

**(b) Sources.**
- Tallavaara, Eronen & Luoto (2018), "Productivity, biodiversity, and pathogens influence the global hunter-gatherer population density", *PNAS* 115(6): https://pmc.ncbi.nlm.nih.gov/articles/PMC5819417/ (**retrieved**).
- Hamilton, Milne, Walker & Brown (2007), "Nonlinear scaling of space use in human hunter-gatherers", *PNAS* 104(11): https://www.unm.edu/~robwal/pnas.pdf (**retrieved**; contains no headline density figures).
- Wikipedia, "Hunter-gatherer" (Chumash figure): https://en.wikipedia.org/wiki/Hunter-gatherer (**retrieved**).
- New World Encyclopedia, "Hunter-gatherer" ("60 to 100 times"): https://www.newworldencyclopedia.org/entry/Hunting_and_gathering (**retrieved**; secondary source).
- Bocquet-Appel (2011), *Science* 333: 560–561, HAL record https://hal.archives-ouvertes.fr/hal-00834316 (**search-result only**).

**(c) Game use.**
- Carrying capacity per tile = subsistence mode × biome productivity × pathogen penalty (hot and wet biomes).
- Foraging K is small, on the order of 0.1 per km² equivalent. Farming multiplies it by about 10–100× depending on irrigation and fertilizer technology (topic 21).
- Adopting farming raises fertility (the Neolithic transition) and contact rates, and so disease (topic 9).
- Forager bands need large, roaming home ranges, which suits nomadic "packs" before kingdoms form.

**(d) Classification.** **Evidence-informed at order-of-magnitude level.** Exact multipliers are **stylized**, and several numbers above are unverified.

## 5. Population size and technological progress (Kremer 1993)

**(a) Principle.** Ideas are non-rival, so a larger population means more potential inventors and faster technological change. Combined with Malthusian limits (topic 2), this implies that "over most of history, the growth rate of population will be proportional to its level". Empirically, "among societies with no possibility for technological contact, those with larger initial populations have had faster technological change and population growth".

**(b) Source.** Kremer, M. (1993), "Population Growth and Technological Change: One Million B.C. to 1990", *QJE* 108(3): 681–716. EconPapers abstract: https://econpapers.repec.org/RePEc:oup:qjecon:v:108:y:1993:i:3:p:681-716. (**retrieved**).

**(c) Game use.**
- Research points per year = c · (effective connected population)^λ · literacy.
- "Connected" covers populations linked by trade, shared language, books and alliances. Isolated islands fall behind; contact and conquest merge "idea pools".
- Choose λ < 1 for balance, so huge empires do not snowball without limit.
- This also gives a mechanical reason for players to value connectivity.

**(d) Classification.** **Mixed.** The long-run aggregate pattern has empirical support, but the functional form is **stylized**. Scale effects in growth models are debated, and that literature was not researched here (**unverified**).

## 6. Technology diffusion and adoption lags; S-curves

**(a) Principle.**
- Across countries: Comin & Hobijn estimate from "15 technologies in 166 countries over the last two centuries" that "on average, countries have adopted technologies 45 years after their invention", with "substantial variation". "Newer technologies have been adopted faster than old ones", and adoption differences account for "at least 25 percent of per capita income differences".
- Their 2006 working paper reports that where lags matter, they are "largely determined by lack of educational attainment and lack of trade openness".
- Within a society, adoption follows an S-curve over time across Rogers' adopter categories: innovators, early adopters, early majority, late majority, laggards.
- Bass (1969) models the timing of first adoption as "related to the number of previous buyers", from "innovative and imitative behavior". The usual hazard form is p + q·F(t). That standard equation is given here as commonly stated; I did not check it against the paper's full text.

**(b) Sources.**
- Comin & Hobijn (2010), *AER* 100(5): 2031–59, AEA page: https://www.aeaweb.org/articles?id=10.1257/aer.100.5.2031 (**retrieved**).
- NBER WP 12314: https://www.nber.org/papers/w12314 (**retrieved**).
- Bass (1969), *Management Science* 15(5): 215–227, IDEAS: https://ideas.repec.org/a/inm/ormnsc/v15y1969i5p215-227.html (**retrieved**, abstract).
- Wikipedia, "Diffusion of innovations" (Rogers; S-curve; adopter categories): https://en.wikipedia.org/wiki/Diffusion_of_innovations (**retrieved**).

**(c) Game use.**
- Two layers. **Between civilizations:** a technology known in civ A reaches civ B with a lag that falls with contact intensity (gravity-model trade, topic 7; shared language; captured books) and with B's literacy and education.
- **Inside a civilization:** the adopted share F follows dF/dt = (p + q·F)(1 − F). Here p comes from external contact and books, and q from internal word of mouth.
- Show an adoption-progress map, so that "the plough spreading" is visible.

**(d) Classification.** **Evidence-informed:** lags and S-shaped adoption are well documented. The Bass equation is a **stylized** but empirically successful forecasting form.

## 7. Gravity model of international trade

**(a) Principle.** Trade between two economies rises roughly in proportion to their economic sizes and falls with distance and other trade costs: X_ij ∝ Y_iᵃ · Y_jᵇ / D_ijᶿ. In Head & Mayer's meta-analysis, GDP elasticities are near unity (mean 0.98 for the origin, 0.84 for the destination), and "the average distance elasticity of −0.93 is close to the −0.91 reported by Disdier and Head (2008)". Estimation consistent with theory needs "multilateral resistance" controls; leaving them out biases the distance coefficient toward zero.

**(b) Source.** Head, K. & Mayer, T. (2014), "Gravity Equations: Workhorse, Toolkit, and Cookbook", *Handbook of International Economics* vol. 4. CEPII Working Paper 2013-27: http://www.cepii.fr/PDF_PUB/wp/2013/wp2013-27.pdf (**retrieved**, figures checked).

**(c) Game use.** Compute trade between kingdoms each season:

flow_ij = k · GDP_i · GDP_j / cost_ijᶿ, with θ ≈ 1.

- cost_ij uses path distance with terrain, sea and river multipliers. It is infinite during war; reduced by roads, ports, shared language and alliances; and raised by borders and tariffs.
- This fills WorldBox's gap: WorldBox has no trade between kingdoms (see the inventory, F94).
- Trade volume feeds technology diffusion (topic 6), the commercial-peace bonus (topic 10) and market access (topic 20).

**(d) Classification.** **Evidence-informed:** one of the most robust empirical regularities in economics. The exact exponents vary by era and sample, so treat them as tunable.

## 8. Lanchester's laws of combat

**(a) Principle.** Lanchester (1916) modeled attrition with differential equations.
- The **linear law** covers un-aimed area fire or one-on-one melee.
- The **square law** covers aimed fire, where each shooter can engage any enemy: dA/dt = −βB, dB/dt = −αA. Under it, fighting strength grows with the *square* of numbers, so "a superiority in firepower equal to the square of the inferiority in numbers" is needed to compensate. Lanchester's own text calls this the "N-square law".
- Empirical fits to historical battles are weak. For Kursk and the Ardennes, no single law fits consistently.

**(b) Sources.**
- Lanchester, F. W. (1916), *Aircraft in Warfare*, PDF: https://www.math.fsu.edu/~mesterto/NewCourses/MAP5932/2016/PDF/PDF02/Lanchester1916aAircraftInWarfare.pdf (**retrieved**; contains "the N-square law").
- Wikipedia, "Lanchester's laws": https://en.wikipedia.org/wiki/Lanchester%27s_laws (**retrieved**; equations).
- Lucas & Turkes (2004), "Fitting Lanchester Equations to the Battles of Kursk and Ardennes", NPS: https://calhoun.nps.edu/entities/publication/7b018a9d-45fa-4e5a-97b2-a619e14de2e6 (**search-result only**; the page did not render).
- A PMC study testing more than 1,000 historical battles: https://pmc.ncbi.nlm.nih.gov/articles/PMC4701162 (**search-result only**; blocked by reCAPTCHA).

**(c) Game use.**
- Resolve off-screen or zoomed-out battles with Lanchester equations, with an exponent between 1 (melee) and 2 (ranged).
- Modifiers: terrain, walls, equipment tier, morale.
- Switch to per-unit combat when the camera is close.
- The square law also gives the AI a reason to concentrate forces.

**(d) Classification.** **Stylized abstraction:** intuitive and cheap, with a poor empirical fit. Keep it behind tunable constants.

## 9. SIR epidemic models; density and sanitation

**(a) Principle.**
- Kermack & McKendrick (1927) assumed new infections proportional to the product of infected and susceptible people. They showed that "a critical or threshold density of population" exists: below it no epidemic occurs; above it the epidemic's size "increases rapidly"; and an epidemic can end before all susceptible people are infected.
- The standard modern form is dS/dt = −βSI/N, dI/dt = βSI/N − γI, dR/dt = γI, with R₀ = β/γ. This is given in the usual textbook notation.
- On sanitation, Cutler & Miller (2005) find that clean water (filtration and chlorination) "was responsible for nearly half of the total mortality reduction in major cities, three-quarters of the infant mortality reduction, and nearly two-thirds of the child mortality reduction" in the early-20th-century US.

**(b) Sources.**
- MacTutor (University of St Andrews) reproduction of Kermack & McKendrick, *Proc. R. Soc. A* 115 (1927): https://mathshistory.st-andrews.ac.uk/Extras/Epidemic_theory/ (**retrieved**).
- Cutler & Miller, NBER WP 10511 (published in *Demography* 2005): https://www.nber.org/papers/w10511 (**retrieved**).

**(c) Game use.**
- Track S/I/R compartments per settlement rather than per unit, for mobile performance.
- β ∝ density × (1 − sanitation) × contact. Wells, aqueducts and sewers cut β; medicine raises γ.
- Boats, armies and trade routes carry infection between settlements. Rats or animals act as reservoirs.
- Compare WorldBox, where plague spreads by random proximity rolls per unit (inventory F127). A compartment model is cheaper and shows the threshold effect.

**(d) Classification.** **Mixed.** SIR's homogeneous mixing is a **stylized abstraction**. The threshold and density mechanism and the effect of clean water are **evidence-informed**, though the latter rests on one country's historical data.

## 10. Democratic peace and commercial (trade) peace, with critiques

**(a) Principle.**
- "It is widely accepted that democracies are less conflict prone, if only with other democracies" (Gartzke 2007).
- Oneal & Russett (1999): across all dyads they "find no relationship between interdependence and peace". Among politically relevant dyads, "the pacific benefits of trade become evident", and the result is robust across specifications.
- Critiques:
  - Rosato (2003) argues the proposed causal logics fail: democracies do not reliably externalize norms or trust one another, so peace among democracies "may not be caused by the democratic nature of those states".
  - Slantchev, Alexandrova & Gartzke (2005) reply that Rosato "misunderstand[s] the probabilistic nature" of the arguments and ignores selection bias.
  - Gartzke (2007) proposes a "capitalist peace": development, free markets and similar interests account for "the effect commonly attributed to regime type".

**(b) Sources** (all **retrieved**):
- Rosato, *APSR* 2003: https://econpapers.repec.org/RePEc:cup:apsrev:v:97:y:2003:i:04:p:585-602_00
- Slantchev et al.: https://pages.ucsd.edu/~bslantchev/published/abs/logicdempeace-abs.html
- Oneal & Russett, *JPR* 1999: https://ideas.repec.org/a/sae/joupea/v36y1999i4p423-442.html
- Gartzke, *AJPS* 2007: https://ideas.repec.org/a/wly/amposc/v51y2007i1p166-191.html

**(c) Game use.**
- Add *probabilistic* opinion modifiers that lower the weight of war plots, not hard bans.
- Examples: a bonus when both kingdoms have representative regimes, if EPOCH models regimes; a bonus scaled by each side's share of trade with the other (topic 7); a bonus for development or shared interests.
- Expose a world-law slider between "democratic peace" and "capitalist peace" weighting so designers can test alternatives.

**(d) Classification.** **Evidence-informed correlation, mechanism contested.** Implement it as a weak, tunable bias.

## 11. Resource curse

**(a) Principle.**
- Sachs & Warner (1995) found that "economies with a high ratio of natural resource exports to GDP in 1971 ... tended to have low growth rates during the subsequent period 1971-89", even after controls.
- Ross's review (2015) reports "considerable evidence that under certain conditions one type of resource wealth — petroleum — tends to produce a 'political resource curse'". It also reports that "a significant minority" of studies say the curse is a statistical artifact, and that nearly all the evidence is observational. These Ross quotes come from search-result text; I could not open the review (403).

**(b) Sources.**
- Sachs & Warner, NBER WP 5398: https://www.nber.org/papers/w5398 (**retrieved**).
- Ross, M. (2015), *Annual Review of Political Science* 18: 239–59, https://www.annualreviews.org/content/journals/10.1146/annurev-polisci-052213-040359 (**search-result only**).

**(c) Game use.** Add an optional "resource curse" world law. A kingdom whose treasury relies heavily on point-source rents (gold or mythril mines, captured treasure) gets:
- slower growth of tax-collection capacity (topic 18);
- higher weights for coup and rebellion plots;
- elite competition over control of the mine.

Culture or institution traits can offset these effects.

**(d) Classification.** **Evidence-informed but conditional and contested.** It should be off by default or weak.

## 12. Secularization and existential security (Norris & Inglehart)

**(a) Principle.** Norris & Inglehart present "a theory of existential security, backed by empirical evidence from scores of societies".
- Religion stays strong where populations are vulnerable and growing fast.
- Secularization proceeds in most advanced industrial societies, most visibly in Scandinavia and Western Europe.
- The result is growing religious divergence worldwide.

Critics argue that cross-national macro correlations do not establish the individual-level link. One study reports that education explains secularity better than material security (that study was **search-result only**).

**(b) Source.** Norris & Inglehart, *Sacred and Secular: Religion and Politics Worldwide*, Cambridge University Press (2nd ed. 2011), chapter "Reexamining the Theory of Existential Security": https://www.cambridge.org/core/books/sacred-and-secular/reexamining-the-theory-of-existential-security/F2C5AAF80E56801452A73A25231AD65B (**retrieved**, chapter page).

**(c) Game use.**
- Religious conversion and fervor scale with an insecurity index: famine, war losses, plague, disasters, harsh Ages.
- They fall with security: food surplus, low child mortality, long peace.
- Disasters can trigger "revival" events.
- This links naturally to WorldBox-style Ages ("Age of Despair").

**(d) Classification.** **Evidence-informed at the macro level; mechanism contested.**

## 13. Structural-demographic theory of state instability (Goldstone, Turchin)

**(a) Principle.** Turchin & Nefedov's *Secular Cycles* "elaborates and expands upon the demographic-structural theory first advanced by Jack Goldstone". Their claim for agrarian states:
- Population growth past capacity depresses real wages ("popular immiseration").
- It multiplies elites and aspirants, intensifying competition among them.
- It strains state finances, which leads to crisis and instability.
- Long expansion is followed by stagnation and a disintegrative phase.

They test this using "population numbers, prices and real wages, elite numbers and incomes, state finances, and sociopolitical instability". Turchin later combined the parts into a "Political Stress Indicator" Ψ = mass mobilization × elite mobilization × state fiscal distress (**search-result only**). Most academic historians are skeptical (Nature 2012: "historians are not so sure").

**(b) Sources.**
- Turchin's book page for *Secular Cycles* (Princeton UP, 2009): https://peterturchin.com/books/secular-cycles (**retrieved**).
- Nature news feature, "Human cycles: History as science" (2012): https://www.nature.com/articles/488024a (**retrieved**).
- Turchin (2013), "Modeling Social Pressures Toward Political Instability", *Cliodynamics* 4(2): https://escholarship.org/uc/item/6qp8x28p (**search-result only**; 403).

**(c) Game use.**
- Track per kingdom: food per worker (a wage proxy), number of nobles or clan members versus available offices, and treasury balance.
- Combine them into a stress index that scales the rates of rebellion, succession-crisis and civil-war plots.
- This produces emergent dynastic cycles over a century or more, which matches WorldBox-style "plots" well (inventory F106).

**(d) Classification.** **Stylized abstraction, a contested theory** with some quantitative support. Do not present it as a law of history.

## 14. Logarithmic CO₂ forcing and equilibrium climate sensitivity

**(a) Principle.**
- CO₂'s radiative forcing grows roughly with the logarithm of concentration. The simplified form from Myhre et al. (1998) is **ΔF = α·ln(C/C₀) with α = 5.35 W m⁻²**, which gives about 3.7 W m⁻² for a doubling. That is arithmetic: 5.35 × ln 2.
- Etminan et al. (2016) revised it: α now depends on the CO₂ and N₂O concentrations, and "forcing for high CO₂ concentrations is 9% higher than previous expressions".
- IPCC AR6 WG1 SPM A.4.4: "the very likely range of equilibrium climate sensitivity is between 2°C (high confidence) and 5°C (medium confidence). The AR6 assessed best estimate is 3°C with a likely range of 2.5°C to 4°C".
- Human-caused forcing was 2.72 [1.96 to 3.48] W m⁻² in 2019 relative to 1750.
- NOAA's Annual Greenhouse Gas Index switched to IPCC AR6 *effective* radiative-forcing expressions from 2023.

**(b) Sources.**
- IPCC AR6 WG1 Summary for Policymakers PDF: https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_SPM.pdf (**retrieved**).
- Etminan, Myhre, Highwood & Shine (2016), *GRL* 43: 12,614–12,623, PDF: https://courses.seas.harvard.edu/climate/eli/Courses/global-change-debates/Sources/CO2-saturation/more/Etminan_2016.pdf (**retrieved**; it quotes the 5.35 value of Myhre et al. 1998).
- NOAA AGGI: https://gml.noaa.gov/aggi/aggi.html (**retrieved**).
- Myhre et al. (1998), *GRL* 25(14), doi:10.1029/98GL01908: the original was not opened (**search-result only**).

**(c) Game use** (late game, industrial eras):
- Fuel-burning settlements add to a global CO₂ stock.
- Forcing: ΔF = 5.35·ln(C/C₀), where C₀ is the world's starting concentration.
- Equilibrium warming: ΔT_eq = S · ΔF / 3.7, with S set by a "climate sensitivity" world law (default 3, range 2–5).
- The actual temperature relaxes toward ΔT_eq with a lag of decades.
- Temperature shifts biome boundaries, crop yields and sea level. These impact functions are **stylized** and should be labeled as gameplay.

**(d) Classification.** The forcing relation and the ECS range are **evidence-informed**: a fit to radiative-transfer physics and an assessed scientific range. The game's lag and impact model would be a **stylized abstraction**.

## 15. Urban scaling laws and Zipf's law

**(a) Principle.**
- Bettencourt et al. (2007) find that city properties scale as Y = Y₀·N^β. "Quantities reflecting wealth creation and innovation have β ≈1.2 >1 (increasing returns)", while infrastructure shows "β ≈0.8 <1 (economies of scale)", and "the pace of social life in the city increases with population size".
- Arcaute et al. (2015) challenge this. Rebuilding thousands of city-boundary definitions for England and Wales, they find "population size alone does not provide enough information", "most urban indicators scale linearly", and non-linear exponents "fluctuate considerably" with the boundaries.
- Zipf's law: "the number of cities with populations greater than S is proportional to 1/S". Gabaix (1999) shows that proportional (Gibrat) growth in the upper tail produces it.

**(b) Sources** (all **retrieved**):
- Bettencourt et al., *PNAS* 104(17), PDF: https://www.colorado.edu/socialreactors/sites/default/files/attached-files/bettencourt_et_al._2007_pnas.pdf
- Arcaute et al., arXiv:1301.1674 (published in *J. R. Soc. Interface* 2015): https://arxiv.org/abs/1301.1674
- Gabaix, *QJE* 114(3): https://ideas.repec.org/a/oup/qjecon/v114y1999i3p739-767..html

**(c) Game use.**
- City output (gold, research) grows with population to a power of about 1.1–1.2, so big cities are engines. Crime and disease grow superlinearly too, so big cities are also risky.
- Infrastructure upkeep grows with population to a power of about 0.85.
- Use Zipf as a **validation check**: plot each world's emergent rank versus size in the stats panel. If the tail is far from slope −1, city growth is probably not proportional enough.

**(d) Classification.** **Mixed.** Zipf's upper tail is a robust regularity (**evidence-informed**). The specific scaling exponents are **contested** and depend on how cities are defined, so treat them as stylized defaults.

## 16. Lotka–Volterra predator–prey dynamics

**(a) Principle.** dU/dt = αU − γUV; dV/dt = eγUV − βV. Here α is the prey birth rate, β the predator death rate, γ the capture rate and e the conversion efficiency. Populations oscillate around the equilibrium (β/eγ, α/γ). The classic illustration is the Hudson Bay Company hare and lynx pelt records, read with the assumption "that the recorded number of trapped animals is proportional to the animal population". Critics argue the pelt data fit the classical model poorly, for example in peak timing (Deng et al. 2018, **search-result only**).

**(b) Sources.** Chasnov, *Mathematical Biology* §1.4, LibreTexts (CC BY 3.0): https://math.libretexts.org/Bookshelves/Applied_Mathematics/Mathematical_Biology_(Chasnov)/01:_Population_Dynamics/1.04:_The_Lotka-Volterra_Predator-Prey_Model (**retrieved**; equations checked). The critique by Deng et al. at https://www.math.unl.edu/~bdeng1/Papers/DengHLCTmodel.pdf could not be fetched because of a TLS certificate error, so it is **search-result only**.

**(c) Game use.**
- Run wildlife as aggregate populations per region using a discrete Lotka–Volterra model, with a logistic cap on prey to avoid neutral cycles and runaway extinction.
- Spawn individual animal agents only near the camera.
- Civilization hunting acts as a third predator. Overhunting can collapse prey and trigger famine for carnivores.

**(d) Classification.** **Stylized abstraction:** qualitatively useful, but the classic empirical fit is debated.

## 17. Axelrod's model of cultural dissemination; language divergence (and glottochronology critiques)

**(a) Principle.**
- Axelrod (1997) places agents at fixed sites, each with several cultural features. "The more similar an actor is to a neighbor, the more likely that that actor will adopt one of the neighbor's traits." The result is that "local convergence can generate global polarization". Stable regions decrease with the number of features, increase with the number of traits per feature, and decrease with interaction range.
- Glottochronology assumed basic vocabulary is replaced at a constant rate. Lees estimated r ≈ 0.8048 retained per millennium on the 200-word list; Swadesh 0.86 on the 100-word list.
- Bergsland & Vogt (1962) showed rates differ: about 4% per millennium for Icelandic against about 20% for Riksmål. The method "has been rejected by many linguists".
- Pagel, Atkinson & Meade (2007): across 200 meanings in 87 Indo-European languages, how often a word is used predicts how fast it is replaced, accounting "for approximately 50% of the variation".

**(b) Sources** (all **retrieved**):
- Axelrod, *J. Conflict Resolution* 41(2), EconPapers: https://econpapers.repec.org/RePEc:sae:jocore:v:41:y:1997:i:2:p:203-226
- Wikipedia, "Glottochronology": https://en.wikipedia.org/wiki/Glottochronology
- Pagel et al., *Nature* 449, CentAUR record: https://centaur.reading.ac.uk/10061/

**(c) Game use.**
- **Culture:** each settlement holds a culture vector, for example 5 features × 10 traits. When units interact, copying is weighted by similarity (Axelrod). This complements WorldBox's pot-based conversion (inventory F76) and produces stable cultural regions and frontiers.
- **Language:** each language is a lexicon of about 100 "concepts". Each concept has a replacement rate that falls with its usage frequency. Isolated populations drift apart, and when mutual similarity drops below a threshold a new language is declared. This yields dialect continua and family trees, with drift that is plausibly non-constant.

**(d) Classification.** Axelrod: **stylized abstraction**. Constant-rate glottochronology: **discredited as a general law**, so do not present it as dating. Frequency-dependent replacement: **evidence-informed**.

## 18. Agent-based social simulation precedents (Sugarscape, Cederman) and state capacity (Besley & Persson)

**(a) Principle.**
- **Sugarscape** (Epstein & Axtell 1996): agents "born ... with a vision, a metabolism, a speed, and other genetic attributes" follow one local rule, roughly "find the spot with the most sugar; go there and eat". From this emerge migration, a wealth distribution, segregated "tribes", combat, trade, crashes and "ecological collapse".
- **Cederman** (1997, *Emergent Actors in World Politics*) treats states and nations as emergent actors in complex-adaptive-system models, including "a 20 x 20 lattice of mini-states jockeying for position" (JASSS review). The name "GeoSim" for Cederman's later Repast model of geopolitics (capitals and provinces) appears only in search-result snippets (a PNAS 2002 paper and SFI slides), so it is **unverified** here.
- **State capacity** (Besley & Persson 2009): "policy choices" are limited by "past investments in legal and fiscal state capacity". "Common interest public goods, such as fighting external wars, as well as political stability and inclusive political institutions, are conducive to building state capacity."

**(b) Sources.**
- Brookings book page: https://www.brookings.edu/books/growing-artificial-societies/ (**retrieved**).
- Lazer's JASSS review of Cederman (1997): https://jasss.org/4/2/reviews/lazer.html (**retrieved**).
- Cederman (2002) PNAS "Endogenizing geopolitical boundaries with agent-based modeling", PMC128600 (**search-result only**).
- Besley & Persson, NBER WP 13028 (*AER* 2009): https://www.nber.org/papers/w13028 (**retrieved**).

**(c) Game use.**
- Keep Sugarscape's discipline: simple local rules, rich macro patterns, and every rule visible in a debug overlay.
- Model states as Cederman-style aggregates of provinces that can be absorbed or break away.
- Represent state capacity as two stocks that kingdoms invest in. Fiscal capacity gives tax yield and army upkeep; legal capacity gives property rights, trade and lower rebellion. External threats raise the incentive to invest.

**(d) Classification.** The ABMs are **methodological precedents (stylized)**, not empirical laws. State capacity is a **formal theory with preliminary cross-country correlations** ("preliminary empirical evidence ... consistent with the theory").

## 19. Acemoglu & Robinson: democratization under threat of revolution

**(a) Principle.** Nineteenth-century franchise extensions were "strategic decisions by the political elite to prevent widespread social unrest and revolution". Promises of redistribution alone are not credible because "current transfers do not ensure future transfers". Extending the franchise "changes future political equilibria and acts as a commitment to redistribution". The model also explains a Kuznets-curve fall in inequality after democratization.

**(b) Source.** Acemoglu & Robinson (2000), "Why Did the West Extend the Franchise?", *QJE* 115(4): 1167–1199. EconPapers abstract: https://econpapers.repec.org/RePEc:oup:qjecon:v:115:y:2000:i:4:p:1167-1199. (**retrieved**). Later empirical tests, such as those using revolutions in neighboring countries as a proxy for threat, appeared only in search results (**unverified**).

**(c) Game use.** A regime state machine.
- When the stress index (topic 13) and inequality are high, the ruling clan's AI chooses among three options:
  - repress, which costs army loyalty and may fail;
  - temporary concessions, which decay over time;
  - permanent reform, which extends participation, changes policy weights and lowers future rebellion risk.
- The probabilities depend on how credible the threat is: army loyalty, and revolutions in neighboring kingdoms.
- This gives players readable political evolution.

**(d) Classification.** **Stylized abstraction:** a formal game-theoretic model. Its empirical support was not assessed here.

## 20. Transport costs and market access: railroads (Donaldson & Hornbeck 2016)

**(a) Principle.** A county's "market access" sums the economic size of all other counties, discounted by trade costs; it is derived from general-equilibrium trade theory. As the US railroad network grew from 1870 to 1890, "county agricultural land values increased substantially with increases in county market access". The working paper reports an elasticity of 1.1. "Removing all railroads in 1890 is estimated to decrease the total value of U.S. agricultural land by 60%" (journal version; 64% in the working paper), "with limited potential for mitigating these losses through feasible extensions to the canal network or improvements to country roads".

**(b) Sources** (both **retrieved**):
- *QJE* 131(2): 799–858, EconPapers: https://econpapers.repec.org/RePEc:oup:qjecon:v:131:y:2016:i:2:p:799-858.
- NBER WP 19213: https://www.nber.org/papers/w19213

**(c) Game use.**
- Compute MA_i = Σ_j cost_ij^(−θ) · Pop_j over settlements, reusing the topic 7 cost matrix.
- Roads, canals, ports and rail lower costs.
- Farm output, land value and the pull for migration grow with market access; an elasticity near 1 is a reasonable default.
- The AI chooses road and rail projects by the market-access gain, so players see railway towns boom.

**(d) Classification.** **Evidence-informed:** a careful historical estimate, but for one country and period.

## 21. Agricultural productivity history: Green Revolution and Haber–Bosch

**(a) Principle.**
- OWID: "Today, the world can produce almost three times as much cereal from a given area of land than it did in 1961". Most growth in output came from yields, with little land expansion.
- The Green Revolution combined fertilizers, pesticides, irrigation, mechanization and high-yielding seeds. Adoption was uneven; Sub-Saharan Africa lagged.
- Synthetic nitrogen fertilizer from the Haber–Bosch process supports "approximately half of the global population". Erisman et al. (2008), as cited by OWID, put the share fed by nitrogen fertilizer at 44% in 2000 and 48% in 2008. OWID adds that without it the world population "may have been reduced to only around 4 billion people", and Smil (2004) estimated that harvests would be about half.

**(b) Sources** (both **retrieved**):
- OWID, "Yields vs. land use: how the Green Revolution enabled us to feed a growing population": https://ourworldindata.org/yields-vs-land-use-how-has-the-world-produced-enough-food-for-a-growing-population
- OWID, "How many people does synthetic fertilizer feed?": https://ourworldindata.org/how-many-people-does-synthetic-fertilizer-feed

**(c) Game use.**
- Agricultural technologies multiply yields, raising carrying capacity K in topic 2 and topic 4. Default multipliers could be about 1.2–1.5× per pre-industrial step and about 2–3× for synthetic fertilizer plus improved seeds; these numbers are stylized.
- Higher yields allow "land sparing", letting forests regrow.
- Fertilizer requires industry and energy (link to topic 14), and runoff can be an optional pollution effect (stylized).

**(d) Classification.** **Evidence-informed:** historical data. The exact in-game multipliers are stylized.

## 22. Nuclear deterrence (international-relations theory only)

**(a) Principle.** No technical weapon details are given or needed here.
- Deterrence theory holds that the credible threat of unacceptable retaliation can prevent attack.
- In *The Spread of Nuclear Weapons*, Waltz argues "more may be better": "new nuclear states will use their acquired nuclear capabilities to deter threats and preserve peace". Sagan argues "more will be worse": "novice nuclear states lack adequate organizational controls over their new weapons, resulting in a higher risk of either deliberate or accidental nuclear war".
- Two further ideas were seen only in search results: Schelling's "diplomacy of violence" and his deterrence/compellence distinction (*Arms and Influence*, 1966), and the "stability–instability paradox" (Snyder), under which strategic stability may make lower-level conflict more likely.

**(b) Sources.**
- Stanford FSI/CISAC book page, Sagan & Waltz, *The Spread of Nuclear Weapons: A Debate Renewed*: https://cisac.fsi.stanford.edu/node/25364 (**retrieved**).
- Council on Foreign Relations primer citing Schelling: https://www.cfr.org/articles/primer-military-force (**search-result only**).
- Wikipedia, "Stability–instability paradox": https://en.wikipedia.org/wiki/Stability%E2%80%93instability_paradox (**search-result only**).

**(c) Game use** (abstract only):
- A late-game, purely abstract "doomsday deterrent" flag on kingdoms.
- When both rivals hold it, the weight of total-war plots drops sharply, while border skirmishes and proxy wars may become more likely (the stability–instability idea).
- An optional small yearly accident risk follows Sagan's organizational argument, as a world-law toggle.
- Keep this separate from the player's own god powers. WorldBox offers nukes as god powers, but those are not diplomacy.

**(d) Classification.** **Stylized abstraction:** contested theory with limited direct empirical testing. Present it only as an optional strategic-AI bias.

---

## Game-design references (public talks and articles)

These are design precedents, not scientific sources.

| Reference | What it offers EPOCH | Source | Status |
|---|---|---|---|
| Tarn Adams (Dwarf Fortress): GDC 2016 presentation on **myth generation**, 2019 UCSC talk on **emergent narrative**, 2018 Roguelike Celebration talk on villains and procedural stories | World generation as simulated history: civilizations, figures and legends produced by running the simulation before play. Our Ages, books and history log can borrow this "pre-history simulation" step. | Bay 12 Games links page (developer's site, lists the talks): https://bay12games.com/dwarves/links.html | retrieved (listing only; talk content not reviewed) |
| T. X. Short & T. Adams (eds.), *Procedural Storytelling in Game Design* (CRC Press/Routledge, 2019) | Essays on building narrative systems, procedural dialogue and generated characters with backstories. | Routledge book page: https://www.routledge.com/Procedural-Storytelling-in-Game-Design/Short-Adams/p/book/9781138595309 | retrieved (publisher description) |
| RimWorld's **AI storytellers** (Ludeon Studios) | Officially "a story generator" that works by "controlling the 'random' events". Three storytellers: "Randy Random does crazy stuff, Cassandra Classic goes for rising tension, and Phoebe Chillax likes to relax." A direct model for an EPOCH "disaster and event director" with selectable pacing. | Official site: https://rimworldgame.com/ (also the Steam page https://store.steampowered.com/app/294100/RimWorld/) | retrieved |
| Tynan Sylvester, GDC 2017: "'RimWorld': Contrarian, Ridiculous, and Impossible Game Design Methods" | Defining the product "not as a game, but as a story generator". Leaving features out so players fill gaps with their imagination. A method for choosing which features actually matter. | GDC Vault: https://gdcvault.com/play/1024686/-RimWorld-Contrarian-Ridiculous-and | retrieved (abstract) |
| WorldBox's own design choices (Ages instead of day/night; plots as visible intent; possession; meta control) | See worldbox-feature-inventory.md, sections 15, 16 and 23. | Developer Steam announcements cited there | retrieved |

---

## Consolidated source list for this file

**Retrieved** (opened and checked):

- https://ourworldindata.org/demographic-transition
- https://econpapers.repec.org/RePEc:aea:aecrev:v:101:y:2011:i:5:p:2003-41
- https://ideas.repec.org/p/nbr/nberwo/17037.html
- https://gurven.anth.ucsb.edu/sites/secure.lsit.ucsb.edu.anth.d7_gurven/files/sitefiles/papers/GurvenKaplan2007pdr.pdf
- https://pmc.ncbi.nlm.nih.gov/articles/PMC5819417/
- https://www.unm.edu/~robwal/pnas.pdf
- https://en.wikipedia.org/wiki/Hunter-gatherer
- https://www.newworldencyclopedia.org/entry/Hunting_and_gathering
- https://econpapers.repec.org/RePEc:oup:qjecon:v:108:y:1993:i:3:p:681-716.
- https://www.aeaweb.org/articles?id=10.1257/aer.100.5.2031
- https://www.nber.org/papers/w12314
- https://ideas.repec.org/a/inm/ormnsc/v15y1969i5p215-227.html
- https://en.wikipedia.org/wiki/Diffusion_of_innovations
- http://www.cepii.fr/PDF_PUB/wp/2013/wp2013-27.pdf
- https://www.math.fsu.edu/~mesterto/NewCourses/MAP5932/2016/PDF/PDF02/Lanchester1916aAircraftInWarfare.pdf
- https://en.wikipedia.org/wiki/Lanchester%27s_laws
- https://mathshistory.st-andrews.ac.uk/Extras/Epidemic_theory/
- https://www.nber.org/papers/w10511
- https://econpapers.repec.org/RePEc:cup:apsrev:v:97:y:2003:i:04:p:585-602_00
- https://pages.ucsd.edu/~bslantchev/published/abs/logicdempeace-abs.html
- https://ideas.repec.org/a/sae/joupea/v36y1999i4p423-442.html
- https://ideas.repec.org/a/wly/amposc/v51y2007i1p166-191.html
- https://www.nber.org/papers/w5398
- https://www.cambridge.org/core/books/sacred-and-secular/reexamining-the-theory-of-existential-security/F2C5AAF80E56801452A73A25231AD65B
- https://peterturchin.com/books/secular-cycles
- https://www.nature.com/articles/488024a
- https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_SPM.pdf
- https://courses.seas.harvard.edu/climate/eli/Courses/global-change-debates/Sources/CO2-saturation/more/Etminan_2016.pdf
- https://gml.noaa.gov/aggi/aggi.html
- https://www.colorado.edu/socialreactors/sites/default/files/attached-files/bettencourt_et_al._2007_pnas.pdf
- https://arxiv.org/abs/1301.1674
- https://ideas.repec.org/a/oup/qjecon/v114y1999i3p739-767..html
- https://math.libretexts.org/Bookshelves/Applied_Mathematics/Mathematical_Biology_(Chasnov)/01:_Population_Dynamics/1.04:_The_Lotka-Volterra_Predator-Prey_Model
- https://econpapers.repec.org/RePEc:sae:jocore:v:41:y:1997:i:2:p:203-226
- https://en.wikipedia.org/wiki/Glottochronology
- https://centaur.reading.ac.uk/10061/
- https://www.brookings.edu/books/growing-artificial-societies/
- https://jasss.org/4/2/reviews/lazer.html
- https://www.nber.org/papers/w13028
- https://econpapers.repec.org/RePEc:oup:qjecon:v:115:y:2000:i:4:p:1167-1199.
- https://econpapers.repec.org/RePEc:oup:qjecon:v:131:y:2016:i:2:p:799-858.
- https://www.nber.org/papers/w19213
- https://ourworldindata.org/yields-vs-land-use-how-has-the-world-produced-enough-food-for-a-growing-population
- https://ourworldindata.org/how-many-people-does-synthetic-fertilizer-feed
- https://cisac.fsi.stanford.edu/node/25364
- https://bay12games.com/dwarves/links.html
- https://www.routledge.com/Procedural-Storytelling-in-Game-Design/Short-Adams/p/book/9781138595309
- https://rimworldgame.com/
- https://store.steampowered.com/app/294100/RimWorld/
- https://gdcvault.com/play/1024686/-RimWorld-Contrarian-Ridiculous-and

**Search-result only** (not opened; claims resting on these are flagged in the text):

- Wikipedia, "Gompertz–Makeham law of mortality"
- Bocquet-Appel (2011), HAL hal-00834316
- Smil book excerpt on MUSE (403)
- Lucas & Turkes (2004), NPS Calhoun
- PMC4701162 (Lanchester battle test)
- Ross (2015), Annual Reviews (403)
- Haber & Menaldo (2011)
- Turchin (2013), eScholarship 6qp8x28p (403)
- Myhre et al. (1998), original
- Deng et al. (2018), lynx–hare critique (TLS error)
- Cederman (2002), PNAS PMC128600, and the "GeoSim" naming
- CFR primer on Schelling
- Wikipedia, "Stability–instability paradox"
- Secularism & Nonreligion (2012), DOAJ (403)
