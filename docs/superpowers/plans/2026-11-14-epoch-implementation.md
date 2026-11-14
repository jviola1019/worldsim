# EPOCH: Civilizations Unbound Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playable, deterministic, mobile-first pixel-art civilization god simulator whose history emerges from interacting systems (prehistory → speculative future).

**Architecture:** Plain-data `WorldState` (typed-array `TileMap` + id-keyed entity Maps) mutated by pure system functions under a fixed-tick `Simulation` (120 ticks/year; monthly and yearly work staggered by entity id). A Canvas2D renderer draws cached 16×16-tile chunk textures from an original procedural/hand-authored sprite atlas; Preact renders the HUD and inspectors. Saves are versioned, gzip-compressed binary+JSON blobs in IndexedDB.

**Tech Stack:** TypeScript 5.9.3, Vite 7.3.8, Preact 10.29.8, Vitest 3.2.7, tsx 4.23.15, fake-indexeddb 6.2.8, Playwright (preinstalled, `require('playwright')`).

**Spec:** `docs/REQUIREMENTS.md` (requirement IDs R0–R17) condensed from the master prompt.

## Global Constraints

- Simulation code never calls `Math.random`, `Date.now` or `performance.now`; all randomness comes from `sim.rng` (sfc32, state saved in `WorldState.rng`).
- One tile = 8×8 art pixels; all art uses only `src/rendering/art/palette.ts` keys; team colors via `T/U/V`.
- `TICKS_PER_YEAR = 120`, `TICKS_PER_MONTH = 10`; settlement monthly work runs when `tick % 10 === s.id % 10`; civ yearly work runs when `tick % 120 === (c.id * 37) % 120`.
- Entities are JSON-serializable plain objects; typed arrays only in `TileMap` and `WorldState.knowledge`.
- Original art/icons only; no real religious/political symbols, no Red Cross emblem, weapons stylized.
- Every displayed statistic is read from simulation state; no hardcoded or invented numbers in UI.
- Target browsers: iOS Safari 15+, current Chrome/Firefox/Safari desktop; build target `['es2020','safari15']`.
- Commits end with the session attribution lines; push only to `claude/epoch-civilizations-unbound-dap8pc`.

## Review Focus

- Private-browsing Safari where `indexedDB.open` throws or quota is 0 → game must still start, play, and show "saving unavailable", with export-to-file working (Task 11 test `saves.unavailableStorage`).
- A second finger landing during a brush stroke → stroke ends without painting the pinch path; camera pinches (Task 13 test `input.pinchCancelsPaint`).
- Very long runs (3000+ simulated years) → event log, stats series and person archive stay bounded; memory does not grow linearly (Task 26 test `stress.boundedGrowth`).
- Extreme world sliders (ocean 0.9 / 0.2, size 128 & 320, all toggles off, 0 start civs) → world generates, simulation runs with zero civs (Task 3 test `worldgen.extremes`, Task 5 test `sim.emptyWorld`).
- God powers that delete entities the UI is inspecting (destroy city, kill civ) → inspectors close/fallback without exceptions; history keeps archived references (Task 13 test `powers.destroyWhileSelected`, Task 14 UI guard).

---

## File Structure

```
src/core/        rng.ts noise.ts math.ts heap.ts time.ts                       (done)
src/config/      balance.ts laws.ts                                           (done)
src/world/       terrain.ts tilemap.ts resources.ts worldgen.ts               (done)
                 pathfinding.ts environment.ts climate.ts                     (Tasks 10, 22)
src/sim/         types.ts context.ts (done) world.ts bootstrap.ts simulation.ts digest.ts
src/history/     events.ts newspaper.ts (done) stats.ts explain.ts
src/population/  traits.ts persons.ts demography.ts (done) bands.ts disease.ts
src/ecology/     species.ts ecology.ts
src/civilizations/ buildingTypes.ts (done) buildings.ts settlement.ts urban.ts territory.ts civ.ts
src/economy/     production.ts market.ts trade.ts infrastructure.ts
src/technology/  types.ts (done) techData.ts (agent) research.ts
src/politics/    govforms.ts succession.ts government.ts diplomacy.ts
src/military/    war.ts combat.ts
src/culture/     language.ts (done) culture.ts religion.ts
src/future/      space.ts
src/powers/      powers.ts undo.ts
src/persistence/ serialize.ts saves.ts migrations.ts
src/rendering/   art/* (agents) atlas.ts camera.ts terrainLayer.ts renderer.ts overlays.ts effects.ts
src/ui/          main.tsx App.tsx screens/*.tsx hud/*.tsx panels/*.tsx charts/*.tsx input.ts audio.ts
src/workers/     worldgen.worker.ts
tests/           <module>/*.test.ts, integration/*.test.ts, e2e/run-e2e.mjs
benchmarks/      sim-bench.ts browser-bench.mjs
scripts/         run-sim.ts multi-seed.ts
docs/            REQUIREMENTS.md ARCHITECTURE.md MODEL.md FEATURES.md STATUS.md ASSETS.md research/*
```

