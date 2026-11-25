# Design: three starts, realistic disease, ranging predators, tuning and fixes (round 10, second addendum)

Date: 2026-11-25. Owner decisions are quoted or marked **(owner)**; everything else is marked **(my call)**.

## 1. Intent

The owner read the first addendum's report: developed modern starts stall, there are no pandemics in modern worlds, and hand-placed predators die out. They asked for five things:
- no world starts in the Digital era or later;
- Realistic worlds begin like WorldBox, with no technology and nothing built;
- diseases at realistic rates;
- predators that hunt where they must;
- tuning of the weak promises, plus fixes for the three small issues.

Why: the game should be honest. Realistic is a sandbox that starts from nothing and behaves like the real world, the menu should be simple, and every reported problem should get fixed rather than recorded.

## 2. Goals

1. **Three main starts (owner):** Realistic, God mode and Observer, as the New World screen's main choice.
2. **Start era as a setting (owner).** "Further in the seed settings, you can decide if you want to change times."
   - Any of the three starts can begin in any era from Prehistoric to Atomic & Space (era 10).
   - Nothing starts at era 11 (Digital) or later **(owner: "Cap below Digital")**.
   - The default is Prehistoric. Starting after Prehistoric asks "Are you sure?" first **(owner)**.
3. **Fold the other presets into settings (owner).**
   - Age of Kingdoms, Industrializing World and Modern Geopolitics become stops on the era setting.
   - After the Collapse becomes a toggle.
   - Alien Planet becomes a toggle, available in God mode only, because it is fiction.
   - Complete Randomization becomes a "Randomize settings" button.
4. **Scenarios** stay on their own screen, all capped below Digital: Space Race moves from era 13 to era 10.
5. **Realistic disease (owner picked approach B).**
   - Modern medicine cuts deaths far more than it cuts spread.
   - A rare world-wide pandemic draw, with heavy-tailed severity calibrated to history.
   - Outbreaks that matter in a modern world (around 0.1% dead) are logged and shown.
6. **Ranging predators (owner picked approach A).**
   - A pack hunts prey in its home habitat first.
   - Only if none can be found does it leave home to hunt, then head back.
7. **Tuning (owner: "Tune what is needed"):**
   - Fantasy "a monster is slain" (2/6);
   - coal-rich nations industrialise first (1/3);
   - the Realistic placed band settles a village (5/6; one band died out);
   - promises affected by the era cap (Space Race colony, Long Standoff organization);
   - developed starts actually advancing.
8. **Fixes (owner):**
   - the predator hunger counter;
   - the hover hand lingering after a keyboard tool switch;
   - checkpoint filenames without the run length.
9. **Audits:** the events audit grows Realistic worlds from nothing, plus a Realistic start at era 10 for modern events. A disease audit compares rates with history.
10. **Memory and docs (owner: "caching all memory"):** CLAUDE.md, the ledger, and the docs that need updating (STATUS, VALIDATION, MODEL, METHODS, ARCHITECTURE, PARAMETERS, README, GUIDE, SECURITY if relevant).

## 3. Non-goals and anti-goals

**Non-goals:**
- New pathogen types or named real diseases (approach C was not chosen).
- A den or home-range state for predators (approach B was not chosen).
- Changing Slow-pace targets.

**Anti-goals** (failure even if it "works"):
- A Realistic world that starts with anything built or invented without the player choosing a later era and confirming it.
- Any start at era 11 or later, including through Random, old saves' New World defaults, scripts or scenarios.
- Pandemics so frequent or deadly that histories collapse, or so rare that a modern world never sees one in a few centuries.
- Predators that strip prey herds or roam permanently in hostile land.
- Losing the ability to make the old preset worlds: each must still be reachable through settings.

## 4. Constraints

- **Determinism:** same seed and settings give the same world. New RNG draws are fine in any mode, but Standard-pace histories will change because of the disease and predator changes, and that must be measured and documented (balance comparison against round 10).
- **Saves:** the save format stays compatible. Removing presets changes no stored field. `settings.startEra` above 10 in an old save still loads, since it is history; only new worlds are capped.
- **Docs must be honest:** rates are checked against cited sources and stated as stylized where they are.
- **Parameters:** every new BALANCE coefficient gets an evidence class; regenerate `docs/PARAMETERS.md`.
- **Test gate:** tsc, all unit tests, build, e2e and a11y in Chromium and WebKit, viewports.

