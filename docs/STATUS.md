# Status report

This report tracks completion against the requirements (R-IDs from [REQUIREMENTS.md](REQUIREMENTS.md)) and the round-5 phases ([ROADMAP.md](ROADMAP.md)). Labels:

- **Complete:** implemented, used by the simulation and covered by tests or verified in the browser.
- **Partial:** works, with the stated gaps.
- **Experimental:** works, but balance or behavior is not yet validated.
- **Missing:** not implemented.

Last verified 2026-11-19 (round 7, audit loop pass 2):

| Check | Result |
|---|---|
| Typecheck | `tsc` 7.0.2: exit 0 |
| Unit tests | `npm test` (Vitest 5.1.1): **594/594** (38 files, 0 skipped) |
| Build | `vite build` 8.3.8: exit 0 |
| E2E | **61/61**: phone, desktop and desktop with Reduce motion (Chromium), on the production build. Includes jobs, map effects, still markers under Reduce motion, the close-up city, CSP, injected-script and framing checks. |
| Design floors | 6/6 device profiles: text ≥ 12 px, touch targets ≥ 44 px, WCAG AA (`tools/viewports.mjs`); 121 captures with 0 violations |
| Dependencies | `npm audit`: 0 vulnerabilities; `npm outdated`: none |
| GitHub Actions | CI and Pages run on every push of this branch (VALIDATION §R7) |
| Multi-seed invariants | 20 seeds × 600 years: ledger, finite values and GDP identity hold in **20/20** (round-7 code) |

Evidence for every figure is in [VALIDATION.md](VALIDATION.md); performance is in [PERFORMANCE.md](PERFORMANCE.md) and security in [SECURITY.md](SECURITY.md).

## Requirements

| ID | Area | Status | Evidence / gaps |
|---|---|---|---|
| R0 | Principles: autonomy, emergence, original IP, truthful docs | Complete | 20-seed runs diverge. Every name is generated, and a list of real brands is blocked (`culture/naming.ts`). |
| R1 | World creation, presets, no forced quests | Complete | 9 presets plus **17 map shapes** (264 preset tests with measured land fraction, shape and playability). |
| R2.1–2.4 | Terrain, generation, dynamics with causal effects | Complete | Drought counterfactual; undo restores land exactly; natural catastrophes at real-order base rates. |
| R2.5 | Resources, depletion, extraction | Complete | Industrial extraction scales both the rate and the recoverable reserves. Modern worlds keep their metal access: 0–7% food short in the final 1,000-year runs. |
| R3.1–3.5 | Individuals, development, notables, demography, transition | Complete | The fertility transition is driven by development and access, and starvation adds mortality. The Malthusian ceiling of round 2 is gone (VALIDATION §R5). |
| R4–R6 | Civilizations, religion, government | Complete | 11 ethos archetypes scored relative to other nations; contested ideals stop all governments converging (measured: 7 ethos types and 4–5 government forms over 6 seeds). Emergent missions. |
| R7 | Technology | Complete | Leapfrogging and sclerosis (counterfactual test); tech-lead history; geography dead ends removed (rare metals, oil or coal). |
| R8.1–8.4 | Cities, transport, economy, trade | Complete | Redevelopment of obsolete districts; transport by era; ports and airports; visitor accords; GDP identity 20/20. |
| R9 | War and diplomacy | Complete | Era weapons and doctrines, nuclear deterrence and arms control (`war-nuclear.test.ts`); war counterfactual #4. |
| R10 | Disease, ecology, powers | Complete | God-mode horrors are refused in observer worlds (test). |
| R11 | Modern and future systems | **Complete** (was Experimental) | 4 of 4 natural worlds reach Atomic & Space; 2 become Spacefaring; media and AI simulation; space programs; typed endings, including AI takeover. Unemployment of 15–36% and warming of 3–10 °C remain (below). |
| R12 | History, statistics, feed, album | Complete | Era-medium feed derived from recorded events (8 tests); 50-year album (5 tests); population ledger exact. |
| R13 | UI, touch, inspectors, overlays | Complete | Era interface frames, nation overview with city pictures, album tab. Chromium emulation only: **no WebKit or physical-device testing.** |
| R14 | Art and asset manifest | Complete | Sprite pack (venues, ports, airports, ethos housing, era vehicles, job characters); [contact sheet](images/sprites/contact-sheet.png). |
| R15 | Architecture, determinism, performance | Partial | Determinism complete (the round-trip and digest tests include every round-5 entity). Multi-seed cost: median 32 ms per simulated year on 96². **Physical iPhone performance is unverified.** |
| R16 | Persistence and security | Complete | Validating decoder, now including the round-5 fields. 92-threat audit with CSP, frame check, validated preferences and pinned CI (SECURITY.md). |
| R17 | Tests, benchmarks, docs, CI | Partial | 506 tests and 28 e2e checks; CI on every push; weekly long run; ERD and data dictionary. Missing: WebKit, Firefox and physical-device runs. |

