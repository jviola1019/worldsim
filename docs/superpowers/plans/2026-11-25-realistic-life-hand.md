# Realistic: real world only, living placement, placing hand: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Realistic an empty real Earth that you seed by hand with humans and real animals, and that then runs on its own:
- every technically possible technology and event can occur;
- nothing fictional can ever appear;
- a pixel hand drops the life onto the map.

**Architecture:**
- **Rule layer:** one helper (`realWorld`) and one normaliser (`normalizeReal`) decide what a realistic world may contain. They run at world creation and at load. The spawners check the same helper as a second guard.
- **Powers:** the Realistic power set is reduced to "place life".
- **The hand:** a visual-only effect in the existing concept-effects pipeline (`sim.fx` → `renderer.drawFx`), so history is untouched.
- **Measurement:** new audit scripts produce dated data in `docs/data/round10/`. Long runs checkpoint so container restarts cannot lose them.

**Tech Stack:** TypeScript, Vite, Preact, Canvas2D, Vitest, Playwright (Chromium and WebKit), axe-core.

**Spec:** `docs/superpowers/specs/2026-11-25-realistic-life-hand-design.md`. Owner additions on approval: "realistic mode should include all technically possible scenarios and events"; add more real animals where possible or needed; every aspect backtested and researched; all tests pass; architecture and docs updated; important information cached in the round ledger (`.superpowers/sdd/2026-11-20-round10/progress.md`).

## Global constraints

- **Determinism:** only `sim.rng` affects history. The hand and the hover hand live in `sim.fx` or the renderer: never saved, never digested, no RNG draws.
- **Realistic power set (`'grounded'`):** exactly `spawn_human` plus every `animal_*` power. All other powers return `'Not available in this world'`.
- **Real-world lock:** applies when `powerSetOf(settings) !== 'all'`, which covers Realistic and Observer.
- **Realistic tech:** `settings.realism = 'unrestricted'` and `laws.speculativeTech = true`.
- **Observer tech:** unchanged (`'grounded'`).
- **Docs must be honest:** cite sources for researched values; never invent a run; emulation is not physical-device testing.
- **Every BALANCE coefficient** keeps an `[E]/[S]/[C]/[T]` class. Rerun `node tools/param-registry.mjs` after changing `balance.ts`, and `node tools/guide-facts.mjs` after adding source files.
- **Commits** end with the session's Co-Authored-By and Claude-Session lines. Push only to `claude/epoch-civilizations-unbound-dap8pc`.

## Review focus

1. **An old round-10 Realistic save** (power set `'grounded'`, made when land tools were allowed) loads with land and disaster powers refused and no crash. *Test in Task 3.*
2. **Tapping water with Humans, or dry land with Fish:** the hand still plays, the toast explains the refusal, and no sprite is left behind. *Test in Task 6:* the hand runs only when `applyPower` returns `null`.
3. **Rapid repeated taps:** many hands at once stay capped and never exceed the 400-effect limit. *Test in Task 6:* the `cap` field on the hand spec.
4. **A forged save** with Realistic, fantasy on and monsters present loads with no monsters, horrors or alien herds remaining, and none spawn later. *Test in Task 2.*
5. **Reduce motion:** the hand shows one still frame and nothing moves. *e2e step in Task 6.*

---

### Task 1: Research, and the checkpointing that makes long runs survive restarts

**Files:**
- Create: `docs/data/round10/research-notes.md`
- Create: `scripts/lib/checkpoint.ts`
- Modify: `scripts/pace-calibrate.ts`
- Modify: `scripts/modernization.ts`
- Test: `tests/sim/checkpoint.test.ts`

**Interfaces:**
- **Produces:**
  - `saveCheckpoint(path: string, sim: Simulation, extra: unknown): void` writes `encodeWorld(sim.w)` bytes to `path` and `extra` as JSON to `path + '.json'`.
  - `loadCheckpoint<T>(path: string): { sim: Simulation; extra: T } | null`.
  - Researched reference values that Tasks 4, 5 and 9 cite.

Steps:

- [ ] **Step 1.** Research with WebSearch, and record each value with its source URL and date in `research-notes.md`:
  - intrinsic annual growth rates (r_max) for every species in `ecology/species.ts` plus the candidate additions (elephant, water buffalo, llama, seal);
  - long-run and boom growth rates of forager populations;
  - real frequencies of regional earthquakes, eruptions, floods and storms, to set against our stylized rate;
  - the catastrophe rates already in `world/catastrophes.ts`.
