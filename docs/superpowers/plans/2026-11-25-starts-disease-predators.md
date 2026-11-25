# Three starts, realistic disease, ranging predators: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Three starts (Realistic, God mode, Observer) with a start-era setting capped below Digital and an "Are you sure?" check.
- Disease at historically grounded rates, with modern pandemics and realistic visuals.
- Predators that leave home only when there is no prey there.
- The weak promises tuned, and the three small defects fixed.

**Architecture:**
- **Starts:** the three starts stay as `PRESETS` in `config/laws.ts`. The old presets become data-only `START_VARIANTS` that scripts can still apply. One `MAX_START_ERA` constant caps every path into a new world.
- **Disease:** stays in `population/disease.ts`. Medicine changes from blocking spread to mainly saving lives. A yearly world pandemic draw is added in a new `population/pandemic.ts`.
- **Visuals:** go through the existing concept-effect registry (`sim/conceptFx.ts` → `rendering/renderer.ts`) and the pixel sprites in `rendering/art/effects.ts`.

**Tech stack:** TypeScript, Preact, Canvas2D, Vitest, Playwright (Chromium and WebKit), axe-core.

**Spec:** `docs/superpowers/specs/2026-11-25-starts-disease-predators-design.md` (approved 2026-11-25). The owner added: "verify all fits theme, works realistically and gameplay is validated; all sprites are animated correctly with realistic graphics for certain situations and aspects (disease, natural disasters)".

**Ledger:** `.superpowers/sdd/2026-11-25-starts-disease-predators/progress.md`. Read it first after a restart, and append a line per task (rulings, commits, test results).