## 5. Approaches (chosen with the owner)

**Disease:**
- A, retune numbers only: rejected. Modern medicine would still erase outbreaks.
- **B, medicine lowers deaths more than spread, plus a world pandemic draw: chosen (owner).**
- C, per-era disease libraries: rejected as too large.

**Predators:**
- **A, two-step search: chosen (owner).**
- B, den or home range: rejected (more saved state).

**Start screen:** one sensible way, from the owner's answers: three starts, a folded era setting, toggles, and a confirmation.

## 6. Design

### 6.1 Starts and the New World screen
- **The main choice is three cards: Realistic, God mode, Observer.**
  - God mode is today's "Primitive Earth": full powers and 5 starting peoples. Rename it **(my call)**.
  - Keep the `primitive` key internally for scripts and tests, or alias it **(builder)**.
- **"Start in era"** replaces "Starting era" in Life & history: a slider of era names from 1 (Prehistoric) to 10 (Atomic & Space).
  - Moving it also sets "Starting peoples" to that era's default **(my call, matches the old presets)**: Prehistoric keeps the start's own count (Realistic 0, God mode 5, Observer 5); eras 2–6 → 8; eras 7–9 → 8; era 10 → 10. The player can still change it.
  - A Realistic world started after Prehistoric starts with nations (count above 0) **(my call: a later era means history already happened)**, still under the real-world lock.
- **Toggles:**
  - "Start after a collapse": sets `scenario = 'collapse'`; if the era is Prehistoric it moves to Bronze (era 3), as the old preset did **(my call)**.
  - "Alien planet": God mode only; disabled with the existing real-world footnote in Realistic and Observer.
- **"Randomize settings" button:** runs `randomizeConfig`, whose era roll is capped at 10. It keeps the chosen start's power set **(my call)**.
- **Confirmation:** "Create world" with era above 1 opens a modal dialog (focus trapped, Escape cancels) before starting **(owner: "Are you sure")**. The ux-copy skill drafts the text; sketch: *"Start in the Atomic & Space era? Nations, cities and technology will already exist. [Start in Atomic & Space] [Cancel]"*.
  - Scenarios start at their designed era without the dialog, since the era is part of the scenario. The dialog only appears if the player moved the era away from the scenario's own value **(my call)**.
- **Scenario screen:** unchanged layout. Space Race era 13 → 10; its objectives (station, colony) are re-measured and its horizon adjusted if needed. Long Standoff stays at era 10.
- **Hard cap:** a single constant `MAX_START_ERA = 10`, enforced in config normalization (`createWorld` clamps `settings.startEra` for new worlds), the UI slider, `randomizeConfig` and scenarios. A test fails if any preset, scenario or random roll exceeds it.
- **Code:** PRESETS becomes the three starts. The folded variants live as data (era defaults and toggles) so `scripts/mode-audit.ts` can still build "Age of Kingdoms" (God mode, era 4, 8 peoples), "Industrializing" (era 7, 8 peoples, resources 1.1), "Modern" (era 10, 10 peoples), "Collapse" and "Alien" worlds **(builder decides the shape)**.

### 6.2 Disease (approach B)

**Local spread.** In `population/disease.ts`, medicine (`caps.diseaseControl`, `healthcare`) changes from "cuts transmission by up to 60% plus quarantine" to:
- it cuts transmission by at most about 25–35%, rising with healthcare;
- it still cuts lethality strongly (about 85%).

A novel pathogen in a modern city can then still reach an effective reproduction number above 1, as COVID-19 and 2009 H1N1 did. Immunity after an outbreak stays.

**World pandemic draw (new).**
- Once a year, a pandemic emerges somewhere with probability `p(era, connectivity)`.
- Severity is drawn heavy-tailed: most are mild, some severe. The pathogen gets an r0 and lethality from that draw and seeds the largest or best-connected settlement; spread then happens through the existing links, migrants and armies.
- The calibration target (to verify in research notes) is the 20th–21st century: about 4–5 notable pandemics per 100 years (1918, 1957, 1968, 2009, 2020), with a 1918-scale event at roughly 0.3–1.9% a year (Marani et al. 2021). Pre-modern rates are lower and scale with connectivity, as with the plague pandemics of 541 and 1347.
- New BALANCE parameters carry [E] where sourced and [S] where stylized.