## Round 6 (close-up cities, planning rule, design review)

| Item | Status | Evidence |
|---|---|---|
| Close-up city blocks (streets, yards, shops, gyms, cafés, parks, civic grounds, street-scale life) | Complete | 28 rendering tests; e2e; screenshots in the README |
| Planning rule (street access, parks, compactness) | Complete | 8 planning tests (counterfactual); balance within ±15% on reached milestones (VALIDATION §R6) |
| Photos from the close-up drawing | Complete | e2e (aerial blocks) |
| Full design review (13 findings) | Complete: 12 fixed, 1 partly (D11 spacing, low) | DESIGN-REVIEW.md; floors enforced in viewports |
| Save determinism with fires (nuclear strike, rain) | Fixed (pre-existing bug) | `fire-determinism.test.ts` |
| Duplicate league names | Fixed (pre-existing bug) | sports uniqueness test |
| Final whole-branch review | 1 critical and 3 important findings fixed with tests (close-up cache thrash at large screens, reduce-motion weather, 2×2 access, a doc correction) | VALIDATION §R6 |

## Round 7 (concept effects, render-cache freshness, city life, jobs, WorldBox-style caching)

| Item | Status | Evidence |
|---|---|---|
| A map effect for every concept (108 powers, every event type), area rings, sequences, a per-place cap, screen flashes | Complete | `conceptFx.test.ts` (coverage, one source, hooks, cap, determinism); e2e (an earthquake plays and ends) |
| Reduce motion everywhere (still markers, no flash, sheets without animation) | Complete | e2e reduced-motion run; renderer collapses sequences |
| Render caches follow every concept ("recall cache") | Complete: **9 stale-drawing cases found and fixed** | `cacheFreshness.test.ts` (every power and 30-year runs from 3 eras) |
| WorldBox-style zone caching of the overview and overlays | Complete | `pixelCache.test.ts` (byte-equal to a full rebuild); PERFORMANCE §2d |
| Jobs tracked and shown (41 occupations; history per nation) | Complete | `occupations.test.ts`; e2e (jobs panel) |
| Streets and parks at real-world rates; traffic from demand over capacity | Complete. Parks are simulated (target and zoning) and drawn; streets and traffic are drawn and derived. | `cityLife.test.ts`; VALIDATION §R7 |
| Homes past huts and caves (16 forms) | Complete (a visual and reporting mix; the housing stock is unchanged) | `cityLife.test.ts` |
| Highways and future roads; road networks share trunk lines | Complete | `cityWorks.test.ts`; close-up arterials |
| Renovation, build-up and redevelopment, counted per settlement | Complete | `cityWorks.test.ts` |
| Repeated "third straight title" headlines | Fixed (pre-existing) | sports test |
| Whole-branch review | 8 findings, all fixed | VALIDATION §R7 |

Round-6 deferred minor fixed in round 7: blocks now use the simulated road tier (arterials and highways).