## Global constraints
- **Era cap:** `MAX_START_ERA = 10` (Atomic & Space). No new world, preset, variant, scenario or random roll starts at era 11 or later. Old saves keep their stored era.
- **Starts:** Realistic, God mode and Observer. Default era 1 (Prehistoric). Era above 1 → confirmation dialog before creating the world (scenarios: only if the player changed the era from the scenario's own value).
- **Era defaults for starting peoples:** era 1 → the start's own count (Realistic 0, God mode 5, Observer 5); eras 2–6 → 8; eras 7–9 → 8; era 10 → 10.
- **Rules per start:** Realistic keeps the real-world lock and Slow pace in every era. Alien planet is God mode only. Collapse is allowed in all three; at era 1 it moves the era to 3.
- **Epidemic logging threshold:** deaths > `max(20, 0.5% of the settlement)`.
- **Predator search:** home habitat (≥ 0.2) within 12 tiles; otherwise any standable tile within 24. Head back to habitat after feeding. Hunger resets only when `fed ≥ 0.5`.
- **Determinism:** same seed and settings give the same world. Histories may change; measure and document every change.
- **Parameters:** every new BALANCE coefficient gets a `[E]/[S]/[C]/[T]` class; rerun `node tools/param-registry.mjs`. After adding source files, rerun `node tools/guide-facts.mjs`.
- **Docs are honest:** measured numbers only; cite sources; emulation is not physical-device testing.
- **Commits:** end with the two attribution lines. Push to `claude/epoch-civilizations-unbound-dap8pc` only.
- **Skills per task:**
  - test-driven-development for code;
  - systematic-debugging for any surprise;
  - ux-copy for new text;
  - frontend-design and interaction-design for screens and effects;
  - verification-before-completion before any claim.

## Review focus
1. **An old save or URL config with `startEra` 11–15 used to create a new world** (e.g. Random, or a config built by a script). Expected: clamped to 10 for new worlds; loading an old save keeps its history. Test: Task 1, `clampStartEra`.
2. **The dialog dismissed with Escape or Cancel.** Expected: the world is not created, focus returns to "Create world", and the settings are unchanged. Test: Task 2 e2e.
3. **A pandemic in a world with one settlement or no links.** Expected: it stays local, with no crash and no division by zero in the connectivity calculation. Test: Task 4 unit.
4. **A predator in a world with no prey anywhere.** Expected: it stays in its habitat and starves slowly; it never wanders the whole map. Test: Task 5 unit.
5. **Reduce motion on every new or changed effect.** Expected: a still frame, with no animation over 0 s. Test: Task 7 unit and e2e.

---

### Task 1: Start-era cap, three starts and folded variants (config)

**Files:**
- Modify: `src/config/laws.ts` (PRESETS → three starts; `START_VARIANTS`; `MAX_START_ERA`; `eraPeopleDefault`; `clampStartEra`; `randomizeConfig` cap)
- Modify: `src/sim/world.ts` (clamp on create)
- Modify: `src/ui/worldFactory.ts` (clamp on create)
- Modify: `src/scenarios/scenarios.ts` (Space Race era 13 → 10)
- Modify: `scripts/mode-audit.ts` (build old preset modes from `START_VARIANTS`)
- Modify: tests that use removed preset keys: `tests/ui/peoples.test.ts`, `tests/population/explorers.test.ts`, `tests/integration/causal.test.ts`, `tests/modes/promises.test.ts`, `tests/world/presets.test.ts`, `tests/powers/*`
- Test: `tests/config/starts.test.ts` (new)

**Interfaces (produces):**
- `export const MAX_START_ERA = 10`
- `export function clampStartEra(era: number): number` (rounds, clamps to 1..10)
- `export function eraPeopleDefault(startKey: 'realistic' | 'god' | 'observer', era: number): number`
- `PRESETS` keys `'realistic' | 'god' | 'observer'`, in that order. `'god'` is named "God mode" and is today's Primitive Earth. `presetByKey('primitive')` returns `'god'` (alias for old callers).
- `export const START_VARIANTS: { key: 'kingdoms' | 'industrial' | 'modern' | 'collapse' | 'alien'; apply(c: WorldConfig): void }[]`, the old preset bodies. `collapse` sets `scenario = 'collapse'` and era 3 if era is 1. `alien` sets the fiction flags.

**Steps:**
- [ ] **Step 1: Write failing tests in `tests/config/starts.test.ts`:**
  - `PRESETS.map(p => p.key)` equals `['realistic','god','observer']`;
  - for every preset, every variant applied on top of God mode, every scenario, and 1,000 `randomizeConfig` rolls with a seeded `Math.random` stub: `settings.startEra <= MAX_START_ERA`;
  - `clampStartEra(13) === 10`, `clampStartEra(0) === 1`;
  - `createWorld` with `startEra: 14` yields a world whose leading civ era ≤ 10;
  - `eraPeopleDefault('realistic',1) === 0`, `('god',1) === 5`, `('god',4) === 8`, `('observer',10) === 10`;
  - Space Race scenario `startEra === 10`.
- [ ] **Step 2: Run** `npx vitest run tests/config/starts.test.ts`. Expected: FAIL (`MAX_START_ERA` is undefined).
- [ ] **Step 3: Implement** the interfaces above. `createWorld` and the worker factory call `clampStartEra` before generation, next to `normalizeReal`.
- [ ] **Step 4: Update the scripts and tests that use the old keys** to use `START_VARIANTS`. For each, record in the ledger which key went where.
- [ ] **Step 5: Run** `npx tsc --noEmit -p . && npx vitest run`. Expected: all pass. Space Race objective tests may fail; if so, re-measure them over more worlds or a longer horizon (systematic-debugging) and record it in the ledger.
- [ ] **Step 6: Commit** `feat(starts): three starts, start era capped at Atomic & Space, old presets as variants`.

### Task 2: New World screen (three cards, era setting, toggles, confirmation)

**Files:**
- Modify: `src/ui/screens/NewWorldScreen.tsx`
- Create: `src/ui/screens/ConfirmEra.tsx` (modal dialog)
- Modify: `src/ui/styles.css` (cards, dialog)
- Modify: `tests/e2e/run-e2e.mjs`, `tests/e2e/run-a11y.mjs`
- Test: `tests/ui/newWorld.test.ts` (new; pure helpers: `needsEraConfirm`)

**Interfaces:**
- Consumes: Task 1's `PRESETS`, `START_VARIANTS`, `MAX_START_ERA`, `eraPeopleDefault`, `clampStartEra`.
- Produces: `export function needsEraConfirm(cfg: WorldConfig, scenarioEra?: number): boolean`. It returns true when `startEra > 1` and, for scenarios, when `startEra !== scenarioEra`.

**Steps:**
- [ ] **Step 1: Copy.** Use the ux-copy skill for the card descriptions, the slider label "Start in era", toggle labels, the "Randomize settings" button, and the dialog. Dialog sketch: title "Start in the {era} era?"; body "Nations, towns and technology will already exist. You will skip the start from nothing."; buttons "Start in {era}" and "Cancel". Record the final copy in the ledger.
- [ ] **Step 2: Write the failing unit test.** `needsEraConfirm`: era 1 → false; era 4 → true; scenario era 10 with cfg era 10 → false; scenario era 3 with cfg era 5 → true.
- [ ] **Step 3: Write the failing e2e checks** in `run-e2e.mjs`:
  - the New World screen shows exactly 3 start cards named Realistic, God mode and Observer;
  - the era slider's max label is "Atomic & Space";
  - moving it to 4 sets Starting peoples to 8;
  - "Create world" at era 4 opens a dialog with role `dialog`; Escape closes it, no world starts, and focus is back on "Create world";
  - confirming starts a world whose HUD shows the Iron & Classical era;
  - in Realistic, "Alien planet" is disabled;
  - at era 1 no dialog appears.
- [ ] **Step 4: Run** `npm run build && npm run e2e`. Expected: the new checks FAIL.
- [ ] **Step 5: Implement the screen.** Use the frontend-design skill: three large cards in the existing preset style. Everything else stays in the existing field sets. The dialog uses `<dialog>` or a focus-trapped `role="dialog"` with `aria-modal`, Escape to cancel, and initial focus on Cancel.
- [ ] **Step 6: Run** `npm run e2e`, `BROWSER=webkit npm run e2e`, `npm run a11y`, `BROWSER=webkit npm run a11y` and `node tools/viewports.mjs`. Expected: all pass, including axe on the open dialog (add an a11y stop for it).
- [ ] **Step 7: Commit** `feat(ui): three starts, start-era setting with confirmation, variant toggles`.

### Task 3: Disease: medicine mainly saves lives; logging threshold; research notes

**Files:**
- Modify: `src/population/disease.ts` (beta and lethality terms; logging threshold)
- Modify: `src/config/balance.ts` (`medicineTransmissionCut` [S]; `epidemicLogShare` [S])
- Modify: `docs/data/round10/research-notes.md` (§5 disease, with sources)
- Test: `tests/population/disease.test.ts` (new or extended)

**Interfaces (produces):** `BALANCE.medicineTransmissionCut` (target 0.3: at most 30% fewer transmissions at full disease control) and `BALANCE.epidemicLogShare` (0.005).

**Steps:**
- [ ] **Step 1: Research** (web search, standard mode; no personal details in queries). Collect the R0 of 1918 influenza, 1957, 1968, 2009 H1N1 and COVID-19; their infection-fatality ratios; and the rate of notable pandemics since 1900. Write §5 in `research-notes.md` with the sources and the log of queries.
- [ ] **Step 2: Write failing tests:**
  - a settlement with `diseaseControl = 1, healthcare = 1, sanitation = 1` and a novel disease with r0 2.5 still has effective R above 1 (infections rise in month 1);
  - its lethality term is ≤ 15% of the base lethality;
  - an epidemic killing 0.6% of a 10,000-person town is logged as an `epidemic` event, while one killing 0.3% is not.
- [ ] **Step 3: Run** `npx vitest run tests/population/disease.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement.** `beta` uses `(1 - control * medicineTransmissionCut * (1 - misinfo*0.5))` in place of `0.6`. Quarantine stays. Lethality stays. The log threshold uses `epidemicLogShare`.
- [ ] **Step 5: Run** the disease tests and the full suite. Re-measure any seed-dependent test over more worlds (systematic-debugging), and record each in the ledger.
- [ ] **Step 6: Regenerate PARAMETERS** (`node tools/param-registry.mjs`) and commit `feat(disease): medicine saves lives more than it stops spread; modern outbreaks are logged`.

### Task 4: World pandemic draw and disease audit

**Files:**
- Create: `src/population/pandemic.ts`
- Modify: `src/sim/simulation.ts` (yearly hook)
- Modify: `src/sim/types.ts` (`Disease.pandemic?: boolean`)
- Modify: `src/population/disease.ts` (export `emergeNovel`)
- Modify: `src/config/balance.ts`: `pandemicPreIndustrial` [E] (target 0.005 a year), `pandemicModern` [E] (0.04 a year, notable), `pandemicSevereShare` [E] (share of pandemics at ≥ 1% world deaths, target 1/8)
- Create: `scripts/disease-audit.ts` (checkpointed)
- Test: `tests/population/pandemic.test.ts`

**Interfaces (produces):**
- `export function connectivity(sim: Sim): number`, in 0..1. It is the share of settlements with at least one link, times an era factor `clamp((leadEra - 6) / 4, 0, 1)` (rail, steamships, flight). It is 0 with ≤ 1 settlement.
- `export function pandemicChance(sim: Sim): number` = `pandemicPreIndustrial + (pandemicModern - pandemicPreIndustrial) * connectivity(sim)`.
- `export function pandemicYearly(sim: Sim): void`. It draws once a year; on success it creates a disease with `pandemic: true`, seeds the most-linked settlement, and logs one `pandemic` summary event when it ends (deaths, share of the world).
- Severity: a heavy-tailed draw that sets r0 in 1.4–3 and lethality. Calibrate so that about `pandemicSevereShare` of pandemics kill ≥ 1% of the world.

**Steps:**
- [ ] **Step 1: Write failing tests:**
  - `connectivity` is 0 for a world with one settlement and in 0..1 otherwise;
  - `pandemicChance` equals `pandemicPreIndustrial` at connectivity 0 and `pandemicModern` at 1;
  - a forced pandemic in a two-settlement linked world reaches the second settlement and logs exactly one `pandemic` event when finished;
  - 200 seeded severity draws: the share at ≥ 1% world deaths is within 0.05–0.25.
- [ ] **Step 2: Run** `npx vitest run tests/population/pandemic.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces. Add a `pandemic` entry to `conceptFx.ts` (its visual comes in Task 7). Add the event to the history feed and media.
- [ ] **Step 4: Run** the full suite. Expected: pass, with any re-measurements recorded.
- [ ] **Step 5: Write `scripts/disease-audit.ts`** (`[worlds=6] [years=600] [size=96] [startEra=1|10]`, with `CHECKPOINT` and run-length filenames). Per era band (pre-industrial, industrial, modern) it reports: outbreaks, logged epidemics, pandemics per century, deaths as a share of the population per century, the largest event, and pandemic endings. Run it at start eras 1 and 10, save the output to `docs/data/round10/disease-audit-*.txt`, and compare with research notes §5. Tune the [E] values only within the sourced ranges, then re-run.
- [ ] **Step 6: Commit** `feat(disease): world pandemics calibrated to history; disease audit`.

### Task 5: Predators hunt at home first, then range; hunger fix

**Files:**
- Modify: `src/ecology/ecology.ts` (`pickTarget`; monthly feeding)
- Test: `tests/ecology/predation.test.ts` (extend)

**Steps:**
- [ ] **Step 1: Write failing tests:**
  - (a) prey 8 tiles away in habitat and prey 6 tiles away outside habitat → the target is the habitat prey;
  - (b) no habitat prey within 12, prey at 20 tiles in hostile land → the target is that prey;
  - (c) no prey within 24 → the target is a habitat tile (score > 0);
  - (d) a fed predator (`hunger 0`) standing in habitat < 0.2 → the next target has habitat ≥ 0.2;
  - (e) a month with prey in reach but `fed < 0.5` → `hunger` increments; with `fed ≥ 0.5` → resets to 0.
- [ ] **Step 2: Run** `npx vitest run tests/ecology/predation.test.ts`. Expected: (b), (d) and (e) FAIL.
- [ ] **Step 3: Implement.** In `pickTarget`, step 1 is the existing filter at 12 tiles; step 2 searches `herdsNear(..., 24)` with only the realm and edible filters. A "head home" branch applies when `h.hunger === 0 && habitat(here) < 0.2`. Feeding sets `h.hunger = fed >= 0.5 ? 0 : h.hunger + 1`.
- [ ] **Step 4: Run** the ecology tests and the full suite, then `npx tsx scripts/life-audit.ts 3 100 96`. Compare predator cases with today's 0/9 home persistence and record the result. Herbivore and human verdicts must not regress.
- [ ] **Step 5: Commit** `fix(ecology): predators range for prey only when home has none, then return; hunger resets only after a real meal`.

### Task 6: Hover hand on tool switch; checkpoint filenames

**Files:**
- Modify: `src/ui/game/Game.tsx` (`pickTool`)
- Modify: `scripts/lib/checkpoint.ts` (`checkpointPath`)
- Modify: `scripts/pace-calibrate.ts`, `scripts/events-audit.ts`, `scripts/modernization.ts`, `scripts/disease-audit.ts`
- Test: `tests/scripts/checkpoint.test.ts` (extend); e2e

**Interfaces (produces):** `export function checkpointPath(dir: string, kind: string, parts: (string | number)[]): string`, which returns `${dir}/${kind}-${parts.join('-')}.bin`. Every script passes its seed, size, options and years with a `y` suffix (e.g. `1600y`).

**Steps:**
- [ ] **Step 1: Write failing tests:**
  - `checkpointPath('/d','pace',['pace-a','slow','1600y']) === '/d/pace-pace-a-slow-1600y.bin'`;
  - a checkpoint saved by a 200-year run is not loaded by a 300-year run of the same script (different path);
  - e2e: with a placing tool hovered, switching to Inspect by keyboard hides the hand (`data-hand` reads off).
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** `pickTool` sets `r.hand.visible = isPlacingPower(id) && r.hand.visible`. The keyboard and dock paths both call `pickTool`. The scripts use `checkpointPath`.
- [ ] **Step 4: Run** the unit tests and `npm run e2e`. Expected: pass.
- [ ] **Step 5: Commit** `fix: hover hand follows keyboard tool switches; checkpoint names include the run length`.

### Task 7: Realistic disaster and disease visuals

**Files:**
- Modify: `src/rendering/art/effects.ts` (new and redrawn sprites)
- Modify: `src/sim/conceptFx.ts` (mappings)
- Modify: `src/rendering/renderer.ts` (persistent sick-town marker; aurora)
- Modify: `tests/sim/conceptFx.test.ts`, `tests/rendering/*.test.ts`, `tests/e2e/run-e2e.mjs`
- Create: `tools/fx-capture.mjs` (2× captures of every disaster and disease effect, for review)

**Design** (frontend-design and interaction-design skills; existing palette and pixel scale; every effect has a Reduce-motion still):
- **storm:** a rain squall (dark cloud, slanted rain, lightning flicker). Keep `tornado` for tornado events only. Add a `hurricane` look (spiral cloud) when the storm is coastal and large.
- **volcano:** an eruption (ash column rising, lava glow at the vent, falling ash) → dark smoke. Not the generic explosion.
- **epidemic:** a sickness pall (pale green-grey haze, a small cross or figure-in-bed marker) over the town. No skulls for natural disease; keep skulls for fictional horrors.
- **pandemic:** the epidemic pall on each affected town, plus a one-time world flash in the event colour.
- **Sick-town marker:** while `infectedShare(s) > 0.01`, a small persistent marker (pulsing slowly; still under Reduce motion) on the settlement.
- **geomagnetic storm:** an aurora band across the top of the map for its duration (still under Reduce motion).
- **airburst:** a bright fireball and a shock ring, then smoke. Distinct from a ground impact.
- **flood, tsunami, drought, blizzard, wildfire, earthquake:** capture and review. Redraw any that reads as wrong at 2×, noting why in the ledger.

**Steps:**
- [ ] **Step 1: Capture today's look.** Run `node tools/fx-capture.mjs` (new, modelled on `tools/hand-capture.mjs`). Inspect each 2× PNG and write a one-line verdict per effect in the ledger.
- [ ] **Step 2: Write failing tests:**
  - `conceptFx` maps `storm` → the squall sprite, `volcano` → the eruption sprite, `epidemic` and `pandemic` → the pall (not `skull`), `geomagnetic_storm` → aurora, airburst `impact` → fireball;
  - every new sprite exists and is used;
  - a settlement with `infectedShare > 0.01` gets a marker; at 0 it gets none;
  - Reduce motion: each new effect returns its still frame.
- [ ] **Step 3: Run** `npx vitest run tests/sim/conceptFx.test.ts tests/rendering`. Expected: FAIL.
- [ ] **Step 4: Draw the sprites and implement the mappings and markers.**
- [ ] **Step 5: Re-capture at 2×** and inspect every effect, by eye at 10× for the sprites. Fix anything off-theme or unrealistic, and record the verdicts.
- [ ] **Step 6: Extend e2e:** an epidemic shows the pall and the town marker, then ends; an eruption animates (motion sampled 5×); under Reduce motion both are still.
- [ ] **Step 7: Run** the unit tests, e2e and a11y in both browsers. Expected: pass.
- [ ] **Step 8: Commit** `feat(fx): realistic storms, eruptions, sickness and auroras; sick towns are marked`.

### Task 8: Tuning (cause first, then the smallest fix)

**Files:** decided by each investigation (systematic-debugging).
**Tests:** one failing test per root cause before its fix.

Each item records its measured cause, fix, test and before/after numbers in the ledger:
- [ ] **8a. Realistic village 5/6:** in mode-audit world 0 the placed band died. Load that world (`scripts/mode-audit.ts realistic 6`), trace the band's food, deaths and site, and find the cause.
- [ ] **8b. Fantasy "a monster slain by a settlement" 2/6 within 200 years:** count monster–settlement encounters and fight outcomes; find why kills are rare.
- [ ] **8c. Coal-first 1/3:** measure whether coal deposits affect when a nation reaches the industrial era.
- [ ] **8d. Space Race at era 10:** do station and colony happen within the horizon? Adjust the horizon or the cause.
- [ ] **8e. Long Standoff organization 1/3.**
- [ ] **8f. Developed starts advance:** God mode and Realistic at eras 4, 7 and 10 each gain an era within 150 years (Standard pace) or 300 years (Slow pace). If not, find where research stalls.
- [ ] **Re-run:** `npx tsx scripts/mode-audit.ts all 6` after the fixes; save it to `docs/data/round10/mode-audit-3.txt`.
- [ ] **Commit per fix:** `fix(<area>): <cause> (<promise> was x/n, now y/n)`.

### Task 9: Audits and long runs

**Files:**
- Modify: `scripts/events-audit.ts` (modes: `empty` = Realistic from nothing with one band placed; `era10` = Realistic started at era 10)
- Data: `docs/data/round10/`

**Steps:**
- [ ] **Step 1: Write a failing test** in `tests/modes/realEvents.test.ts`: `events-audit` in `empty` mode builds a world with `startEra 1`, no civs except the placed band, and no settlements at year 0.
- [ ] **Step 2: Implement the modes.** Run, with checkpoints:
  - (a) `empty`: 6 worlds × 1,000 years;
  - (b) `era10`: 6 worlds × 300 years.
  Save the output and record fiction (must be none), natural disasters, epidemics, pandemics, AI and nuclear events.
- [ ] **Step 3: Re-run, with checkpoints:**
  - the life audit;
  - the pace calibration (5 seeds; targets as before);
  - the balance runs: 4 × 1,000 years, compared with the round-10 final runs using `tools/balance-compare.mjs`;
  - multi-seed: 20 × 600.
  Explain any shift beyond ±15% or report it as not causally traced.
- [ ] **Step 4: Commit the data** with a summary.

### Task 10: Gameplay validation, theme review, docs, gate, standing to-dos

**Steps:**
- [ ] **Step 1: Play-through.** With Playwright, play each start (Realistic, God mode, Observer) at era 1, and God mode and Realistic at era 10 through the dialog, at 2× on phone and desktop:
  - place life and watch 200 years;
  - check the HUD, feed, era, effects and sick-town markers.
  Review the captures with the design-critique skill (theme fit, pixel scale, palette, realism of disaster and disease visuals). Fix findings with tests.
- [ ] **Step 2: Code review** (code-review skill, medium) of the whole branch diff since 3d64458. Fix important findings with failing tests first.
- [ ] **Step 3: Docs.** Use only measured numbers. Update:
  - VALIDATION (§R10 second addendum);
  - STATUS (close issues 9–11 or restate them);
  - MODEL (disease, pandemic, predators, starts);
  - METHODS (disease audit, events modes);
  - ARCHITECTURE (start contract, era cap, pandemic hook);
  - DESIGN-REVIEW (effects, starts);
  - README (three starts, era setting, disease);
  - GUIDE (`node tools/guide-facts.mjs`);
  - PARAMETERS;
  - SECURITY (new inputs: none expected; record that);
  - CLAUDE.md;
  - the ledger.
- [ ] **Step 4: Gate.** Run `npx tsc --noEmit -p .`, `npx vitest run`, `npm run build`, e2e and a11y in Chromium and WebKit, and `node tools/viewports.mjs`. Record the counts.
- [ ] **Step 5: Standing to-dos.**
  - Audit the GitHub Actions runs (`ci.yml`, `long-run.yml`, `pages.yml`) and fix failures.
  - Run `npm outdated` and `npm audit`. Upgrade, including vitest 5.1.2 if it has been out a few days, and GitHub Actions versions.
  - Re-run the gate; update SECURITY and STATUS.
  - Verify the live site's bundle against a local build.
- [ ] **Step 6: Commit, push and report to the owner:** the calls made, findings and open questions.