## Execution model

Hybrid, per the prompt ("delegate independent tasks, keep central architectural control"):
- **Delegated (isolated worktrees, merged by lead):** A1–A4 pixel art, A5 tech data, A6 research, later Task 11 persistence and Task 27 e2e scripts.
- **Lead implements natively:** tightly coupled simulation systems (Tasks 3–10, 15–25), renderer, UI integration.
- Resume interrupted agents with `SendMessage` (their prompt/context is preserved); never start duplicates.
- After each merged delegated task: run `npm run typecheck && npm test`; review contact sheets visually.

---

### Task A1–A6: Resume delegated work (agents)

**Files:** `src/rendering/art/{effects,buildings,buildings_civic,animals,vehicles,icons}.ts`, `src/technology/techData.ts`, `tests/technology/techData.test.ts`, `docs/research/*.md`

**Interfaces:** Produces `ALL_SPRITES` ids per agent briefs (`fx.*`, `bld.<KEY>.<tier>`, `ani.*`, `mon.*`, `veh.*`, `ico.*`); `TECHS`, `TECH_BY_ID`, `STARTING_TECHS`, `ERA_NAMES`.

- [ ] **Step 1:** SendMessage each agent: "Usage limit has reset; continue from where you stopped; commit when done."
- [ ] **Step 2:** On completion, `git merge --no-ff worktree-agent-<id>` into the work branch; resolve none-expected conflicts.
- [ ] **Step 3:** Run `npx tsx tools/render-sprites.ts <prefix> 6`; Expected: `VALIDATION PROBLEMS` absent.
- [ ] **Step 4:** Run `npx vitest run tests/technology`; Expected: PASS.
- [ ] **Step 5:** Commit merge.

### Task 3: World generation tests

**Files:** Test: `tests/world/worldgen.test.ts`

**Interfaces:** Consumes `generateWorld(p: WorldGenParams): WorldGenResult`, `DEFAULT_GEN`.

- [ ] **Step 1: Write tests**
  - `deterministic`: two runs with seed `'t1'` produce identical `elev`, `terrain`, `river`, `dep` arrays.
  - `oceanCoverage`: water fraction within ±0.06 of `oceanCoverage` for 0.4, 0.6, 0.8.
  - `riversReachWater`: following `flow` from every river tile ends on a water tile (or lake) within `n` steps.
  - `depositsRespectGeology`: no deposit on deep/ocean tiles except FISH; SPICES only where `temp >= 19`.
  - `worldgen.extremes`: sizes 128/320 and ocean 0.2/0.9 complete without throwing and have ≥1 land tile.
- [ ] **Step 2:** `npx vitest run tests/world` → PASS (fix worldgen if not). Commit.

### Task 4: Government forms and dynastic succession

**Files:** Create `src/politics/govforms.ts`, `src/politics/succession.ts`; Test `tests/politics/succession.test.ts`

**Interfaces:**
- Produces `deriveGovForm(civ: Civ, nSettlements: number): GovFormKey`, `GOV_FORMS: Record<GovFormKey,{label;title:[string,string];name:(base:string,adj:string)=>string}>`, `civDisplayName(civ): string`, `rulerTitle(civ, female): string`.
- Produces `onNotableDeath(sim, p)`, `crown(sim, civ, person, how: 'founded'|'inherited'|'elected'|'chosen'|'seized')`, `pickSuccessor(sim, civ): Person|undefined`, `notablesYearly(sim)`, `protectRulingFamily(sim, civ)`.
- Rules: hereditary ≥ 0.5 → eldest living child, then siblings, then dynasty; otherwise a new candidate person from the civ's culture; no candidate → succession crisis event (`importance 3`, legitimacy −0.25, new dynasty).