- [ ] **Step 2.** Write the failing test `checkpoint resumes the identical history`:
  - arm A: run world `ck-1` (64², default preset) for 30 years and take its digest;
  - arm B: run 15 years, `saveCheckpoint`, `loadCheckpoint`, run 15 more;
  - assert the two digests are equal (use the digest helper the determinism tests use).
- [ ] **Step 3.** Run `npx vitest run tests/sim/checkpoint.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 4.** Implement `scripts/lib/checkpoint.ts`: `decodeWorld` restores the world, then `new Simulation(w)`.
- [ ] **Step 5.** Run the test. Expected: PASS.
- [ ] **Step 6.** Add an optional `CHECKPOINT=<dir>` to both scripts:
  - every 100 years they save the sim plus their accumulators;
  - on start they resume when a checkpoint exists;
  - output lines are appended, not rewritten.
- [ ] **Step 7.** Commit: `feat(scripts): resumable long runs (checkpoint every 100 years); research notes`.

### Task 2: The real-world lock

**Files:**
- Modify: `src/powers/powerSet.ts` (add `realWorld`, `normalizeReal`)
- Modify: `src/ui/worldFactory.ts`
- Modify: `src/sim/world.ts` (`createWorldState`)
- Modify: `src/persistence/serialize.ts` (end of `decodeWorld`)
- Modify: `src/sim/bootstrap.ts:84`
- Modify: `src/ecology/ecology.ts:461`
- Modify: `src/powers/horrors.ts:156`
- Modify: `src/world/worldgen.ts:850`
- Modify: `src/ui/screens/NewWorldScreen.tsx`
- Test: `tests/powers/realWorld.test.ts`

**Interfaces:**
- **Produces:**
  - `realWorld(s: WorldSettings): boolean`, true when `powerSetOf(s) !== 'all'`.
  - `normalizeReal(cfg: WorldConfig): void` sets these to false: `settings.fantasy`, `settings.alien`, `gen.fantasy`, `gen.alien`, `laws.fantasyCreatures`, `laws.horrors`.
  - `stripFiction(w: WorldState): void` empties `w.monsters` and horror entities, and removes herds whose species has `alien: true`.

Steps:

- [ ] **Step 1.** Write the failing tests:
  - **`no preset or scenario combined with a real-world power set yields fiction`:** for every PRESET and SCENARIO, apply it, set `powerSet` to `'grounded'` and then `'none'`, and `createSimulation` at 64². Assert:
    - `w.monsters.size === 0`;
    - no herd with `SPECIES_BY_KEY[h.species].alien`;
    - no civ whose species is not `'human'`;
    - no tile with deposit `Deposit.EXOTIC`;
    - no terrain in `[T.ALIEN, T.ALIEN_GRASS, T.CORRUPT, T.CRYSTAL]`;
    - after 50 years still no monsters and no horrors.
  - **`a forged realistic save with fiction loads clean`:** build a fantasy world, set `powerSet = 'grounded'`, `encodeWorld`, then `decodeWorld`. Assert the laws are off, the monsters gone and the alien herds gone.
  - **`normalizeReal is idempotent and leaves god mode alone`.**
- [ ] **Step 2.** Run the tests. Expected: FAIL.
- [ ] **Step 3.** Implement the helpers.
  - Call `normalizeReal` in `worldFactory` before generation and in `createWorldState`.
  - Call `stripFiction` and force the laws off in `decodeWorld` when `realWorld`.
  - Add the `!realWorld(...)` guard at the four spawn and generation sites.
- [ ] **Step 4.** On the New World screen, when `realWorld(cfg.settings)`, give the Fantasy checkbox `disabled` plus `aria-describedby`, pointing to the footnote "Realistic and Observer worlds contain only what could exist in the real world."
- [ ] **Step 5.** Run the new tests, then the full `npm test`. Expected: PASS.
- [ ] **Step 6.** Commit: `feat(realistic): nothing fictional in Realistic or Observer worlds, enforced at creation and load`.

### Task 3: Realistic technology and the "place life only" power set

**Files:**
- Modify: `src/config/laws.ts` (Realistic preset)
- Modify: `src/powers/powers.ts`: drop the `grounded` tag from the biome, deposit and disaster factories; delete `GROUNDED_LITERALS`; keep it on `people('human')` and `animal()`
- Modify: `src/ui/game/Dock.tsx`: the realism note says "Realistic: place people and animals; nature does the rest."
- Test: `tests/powers/powerSets.test.ts`, `tests/config/presets.test.ts`

**Interfaces:**
- **Consumes:** `realWorld` from Task 2.
- **Produces:** `GROUNDED_IDS = POWERS.filter(p => p.grounded).map(p => p.id)`, equal to `['spawn_human', ...ANIMAL_POWER_IDS]`.

Steps:

- [ ] **Step 1.** Update the failing tests:
  - `grounded power set is exactly humans and animals` lists the ids;
  - `raise`, `dis_fire`, `asteroid` and `biome_grass` are refused with `'Not available in this world'`;
  - `Realistic preset enables every science-based technology`: for every TECH, the permission helper in `research.ts:166` returns true;
  - an old save with power set `'grounded'` still loads, and `raise` is refused.
- [ ] **Step 2.** Run the tests. Expected: FAIL.
- [ ] **Step 3.** Implement it. Export the permission check in `research.ts` as `techPermitted(sim, t)` if it isn't exported already.
- [ ] **Step 4.** Run them. Expected: PASS. Then run `npm test`.
- [ ] **Step 5.** Commit: `feat(realistic): full science-based technology; you place only people and animals`.

### Task 4: More real animals

**Files:**
- Modify: `src/ecology/species.ts`
- Modify: `src/rendering/art/animals.ts`
- Modify: `src/powers/powers.ts:401-403` (animal list)
- Modify: `src/sim/conceptFx.ts` (`ANIMALS`)
- Test: `tests/ecology/species.test.ts` (create)

**Interfaces:**
- **Consumes:** the research values from Task 1.
- **Produces:** placement powers `animal_<key>` for every non-alien, non-monster species. The icon is `ico.animal_<key>` when the atlas has it, otherwise the species sprite `ani.<key>`.

Steps:

- [ ] **Step 1.** Write the failing tests:
  - every non-alien species has a placement power;
  - each power's icon and sprite exist in the atlas;
  - new species exist with sprites: `elephant` (savanna, jungle, grass), `buffalo` (water buffalo: swamp, grass, jungle), `llama` (mountain, hills, steppe; domesticable), `seal` (aquatic: shallow, ocean, cold temperatures);
  - each species' `growth` is within the research-notes range, or the test carries a commented justification.
- [ ] **Step 2.** Run the tests. Expected: FAIL.
- [ ] **Step 3.** Implement the species:
  - draw the four sprites in the existing `walk()` style and palette;
  - set the `growth` and `start` values from the research;
  - the elephant is marked megafauna only if research says so (it isn't: elephants live today), so it appears in all eras;
  - add the powers and the effect map entries.
- [ ] **Step 4.** Run the tests, then `npm test`. Expected: PASS. Any change in starting wildlife changes world histories; record that in the ledger for Task 9.
- [ ] **Step 5.** Commit: `feat(ecology): elephants, water buffalo, llamas, seals; every real species can be placed by hand`.

### Task 5: Life audit (placed life reproduces where it could live)

**Files:**
- Create: `scripts/life-audit.ts`
- Create: `docs/data/round10/life-audit.txt` (output)
- Test: `tests/ecology/placedLife.test.ts`

**Interfaces:**
- **Consumes:** the species from Task 4; `spawnBand` and `spawnHerd`.
- **Produces:** a table per biome or species of `start → year 25 / 50 / 100` and the verdict `grows | holds | declines | dies`.

Steps:

- [ ] **Step 1.** Write the expectations in the script header before running:
  - humans grow in grass, steppe, savanna, forest, taiga, jungle, swamp, hills and beach, and decline or die on snow, glacier, mountain and deep desert;
  - every animal grows in its first home biome and declines in a named hostile biome (e.g. the camel on snow, the penguin in jungle).
- [ ] **Step 2.** Run `npx tsx scripts/life-audit.ts 3 100 > docs/data/round10/life-audit.txt` (3 seeds, 100 years, an empty 96² Realistic world, the land around the drop painted to the target biome).
- [ ] **Step 3.** For each mismatch, use systematic-debugging: instrument, find the cause, fix it, record it in the ledger.
- [ ] **Step 4.** Write the tests for the fixed and core cases:
  - `a band placed on grassland grows within 50 years`;
  - `a band placed on glacier does not grow`;
  - `deer grow in forest and decline on desert`;
  - `fish placed on land are refused` (`spawnHerd` returns null, or the power returns a message).
- [ ] **Step 5.** Run `npm test`. Expected: PASS.
- [ ] **Step 6.** Commit: `test(life): placed humans and animals reproduce where they could live (life audit)`.

### Task 6: The placing hand

**Files:**
- Modify: `src/rendering/art/effects.ts` (`E['fx.hand']`: 3 frames, closed / open / open-tilted, about 14×14, using the existing palette keys for skin and outline)
- Modify: `src/sim/conceptFx.ts` (`spawn_*` and `animal_*` map to `fx('hand', 1.1, { cap: 3 })`)
- Modify: `src/powers/powers.ts` (`powerFx` passes the dropped sprite as the effect's `sprite`)
- Modify: `src/sim/context.ts` (`VisualFx.sprite?: string`)
- Modify: `src/rendering/renderer.ts` (`drawFx`: the hand branch; the hover hand)
- Modify: `src/ui/game/Game.tsx` (`onHover`: set `r.hand` when the tool is a placing tool and the pointer is a mouse)
- Test: `tests/rendering/hand.test.ts`, `tests/e2e/run-e2e.mjs`

**Interfaces:**
- **Produces:**
  - `VisualFx.sprite?: string`;
  - renderer field `hand: { x: number; y: number; visible: boolean } | null`;
  - `isPlacingPower(id: string): boolean` in `powers.ts`, true for the `spawn_` and `animal_` prefixes.

Steps:

- [ ] **Step 1.** Write the failing unit tests:
  - `every placing power shows the hand` (`FX_BY_POWER` kind `'fx.hand'`);
  - `the hand carries the placed sprite` (`ani.deer` for `animal_deer`; a `unit.*` id for `spawn_human`);
  - `a refused placement shows no hand`;
  - `placing with and without effects leaves the same history digest`;
  - `the hand sprite has 3 frames in the atlas`.
- [ ] **Step 2.** Run the tests. Expected: FAIL.
- [ ] **Step 3.** Implement the hand.
  - **Phases by progress `p`:**
    - `p < 0.4`: the closed hand descends from 24 px above the tile;
    - `0.4 ≤ p < 0.7`: the hand opens and 3 copies of the sprite fall 12 px, with `fx.dust` added at `p = 0.7`;
    - `p ≥ 0.7`: the open hand rises and fades.
  - **Reduce motion:** draw only the open hand with the landed sprites.
  - **Hover hand:** the open frame at 70% opacity, drawn at the pointer's tile.
  - Set `data-fx` and `fxMotion` as other effects do.
- [ ] **Step 4.** Run the tests. Expected: PASS.
- [ ] **Step 5.** e2e (Chromium and WebKit):
  - in Realistic, select Humans and tap land: `data-fx` contains `fx.hand`, two `fxMotion` samples differ, and later a band exists (HUD tribes 1);
  - with `reducedMotion: 'reduce'`, the hand appears and the samples are equal.
- [ ] **Step 6.** Visual check at deviceScaleFactor 2: capture the descend, open and landed frames to `tools/output/hand-*.png` and inspect them. Add a DESIGN-REVIEW note.
- [ ] **Step 7.** Commit: `feat(hand): a pixel hand drops placed people and animals onto the map`.

### Task 7: Every technically possible event can happen in Realistic

**Files:**
- Create: `scripts/events-audit.ts`
- Create: `docs/data/round10/events-audit.txt`
- Test: `tests/modes/realEvents.test.ts`

**Interfaces:**
- **Consumes:** `ENDINGS` (`realistic` flag); `CATASTROPHE_RATES`; `risksYearly`.
- **Produces:** for every `realistic: true` ending and catastrophe:
  - the code path that triggers it naturally;
  - its gate;
  - whether the gate is open in a Realistic world.

Steps:

- [ ] **Step 1.** Write the failing test `no realistic ending is gated off in a Realistic world`. For each `realistic: true` ending, assert that its natural trigger's gates are satisfied by a Realistic config:
  - `laws.disasters`, `laws.diseases`, `laws.advancedWeapons` and `laws.speculativeTech` are true;
  - realism is `'unrestricted'`.

  Also: `fictional endings never fire in Realistic` (monsters, zombies, ghouls, blight; 200 years, era-11 Realistic-rules start).
- [ ] **Step 2.** Run it. Expected: FAIL until Task 3 is in. If it already passes, record that.
- [ ] **Step 3.** Write the backtest `scripts/events-audit.ts`: 6 worlds with Realistic rules (power set grounded, lock on) starting in era 11 with 6 nations, 300 years each. It counts every event type, catastrophe and ending, and compares the disaster counts per world-year with Task 1's research.
- [ ] **Step 4.** Run it with `CHECKPOINT` on, then save the output.
- [ ] **Step 5.** Commit: `test(realistic): every technically possible event is reachable; fictional ones never fire`.

### Task 8: Mode audit, pace table and the Realistic promises

**Files:**
- Modify: `scripts/mode-audit.ts` (Realistic promises)
- Modify: `tests/modes/promises.test.ts`
- Modify: `tests/e2e/run-e2e.mjs` (the Realistic flow: the dock shows only Life, the Fantasy checkbox is disabled)

Steps:

- [ ] **Step 1.** Change the Realistic promises:
  - empty at year 0;
  - you place only humans and animals;
  - no fiction after 300 years;
  - full technology permitted;
  - a placed band settles a village in 42–250 years.

  Update the start-of-world promises test to match.
- [ ] **Step 2.** Run the mode audit for `realistic` and `observer` (3 worlds each) with `CHECKPOINT`, and the pace calibration for seeds a, d and e to 1,600 years with `CHECKPOINT`.
- [ ] **Step 3.** Update the e2e checks, then run both browsers and a11y.
- [ ] **Step 4.** Commit: `test(modes): Realistic promises (life only, real world only); pace table complete`.

### Task 9: Backtest the whole round

Steps:

- [ ] **Step 1.** With `CHECKPOINT`, run `modernization.ts` for modern-1..3 and realistic-1 at 1,000 years and 128², plus `multi-seed.ts 20 600 96`, writing to `docs/data/round10/final2-*`.
- [ ] **Step 2.** Run `node tools/balance-compare.mjs docs/data/round10 final- docs/data/round10 final2-` and compare with round 9. Apply the owner's ±15% decision rule (METHODS §2.2) and explain any larger shift from the run's own records.
- [ ] **Step 3.** Run the full gate: `npm run typecheck`, `npm test`, `npm run build`, e2e (Chromium and WebKit), `npm run a11y` (both browsers), `node tools/viewports.mjs`, `node tools/design-capture.mjs`.
- [ ] **Step 4.** Run a whole-branch review with the code-review skill. Fix the important findings with tests.
- [ ] **Step 5.** Commit the data and fixes.

### Task 10: Documentation, architecture and standing to-dos

**Files:** `docs/ARCHITECTURE.md` (the lock layer, the hand in the effects pipeline, checkpointing), `docs/MODEL.md` (sourced species parameters, realistic events), `docs/METHODS.md` (life audit, events audit, checkpoint resumes), `docs/PARAMETERS.md` (regenerated), `docs/VALIDATION.md` §R10 addendum (pace table, life, events, rates, balance, GitHub Actions and the live site), `docs/STATUS.md`, `docs/DESIGN-REVIEW.md` §R10 (the hand), `README.md` (Realistic description), `docs/GUIDE.md` and `tools/guide-facts.mjs`, `CLAUDE.md` (plan link), the ledger.

Steps:

- [ ] **Step 1.** Update every file listed with measured results only.
- [ ] **Step 2.** Run `node tools/param-registry.mjs` and `node tools/guide-facts.mjs`, then `npm test`. Expected: PASS.
- [ ] **Step 3.** Run the standing to-dos:
  - check CI (ci, long-run and pages) for the final commit;
  - verify the Pages deploy and the live bundle hash;
  - run `npm outdated` and `npm audit`, and upgrade anything stale;
  - rerun the gate if anything changed;
  - record it all in VALIDATION, SECURITY and STATUS.
- [ ] **Step 4.** Commit, push, and report to the owner with the list of calls made.
