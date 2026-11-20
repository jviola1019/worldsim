# Round 10 design: Realistic sandbox, slow pace, honest nation count, medium-themed feed, accessibility

Status: **draft for approval** · 2026-11-20 · branch `claude/epoch-civilizations-unbound-dap8pc`

## Why

The player wants Realistic mode to feel like WorldBox played straight. You start with an empty Earth-like world at year 0. You place real people and real animals, and you watch them take generations to settle, then centuries to build cities. Today Realistic is a hands-off observer mode that starts with 5 bands, which settle within a few years.

The news feed should feel like part of the world: the whole panel looks like a cave wall, clay, papyrus or newsprint, not a small brown box inside a navy panel. Everything must scroll properly and meet accessibility standards (ADA, WCAG 2.2 AA), and this must be checked.

The top-left nation count must be right.

## Goals

1. **Nation count is honest everywhere.** Today year 0 of a primitive world shows "5 nations" when there are only 5 wandering bands, and a single nation reads "1 people".
2. **Realistic = a grounded sandbox.** It starts with an empty Earth-like world: year 0, land, plants and wild animals, no people. The god powers are grounded only: place humans, place real animals, shape the land, and real natural disasters.
3. **Observer stays available** as its own preset, with exactly today's Realistic behaviour.
4. **A "Pace" setting.** At **Slow** (Realistic's default), placed humans take about **100 years** to found a village and about **1,000 years** to grow a city of 10,000.
5. **The feed panel takes on its era's medium**: header, filters, tabs and posts. Posts scroll as one list.
6. **Phones:** the nation inspector's tabs fit on one row you can swipe sideways, and Favourite moves to a star in the header, so the Feed tab gets the space.
7. **Accessibility is audited and tested:** automated axe-core checks in the browser tests, plus checks of keyboard use, focus, scrolling and reflow, in Chromium and WebKit, at phone and desktop sizes.

## Non-goals

- The real Earth map (continents as on Earth). It was offered and not chosen.
- Historical figures, such as placing "Napoleon". "Real-life people" is read as **humans**, as opposed to the game's fantasy peoples. *(my call)*
- Changing Standard pace. Every other preset keeps today's speed, so balance results stay comparable.

## Anti-goals

These would make the round a failure even if everything technically works:
- Realistic quietly allows fantasy, sci-fi or "hand of god" politics (wars, coups, tech grants).
- Old saves change behaviour. An old Realistic (observer) save must stay an observer world.
- A themed medium that fails contrast, or a nested scroll box that traps touch scrolling.
- Claiming "ADA certified". Automated plus manual checks reduce risk; they do not certify. The docs will say so.

## Constraints

- **Determinism:** pace and the power set are saved settings that the simulation reads. The same seed and settings give the same history.
- **Saves:** new settings are optional with defaults (`pace` missing means standard; `powerSet` missing is derived from `observer`). Old saves load unchanged.
- **CSP:** the build allows `'self'` only. The accessibility tool runs in the e2e browser context, never in the shipped game.
- **Existing floors:** 12-px text minimum, 44-px touch targets, and Reduce motion.

## Approaches (chosen with the user)

| Part | Chosen | Alternative not taken |
|---|---|---|
| Realistic powers | Tag each power as **grounded** or not. A world's `powerSet` (`all` / `grounded` / `none`) filters the dock and is enforced when a power is applied. | A list of allowed power ids for Realistic only. It is quicker, but it falls out of step as powers are added. |
| Slow development | A **Pace** setting (`standard` / `slow`) that slows settling, research and city growth. Calibrated to the "Much slower" targets. | Reusing the tech-speed slider. It does not slow settling or building, so villages would still appear in year 1. |
| Feed look | The **whole panel becomes the medium**; one scroll container. | Theming the posts only. |
| Accessibility | **axe-core** (a new dev-only dependency) inside the e2e, plus manual checks. | Hand-written checks only. |

## Design

### 1. Nation count

- One shared helper, `countPeoples(w)`, returns `{ nations, tribes, people }`:
  - a **nation** is a living civ with at least one settlement;
  - a **tribe** is a living civ with only wandering bands;
  - **people** counts settlements and bands.
- **World card** (top left), each part shown only when non-zero and in the singular when it is 1:
  - `Stone Age · 120 people · 3 tribes`
  - `Medieval · 1.2M people · 9 nations · 1 tribe`
  - `No people yet`
- **On phones** the card wraps cleanly. It must not overlap the speed controls at 320 px.
- **Nations list:** the same counts head the list, and tribes are labelled "tribe (no settlements yet)".
- **Statistics:** the world tab shows Nations and Tribes from the helper. The yearly `civs` history series keeps its meaning (all living civs) but is relabelled **"Peoples (nations and tribes)"**, so balance tools and old saves still agree.
- **Verified:** unit tests on the helper (year 0 of a primitive world is 0 nations and 5 tribes; one nation is singular), plus e2e on the HUD text.

### 2. Presets and powers

- **`WorldSettings.powerSet`:** `'all' | 'grounded' | 'none'`. A missing value means `observer ? 'none' : 'all'` (old saves keep working). `observer` stays as written by old saves; new code reads `powerSet` through one function, `powerSetOf(settings)`.
- **`PowerDef.grounded`:** true for these powers.

  | Group | Grounded powers |
  |---|---|
  | Terrain | raise, lower, mountain, ocean, shallow, river, fertility up and down, remove resources; biome brushes for real biomes only (not Alien meadow, Blight or Crystal fields) |
  | Nature | trees, clear, rain, **every real animal** |
  | People | **Humans** only (not Sylvans, Delvers or Grakk) |
  | Disasters | lightning, fire, meteor, earthquake, eruption, flood, storm, drought, plague, tsunami, blizzard |
  | Rare natural catastrophes | asteroid, supervolcano, solar superflare, gamma-ray burst, solar storm (`emp`) |

  **Not grounded:** monsters and horrors; anything acting on nations (found village, grow, independence, allegiance, raze, religion, tech, diplomacy, war, armies); nuclear and lab-made threats, rogue AI, first contact; climate dials; laws.
- **Enforcement:** the Dock lists only allowed powers. The power dispatcher also **refuses** a disallowed power (defence in depth, tested), and the inspector's god controls (trait editor, missions) follow `powerSet === 'all'`.
- **Presets:**
  - **Realistic (sandbox):** the default Earth-like map, `startCivs = 0`, wildlife on, `startEra 1`, `powerSet 'grounded'`, `pace 'slow'`, fantasy, alien, speculative tech and horrors off, real disasters and diseases on. The description says you place the first humans.
  - **Observer:** exactly the old Realistic preset (5 bands, no powers, standard pace).
- **Preset keys:** the key `realistic` now names the sandbox, and the old behaviour moves to the new key `observer`. Every script, test and workflow that used `realistic` to mean the observer world switches to `observer`. This covers `scripts/modernization.ts` (the `realistic-1` balance world), the long-run workflow and the preset tests, so the round-to-round balance comparison stays like for like. *(builder check)*
- **Badge:** the old observer badge text stays for `none`. For `grounded` the dock shows a small "Realistic: real people, animals, land and disasters only" note. A first-visit hint points at the Humans tool.

### 3. Pace

- **`WorldSettings.pace`:** `'standard' | 'slow'`, shown on the New World screen as a two-option segmented control ("Standard" / "Slow: generations to settle, centuries to build cities").
- **Levers under `slow`**, each a `BALANCE` constant, so the values can be calibrated:
  - **Settling:** the band settle probability is multiplied by `slowSettleMult` (first guess 0.04).
  - **Research:** points are multiplied by `slowResearchMult` (first guess 0.45).
  - **City growth:** migration and attraction into settlements are multiplied by `slowGrowthMult`, and construction progress by `slowBuildMult`.
- **Calibration targets,** from a placed band of 24 humans next to fresh water on a 128² world, over 5 seeds:

  | Milestone | Baseline today (3 seeds) | Slow target |
  |---|---|---|
  | First village | 1–13 years | median ~100 years, every seed within 40–250 |
  | First town (2,000 people) | 233–616 years | — |
  | First city (10,000 people) | 304–678 years | median ~1,000 years, every seed within 600–1,600 |

  The bands must survive: no seed dies out before 300 years.
- **Pace never changes Standard runs:** the balance outputs for the existing presets must be byte-identical to round 9 on the four modernization worlds.
- **Tests:** a calibration test on 2 fixed seeds (bounded runtime) checks the windows. A determinism test covers a slow world saved and reloaded.

### 4. Medium-themed feed

- **Tokens:** each medium gets a token set: surface, surface texture, ink, muted ink, accent, line, chip surface and focus ring.

  | Medium | Look |
  |---|---|
  | carving | cave wall: dark rock, ochre pigment, scratched type |
  | tablet | fired clay: terracotta, pressed wedge marks |
  | scroll | papyrus or parchment: warm fibre, ink |
  | broadsheet | rag paper: serif, column rules |
  | newspaper | newsprint: grey-white, masthead, columns |
  | broadcast | TV studio: dark screen, lower-third bars |
  | social | phone app: light card UI |
  | holo | holographic: cyan on near-black |

  Every text-on-surface pair is **≥ 4.5:1** (≥ 3:1 for large text), and every control or focus pair is **≥ 3:1**. A unit test computes these from the token table, so a future tweak cannot regress them silently.
- **World news sheet:** while the feed is open, the sheet's own surface (header, intro, filter chips, frame header, posts and side lists) uses the active medium's tokens. The nation filter changes the medium when that nation's medium differs.
- **Nation inspector, Feed tab:** the tab panel area takes the medium edge to edge. The tab row and sheet header take the medium's colours while Feed is active.
- **One scroll container:** the sheet body. The frame loses `overflow: hidden` and any inner scrolling, and the ticker stays decorative (`aria-hidden`, paused under Reduce motion). "Older posts" stays a real button, and also loads automatically when it scrolls into view.
- **Posts:** each post remains an `<article>` with a heading line (medium, outlet, year) and a "Show on map" button with an accessible name. Replies stay nested. The side lists (trending, people) collapse under the posts on narrow screens.
- **Phones:** inspector tabs become one horizontally scrollable `tablist` with scroll snapping and visible edge fades. Arrow keys move between tabs (ARIA tabs pattern). Favourite and Follow move into the sheet header as icon buttons with labels.

### 5. Accessibility audit

- **Tool:** `axe-core` as a devDependency. It is injected with `page.evaluate` in a separate e2e context created with `bypassCSP: true`, so the shipped CSP is unchanged.
- **Ruleset:** `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`. **Fail** on serious or critical violations; record moderate and minor ones in VALIDATION.
- **Where axe runs:**
  - screens: title, settings, load, new world;
  - the game HUD and the dock in every power set;
  - every sheet: layers, nations, history, feed, stats, laws, menu;
  - inspector tabs: settlement, person and nation (every tab);
  - the feed in at least 4 mediums reached through presets (carving in primitive, scroll or tablet in kingdoms, newspaper or broadcast in industrial or modern, social in modern). All 8 are covered by the unit contrast test.
- **Manual checks,** scripted where possible:
  - everything reachable and usable with the keyboard;
  - focus always visible (2.4.7), and no focus hidden under sticky bars (2.4.11);
  - Escape closes sheets;
  - the feed scrolls with wheel, touch drag (phone emulation) and keyboard (PageDown, Space);
  - reflow at 320 CSS px without horizontal scrolling (1.4.10);
  - text spacing override (1.4.12);
  - target size ≥ 24 px (2.5.8; our floor is 44);
  - Reduce motion honoured.
- **Skills:** the `design-skills:accessibility-audit` and `design-skills:design-critique` skills structure the audit report (findings, severity, fixes) in `docs/DESIGN-REVIEW.md` §R10.
- **Browsers:** Chromium and WebKit, both e2e.
- **Honesty:** the docs state "WCAG 2.2 AA automated and manual checks passed in emulated Chromium and WebKit". They do not say "ADA compliant" or "certified", and they say no screen-reader or physical-device test was done.

## Settled during the builder check

- **Megafauna** (mammoths) count as real animals and are grounded. *(my call)*
- **The pace levers** apply in any era and with any preset the player customises. Only Realistic defaults to Slow. *(my call)*
- **Standard pace stays byte-identical:** every slow multiplier is applied as `pace === 'slow' ? m : 1`, and no new random draws are made on the standard path. *(my call)*
- **The Laws panel** is a god power, so it is hidden under `grounded` and `none`, as it is today for observer. *(my call)*

## Left to the builder

- The exact token colours per medium, within the contrast rules (use `frontend-design` for direction).
- The final values of the four slow multipliers, from calibration.
- The exact wording of hints and badges, within the meanings above.

## Verification (definition of done)

- Gate: tsc, full `npm test`, build, e2e in Chromium and WebKit (the new checks included), viewports, design capture with 0 violations, and axe with 0 serious or critical violations.
- Standard-pace modernization outputs identical to round 9. Slow calibration table recorded in VALIDATION §R10.
- Code review of the whole diff, with findings fixed. Then the docs (VALIDATION, STATUS, GUIDE, README, SECURITY for the new dependency), push, and the standing to-dos: Actions, Pages, live site and packages.