- [ ] **Step 1: Tests:** `heirIsEldestChild` (monarchy, ruler dies → eldest child crowned, title from GOV_FORMS), `electiveCreatesNewLeader` (democracy → different family), `crisisWithoutHeirs` (legitimacy drops ≥0.2, event type `succession_crisis`), `govFormFromInstitutions` (participation .7/competition .7/liberties .7/hereditary 0 → `democracy`; hereditary .9 + 10 settlements + 2 cultures → `empire`).
- [ ] **Step 2:** Implement; run `npx vitest run tests/politics` → PASS; commit.

### Task 5: World creation, bootstrap and Simulation orchestrator

**Files:** Create `src/sim/world.ts`, `src/sim/bootstrap.ts`, `src/sim/simulation.ts`, `src/sim/digest.ts`; Test `tests/sim/simulation.test.ts`

**Interfaces:**
- `createWorld(cfg: WorldConfig): WorldState`; `newId(w, kind: string): number`; `relKey(a,b): string`; `ensureRelation(sim,a,b): Relation`.
- `class Simulation implements Sim { constructor(w: WorldState); step(): void; runYears(n: number): void; advance(realMs: number, speed: number): number; snapshot(): WorldState }` — `advance` caps work at `BALANCE.maxTicksPerFrame` and ~8 ms per call.
- `SPEEDS = [0, 20, 60, 120, 360, 1200]` (ticks/second targets).
- `stateDigest(w): string` (Digest over map arrays, entity numeric fields, rng state).
- `seedLife(sim)`: herds by biodiversity; `startCivs` bands (era 1) or developed civs (era > 1, Task 24).

- [ ] **Step 1: Tests:** `sim.deterministic` (two sims seed 's' run 50 years → equal digest), `sim.emptyWorld` (startCivs 0, empty → 100 years no throw, zero civs), `sim.yearAdvances` (`runYears(3)` → `tick === 360`), `sim.staggering` (each settlement monthly hook called exactly 12×/year).
- [ ] **Step 2:** Implement; `npx vitest run tests/sim` → PASS; commit.

### Task 6: Ecology

**Files:** Create `src/ecology/species.ts`, `src/ecology/ecology.ts`; Test `tests/ecology/ecology.test.ts`

**Interfaces:** `SPECIES: SpeciesDef[]` (key, name, diet 'herbivore'|'predator'|'omnivore', biomes, size, speed, domesticable, food value, sprite); `spawnHerd(sim, key, x, y, count): Herd`; `herdsTick(sim)`; `ecologyMonthly(sim)` (vegetation regrowth toward `vegCapacity`, predation, reproduction logistic in local vegetation, starvation); `huntHerds(sim, x, y, r, demand): number` (returns food taken); `evolutionYearly(sim)` (gene drift + selection by temperature; subspecies when divergence > 0.35 after ≥ 150 years).

- [ ] **Step 1: Tests:** `herdsGrowWithFood`, `predatorsReducePrey`, `overhuntingCausesExtinction` (event `species_extinct`), `vegetationRegrows` (cleared forest tile recovers ≥50% capacity within 60 years), `subspeciesNeedsTime` (no subspecies before 150 years).
- [ ] **Step 2:** Implement; tests PASS; commit.

### Task 7: Bands, tribes and settlement founding

**Files:** Create `src/population/bands.ts`, `src/civilizations/civ.ts` (createCiv/killCiv/recomputeCaps), `src/civilizations/settlement.ts` (foundSettlement/destroySettlement); Test `tests/population/bands.test.ts`

**Interfaces:** `spawnBand(sim, x, y, species, size, civId?): Band`; `bandsTick(sim)`; `bandMonthly(sim, b)`; `createCiv(sim, opts:{species;cultureId?;languageId?;x;y;parentId?}): Civ`; `foundSettlement(sim, civ, x, y, opts:{members?:number[];pop?:number;name?:string}): Settlement`.
- Settling chance/year = `0.03 + 0.15*richness + (caps.farming>0 ? 0.5 : 0)`; split at `BALANCE.bandSplitSize`; daughter joins parent civ if a parent settlement within 25 tiles else new tribe civ with p=0.6.

