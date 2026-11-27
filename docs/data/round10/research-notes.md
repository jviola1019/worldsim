# Research notes: Realistic addendum (round 10, 2026-11-25)

These are the real-world reference values behind the Realistic addendum. They were collected with web searches on 2026-11-25. Each value names its source; where no source was found, the note says so.

**How to read this:** the simulation is stylized (see [METHODS](../../METHODS.md) and [PARAMETERS](../../PARAMETERS.md)). These figures are used for two things:
1. to check that a model value has the right **order of magnitude**;
2. to set new values in an honest range.

None of them is a calibration target fitted to data.

## 1. Animal growth rates (the `growth` field: maximum annual growth in good conditions)

| Species (model key) | Model value | Reference | Source | Verdict |
|---|---|---|---|---|
| Elephant (`elephant`, new) | **0.07** | r_max 0.07: a population recovering from poaching, Tanzania | Foley & Faust 2010, as cited in the popbayes vignette ([CRAN](https://cran.r-project.org/web/packages/popbayes/vignettes/generate_data.html)) | Set from the source |
| Water buffalo (`buffalo`, new) | **0.12** | Feral buffalo in Kakadu: mean exponential increase 0.10 per year; one recent Northern Territory year +17%. African buffalo r_max ≈ 0.21 (body-mass formula after Sinclair 2003) | [Kakadu thesis](https://researchprofiles.canberra.edu.au/en/studentTheses/feral-buffalo-in-kakadu-national-park-survey-methods-population-d/); [news report, undated](https://www.inkl.com/news/feral-buffalo-numbers-in-the-nt-out-of-control-and-nearing-200-000-head); popbayes vignette | Inside the observed range 0.10–0.21 |
| Seal (`seal`, new) | **0.10** | Baltic grey seal +7.9% a year since 2000; Wadden Sea harbour seal +7% (1974–87) and +12.9% (1989–2002); harbour seal intrinsic maximum just under 13% | [HELCOM 2018](https://helcom.fi/wp-content/uploads/2019/08/Population-trends-and-abundance-of-seals-HELCOM-core-indicator-2018.pdf); [Wadden Sea QSR](https://qsr.waddensea-worldheritage.org/reports/marine-mammals); [COSEWIC](https://www.canada.ca/en/environment-climate-change/services/species-risk-public-registry/cosewic-assessments-status-reports/harbour-seal/chapter-7.html) | Inside the observed 0.08–0.13 |
| Llama, wild type (`llama`, new) | **0.15** | No published annual guanaco growth rate was found. Camelid biology (one young a year, first breeding at about 2 years) suggests a rate similar to the camel's 0.15 | [Zoological Studies 2015, guanaco density](https://zoolstud.sinica.edu.tw/Journals/54/54-23.html) (density only) | **[S] stylized**, no source for the rate |
| Bison (`bison`) | 0.22 | Yellowstone: 14.5–15% a year net of removals (2022–23); 11.5% mean 1997–2005; r = 0.16 for the northern herd 1902–52 | [IBMP 2023 status report](https://www.ibmp.info/Library/OpsPlans/2023_StatusYellowstoneBisonPopulation_Oct2023_final.pdf); [IBMP 2022](https://www.ibmp.info/Library/OpsPlans/2022_StatusYellowstoneBisonPopulation_FINAL_Oct2022.pdf) | Above the observed **sustained** rates, which include removals and density limits. Plausible as a maximum; kept |
| Whale (`whale`) | 0.05 | Gulf of Maine humpbacks 6.5% a year (1979–91); slower near carrying capacity | [MUN thesis](https://research.library.mun.ca/538/3/north_atlantic_humpback.pdf); [UW 2024](https://fish.uw.edu/2024/08/rapid-increase-rates-in-large-whale-populations-continue-until-they-near-carrying-capacity) | Same order, slightly low (the model's "whale" stands for great whales in general); kept |
| Wolf (`wolf`) | 0.30 | Unexploited wolf populations: mean growth near 0 (they sit at equilibrium), year-to-year λ about 0.86–1.14 | [USGS / Mech & Fieberg 2015](https://pubs.usgs.gov/publication/70138809) | That is equilibrium variation, not a maximum; no maximum found. **[S]**, kept |
| Deer, elk, horse, goat, sheep, aurochs, boar, junglefowl, camel, hare, mammoth, crocodile, bear, great cat, penguin, fish, birds | see `species.ts` | The searches gave no reliable species-level maximum rates (Fagan et al. 2013, Proc. R. Soc. B 280, has predicted values in its supplement, which could not be read) | [Lynch & Fagan 2009](https://science.umd.edu/biology/faganlab/abstracts/LynchFagan2009.html); [Fagan et al. 2013](https://experts.umn.edu/en/publications/phylogenetic-prediction-of-the-maximum-per-capita-rate-of-populat-2/) | **[S] stylized.** The ordering is plausible: small, fast breeders (hares, fowl, fish) are highest; mammoths, whales and elephants lowest |

**Predator density and food needs (task 5, owner options A + C, collected 2026-11-26):**

| Quantity (model use) | Model value | Reference | Source | Verdict |
|---|---|---|---|---|
| Predator biomass per prey biomass (`BALANCE.predatorPreyBiomass`: how many predators a natural world starts with) | **0.01** (herd units times `meat` as the biomass measure) | About 10,000 kg of prey supports about 90 kg of a given carnivore species, whatever the carnivore's size (about 1:111) | Carbone & Gittleman 2002, *A common rule for the scaling of carnivore density*, Science 295: 2273-2276, [doi:10.1126/science.1067994](https://doi.org/10.1126/science.1067994) (abstract read; full text not read) | **[E]** set from the source. Seeding also caps each pack at what its territory's prey can replace, so the realised start is at or below 1:100 (tests/ecology/predation.test.ts asserts 1:300 to 1:100) |
| Crocodile food need relative to a warm-blooded predator (`upkeep` in `species.ts`) | **0.1** | Wild juvenile Nile crocodiles (Okavango) ate 0.48% (yearlings) and 0.23% (juveniles) of body mass a day, and the larger the crocodile the less it eats for its size. Minnesota wolves in winter ate about 2.0 kg of deer a wolf a day, about 6% of body mass. The ratio is about 0.04-0.08 | Okavango diet study ([J. Herpetology 42(2), BioOne](https://bioone.org/journals/journal-of-herpetology/volume-42/issue-2/07-1071.1/Diet-of-the-Nile-Crocodile-Crocodylus-niloticus-in-the-Okavango/10.1670/07-1071.1.full)) and the related thesis; wolf figure from a Minnesota winter study as summarised in search results ([Fuller 1989](https://wrrb.ca/sites/default/files/Fuller%201989.pdf)); field metabolic rates of reptiles scale more steeply than mammals' (Nagy, Girard & Brown 1999, Annu. Rev. Nutr. 19: 247) | Rounded up from the measured 0.04-0.08 (conservative). The pages were seen through search summaries, not read in full |
| Great cat habitat includes forest (`biomes` of `bigcat` in `species.ts`, task 8 part C: savanna, jungle, grass and now forest) | forest added | The model's great cat stands for lion, tiger, leopard and jaguar. "The tiger mainly lives in forest habitats and is highly adaptable"; the leopard "inhabits savanna and rainforest, and grasslands, woodlands and riparian forests", and temperate coniferous forest in the Russian Far East; "the jaguar prefers dense forest". Only the lion is a cat of open country | Wikipedia articles [Tiger](https://en.wikipedia.org/wiki/Tiger), [Leopard](https://en.wikipedia.org/wiki/Leopard) and [Jaguar](https://en.wikipedia.org/wiki/Jaguar), "Distribution and habitat" sections (read through a page summary, first part of each page only); the IUCN Red List accounts they cite were not read | **[S]** a habitat class, not a fitted value. Steppe and hills stay outside (0.25) |
| Crocodiles take fish (`fishes` in `species.ts`, task 8 part C: a crocodile also hunts fish shoals in its territory; wolves, great cats and other land predators do not) | crocodile only | Nile crocodile diet changes with size: yearlings eat mainly aquatic insects and arachnids, larger juveniles more crustaceans, amphibians and fish, and subadults, the largest class sampled, mainly fish (286 crocodiles, stomach flushing over two years) | Wallace & Leslie 2008, *Diet of the Nile crocodile (Crocodylus niloticus) in the Okavango Delta, Botswana*, J. Herpetology 42(2): 361-368, [doi:10.1670/07-1071.1](https://doi.org/10.1670/07-1071.1) (abstract and search summary read; full text not read) | **[S]** a switch, not a fitted value. The model's herds stand for whole populations, so fish stand for the main diet of most of a crocodile population's members; adults also take mammals at the water's edge, which the land diet keeps |

**Caveat:** Lynch & Fagan (2009) show that some survivorship models inflate r estimates. Published values also vary with years, removals and density. These are ranges, not single truths.

## 2. Human (forager) growth

- **Archaeological long-run rate:** about **0.04% a year**. Wyoming–Colorado foragers, 13,000–6,000 years ago, doubled roughly every 1,700 years. The same study found farming did not raise the long-term rate. Source: Zahid, Robinson & Kelly, PNAS 2015 ([PMC4743830](https://pmc.ncbi.nlm.nih.gov/articles/PMC4743830); [Smithsonian summary](https://insider.si.edu/2015/12/research-shows-same-growth-rate-for-farming-non-farming-societies/)).
- **Ethnographic and historical rates are much higher.** The gap between them and the archaeological rate is unresolved; booms and crashes average out to near zero over millennia. Source: [PMC7741106](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7741106/).
- **Use in the model:** a placed band may grow quickly while food is plentiful (an ethnographic-scale boom), but the long-run average across settled and failed groups should be small. The Slow-pace targets (a village after about 100 years, a city after about 1,000) were chosen by the owner. They are not derived from these rates.

## 3. Natural hazard frequencies (whole Earth)

| Hazard | Real frequency | Source |
|---|---|---|
| Earthquakes of magnitude 7 or more | About 16 a year (long-term average since 1900); magnitude 8 or more about 1 a year | [USGS FAQ](https://www.usgs.gov/faqs/why-are-we-having-so-many-earthquakes-has-naturally-occurring-earthquake-activity-been) |
| Volcanic eruptions | 64–89 under way each year since 2000 (average 78), about 36 starting or ending; most are VEI 2 or smaller; the VEI 4+ rate has been steady for over a century | [GVP via Discover](https://www.discovermagazine.com/volcanic-activity-isnt-increasing-across-the-planet-44448) |
| Rare catastrophes (Tunguska-class airburst 1/800 yr, VEI-7 1/1,000 yr, supervolcano 1/60,000 yr, severe geomagnetic storm 1/150 yr, and others) | As documented in `src/world/catastrophes.ts`, round 5, of real order of magnitude | (existing, unchanged) |

**What this means for EPOCH:**
- A world map compresses a continent-sized region into 128² tiles, and a "regional disaster" in the model is one damaging event big enough to matter to towns.
- The model draws such an event with probability 0.012 a month (about 0.14 a year per world, `world/environment.ts`). That is **far fewer** than Earth's magnitude-7 quakes plus damaging eruptions, floods and storms.
- The rate is **[S] stylized**, set for readable histories. The events audit (Task 7) reports the realised counts beside these figures, so the gap is visible rather than hidden.
- Only the rare catastrophes are claimed to have real-world base rates.

## 4. Search log

Queries, all run on 2026-11-25 (standard web search, US results):
1. maximum intrinsic rate of population increase r_max mammals table deer bison elephant wolf bear
2. hunter-gatherer population growth rate per year prehistoric 0.1% forager fertility study
3. global frequency of natural disasters per year earthquakes magnitude 7 volcanic eruptions VEI 4 statistics USGS
4. annual population growth rate white-tailed deer brown bear wolf population maximum per year percent study
5. Smithsonian Global Volcanism Program how many volcanoes erupt each year VEI 4 frequency
6. bison population growth rate per year Yellowstone; seal population growth rate; llama guanaco growth rate; water buffalo feral growth rate Australia
7. grey seal harbour seal population annual growth rate percent recovery; humpback whale population growth rate 7% per year
8. guanaco population growth rate per year Patagonia study; feral water buffalo Northern Territory population increase rate per year
9. (2026-11-26, task 5) Carbone Gittleman 2002 common rule scaling of carnivore density 10,000 kg prey supports 90 kg carnivore; "10,000 kg of prey" supports "90 kg" carnivore Carbone Gittleman Science 2002
10. (2026-11-26, task 5) Nagy Girard Brown 1999 field metabolic rate reptiles compared to mammals same body mass times lower; crocodile food requirement compared to mammal same size; Nagy 2005 field metabolic rate and body size (intercepts not confirmed, not used)
11. (2026-11-26, task 5) Nile crocodile annual food consumption percent body mass per year wild adult feeding rate; wolf food consumption kg per wolf per day kill rate study average body mass percent
12. (2026-11-27, task 8 part C) Wallace Leslie 2008 diet of the Nile crocodile Okavango Delta fish proportion Journal of Herpetology
13. (2026-11-27, task 8 part C) IUCN Red List Panthera pardus habitat forest; Panthera onca habitat tropical forest; tiger habitat temperate boreal forest (then the three Wikipedia pages above)
14. (2026-11-27, task 8 part C) Palomares Caro 1999 interspecific killing among mammalian carnivores American Naturalist body mass ratio; Miquelle 2005 tigers and wolves in the Russian Far East competitive exclusion functional redundancy (an interference-competition variant was measured and not adopted; see the task 8 part C report)

The queries carried no personal or project-identifying details.

## 5. Disease (Task 3: medicine saves lives more than it stops spread)

Collected 2026-11-25. The model is an abstract SIR per settlement. These values check order of magnitude only.

| Quantity | Real value | Source | Verdict |
|---|---|---|---|
| R of 1918 influenza | Median 1.80 (IQR 1.47-2.27) over 51 estimates; one city-level fit gives 2-3 | Biggerstaff et al. 2014, BMC Infect Dis 14:480 ([link](https://www.biomedcentral.com/1471-2334/14/480)); [PMC4169819](https://pmc.ncbi.nlm.nih.gov/articles/PMC4169819/) | Model novel-disease r0 spans 1.4-4.5, covering it |
| R of 1957 (H2N2) | Median 1.65 (IQR 1.53-1.70) | Biggerstaff et al. 2014 | Inside the model range |
| R of 1968 (H3N2) | R0 1.06-2.06 (first wave), 1.21-3.58 (second, with cross-protection). The review median was not read reliably; check the paper before quoting one | [PMC2889325](https://pmc.ncbi.nlm.nih.gov/articles/PMC2889325) and the review above | Inside the model range |
| R of 2009 (H1N1) | Median 1.46 (IQR 1.30-1.70) over 78 estimates | Biggerstaff et al. 2014 | Near the low end of the model range |
| R0 of COVID-19 | Pooled early estimate 2.69 (range of 108 estimates 0.27-8.21); a later review of early-outbreak estimates ranged 0.4-12.58 and found them unreliable | 2021 meta-analysis ([PubMed 33977156](https://pubmed.ncbi.nlm.nih.gov/33977156/)); [PMC9517346](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9517346/) | Inside the model range 1.4-4.5; not used for a value |
| Infection fatality, 1918 | Case fatality usually 2-3%, "may be close to" the infection rate | secondary summary ([IEEE Spectrum](https://spectrum.ieee.org/tech-history/heroic-failures/pandemic-memories-and-mortalities)) | Model lethality up to 0.4 for 15% of pathogens; far above any flu, deliberately stylized |
| Infection fatality, later pandemics | 1957-59 0.017-0.1%; 1968-70 0.1-0.2%; 2009 0.01-0.02%; COVID-19 0.67-1.18% | UK COVID-19 Inquiry reference table ([PDF](https://covid19.public-inquiry.uk/wp-content/uploads/2023/06/14181206/INQ000207453_1.pdf)); the extracted text was partly garbled, so verify against the PDF | Model typical lethality 0.01-0.12 is higher than these; **[S] stylized** (a model infection also stands for severe illness) |
| Pandemic frequency | A 1918-scale event: about 0.3-1.9% a year | Marani et al. 2021, PNAS, "Intensity and frequency of extreme novel epidemics" | For Task 4's world draw |
| Outbreak frequency | About 50 WHO Disease Outbreak News events a year | PreventionWeb summary of WHO DON | For Task 4's world draw |
| Handwashing and respiratory infection | Handwashing with soap, any acute respiratory infection: RR 0.83 (95% CI 0.76-0.90, I2 88%); an older review found a pooled cut of about 24% | Lancet meta-analysis as reported by [LSHTM](https://lshtm.ac.uk/node/378136); [Rabie & Curtis 2006](https://pubmed.ncbi.nlm.nih.gov/16553905/) | **Basis of `sanitationTransmissionCut` = 0.2** |

**Why 0.2 for sanitation.** Hygiene cuts respiratory infection by roughly 17-24%, and sanitation mostly stops waterborne spread, which the model does not separate. A cut of 0.2 sits in that range. The old hard-coded 0.45 was about twice the evidence.

**Why 0.3 for medicine.** Pandemics of 1918, 1957, 1968 and 2009 and COVID-19 all spread widely despite the best health systems of their day. Treatment mostly saved lives rather than stopped infection, so full disease control may stop at most 30% of transmissions (was 60%). Quarantine (15% once healthcare passes 0.3) and the lethality cut (up to 85%, plus 40% from healthcare) are unchanged. This is **[S] stylized**, not fitted. A full-control, full-sanitation settlement facing r0 2.5 has effective R of about 1.19 x crowd (crowd = clamp(0.55 + 0.18 x (log10(pop) - 1), 0.5, 1.5); the clamp is on crowd, not on the density term): about 1.3 in a 10,000-person town, above 1 for towns of roughly 400 people or more, and below 1 (about 0.6-1.0) in smaller villages, where a fully protected settlement can stop a novel disease. Misinformation raises it.

**Why 0.5% for logging.** Outbreaks that kill 0.5% of a town are historically notable and nearly all modern outbreaks sit below the old 3% line, so none were logged. The 20-death floor stays. **[S]**.

Queries (2026-11-25, standard web search, no personal or project details):
1. basic reproduction number 1918 influenza 1957 1968 2009 H1N1 pandemic estimates R0
2. infection fatality ratio 1918 1957 1968 2009 influenza pandemics COVID-19 comparison
3. sanitation hygiene effect on respiratory infection transmission systematic review handwashing reduction
4. COVID-19 basic reproduction number R0 early estimates systematic review and infection fatality ratio meta-analysis (no IFR meta-analysis came back; the COVID-19 IFR row stays from the UK Inquiry table)

Marani et al. 2021 and the WHO DON count were supplied by the controller from earlier searches; they were not re-checked here. (Task 4 re-checked Marani et al. 2021 below.)

### 5.1 World pandemics (Task 4)

Collected 2026-11-25 for the yearly world pandemic draw (`population/pandemic.ts`).

| Quantity | Real value | Source | Use in the model |
|---|---|---|---|
| Frequency of a 1918-scale event | Yearly probability 0.27-1.9% from 1600 to the present; the yearly number of epidemics varies ninefold over centuries | Marani et al. 2021, PNAS 118(35) e2105482118 ([PMC8536331](https://pmc.ncbi.nlm.nih.gov/articles/PMC8536331/)), abstract, read 2026-11-25 | The realised rate of world pandemics killing at least 1% of the world, checked by the disease audit |
| Shape of the severity tail | Epidemic intensity (deaths / world population / duration, in per mille a year) follows a generalized Pareto distribution, shape 1.40; the tail decays with exponent about -0.71 for intensities above 3 x 10^-2 per mille a year | Marani et al. 2021 (results and Fig. 1) | **`pandemicTailExponent` = 0.71 [E].** Caveat: the paper's intensity divides by duration; the model's severity is the total death share. Most pandemics last 1-3 years, so the two are of the same order, not the same quantity |
| Notable pandemics since 1900 | 1918, 1957, 1968, 2009 and COVID-19 (1977 is sometimes added): 5-6 in about 105 years | Influenza: Taubenberger & Morens 2009, Rev Sci Tech 28(1) ([PMC2720801](https://pmc.ncbi.nlm.nih.gov/articles/PMC2720801)) and the Wikipedia timeline of influenza; COVID-19 | **`pandemicModern` = 0.04 a year [E]** (4 a century, at the low end) |
| Pandemics before rail and steamships | "Since 1500, there appear to have been 13 or more influenza pandemics" (about one every 38 years, with no predictable period); world-scale plague pandemics: Justinian 541, Black Death 1346-53; also the Antonine plague (165) | Taubenberger & Morens 2009 ([PMC2720801](https://pmc.ncbi.nlm.nih.gov/articles/PMC2720801), read 2026-11-25); plague dates are standard history | **`pandemicPreIndustrial` = 0.005 a year [E]**: one in two centuries. The early-modern influenza count (one every 38 years, about 2.6 a century) is higher, but those already travelled by sail; antiquity and the Middle Ages had a few world-scale pandemics in over a thousand years. The value sits between |
| Death share of the world | 1918-20: 1.0-5.7%; 1957-58: 0.03-0.05%; 1968-70: 0.02-0.03%; 2009-10: 0.001-0.004%; COVID-19: excess mortality above 0.08% by late 2021 (still rising then) | Review table citing World Bank 2020 and Biggerstaff et al. 2014 ([PMC8507505, Table 1](https://pmc.ncbi.nlm.nih.gov/articles/PMC8507505/table/Tab1)); WEF summary for 1918 (0.95% at 17 million deaths, 2.7% at 50 million) | **`pandemicSevereShare` = 1/8 [E]**: 1 of the 5 notable pandemics since 1918 killed at least 1% of the world (1/5); with 1977 and earlier mild ones counted, fewer. 1/8 sits between and keeps the realised severe rate inside Marani's range |
| Plague pandemics | Justinian (541-42): best estimate 0.6-4.4% of the world (highest 24%); Black Death (1346-53): best estimate about 10% (highest 44%) | Secondary compilation, ["What was the deadliest natural catastrophe"](https://whatweowethefuture.com/wp-content/uploads/2023/06/What-was-the-deadliest-natural-catastrophe.pdf); census data do not exist ([Our World in Data](https://ourworldindata.org/historical-pandemics)) | The severity draw is capped at 30% of the world (about the Black Death's range). Treat these as rough |

**How the draw uses these.** A pandemic is drawn with yearly probability `pandemicPreIndustrial + (pandemicModern - pandemicPreIndustrial) x connectivity`, where connectivity is the share of linked settlements times `clamp((leadEra - 6) / 4, 0, 1)`. Its intended world death share follows a Pareto tail with exponent 0.71, scaled so 1/8 of draws reach 1% (the floor is then about 0.05% of the world), capped at 30%. R is drawn in 1.4-3 (2009 H1N1 1.46 to COVID-19 2.69). The historical R and death figures are realised under the medicine of their day, so the drawn R and share describe the pandemic in the world's average town: base r0 and lethality are divided by the population-weighted mean protection of the world's towns. The audit (`scripts/disease-audit.ts`) checks realised against drawn.

**Measured (disease audit, 6 Observer worlds x 600 years, 96², `docs/data/round10/disease-audit-era1.txt` and `-era10.txt`).**
- From era 10 (3,600 world-years, connectivity 1.00): 4.61 pandemics drawn and 4.53 logged per world-century (history: 4-5); 26 of 163 realised at least 1% of the world, 0.72 per world-century, or 0.72% a year (Marani et al.: 0.27-1.9%); pandemic deaths 3.37% of the population per century (20th century: roughly 1.2-6%, mostly 1918); realised / drawn share median 1.06. The largest killed 16.9% of its world (drawn 17.5%): the tail allows Black Death-scale events in modern worlds about once in a thousand world-years.
- From era 1 (3,418 pre-industrial world-years, connectivity 0): 0.47 drawn and 0.32 logged per world-century (model rate 0.5); realised / drawn median 0.74, since links carry a pandemic less far in sparse early worlds. Only 182 industrial world-years, with one pandemic: too few to judge that band.
- No nation ended by `pandemic` in either run.

Queries (2026-11-25, standard web search, no personal or project details):
1. Marani 2021 PNAS intensity and frequency of extreme novel epidemics probability per year Spanish flu (then the PMC full text, fetched)
2. influenza pandemics since 1500 number list historical frequency per century
3. deaths as percentage of world population 1918 1957 1968 2009 influenza pandemics COVID-19 comparison
4. Black Death percentage of world population killed estimate 14th century Plague of Justinian deaths share
5. "0.03" "0.05" percent global population 1957 pandemic "1.0" "5.7" 1918 review table mortality pandemics share of world population (to find the table behind query 3)