**Logging.**
- An epidemic event is logged when deaths exceed `max(20, 0.5% of the town)` (was 3%) **(my call)**.
- A world pandemic gets one summary event naming the pathogen, the deaths and the share of the world.

**Endings.** Pandemic pressure feeds the existing endings. Check that `pandemic` endings do not become common, and record the count.

**Audit.** `scripts/disease-audit.ts` (new, checkpointed) counts, per era band and per world-century: outbreaks, logged epidemics, pandemics, deaths as a share of the population, and the largest event. It compares these with research notes §4 (new).

### 6.3 Predators (approach A)
- **Search order** in `pickTarget`:
  1. edible prey of the predator's realm within 12 tiles, standing in habitat ≥ 0.2 (as today);
  2. if none, the same prey within 24 tiles anywhere it can stand (land or water by realm). The pack heads there.
- **Going home.** After a successful hunt, when the pack stands in habitat below 0.2, its next target is the best habitat tile within 12 tiles. The existing 4%-a-month loss in hostile land stays, so excursions cost something.
- **Hunger fix.** `hunger` resets only when the month's feeding was adequate (`fed ≥ 0.5`); otherwise it increments. Today it resets whenever any prey is in reach, even if the catch is near zero.
- **Measure** with the life audit's predator cases (0/9 persisting today) and the predation tests. A herd must never be stripped: the predation caps stay.

### 6.4 Tuning (investigate first, then fix)

Each item begins with a measurement of the cause (systematic-debugging), then the smallest fix, then re-measurement:
- **Realistic village 5/6:** in world 0 the placed band died out. Find why: drop site, starvation, or disease.
- **Fantasy "a monster slain by a settlement" 2/6 in 200 years:** find why settlements rarely kill monsters (fight odds, encounters, garrisons).
- **Coal-rich nations industrialise first, 1/3:** find whether coal matters to the industrial transition.
- **Space Race at era 10:** do the station and colony goals still happen within the scenario's horizon?
- **Long Standoff organization 1/3.**
- **Developed starts advance:** worlds starting at eras 4, 7 and 10 must move forward. If research stalls, as in the old era-11 starts, find out why.

### 6.5 Small fixes
- **Hover hand:** cleared or updated when the tool changes by keyboard, menu or any path, not only on pointer move.
- **Checkpoint filenames:** include the run length and every option that changes the run, e.g. `pace-<seed>-slow-1600y.bin`, `events-<seed>-96-era1-1000y.bin`, `modern-<seed>-128-1000y.bin`. A shorter or longer run then never resumes the wrong file.

### 6.6 Audits and verification
- **Events audit:**
  - (a) 6 empty Realistic worlds, a band placed in each, about 1,000 years (checkpointed): natural events, pre-modern epidemics, no fiction;
  - (b) 6 Realistic worlds started at era 10, 300 years: modern events, AI, nuclear, pandemics.
- **Re-run:** the mode audit (all modes), the life audit, the pace calibration (disease and predators touch Slow worlds), the balance comparison (4 × 1,000 years against round 10) and multi-seed invariants.
- **Full gate:** tsc, unit tests, build, e2e and a11y in Chromium and WebKit, viewports. The e2e covers the three cards, the era slider capped at Atomic & Space, the confirmation dialog appearing and cancelling, and toggles disabled in Realistic.
- **Standing to-dos last:** GitHub Actions audit, then the packages audit (vitest 5.1.2 once it is a few days old).

## 7. What is left to the builder
- How PRESETS and variants are structured in code; the exact modal component.
- Exact parameter values, set by the calibration runs against the research targets.
- Test file layout.

## 8. Calls I made (for the owner to check)
1. God mode is today's Primitive Earth, renamed.
2. Era defaults for starting peoples: 8 / 8 / 10, as the old presets had.
3. Realistic after Prehistoric starts with nations.
4. Collapse moves Prehistoric to Bronze.
5. Alien planet is God mode only.
6. Scenarios start at their designed era without the dialog.
7. Epidemic logging threshold of 0.5%.
8. A predator's search widens from 12 to 24 tiles before it leaves home.
9. Randomize keeps the chosen start's power set.
10. A Realistic world started in a later era keeps Slow pace and the real-world lock (the start's own rules do not change with the era).
11. "Start after a collapse" is allowed in all three starts: ruins of a fallen society are realistic.
12. The pandemic draw's "connectivity" is measured from the world itself (for example, the share of settlements linked by trade routes); the exact measure is the builder's, documented in MODEL.
