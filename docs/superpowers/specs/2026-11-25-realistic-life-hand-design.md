# Round 10 addendum: a real-world-only Realistic mode, living placement, and the placing hand (2026-11-25)

Extends [2026-11-20-round10-design.md](2026-11-20-round10-design.md). Owner decisions are marked **(owner)**; the builder's calls are marked **(call)**.

## Intent

Realistic should feel like starting WorldBox on a real Earth:
- The world begins empty at year 0.
- You drop real people and real animals onto it by hand.
- Everything after that happens on its own, at natural rates.
- Nothing that could not exist in the real world ever appears: no monsters, mutants, ghosts, zombies or fantasy peoples. Real future technology is welcome: AI, futuristic weapons and warfare, holograms.

## Goals

1. **Real world only (owner).** Realistic and Observer worlds can never contain:
   - fantasy peoples or creatures (monsters, giants, spirits, dragons and the like);
   - god-only horrors (zombies, ghouls, the Blight);
   - alien biomes or wildlife;
   - exotic matter.

   This is enforced in the simulation at world creation and when a save loads, not only in the interface. On the New World screen, the Fantasy toggle is disabled for these modes, with a one-line reason.
2. **All science-based technology in Realistic (owner).** Realistic uses the "Science fiction" technology setting with speculative technology allowed, so the whole tree, era 15 included, can be researched. Two science-based risks become possible as a result, both at their existing rates: runaway nanotechnology ("grey goo") and an AI takeover. None of the tree is supernatural.
3. **You place only humans and animals (owner).** The Realistic power set holds `spawn_human` and the nine real animals (deer, wolves, bison, wild horses, wild sheep, bears, mammoths, fish, hares). Land shaping, natural disasters and every other power are god mode only.
4. **Natural rates (owner).** Disasters and catastrophes happen on their own:
   - rare catastrophes at their documented real-world orders of magnitude (`world/catastrophes.ts`);
   - ordinary earthquakes, floods, storms and wildfires at the existing stylized rate.

   Long runs measure the realised rates, and the docs report them honestly, with the classes [E] and [S].
5. **Placed life reproduces where it could really live (owner).**
   - **Humans:** a placed band pairs men and women and has children in most land biomes. It struggles or dies out only where foraging cannot feed it: ice, high mountains, deep desert.
   - **Animals:** a herd grows in its home biomes and climate. It grows slower, or declines, outside them.

   A new audit script measures both, and failures are root-caused and fixed.
6. **The placing hand (owner: drawn on the map).**
   1. A tap with Humans or an animal tool shows a pixel hand descending to the tile (about 0.5 s).
   2. The hand opens. The placed species' own sprites fall about 12 px and land with a dust puff.
   3. The hand lifts away.

   On desktop, an open hand hovers under the pointer while a placing tool is selected. The hand appears in every mode, including god mode's fantasy peoples **(call)**. Under Reduce motion it shows one still frame: the open hand over the landed sprites, for 0.6 s.
7. **Verified.** Unit tests, e2e in both browsers, a11y, viewports and the design capture, plus an animation check that the hand's frames really advance.

## Non-goals

- Observer's technology ceiling stays Grounded **(call)**: the round-to-round balance runs use Observer, and changing it would break those comparisons.
- No change to god mode's powers apart from the hand.
- No new species. Mammoths stay: they are real animals, now extinct.

## Anti-goals (failure even if it works)

- A Realistic world in which any fictional creature, biome or deposit appears, by any path: a preset switch, a hand-edited save, an old save, or a scenario.
- The hand changes history. It must be visual only: kept in `sim.fx`, with no RNG draws and never saved.
- The hand hides the result. The sprites must visibly land and stay, as real bands and herds, after the effect ends.
- A band or herd placed in a good habitat dies out for an artificial reason.

## Approaches considered (hand)