- [ ] **Step 1: Tests:** `bandForagesAndGrows` (25 people on grassland → >25 after 40 years), `bandSettles` (settlement exists within 60 years), `bandSplitCreatesNewBand`, `individualToCohortConversion` (settlement >150 → `mode==='cohort'`, population conserved ±1).
- [ ] **Step 2:** Implement; tests PASS; commit.

### Task 8: Buildings, settlement economy and urban growth

**Files:** Create `src/civilizations/buildings.ts`, `src/civilizations/urban.ts`, `src/economy/production.ts`; Modify `settlement.ts` (`settlementMonthly`); Test `tests/economy/production.test.ts`, `tests/civilizations/urban.test.ts`

**Interfaces:** `BUILDINGS: BuildingDef[]` ({id,key,name,category,tech?:BuildingKey-unlocked-by-caps,housing,jobs,sector,inputs,outputs,cost:{WOOD,STONE,METAL,MACHINERY},labor,placement}); `SECTORS = ['food','resources','industry','construction','services','military']`; `settlementEconomy(sim, s, civ): {foodProduced; adequacy; employment:number[]; output:number[]}`; `planConstruction(sim, s, civ)`; `progressConstruction(sim, s, civ, builders)`.
- Food in person-years; farm yield `BALANCE.farmYield*(fert/255)*climate*(1+caps.farming)`; labor `BALANCE.farmLabor*(1-caps.farmMechanization)`.

- [ ] **Step 1: Tests:** `foodConservation` (produced − consumed − spoiled = Δstock ±1e-6), `droughtLowersYield` (regional rain anomaly −0.6 → farm output −30% or more), `housingDrivesConstruction` (pop > housing → residential project started), `buildingTierFollowsEra` (era 9 civ builds APARTMENT not HUT), `historicLandmarksPersist` (tier-1 TEMPLE flagged HISTORIC after upgrade era).
- [ ] **Step 2:** Implement; tests PASS; commit.

### Task 9: Technology runtime

**Files:** Create `src/technology/research.ts`; Test `tests/technology/research.test.ts`

**Interfaces:** `computeCaps(civ): Caps`; `researchYearly(sim, civ)`; `chooseResearch(sim, civ): string`; `grantTech(sim, civ, id, how)`; `forgetTech(sim, civ, id)`; `eraOf(civ): number`; `techAvailable(sim, civ, t): boolean` (prereqs + realism mode + laws + features); `adoptionStep(sim, civ, t)` (blocked while `requires.resources` access < 0.3).

- [ ] **Step 1: Tests:** `prereqsEnforced`, `adoptionNeedsResources` (bronze_working stays < 0.2 without TIN access, rises after access), `diffusionFromContact` (neighbor with tech raises progress), `knowledgeLossOnCollapse` (literacy 0 + no libraries → some adopted techs lost over 200 years), `speculativeGated` (realism 'grounded' never discovers era-15 techs).
- [ ] **Step 2:** Implement; tests PASS; commit.

### Task 10: Territory, pathfinding, infrastructure

**Files:** Create `src/world/pathfinding.ts`, `src/civilizations/territory.ts`, `src/economy/infrastructure.ts`; Tests `tests/world/pathfinding.test.ts`, `tests/integration/roads.test.ts`

**Interfaces:** `findPath(map, from, to, opts:{mode:'land'|'sea'|'any'; maxCost?; railTier?}): number[]|null` (A*, MinHeap); `pathCost(map, path, mode): number`; `recomputeTerritory(sim, s)`; `planInfrastructure(sim, civ)`; `buildRoute(sim, path, roadTier, railTier)`.

