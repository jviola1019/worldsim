# Status report

This report tracks completion against the requirements (R-IDs from [REQUIREMENTS.md](REQUIREMENTS.md)) and the phases of the implementation plan. Labels:

- **Complete:** implemented, used by the simulation and covered by tests or verified in the browser.
- **Partial:** works, with the stated gaps.
- **Experimental:** works, but balance or behavior is not yet validated.
- **Missing:** not implemented.

Last verified 2026-11-18 (round 2):
- `tsc`: exit 0.
- `npm test`: **125/125** (14 files, 0 skipped).
- `vite build`: exit 0.
- E2E: 12/12 (phone and desktop, Chromium).
- Viewport check: 6/6 device profiles.

Evidence for every figure is in [VALIDATION.md](VALIDATION.md); performance is in [PERFORMANCE.md](PERFORMANCE.md) and security in [SECURITY.md](SECURITY.md).

## Requirements

| ID | Area | Status | Evidence / gaps |
|---|---|---|---|
| R0 | Principles: autonomy, emergence, original IP, truthful docs | Complete | 20-seed holdout runs diverge (VALIDATION §6). |
| R1 | World creation, presets, no forced quests | Complete | The presets test covers every preset. Developed (era) starts are now sized to their land and laid out with farmland. |
| R2.1–2.4 | Terrain, generation, dynamics with causal effects | Complete | Drought counterfactual. Undo now restores land exactly, including valleys flooded by a stroke. |
| R2.5 | Resources, depletion, extraction | Partial | Deposits deplete. Pre-stocked developed starts mask scarcity for decades: "rich" and "poor" scenarios differ little over 25 years, although metal access does differ. |
| R3.1–3.2, R3.4–3.5 | Individuals, character development, notables, multi-resolution | Complete | 10 development tests. Cohort↔individual conversions now conserve population, with rounding recorded explicitly. |
| R3.3 | Demographic response and transition | Partial | Works, but organic late-era worlds reach a **Malthusian ceiling**: food at 41% of need, 26 births and 17 famine deaths per 1,000 per year. The fertility transition needs recalibration (VALIDATION §3). |
| R4–R6 | Civilizations, religion, government | Complete | Counterfactual tests #6 and #9; flags; secession; alliance obligations. |
| R7 | Technology | Complete | #10: prerequisites hold across seeds, speculative technology is gated, diffusion needs contact. #3: education raises research capability, with no measurable effect on tech score within 30 years. |
| R8.1–8.2 | Cities, transport | Complete | housingDrivesConstruction, roads (#2), buildingTierFollowsEra. |
| R8.3 | Economy, accounting identities | Complete | GDP identity, ledger and finiteness hold in 20/20 holdout seeds (VALIDATION §6). ΔInventories counts quantity changes only, with no holding gains and no spoilage. Public debt can no longer reach Infinity. Unemployment follows service demand rather than a fixed rule. |
| R8.4 | Trade, embargoes, crises | Complete | Integration #8: an embargo hurts the dependent importer and trade recovers once it is lifted. tradeBalanceSumsToZero passes. |
| R9 | War and diplomacy | Complete | War counterfactual (#4), recorded causes, alliance obligations. |
| R10 | Disease, ecology, powers | Complete | Sanitation lowers deaths and predators reduce prey (both counterfactual). All 97 powers apply without error, and the ledger fuzzer applied random powers with no failures. |
| R11 | Modern and future systems | Experimental | Colonies require space tier and automation displaces labor (tests). Late-era balance is limited by R3.3. |
| R12.1–12.3 | Event log, causes, snapshots, branching | Complete | Saves resume identically for 20–40 years in eras 1/4/9/10/12. |
| R12.4 | Statistics and change decomposition | **Complete** | The population ledger reconciles exactly at every tick, for the world and for every civ. Residual: baseline mean 0–11% (worst 40%), now 0%. |
| R13 | UI, touch, inspectors, 16 overlays | Complete | Tested in Chromium emulation of iPhone SE, iPhone 13 portrait and landscape, iPhone 15 Pro Max, iPad and Galaxy S9+. Map labels no longer overlap. **No WebKit or physical-device testing.** |
| R14 | Art and asset manifest | Complete | [ASSETS.md](ASSETS.md) |
| R15 | Architecture, determinism, performance | Partial | Determinism is complete. On identical state the median is about 9% faster. Late game on 256² costs about 0.4–0.5 s per simulated year. **Physical iPhone performance is unverified.** |
| R16 | Persistence | **Complete** | Validating decoder; gzip-bomb cap; atomic saves; quota failure leaves the old save intact; V0 migration and unavailable storage are tested (29 security tests). |
| R17 | Tests, benchmarks, docs, CI | Partial | 125 tests, plus a CI workflow (quality gate on every push, weekly long-run job). Missing: WebKit/Firefox and physical-device runs. |

## Bug ledger, round 2

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
| 18 | Low | `foundSettlement`'s profile also inflated the starting population of developed civs by 0.7%. | Normalized | Ledger tests |

## Known issues and next steps (ranked)

1. **Malthusian ceiling in late eras (R3.3).** This has the highest model impact. Next step: recalibrate the fertility transition so that food security, child survival and urbanization lower TFR. Yields alone were tested and rejected.
2. **No WebKit or physical-device verification (R13, R15).** Run the protocol in VALIDATION §8 on an iPhone.
3. **Late-game performance on 256²:** about 0.45 s per simulated year. The next targets are migration, settlement monthly bookkeeping and herd updates (PERFORMANCE §1).
4. **Resource scarcity is masked by pre-stocked developed starts (R2.5).**
5. **Dev-dependency advisories:** vitest 5 upgrade (SECURITY.md).
6. **Favorites and follow camera:** not implemented (deferred, as agreed).
7. **Self-host the Pixelify Sans font:** privacy improvement.

## Plan verification

Tests the plan named, and where they stand:

| Status | Tests |
|---|---|
| Implemented this round | pathAvoidsWater, buildingTierFollowsEra, housingDrivesConstruction, undoRestoresTiles, seriesMatchState, decompositionSumsToChange (as the ledger tests), tradeBalanceSumsToZero, printingMoneyInflates, deficitBuildsDebt, warHasRecordedCauses, allianceObligationsJoinWar, automationDisplacesLabor, sanitationLowersDeaths, predatorsReducePrey, colonyRequiresSpaceTier, prereqsEnforced, speculativeGated, diffusionFromContact, tradeInterruptionHurtsDependentCity (#8), unavailableStorage, migrationFromV0, quota and interrupted-write handling, corrupted and truncated imports |
| Covered by equivalent tests | roadsReduceCost (#2), instability (#6), war (#4), religion (#9), drought (#1), pollution (#7) |
| Not implemented, with reasons | `terrainDefenseBonus` (the defense multiplier is a private function; battle outcomes are covered indirectly). `notAlwaysTotalConquest` (statistical: in the 20-seed sample, median annexations are far below median wars). `densityRaisesR` (sanitation was tested instead; the density term is a monotone formula). `foodConservation`, `historicLandmarksPersist`, `adoptionNeedsResources`, `industrialWorkersPushParticipation`, `nuclearDeterrenceLowersWarUtility`, `overhuntingCausesExtinction`, `secularizationWithDevelopment`, `cultureSurvivesConquest`, `knowledgeLossOnCollapse` (lower risk; next round). |
