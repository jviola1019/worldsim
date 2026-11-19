# Animations for every concept, reduce motion everywhere, render-cache freshness: design

Status: draft for owner approval · 2026-11-19 · branch `claude/epoch-civilizations-unbound-dap8pc`

## 1. Intent

The owner asked for three things:

1. Verify the animations for every task and concept in the game.
2. Run the final audit.
3. "Recall cache for concepts". The owner clarified this means two things: verify that render caches refresh whenever a concept changes the world, and refresh the builder's knowledge of every game concept before auditing.

**Owner decisions (2026-11-19).**
- **Add the missing animations.** Every god power and every major world event gets a visible effect, and the unused effect sprites are wired in where they fit.
- **Verify** map effects per concept, ambient map animation, interface motion, and Reduce motion everywhere.

## 2. What exists today (recon)

- **108 god powers** in 9 groups:

  | Group | Powers |
  |---|---|
  | Terrain (brushes) | 37 |
  | Nature | 13 |
  | Civilizations | 9 |
  | Religion | 5 |
  | Technology | 5 |
  | Diplomacy | 7 |
  | War | 3 |
  | Disasters (incl. 3 horrors) | 14 |
  | Future | 15 |

- **109 world-event types** are logged through `logEvent` (`history/events.ts`).
- **34 effect sprites** exist in `art/effects.ts`. Only 13 are ever triggered, through `addFx` (`sim/context.ts`: visual only, never saved, capped at 400). The other 21 never play, including emp, meteor, heal, coin, skull, radiation, ring, splash, star, steam, wave, dust, banner and foam.
- **`drawFx`** draws each effect as a single sprite. The effect's area (its `data` radius) is ignored. Effects keep playing under Reduce motion, and nuclear and lightning flashes are not toned down.
- **Concepts with no on-map effect today:**
  - asteroid and supervolcano catastrophes, superflare, gamma-ray burst;
  - zombie, ghoul and blight horrors, and engineered or infertility plagues;
  - EMP, AI uprising and AI incidents, grey goo;
  - sports games and championships, treaties and peace, new nations;
  - most terrain, nature, religion, tech and diplomacy powers.
- **Ambient animation:** water, fire, smoke, weather, walkers, traffic, ships, trains, aircraft, rockets, armies (marching, battle, siege), herds, bands, monsters and close-up street life. Reduce motion (round 6) stops walkers and road traffic, and steps the rest once a second.
- **Render caches:**
  - map chunks are invalidated through `markTile`, which sets `sim.chunkDirty`;
  - the close-up blocks follow the same flags, plus a yearly signature check;
  - the overview image redraws when any chunk is dirty;
  - tinted sprites are cached per colour;
  - photos are drawn when opened.

  Whether every concept that changes a drawn map field also calls `markTile` has never been tested.

## 3. Goals, non-goals, anti-goals

**Goals**

1. Every god power gives visible feedback where it is used, and every major world event that has a place shows an effect there. Coverage is enforced by a test, so a new power or event cannot ship without a decision.
2. Area effects show their size, for example a ring for the radius of a quake, flood or nuclear blast. Multi-stage concepts play in sequence: a meteor falls, then explodes, then smoke rises.
3. Reduce motion is respected everywhere:
   - effects are shown as a still marker for their duration, with no flashes or shaking;
   - global flashes (superflare, gamma-ray burst) are off;
   - ambient animation follows the round-6 rules.
4. Animations are verified:
   - every effect plays, moves, and ends;
   - ambient animation moves (and stops or steps under Reduce motion);
   - interface motion uses the tokens and is off under Reduce motion.
5. Render caches are verified: every concept that changes a drawn map field invalidates the cached drawing of that place. A test runs every god power and a long simulation, then compares map snapshots against the dirty flags.

**Non-goals**

- No sound design. The existing sounds are unchanged.
- No new simulation behaviour. Effects never change history.
- No particle engine. Effects stay sprite-based.

**Anti-goals** (failure even if it technically works)

- Effect spam: hundreds of overlapping effects during a big war, or one per construction project.
- Flashing that ignores Reduce motion (photosensitivity).
- Effects that touch the simulation's random number generator or saved state.
- A stale map after a concept changes it.

## 4. Approach

**Chosen: a central concept-to-effect registry.**
- `src/rendering/conceptFx.ts` holds two tables:
  - `FX_BY_POWER[powerId]`;
  - `FX_BY_EVENT[eventType]`.