- [ ] **Step 1: Tests:** `pathAvoidsWater`, `roadsReduceCost` (cost with roads < 0.6× cost without), `roadConstructionChangesTradeCost` (integration #2), `bordersDontOverlap` (each tile has ≤1 owner; owner matches settle's civ).
- [ ] **Step 2:** Implement; tests PASS; commit.

### Task 11: Persistence (delegate after Task 5 types stabilize)

**Files:** Create `src/persistence/serialize.ts`, `saves.ts`, `migrations.ts`; Test `tests/persistence/*.test.ts`

**Interfaces:** `serializeWorld(w): Uint8Array` (header JSON + gzip via CompressionStream or `fflate`-free fallback); `deserializeWorld(b): WorldState`; `class SaveStore { list(); save(slot, w, thumb); load(slot); remove(slot); exportBlob(w); importBlob(b) }`; `migrate(raw, fromVersion)`.

- [ ] **Step 1: Tests:** `roundTripDigest` (run 30y, save, load, run 30y both → equal digests), `corruptDataRejected` (flipped bytes → typed error, store intact), `saves.unavailableStorage` (indexedDB undefined → `SaveStore.available === false`, export still works), `migrationFromV0`.
- [ ] **Step 2:** Implement with `fake-indexeddb/auto` in tests; PASS; commit.

### Task 12: Renderer

**Files:** Create `src/rendering/atlas.ts`, `camera.ts`, `terrainLayer.ts`, `renderer.ts`, `overlays.ts`, `effects.ts`

**Interfaces:** `buildAtlas(sprites, palette): Atlas {canvas; rect(id): {x,y,w,h,ax,ay,frames}; tinted(id, civColor): CanvasImageSource}`; `class Camera {x;y;zoom; screenToWorld; worldToScreen; clampTo(map)}`; `class Renderer { constructor(canvas, sim, atlas); frame(dtSec): void; overlay: OverlayMode; selection; brushPreview }`; LOD: overview texture (1 px/tile) when `zoom*8 < 3` screen px per tile.

- [ ] **Step 1:** Implement; verify with Playwright screenshot script `tools/screenshot.mjs` (desktop 1280×800 and iPhone 13 emulation); inspect images.
- [ ] **Step 2:** Measure frame time in `benchmarks/browser-bench.mjs` (Task 27). Commit.

### Task 13: Input, god powers, undo

**Files:** Create `src/ui/input.ts`, `src/powers/powers.ts`, `src/powers/undo.ts`; Tests `tests/powers/powers.test.ts`, `tests/ui/input.test.ts`

**Interfaces:** `POWERS: PowerDef[]` ({id, category (10 categories), icon, label, kind:'brush'|'tap'|'global', apply(sim,x,y,r,arg)}); `applyPower(sim, id, x, y, r, arg): void` (records `Intervention`); `UndoStack.begin()/record(i)/end()/undo(sim)`; gesture classifier `classify(pointers, tool): 'pan'|'pinch'|'paint'|'tap'|'longpress'`.

- [ ] **Step 1: Tests:** `raiseLandChangesElevationAndBiome`, `undoRestoresTiles`, `droughtPowerReducesYield`, `grantTechChangesCaps`, `powers.destroyWhileSelected`, `input.pinchCancelsPaint`, `input.longPressInspects` (500 ms, < 8 px movement).
- [ ] **Step 2:** Implement; tests PASS; commit.

### Task 14: UI shell (use frontend-design + dataviz skills)

**Files:** `src/ui/main.tsx`, `App.tsx`, `screens/{Title,NewWorld,Load,Scenarios,Settings}.tsx`, `hud/{TopBar,Dock,Toasts,Ticker}.tsx`, `panels/{Inspector,CivPanel,SettlementPanel,PersonPanel,HistoryPanel,StatsPanel,LawsPanel}.tsx`, `charts/LineChart.tsx`, `ui/styles.css`

- [ ] **Step 1:** Implement screens and panels bound to live `Simulation` state via a 4 Hz UI refresh signal.
- [ ] **Step 2:** Playwright e2e (Task 27) covers create world → play → open civ panel → save → load.
- [ ] **Step 3:** Commit.

### Tasks 15–25: Civilization systems (lead, native)

Each task: Files, Interfaces and tests below; implement, run `npm test`, commit.

- **15 Market & public finance** — `src/economy/market.ts`: `civEconomyYearly(sim, civ)`; tests `gdpIdentity` (|C+I+G+NX−GDP| < 1e-6·GDP), `deficitBuildsDebt`, `printingMoneyInflates`.
- **16 Government** — `src/politics/government.ts`: `politicsYearly(sim, civ)`; factions from employment shares; tests `instabilityCausesRebellionOrChange` (integration #6), `industrialWorkersPushParticipation`.
- **17 Diplomacy** — `src/politics/diplomacy.ts`: `diplomacyYearly(sim, civ)`, `declareWar(sim, a, d, goal, causes)`, `makePeace(sim, war, terms)`, orgs/federations/vassals/embargoes; tests `warHasRecordedCauses`, `nuclearDeterrenceLowersWarUtility`, `allianceObligationsJoinWar`.
- **18 Military** — `src/military/war.ts`, `combat.ts`: armies, A* movement, Lanchester battles (linear pre-gunpowder, square after), sieges, supply, war score, peace terms; tests `warReducesLaborAndDamagesInfrastructure` (integration #4), `terrainDefenseBonus`, `notAlwaysTotalConquest` (multi-seed: < 70% wars end in annexation).
- **19 Religion & culture** — `src/culture/religion.ts`, `culture.ts`: emergence, diffusion, missionaries, schism, syncretism, secularization, assimilation, divergence; tests `religionCrossesBorders` (integration #9), `secularizationWithDevelopment`, `cultureSurvivesConquest`.
- **20 Disease** — `src/population/disease.ts`: SIR per settlement, spread via routes/armies; tests `densityRaisesR`, `sanitationLowersDeaths`.
- **21 Trade** — `src/economy/trade.ts`: routes, gravity-style flows, embargo/war blocking; tests `tradeInterruptionHurtsDependentCity` (integration #8), `tradeBalanceSumsToZero`.
- **22 Environment & climate** — `src/world/environment.ts`, `climate.ts`: fires, disasters, regional rain anomalies (AR(1)), CO2 → forcing → anomaly, sea level, pollution; tests `droughtCausalChain` (integration #1), `industrializationRaisesPollution` (integration #7).
- **23 Future systems** — `src/future/space.ts` + automation in production: launches, satellites, stations, colonies, independence, AI displacement & UBI; tests `colonyRequiresSpaceTier`, `automationDisplacesLabor`.
- **24 Era bootstrap & scenarios** — `src/sim/bootstrap.ts`, `src/scenarios/scenarios.ts`: developed civs for eras 4/7/10, collapse scenario (ruins, lost techs), optional objectives; test `presetsGenerate` (each preset runs 20 years).
- **25 History & analytics** — `src/history/stats.ts`, `explain.ts`: sampled series with decimation, population change decomposition from `DemographicFlows`; tests `seriesMatchState`, `decompositionSumsToChange`.

### Task 26: Statistical & stress tests

**Files:** `scripts/multi-seed.ts`, `tests/integration/stress.test.ts`

- [ ] `stress.boundedGrowth`: 3000-year run on 128² → `events.length ≤ 20000`, persons map ≤ 50k, stats arrays ≤ 600 samples.
- [ ] `multi-seed.ts --seeds 20 --years 1500` prints survival, wars, era reached per world; investigate pathologies (all collapse / identical eras). Record results in `docs/VALIDATION.md`.

### Task 27: Benchmarks & e2e (delegate scripts)

**Files:** `benchmarks/sim-bench.ts` (ticks/s by world size & era), `benchmarks/browser-bench.mjs` (Chromium + iPhone emulation, 4× CPU throttle, FPS while panning/zooming at speeds 1–5), `tests/e2e/run-e2e.mjs` (touch pan, pinch, paint, select, menus, save/load, rotation, small screen).

- [ ] Run both; write measured numbers (hardware, browser, world, population) to `docs/PERFORMANCE.md`. No claims without numbers.

### Task 28–30: Polish, audit, documentation

- **28 Audio & feel** — `src/ui/audio.ts` (WebAudio synthesized ambience/UI/event sounds, mute toggle); tutorial overlay; accessibility (focus order, labels, reduced motion).
- **29 Audit loop** — use `code-review`, `simplify`, `security-review` skills; identify → reproduce → root cause → fix → test → regression → document.
- **30 Docs** — `docs/ARCHITECTURE.md`, `MODEL.md` (evidence-informed / stylized / speculative per mechanic), `FEATURES.md` (WorldBox parity matrix from research), `ASSETS.md` (manifest), `STATUS.md` (complete/partial/experimental/unimplemented), `README.md` (install/dev/build/test/deploy), continuation plan.