| Approach | Trade-off | Decision |
|---|---|---|
| **A. Drawn on the map** through the existing effects pipeline (`sim/conceptFx.ts`, `renderer.drawFx`), with a hand sprite in `art/effects.ts` | Zooms and pans with the world; works on phones; reuses the sprite atlas and Reduce motion. Needs a small custom draw step for the falling sprites | **Chosen (owner)** |
| B. A DOM or CSS overlay above the canvas | Easy to animate, but drifts off the tile while panning or zooming, and cannot draw atlas sprites at map scale | Rejected |
| C. A custom mouse cursor only | Cheapest, but no drop animation, and nothing on touch screens | Rejected |

## Design

**Lock (sim).**
- New helper: `realWorld(settings) = powerSetOf(s) !== 'all'`.
- `normalizeReal(cfg)` runs in `createSimulation` and in the save loader. When `realWorld` holds, it forces off: `settings.fantasy`, `settings.alien`, `gen.fantasy`, `gen.alien`, `laws.fantasyCreatures` and `laws.horrors`.
- Defence in depth: the monster spawner, the horror spawner and exotic-deposit generation also check the helper.
- **Test:** for every preset and scenario combined with Realistic or Observer, and for a forged save with fantasy on, the result contains zero fantasy or alien species, zero horrors, zero EXOTIC deposits and no alien terrain.

**Tech (config).** The Realistic preset sets `realism: 'unrestricted'` and `laws.speculativeTech: true`. **Test:** every tech, era-15 ones included, is permitted in a Realistic world.

**Powers.**
- The `grounded` tag stays on only `spawn_human` and the `animal_*` powers. Biome, deposit and disaster powers and `GROUNDED_LITERALS` lose it.
- The dock in Realistic shows only Life (Humans and animals); the realism note is updated.
- **Tests:** `powerSets.test.ts` is updated, and every other power is refused.

**Hand (visual).**
- An effect `fx.hand` with a payload naming the sprite to drop (`unit.citizen.*` for people, `ani.<key>` for animals).
- In `drawFx`, the hand has three phases:
  - descend: 0–40%;
  - open, with the sprites falling: 40–70%;
  - lift: 70–100%, with `fx.dust` on landing.
- `FX_BY_POWER` maps `spawn_*` and `animal_*` to it, replacing the banner and the sparkle.
- The desktop hover hand is drawn by the renderer at the pointer's tile when the selected tool is a placing tool and the pointer is a mouse (`pointerType === 'mouse'`).
- **Tests:**
  - unit: the effect is registered, payloads exist in the atlas, no RNG draws, the history digest is unchanged;
  - e2e: `data-fx` shows `fx.hand` after a placement, `fxMotion` frames advance, and under Reduce motion one still frame.

**Life audit.** New `scripts/life-audit.ts`:
- 24 humans in each land biome;
- each animal in a home biome and in a hostile one;
- 100 years each, 3 seeds.

It reports growth, decline or extinction. Expectations are written down before the run. Results go to `docs/data/round10/life-audit.txt`, with tests for the fixed cases.

**Rates.** A 1,000-year Realistic run with people placed counts disasters by kind and catastrophes. VALIDATION reports the realised and the documented rates.

## Builder check (read as the implementer; settled as calls)

- **Combinations through the interface:** presets and scenarios start from `defaultConfig`, so picking a fantasy scenario after Realistic resets the power set to 'all'. Only forged or old saves can combine them, and the loader's `normalizeReal` covers those **(call)**.
- **The Future technology control in Realistic:** it stays editable, so a player can still lower it to Grounded or Plausible. The preset only sets the default **(call)**.
- **`spawn_army`** keeps its banner. The hand is for placing life only: `spawn_*` peoples and `animal_*` **(call)**.
- **'unrestricted' realism** is read only by `technology/research.ts` (checked), so the change touches technology alone.

## Left to the builder

- Exact hand pixel art (palette keys from `art/palette.ts`).
- Phase timings within the stated ranges.
- Which hostile biome each animal is tested in.
- How each audit failure is fixed (root cause first).
