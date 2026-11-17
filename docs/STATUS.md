# Status report

This report tracks completion against the requirements (R-IDs from [REQUIREMENTS.md](REQUIREMENTS.md)) and the
phases of the implementation plan. Labels:

- **Complete:** implemented, used by the simulation and covered by tests or verified in the browser.
- **Partial:** works, with the stated gaps.
- **Experimental:** works, but balance or behavior is not yet validated.
- **Missing:** not implemented.

Last verified: 2026-11-17. `tsc` exit 0, `npm test` 62/62, `vite build` exit 0, E2E 12/12 on phone and desktop.

## Requirements

| ID | Area | Status | Evidence / gaps |
|---|---|---|---|
| R0 | Principles: autonomy, emergence, original IP, truthful docs | Complete | No scripted history. Multi-seed runs diverge (below). All art is procedural. |
| R1.1–1.3 | Start menu, New World options, 7 presets | Complete | The `presets` test runs every preset for 20 years. Empty worlds are supported. |
| R1.4 | No forced quests, energy or ads; optional objectives | Complete | 5 scenarios with optional objectives. |
| R2.1–2.3 | Tiles, terrains, generation (plates, rain, rivers, biomes) | Complete | 8 worldgen tests (rivers reach water, ocean share, determinism). |
| R2.4 | Environmental dynamics with causal effects | Complete | Drought → food ↓ and prices ↑ counterfactual test. |
| R2.5 | Resources, depletion, extraction | Partial | Deposits deplete (`deposit_exhausted` events). Civs without metal deposits still struggle to industrialize (see issues). |
| R3.1–3.2 | Individuals: life cycle, skills, traits, genes | Complete | Character development: skill growth with age, schooling and practice; stress; 12 acquired traits; life logs. 9 tests. |
| R3.3 | Demographic response and transition | Complete | Cohort model, transition TFR. Famine fixed (see backtesting log). |
| R3.4 | Notables with biographies from real events | Complete | Biographies list deeds with causes. Rulers and heirs are reachable from the civ inspector. |
| R3.5 | Multi-resolution population | Complete | Individuals below 150 people, cohorts above. |
| R4 | Civilizations: identity, flags, splits, merges, extinction | Complete | Procedural flags from emblems in the inspector, nations list, map labels and army banners. Flag tests. |
| R5 | Religion | Complete | Cross-border spread test. |
| R6 | Government and politics | Complete | Legitimacy-collapse → political change counterfactual test. |
| R7.1–7.3 | Tech graph, research inputs, discovery vs adoption | Complete | 207 techs, 7 tech-graph tests. |
| R7.4 | Eras, realism modes, knowledge loss | Complete | `settings.realism` filters speculative techs. |
| R8.1 | Cities and urban form | Partial | Era districts and land-use redevelopment work. City visuals at high density are not reviewed per era. |
| R8.2 | Transport networks | Complete | The roads → lower path cost test. Routes are persisted. |
| R8.3 | Economy and accounting identities | Complete | The GDP = C+I+G+NX(+ΔInv) test passes in a 300-year run. |
| R8.4 | Trade, embargoes, crises | Partial | Embargoes, tariffs and financial and debt crises exist. The planned `tradeInterruptionHurtsDependentCity` test (integration #8) has **not** been written. |
| R9 | War and diplomacy | Complete | War vs peace counterfactual test. Sieges are lifted when hopeless or after 3 years. |
| R10.1 | Disease | Complete | SIR with immunity; survivors gain the trait. |
| R10.2–10.3 | Ecology, optional creatures | Complete | Bounded herds (stress test). |
| R10.4 | God powers and world laws | Complete | 97 powers in 10 categories, each applied without error (test). 15 laws. Trait editor. |
| R11 | Modern and future systems | Experimental | They run (a 256² world reached era 14), but late-era balance is not validated. |
| R12.1–12.2 | Event log with causes | Complete | |
| R12.3 | Snapshots, branching, newspaper | Complete | Exact save/load: 40 years of identical digests after a mid-month load. |
| R12.4 | Statistics and charts; change decomposition | Partial | Charts are complete. **Population change decomposition does not sum**: flows miss settlement founding, absorption and resolution switches. |
| R13.1–13.3 | UI layout, touch, inspector tabs | Complete | iPhone 13 emulation verified with screenshots. Narrow-screen grid and an opaque sheet were fixed in this pass. |
| R13.4 | 16 overlays incl. historical territory | Complete | "Past borders" overlay with year slider. Snapshot test. |
| R14 | Art and asset manifest | Complete | [ASSETS.md](ASSETS.md). |
| R15 | Architecture, determinism, performance | Partial | Determinism complete. Performance measured ([PERFORMANCE.md](PERFORMANCE.md)). Late game at 256² is 0.3–0.6 s per simulated year. Never measured on a real iPhone. |
| R16 | Persistence | Complete | Round trip, corruption detection, mid-year resume. Tests for quota exhaustion and unavailable storage have **not** been written. |
| R17 | Tests, benchmarks, docs | Partial | Unit, integration, property, stress, round-trip, e2e and multi-seed exist. Missing: integration #3, #5, #8, #10; real-device mobile tests. |

## Backtesting log (verified this pass)

Each bug was found by a test, benchmark or profile, root-caused and fixed, then re-verified.

| Found by | Problem | Root cause | Fix |
|---|---|---|---|
| Round-trip test | Loaded saves diverged from the original | Runtime caches held state (site survey, last-year economy values, trade totals, routes, building lists, fire order) | Moved to serialized state or memoized per tick (ARCHITECTURE.md §Determinism). |
| Stress test | GDP ≠ C+I+G+NX during crises | Crisis multiplier applied after summing | Crises now reduce C and I. |
| 1000-year benchmark | Population became NaN around year 700 | Negative construction requests created goods from nothing | Guards on builders, labor and `take()`. |
| Late-game flows | A 69% national food shortfall alongside 40% unemployment | Farms planned only for local need; land filled with idle workshops (score unbounded); planner tried only the top 4 wishes | National food market, farmland redevelopment, capped scores, ranked planner. |
| Same | Modern yields only 2× medieval | Tech bonuses too small vs OWID | Fertilizer +1.4 and Green Revolution +2.0 (about 3× medieval). |
| War integration test | 10-man armies besieged cities for 17 years | Siege rate had a floor and no exit | Lift when hopeless or after 3 years. |
| CPU profile | 858 ms per year late game | A* search for every migrant group | Reuse persisted routes: 306 ms per year. |
| Code review (gauntlet round 1) | Migrants with no land route vanished from the world | The fallback recorded immigration but never added the people | They now arrive by boat, with culture and religion blended. |
| Same | ΔInventories counted price changes as investment (GDP could go negative) | Stock *value* difference at different prices | Quantity change × current price. Red-green test: −124 vs 1.9 under the old rule. |
| Same | Trait swaps leaked skill bonuses | The opposite trait was removed without reversing its modifiers | Symmetric `applyTraitEffects`; test. |
| Same | Forage reset national-shortage demand; armies looped march→abandon; route cache evicted the newest entry; routes survived terrain edits; past-borders view could go stale | Various | Each fixed (see commit log). |
| Regression test (red-green) | Negative or NaN builders created goods | No guard in construction | Test fails without the guard and passes with it. |

## Multi-seed outcomes (8 seeds × 600 years, 96², current code)

| Metric | Min | Median | Max |
|---|---|---|---|
| Year farming appears | 159 | 175 | 205 |
| Highest era | Medieval | Medieval | Early Industrial |
| Nations alive / fallen | 6 / 1 | 8 / 4 | 12 / 8 |
| Wars | 47 | 83 | 135 |
| Annexations | 2 | 8 | 16 |
| Religions | 8 | 15 | 20 |
| Population | 0.84 M | 1.02 M | 1.86 M |

The outcomes differ across seeds, and no fixed sequence repeats.

## Known issues and next steps

1. Population change decomposition does not reconcile with recorded flows (R12.4).
2. Unemployment stays at 40–49% in industrial and modern eras when metal is scarce. Factory and office districts are
   unaffordable without metal, and no informal or service sector absorbs the idle workers.
3. Write the missing integration tests (#3, #5, #8, #10) and the storage-failure tests (R16).
4. Late-game performance at 256² (`planConstruction` and `forRadius` scans are the next profile targets).
5. Favorites and a follow camera (parity gaps in FEATURES.md).
6. Validate the balance of eras 11–15 and run on physical iOS hardware.
7. Trait modifiers clamp to 0–10, so add-then-remove is not exactly reversible at the bounds (accepted; minor).

## Plan verification (docs/superpowers/plans/2026-11-14-epoch-implementation.md)

Each plan task is checked against the code and tests that exist today. *Built* means the system exists and runs.
*Planned tests* compares the tests the plan named with the tests that actually exist.

| Task | Built | Planned tests | Notes |
|---|---|---|---|
| A1–A6 Delegated art, tech, research | ✓ | ✓ techData (7) | The tech agent produced nothing, so the lead wrote 207 techs. |
| 3 Worldgen tests | ✓ | ✓ (8) | |
| 4 Governments and succession | ✓ | ✗ no dedicated unit tests | Covered indirectly by the integration test #6. |
| 5 World creation and orchestrator | ✓ | ✓ determinism (3) | |
| 6 Ecology | ✓ | ◐ herd bound checked in the stress test | No predation or extinction unit tests. |
| 7 Bands and founding | ✓ | ✗ | |
| 8 Buildings, economy, urban growth | ✓ | ◐ construction regression (2) | |
| 9 Technology runtime | ✓ | ✗ no research or adoption runtime tests | |
| 10 Territory, pathfinding, infrastructure | ✓ | ◐ roads (#2); borders consistency in the stress test | `pathAvoidsWater` not written. |
| 11 Persistence | ✓ | ◐ round trip, corruption | Missing `unavailableStorage` and `migrationFromV0`. |
| 12 Renderer | ✓ | e2e and screenshots | |
| 13 Input, powers, undo | ✓ | ✓ classify (4); all powers apply (1) | Undo not unit-tested. |
| 14 UI shell | ✓ | e2e 12/12 | |
| 15 Market and public finance | ✓ | ✓ GDP identity, ΔInv valuation | Missing `deficitBuildsDebt` and `printingMoneyInflates`. |
| 16 Government | ✓ | ✓ #6 | |
| 17 Diplomacy | ✓ | ✗ | `warHasRecordedCauses` not written. |
| 18 Military | ✓ | ✓ #4 | Missing `terrainDefenseBonus` and `notAlwaysTotalConquest`. Multi-seed annexations are 2–16 against 47–135 wars, so most wars do not end in conquest. |
| 19 Religion and culture | ✓ | ✓ #9 | |
| 20 Disease | ✓ | ✗ | |
| 21 Trade | ✓ | ✗ #8 | |
| 22 Environment and climate | ✓ | ✓ #1, #7 | |
| 23 Future systems | ✓ (experimental) | ✗ | |
| 24 Era bootstrap and scenarios | ✓ | ✓ presets (7) | |
| 25 History and analytics | ✓ | ◐ territory snapshots | Decomposition does not reconcile (issue 1). |
| 26 Statistical and stress | ✓ | ✓ stress (300 y), multi-seed script | |
| 27 Benchmarks and e2e | ✓ | ✓ | |
| 28 Audio | ✓ | — | |
| 29 Audit loop | ✓ one code-review round | — | 8 findings, all fixed and re-verified. Not yet run: `simplify` and `security-review`. |
| 30 Docs | ✓ | — | |
| **Added beyond the plan** | Character development, flags, trait editor, past-borders overlay | ✓ (10 + 3 + 1) | From the user's follow-up request. |

Next gauntlet round: write the ✗ tests above, starting with #8 trade interruption, research runtime and disease
(`densityRaisesR`), then run `simplify` and `security-review`.