Deferred minor findings from the round-6 final review:
- an ethos switch between militarist and mercantile (same block signature) waits for another change to redraw;
- fences and streets across a map-chunk boundary update within a year;
- tall landmarks in a chunk's first row can clip;
- some planning tests check less than their names suggest;
- ruins count as built for planning but open for drawing.

## Bug ledger, rounds 4 and 5

Each fix has a regression test. "Mutation" means the test was confirmed to fail with the fix reverted.

| # | Severity | Root cause | Fix | Regression evidence |
|---|---|---|---|---|
| 22 | High | Malthusian ceiling in modern worlds: fertility ignored development, and starvation only scaled existing mortality. | Development-driven fertility transition; additive starvation mortality | `modern.test.ts` (mutation); 1,000-year runs |
| 23 | High | Metal collapse: deposits ran dry and modern extraction did not scale. | The industrial extraction factor raises both the rate and the recoverable reserves; concrete substitution capped per job | `modern.test.ts` (mutation, including the per-step cap bug) |
| 24 | High | Spaceports were never built: capital-only placement, a 2×2 footprint, circular priority, and an electronics deadlock in which households ate the reserve. | Largest city; priority by scarcity; construction reserve | `modern-civ.test.ts` |
| 25 | High | All modern nations converged to the same government (single-faction ideals ratcheted). Developed starts were all democracies. | Contested hereditary rule and military influence; randomized institutions | Diversity test |
| 26 | Medium | Ethos collapsed onto one archetype. | Relative scoring with hysteresis | `ethos.test.ts` |
| 27 | Medium | Traditionalist caution 0.8 hit the autarky threshold, so trade closed by accident. | 0.7 | Covered by the trade tests |
| 28 | Medium | Feed scroll text lower-cased proper adjectives. | Colon format | `feed.test.ts` |
| 29 | Low | The world app frame said "0% of people online" because it read no nation. | Population-weighted world share | `feed.test.ts` (mutation) |
| 30–36 | Low | Security R5-1…R5-6: no CSP, no frame protection, a third-party font, unvalidated preferences, loose round-5 save fields, mutable CI action tags. | See SECURITY.md §2 | `tests/security/hardening.test.ts` (9 mutations caught) + 5 e2e checks |
| — | Doc | The water-first claim (90.5% vs 83.6%) came from a 2-seed sample. | Corrected: over 8 seeds, 82.4% vs 81.6% (within noise); the test checks the outcome only | ROADMAP, VALIDATION |

## Known issues and next steps (ranked)

1. **Modern unemployment stays high:** 19–27% in the round-6 runs (15–36% in round 5). Automation displaces labor faster than services absorb it. The access rule cost industrial sites, which is why industry is exempt.
2. **City composition:** modern capitals are dominated by school and workshop districts (172 of 551 detail tiles were schools in one era-10 world). The workshop target keeps growing with population (one per 15,000 people), so a 480k capital had about 32 workshop districts in round 7. This is visible in the close-up and in the jobs list (many artisans), and worth rebalancing in the planner. Round 6 showed that fewer industrial districts raised unemployment, so it needs a careful balance pass.
3. **Warming can be strong:** 3.4–10.3 °C by year 1,000 (modern-2 is 10.27 °C). Emissions are normalized by map area, but mitigation (renewables adoption, policy) is weak.
4. **No WebKit or physical-device verification (R13, R15).** Run the protocol in VALIDATION §8 on an iPhone; Safari's CSP behavior is untested.
5. **Nuclear use was never observed** in the 20-world endings census (by design it is rare, and deterrence and the taboo work). This means the launch path is exercised only by tests, not by organic history.
6. **GitHub Pages header limits:** HSTS, frame-ancestors and similar headers need another host or a CDN (SECURITY.md §5).
7. **Favorites and follow camera:** not implemented (deferred, as agreed).

## History

The round-2 ledger is kept below for reference.

### Bug ledger, round 2

Each fix has a regression test, and "mutation" means the test was confirmed to fail without the fix.