- **Spec shape.** Each value is either an `FxSpec` or `null`. A `null` entry must carry a reason, for example "too frequent: construction" or "no place: an election".
- **Hooks.** Two central hooks fire them. `applyPower` uses the power's tap or stroke point. `logEvent` uses the event's `x`, `y`; an event without a place gets no map effect.
- **Coverage test.** It checks that every power id and every event type that the source can emit is in a table.

**Rejected:**
- **Adding `addFx` calls inside each system.** Calls would be scattered, gaps would go unnoticed, and coverage can't be tested.
- **Interface toasts instead of map effects.** They don't show where things happen, which is the point.

## 5. Design

### 5.1 Effect specs

```ts
interface FxSpec {
  kind: string;           // fx sprite id
  dur: number;            // seconds
  area?: boolean;         // draw a ring sized to the power or event radius
  then?: FxSpec;          // played when this one ends (meteor → explosion → smoke)
  minImportance?: number; // events only: skip below this importance (default 2)
  flash?: 'white' | 'red' | 'green'; // a brief screen tint (off under Reduce motion)
  radius?: number;        // events: fixed ring radius in tiles (the event format has no radius)
}
```

### 5.2 Mapping principles

Exact entries are left to the builder. They follow these principles:

| Concept group | Effect |
|---|---|
| Terrain brushes | dust puff at the stroke, at most every 0.3 s per stroke (`fx.dust`) |
| Biomes and resources | sparkle or star |
| Trees, animals | sparkle |
| Monster | smoke, then skull |
| Spawn people, found city, new nation | banner / sparkle |
| Grow | heal |
| Transfer | ring |
| Destroy city | explosion, then smoke |
| Religion found or spread, sacred site | star / ring |
| Culture | ring |
| Tolerance | heal |
| Tech grant, inspire, diffuse | book / star |
| Forget | smoke |
| Anomaly | anomaly |
| Peace, alliance, harmony, bless | ring / heal / banner |
| Discord, rebellion, coup | clash / fire |
| War, spawn army, inspire troops | banner, clash |
| Disasters | lightning, fire, meteor → explosion → smoke, quake (area), explosion → smoke (volcano), flood or wave (area), tornado, dust (drought), plague, wave (tsunami), snow (blizzard) |
| Horrors | skull and plague / smoke |
| Nuke | nuke (area, white flash) → radiation |
| Asteroid | meteor → explosion (area) → smoke |
| Supervolcano | explosion (area) → smoke |
| Superflare, gamma burst | star / ring (global flash) |
| Nuclear war | several nukes |
| Engineered and infertility plague | plague → skull / plague |
| AI uprising, AI awaken | emp / anomaly |
| Grey goo | anomaly (area) |
| EMP | emp (area) |
| Alien | ufo → beam |
| Climate warm / cool | steam / snow |
| **Events with a place, importance ≥ 2** | battle → clash; siege → smoke; bombing → explosion; nuclear strike → nuke; orbital strike → beam; EMP strike → emp; chemical attack → plague; epidemic → plague; famine → skull; impact → meteor → explosion; horror spread → skull; zombie cure → heal; settlement founded → banner; settlement lost → smoke; nation founded → banner; nation fell → skull; revolution or uprising → fire; peace or treaty → ring; world games or championship → fireworks (new `fx.firework`); league founded → coin; trade route → coin; religion founded → star; first-of-its-kind tech → book; AI incident → anomaly; space launch → steam |
| **Explicitly none** (with reason in the table) | construction, notable deaths, elections, debt and financial crises without a place, outlet churn, and other frequent or placeless events |

### 5.3 Drawing (`renderer.drawFx`)

- **Area ring.** When `area` is set and the effect has a radius, an expanding ring of that radius is drawn (2-px stroke, fading).
- **Sequences.** When an effect with `then` ends, its follow-up is queued at the same place.
- **Throttle.** At most 3 identical effects within a 2-tile radius are visible at a time; extras are dropped, so a war cannot flood the screen.
- **Flashes.** A full-screen tint at 0.25 opacity, fading over 400 ms, no more than once per 2 s.
- **Reduce motion.**
  - An effect shows its first frame as a still marker for its duration, with a static ring instead of an expanding one.
  - No flash and no screen shake.
  - The sequence collapses to its final still image.
- **Test hook.** `canvas.dataset.fx` lists the kinds currently drawn, the same pattern as `data-city-chunks`.
- **Effects stay visual.** They live in `sim.fx`, which is never saved or digested and never touches `sim.rng`.

### 5.4 New art

| Sprite | Size and frames |
|---|---|
| `fx.firework` | 4 frames, 12×12 |