| # | Severity | Root cause | Fix | Regression evidence |
|---|---|---|---|---|
| 1 | High | Population created or destroyed outside any flow: the founding profile summed to 1.007; settlers and migrants vanished; repression deaths were recorded but nobody was removed; colonies started from nothing; per-band rounding. | Cumulative population ledger and conservation fixes | 9 ledger tests (mutation); tick probe and fuzzer clean |
| 2 | High | Industrial and modern unemployment came from a fixed formula, because formal jobs covered only 2.5% of workers. | Demand-driven market services | Counterfactual test; 5-scenario comparison |
| 3 | High | Developed starts began with an 84–100% food shortfall. | Size the population to the land and lay out farmland | Fed-starts test |
| 4 | High | Public debt compounded to Infinity (8 of 20 seeds). | Interest capped at 25%; forced restructuring above 3× income | Test (red→green); 20-seed rerun |
| 5 | Medium | Spoilage was counted as negative investment, so future-era GDP went negative. | Spoilage excluded from ΔInventories | Test |
| 6 | Medium | Undo left the land flooded behind a ridge as grass, and left pit-filled elevation in place. | Undo re-derives hydrology; derived changes are captured in the stroke | Test (mutation, both halves) |
| 7 | Medium | Terrain powers cleared buildings without updating settlement counts. | `removeBuilding` | Covered by the powers test |
| 8–17 | Medium/Low | Security audit V1–V9 and S1 (gzip bomb, unvalidated decode, non-atomic save, hangs, URL beacon). | See SECURITY.md | 29 tests; 23 of 28 fail against the pre-fix decoder |
| 19 | High | Medieval stall in 2 of 4 natural worlds: foragers drove every domesticable species extinct, so domestication (and 146 techs behind it) became impossible. | Type-III hunting response (refuge populations) | `refugia.test.ts` (mutation) |
| 20 | High | Tech-tree dead end: 146 of 207 techs behind one geography-dependent tech. | Two historically wrong prerequisite edges removed | Structural test; `modern-3` now reaches Atomic & Space |
| 21 | Medium | New World screen applied the first preset in the list (now Realistic/observer) while highlighting Primitive Earth. | Apply the highlighted preset | E2E |
| 18 | Low | `foundSettlement`'s profile also inflated the starting population of developed civs by 0.7%. | Normalized | Ledger tests |

### Plan verification (round 2)

Tests the plan named, and where they stand:

| Status | Tests |
|---|---|
| Implemented this round | pathAvoidsWater, buildingTierFollowsEra, housingDrivesConstruction, undoRestoresTiles, seriesMatchState, decompositionSumsToChange (as the ledger tests), tradeBalanceSumsToZero, printingMoneyInflates, deficitBuildsDebt, warHasRecordedCauses, allianceObligationsJoinWar, automationDisplacesLabor, sanitationLowersDeaths, predatorsReducePrey, colonyRequiresSpaceTier, prereqsEnforced, speculativeGated, diffusionFromContact, tradeInterruptionHurtsDependentCity (#8), unavailableStorage, migrationFromV0, quota and interrupted-write handling, corrupted and truncated imports |
| Covered by equivalent tests | roadsReduceCost (#2), instability (#6), war (#4), religion (#9), drought (#1), pollution (#7) |
| Not implemented, with reasons | `terrainDefenseBonus` (the defense multiplier is a private function; battle outcomes are covered indirectly). `notAlwaysTotalConquest` (statistical: in the 20-seed sample, median annexations are far below median wars). `densityRaisesR` (sanitation was tested instead; the density term is a monotone formula). `foodConservation`, `historicLandmarksPersist`, `adoptionNeedsResources`, `industrialWorkersPushParticipation`, `nuclearDeterrenceLowersWarUtility`, `overhuntingCausesExtinction`, `secularizationWithDevelopment`, `cultureSurvivesConquest`, `knowledgeLossOnCollapse` (lower risk; next round). |