All other effects reuse the 34 existing sprites. The sprite tests cover the new one.

### 5.5 One source per effect (builder's calls after the builder check)

1. **The registry is the only source of effects.** The roughly 22 existing inline `addFx` calls in `powers.ts`, `war.ts`, `nuclear.ts`, `risks.ts`, `horrors.ts`, `ecology.ts` and `environment.ts` move into the tables, so one tap never shows two or three overlapping effects. A static test checks that no `addFx` call remains outside the hooks.
2. **Power or event: which one draws.**
   - Powers that act on a place the player tapped (brushes, disasters, nukes, spawns) draw through the power hook, at the tap point.
   - Powers that act on the nearest settlement or a nation log a `god_*` event with that settlement's position. Those draw through the event hook, at the affected place, and their `FX_BY_POWER` entry is `null` with the reason "drawn by its event at the affected place".
   - All other `god_*` events whose power already draws are `null` with the reason "drawn by the power hook".
3. **Events without a place** (superflare, gamma-ray burst, geomagnetic storm) get only their global flash, off under Reduce motion, and no map marker. The superflare and gamma-burst *powers* are taps, so they also draw at the tap point.
4. **Area rings.**
   - Powers use their own radius (the brush or power radius passed to `applyPower`).
   - Events use a fixed radius from their `FxSpec` (`radius?: number`), so the saved event format is unchanged.
   - Disasters that already pass their real radius through the effect data keep it.

## 6. Verification

1. **Coverage (unit).** Every id in `POWERS` has an entry in `FX_BY_POWER`. Every event type emitted in `src/` (collected by scanning for `type: '…'` in `logEvent` calls, the same set as the recon) has an entry in `FX_BY_EVENT`. Every `null` carries a reason. Every `kind` and `then.kind` is a registered sprite. Each of the 21 previously unused effects is used at least once, or listed as intentionally unused with a reason.
2. **Hooks (unit, node).** Applying each of the 108 powers in a test world adds its spec's effect at that place (brushes: once per throttle window). Logging an event with a place adds its effect. An event below `minImportance`, or without a place, adds none.
3. **Determinism (unit).** A world where every power is applied produces the same digest whether effects are drawn or not.
4. **Render-cache freshness (unit, node). This is "recall cache".**
   - Snapshot every drawn map field: terrain, elevation, river and flow, infrastructure, building, building flags, owner, settlement, vegetation, hazard, pollution.
   - Apply each power, and separately run a 30-year simulation across all eras including war and catastrophes.
   - Every tile whose drawn fields changed must lie in a chunk marked dirty (`sim.chunkDirty`).
   - Any field the renderer deliberately does not cache (fire, animated tiles) is listed with a reason.
   - Close-up blocks: a building change dirties the detail chunks; size-band and ethos changes are caught by the yearly check.
5. **Effects play (e2e, Chromium).** One world per power group; each power is used through the real dock. The check reads `data-fx` to confirm the expected kind appears, samples canvas pixels in the effect's area over 3 frames (they change), and confirms the kind is gone after its duration. Under Reduce motion, the same pixels stay unchanged across frames and no flash occurs.
6. **Ambient animation (e2e).** A water and city region changes between frames. Under Reduce motion it changes at most once per second.
7. **Interface motion (e2e and capture).** Opening a sheet runs the 200 ms entrance (computed animation name and duration). Under Reduce motion the computed animation and transition durations are 0. The design capture shows no motion outside the tokens.
8. **Final audit (CLAUDE.md standing to-dos):**
   - GitHub Actions runs (CI, Pages, long-run);
   - `npm audit`, `npm outdated` and Actions versions;
   - the full gate (tsc, tests, build, e2e, viewports, design capture);
   - VALIDATION, STATUS and SECURITY updated.

## 7. Builder's calls (not discussed with the owner)

- The exact effect for each power and event (within §5.2), effect durations, and the throttle numbers (3 per 2 tiles).
- Brush feedback limited to a dust puff every 0.3 s per stroke (the terrain change itself is the main feedback).
- One new sprite (`fx.firework`); everything else reuses existing sprites.
- Placeless events (elections, crises, outlet churn) get no map effect; the news feed already reports them.
- Flash opacity and frequency (0.25 over 400 ms, at most every 2 s); none under Reduce motion.
- The single-source rules in §5.5, settled after the builder check.

## 8. Left to the builder

Sprite frame timing; the ring style; how the throttle picks which effect to drop; the e2e sampling details.
