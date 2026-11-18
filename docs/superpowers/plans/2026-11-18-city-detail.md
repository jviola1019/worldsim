# City Detail, Planning Rule and Design Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cities read as real places when zoomed in (streets, yards, shops, gyms, cafés, parks, street-scale people). A light planning rule leaves breathing room in the simulation. A full design review fixes the game's spacing, type, contrast, touch targets and motion.

**Architecture:**
- A pure block composer (`cityBlocks.ts`) turns one tile's real data into a 32×32 draw plan.
- A cached close-up layer (`cityLayer.ts`, same chunk and LRU pattern as `TerrainLayer`) draws those plans over the normal map at close zoom, and the aerial photo reuses it.
- The planning rule lives in `urban.ts` placement.
- The design review is a capture tool, a findings document and CSS/component fixes, enforced by an extended viewport check.

**Tech Stack:** TypeScript 7, Vite 8, Preact 11, Canvas2D, Vitest 5, Playwright (preinstalled Chromium).

**Spec:** `docs/superpowers/specs/2026-11-18-city-detail-design.md` (approved). Read it before any task.

## Global Constraints

**Simulation**
- Rendering never touches `sim.rng`. Randomness comes only from `hash3(x, y, salt)`.
- The planning rule is the only simulation change. It adds no persistent state, and saves must round-trip identically.
- Balance tolerance (spec §5.6):
  - 20/20 seeds hold the ledger, finite-value and GDP invariants (`npm run stats -- 20 600 96`).
  - On the four standard 1,000-year runs, milestone years stay within ±15% of VALIDATION §R5.
  - Food shortfall and unemployment get no worse by more than 5 points.
  - If a run falls outside, weaken the rule first: the green-space target, then compactness.

**Rendering**
- Close-up threshold: fades in from tilePx 20 to 26. `camera.maxZoom` becomes 12.
- Block size: 32×32 detail px per tile. Detail chunks: 8×8 tiles, at most 48 cached, at most 2 redrawn per frame.
- Size bands: village < 2,000, town < 20,000, city < 200,000, metropolis above.
- Amenity shares: 5% village, 12% town, 20% city, 30% metropolis.
- Streets by tier: 0–2 a 3-px dirt lane; 3–4 a 4-px cobbled street; 5+ a 6-px paved road with 1-px sidewalks.
- Layout: organic for tiers 0–4, grid from tier 5.
- Nation colour on buildings is an accent only. Borders and overlays keep full colour.

**Design review**
- Touch targets at least 44 CSS px.
- Text at least 12 CSS px.
- WCAG AA contrast on key text (4.5:1 body, 3:1 large).
- `prefers-reduced-motion` is respected, and a "Reduce motion" preference is added.

**Process**
- The CSP stays strict: no inline styles and no eval. A new font must be self-hosted through `@fontsource`, with an OFL licence.
- Commit after each task on `claude/epoch-civilizations-unbound-dap8pc`, ending with the `Co-Authored-By` and `Claude-Session` lines. No model names in the repository.
- Docs must be honest: every figure comes from a recorded run, and emulation is not device testing.
- After any trajectory change, run the full gate: `npm run typecheck && npm test && npm run build`, then `npm run e2e` with a fresh `npx vite preview --port 4173`.

## Review Focus

1. **Tiles on the map edge.** A neighbour out of bounds counts as open land, with no crash and a fence edge. Pinned in Task 1.
2. **Tiles with no owner, or ruins, construction sites and craters inside a settlement.** These get no city detail (normal layer) and never throw. Pinned in Task 1.
3. **Multi-tile buildings.** `BLDF.PART` tiles are not composed separately; the 2×2 building is drawn once from its anchor tile. Pinned in Task 1.
4. **Cache pressure from fast zooming across a big map.** The cache stays at or below 48 chunks, and a tile whose chunk isn't ready shows the normal layer instead of a blank. Pinned in Task 3.
5. **Cities that are already enclosed (preset starts, old saves).** Planning must not stall. Upgrades in place still happen, and the rule only refuses new sites. Pinned in Task 5.

---

### Task 1: Block composer (pure)

**Files:**
- Create: `src/rendering/cityBlocks.ts`
- Test: `tests/rendering/cityBlocks.test.ts`
- Modify: `CLAUDE.md` ("Current plan" line: point at this plan and the spec, alongside `docs/ROADMAP.md`)

**Interfaces:**
- Produces:
  - `type SizeBand = 'village' | 'town' | 'city' | 'metropolis'`
  - `sizeBand(pop: number): SizeBand`
  - `type NeighbourKind = 'built' | 'water' | 'open' | 'farm'`
  - `interface BlockContext { b: number; tier: number; band: SizeBand; ethos?: EthosKey; color?: string; nb: NeighbourKind[] /* 8, E,SE,S,SW,W,NW,N,NE as DX8 */; road: number; h: number }`
  - `type LotKind = 'hut' | 'house' | 'rowhouse' | 'apartment' | 'tower' | 'shop' | 'office' | 'warehouse' | 'civic' | 'industry' | 'park' | AmenityKind`
  - `type AmenityKind = 'firepit' | 'granary' | 'shrine' | 'bakery' | 'tavern' | 'smithy' | 'bathhouse' | 'training' | 'cafe' | 'pharmacy' | 'school' | 'boxinggym' | 'grocery' | 'gym' | 'clinic' | 'cinema' | 'garage' | 'vertfarm' | 'dronepad' | 'wellness'`
  - `interface Lot { x: number; y: number; w: number; h: number; kind: LotKind; sprite: string; yard: 'grass' | 'dirt' | 'paved' | 'garden' }`
  - `interface StreetSeg { x: number; y: number; w: number; h: number; surface: 'dirt' | 'cobble' | 'paved'; sidewalk: boolean }`
  - `interface BlockPlan { ground: string; streets: StreetSeg[]; edges: { side: 0 | 1 | 2 | 3; kind: 'fence' | 'hedge' | 'wall' | 'quay' }[]; lots: Lot[]; trees: { x: number; y: number; size: 0 | 1 | 2 }[] }`
  - `isDetailTile(m: TileMap, i: number): boolean`
  - `blockContext(sim: Sim, i: number): BlockContext | null`
  - `composeBlock(c: BlockContext): BlockPlan`
  - `blockSignature(c: BlockContext): number` (a cheap hash of everything except `h`)
  - `AMENITIES_BY_TIER: readonly AmenityKind[][]` (index = tier band 0..4: tiers 0–2, 3, 4–5, 6, 7)
  - `amenityShare(band: SizeBand): number`
  - `lotSprite(kind: LotKind, tier: number, h: number): string` (returns an id that Task 2 must define)
  - `STREET_COLORS: readonly string[]` (hex colours of the paved, cobbled, dirt and sidewalk surfaces; used by the e2e pixel samplers)

- [ ] **Step 1: Write the failing tests** in `tests/rendering/cityBlocks.test.ts`. Build a `BlockContext` by hand with `ctx(overrides)`.
  - `sizeBand`: `sizeBand(1999)='village'`, `sizeBand(2000)='town'`, `sizeBand(199999)='city'`, `sizeBand(2e5)='metropolis'`.
  - `amenityShare`: village 0.05, town 0.12, city 0.20, metropolis 0.30.
  - Deterministic: `composeBlock(ctx())` deep-equals a second call. Changing only `h` changes lot sprites or positions but not the street layout.
  - Breathing room: for every combination of residential building and tier 0–7, no two lots overlap, and every pair of lots that are not row houses has a gap of at least 1 px. All lots lie inside 0..31 after the streets are subtracted.
  - Streets: with neighbour `nb[0]='built'`, the east edge has a street segment. With `nb[0]='open'`, the east edge has a fence or hedge and no street. With `nb[0]='water'`, it has a quay.
  - Street widths by tier: tier 1 is a 3-px dirt lane without sidewalk; tier 3 is a 4-px cobbled street; tier 6 is a 6-px paved road with a sidewalk.
  - Era gates:
    - no lot sprite id at tier ≤ 4 contains `car` or `garage`;
    - house blocks at tier ≥ 5 never use `hut` lots;
    - every amenity chosen at a tier is in `AMENITIES_BY_TIER` for that tier.
  - Amenity share grows: over 400 hashes of a tier-6 house block, the mean amenity-lot fraction for `metropolis` is greater than for `town`, which is greater than for `village`.
  - Ethos: over 400 hashes, `ethos='mercantile'` yields more `shop`/`grocery`/`cafe` lots than `ethos='egalitarian'`, and `egalitarian` yields more `clinic`/`school`.
  - Layout: at tier 2 at least one lot edge is off the 2-px grid (organic); at tier 6 all lot x and y values are multiples of 2 (grid).
  - Review Focus 1: `blockContext` for a tile on map column 0 returns `nb[4]==='open'` and does not throw.
  - Review Focus 2: `isDetailTile` is false for `B.FARM`, `B.MINE`, `B.RUINS`, `B.CONSTRUCTION`, `B.CRATER`, and for any tile with `settle===0`. `blockContext` returns null for those.
  - Review Focus 3: `isDetailTile` is false for a tile with `bldFlags & BLDF.PART`.
  - `isDetailTile` is true for the categories `residential`, `commerce`, `civic`, and for `industry`/`energy` inside a settlement, and for `B.PARK`.
- [ ] **Step 2: Run** `npx vitest run tests/rendering/cityBlocks.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `src/rendering/cityBlocks.ts`.**
  - Lot subdivision per district comes from the spec §5.2 table.
  - Pick an amenity when `hash3(x, y, 40 + lot) / 2^32 < amenityShare(band) × ethosAmenityBias(ethos, kind)`.
  - Ethos bias: mercantile ×1.6 shop/grocery/cafe; egalitarian ×1.6 clinic/school; militarist ×1.8 training/boxinggym/gym; ecological replaces 1 in 4 lots with a park.
  - The organic jitter is ±1 px, from the hash.
  - `lotSprite` maps kind and tier to `lot.<kind>.<band>.<v>`, where band is `a` (tiers 0–2), `b` (3–4), `c` (5–6) or `d` (7) and `v = h % variants`. Export `LOT_VARIANTS: Record<string, number>` so Task 2 knows which ids to author.
- [ ] **Step 4: Run** the test. Expected: PASS. Then run `npx tsc --noEmit`. Expected: exit 0.
- [ ] **Step 5: Commit** `feat(city): pure block composer for close-up city detail`.

### Task 2: City lot sprites

**Files:**
- Create: `src/rendering/art/city_lots.ts` (export `CITY_LOT_SPRITES: SpriteSheet`)
- Modify: `src/rendering/art/index.ts` (register under `cityLots`)
- Modify: `tools/contact-sheet.ts` (include the new sheet) and regenerate `docs/images/sprites/contact-sheet.png`
- Test: `tests/rendering/sprites.test.ts` (extend)

**Interfaces:**
- Consumes: `lotSprite`, `LOT_VARIANTS`, `LotKind`, `AMENITIES_BY_TIER` (Task 1).
- Produces: every id `lotSprite` can return, plus `lot.tree.0..2`, `lot.fence.h`, `lot.fence.v`, `lot.hedge.h`, `lot.hedge.v`, `lot.pool.0`, `lot.car.h.0..2`, `lot.car.v.0..2`, `lot.bench.0`, `lot.lamp.0`, `lot.fountain.0`.

- [ ] **Step 1: Write failing tests.**
  - `every lot sprite the composer can request exists`: for every `LotKind`, tier 0–7 and `h` in 0..7, `ALL_SPRITES[lotSprite(kind, tier, h)]` is defined.
  - `lot sprites fit their scale`: houses are 8–12 px wide and towers at most 28 px. Every lot sprite is at most 30×30.
  - `lot sprites use team keys only as accents`: in each lot sprite, team-key (T/U/V) pixels are at most 15% of opaque pixels.
  - The existing `validateSheet` and duplicate-id tests cover the new sheet automatically. Confirm they run on it.
- [ ] **Step 2: Run** `npx vitest run tests/rendering/sprites.test.ts`. Expected: FAIL (missing ids).
- [ ] **Step 3: Author the sprites** with `S([...rows])` and the existing palette keys, in the style of `buildings_housing.ts`.
  - Every amenity has a readable sign motif: dumbbell for the gym, cross for the clinic, cup for the café, columns for the classical gymnasium and bathhouse, awnings on shops.
  - Roofs use the material keys. T/U/V appear only on awnings, flags and trim.
- [ ] **Step 4: Run** the sprite tests and `npm run sprites:sheet`. Expected: PASS, and the contact sheet is written. Look at it, then fix any sprite that is unreadable at 1:1.
- [ ] **Step 5: Commit** `feat(art): city lot sprites (houses, shops, gyms, cafés, parks, street props)`.

### Task 3: Close-up city layer in the renderer

**Files:**
- Create: `src/rendering/cityLayer.ts`
- Modify: `src/rendering/renderer.ts` (draw after `drawChunks`; the fade), `src/rendering/camera.ts` (`maxZoom = 12`)
- Test: `tests/rendering/cityLayer.test.ts` (the pure cache logic), `tests/e2e/run-e2e.mjs` (close-up check)

**Interfaces:**
- Consumes: `isDetailTile`, `blockContext`, `composeBlock`, `blockSignature` (Task 1); lot sprites (Task 2); `Atlas`.
- Produces:
  - `export const DETAIL = 4` (detail px per art px)
  - `export const DCHUNK = 8`
  - `export function detailAlpha(tilePx: number): number` (0 below 20, linear to 1 at 26)
  - `export function detailChunksOf(k: number, mapW: number): number[]` (the 4 detail chunks inside map chunk k)
  - `export class DetailCache { constructor(max: number); want(k: number): void; has(k: number): boolean; put(k: number, v: unknown): void; evicted: number[] }` (the LRU, testable without DOM)
  - `export class CityLayer { constructor(sim: Sim, atlas: Atlas); syncDirty(chunkDirty: Uint8Array): void; yearlyCheck(): void; refresh(wanted: number[], budget: number): void; get(k: number): HTMLCanvasElement | null; drawBlock(ctx: CanvasRenderingContext2D, i: number, ox: number, oy: number): void }`

- [ ] **Step 1: Write failing tests** in `tests/rendering/cityLayer.test.ts`:
  - `detailAlpha(19)=0`, `detailAlpha(20)=0`, `detailAlpha(23)=0.5`, `detailAlpha(26)=1`, `detailAlpha(60)=1`.
  - Review Focus 4: after `put` of 100 distinct keys into `new DetailCache(48)`, `has` is true for exactly 48 keys, and they are the 48 most recently put or wanted.
  - Mapping: one map chunk (16 tiles) covers detail chunks 2×2. A dirty map chunk `k` marks exactly those four detail chunks dirty (`detailChunksOf(k, mapW)`, exported).
- [ ] **Step 2: Run** the test. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - A detail chunk canvas is `DCHUNK·TILE·DETAIL` = 256 px square, plus `PAD·DETAIL` overhang.
  - For each detail tile, `drawBlock`:
    1. paint the ground;
    2. paint the streets, with lane marks at tier ≥ 5;
    3. draw the edges;
    4. draw the trees and lots in row order;
    5. draw multi-tile civic buildings once, from the anchor, using the existing building sprite scaled ×`DETAIL` with smoothing off.
  - Non-detail tiles stay transparent.
  - `yearlyCheck` compares stored per-tile signatures and marks changed chunks dirty. The renderer calls it when `sim.year` changes.
  - In `Renderer.render`, when `!far`, draw city chunks after `drawChunks` with `ctx.globalAlpha = detailAlpha(tilePx)` at world size, `drawImage(c, x, y - PAD, DCHUNK*TILE, DCHUNK*TILE + PAD)`.
  - A missing chunk is simply skipped, so the normal layer shows (Review Focus 4).
- [ ] **Step 4: Add an e2e check.** Create a Modern Geopolitics world and run it for 5 s. Open the first nation, choose "Show capital", and zoom with 14 wheel steps.
  - Then `check('<label>: close-up city shows streets', …)`. It samples the canvas at the viewport centre with `getImageData` over a 200×200 region, and passes when at least 3% of the pixels match the street palette (the paved and sidewalk colours exported from `cityBlocks.ts` as `STREET_COLORS`).
- [ ] **Step 5: Run** the unit tests, the build, `npx vite preview --port 4173 &` and `npm run e2e`. Expected: all pass, including the new check. Take a screenshot at maximum zoom into the scratchpad and look at it.
- [ ] **Step 6: Commit** `feat(city): close-up city layer with streets, lots and amenities`.

### Task 4: Street-scale life and zoomed-out map changes

**Files:**
- Modify: `src/rendering/renderer.ts` (`drawAmbient`, `drawTraffic`)
- Modify: `src/rendering/terrainLayer.ts` (street lines, muted tint)
- Modify: `src/rendering/atlas.ts` (`getMuted`)
- Modify: `src/rendering/art/palette.ts` (`mutedTeamShades`)
- Test: `tests/rendering/palette.test.ts` (create), e2e

**Interfaces:**
- Produces:
  - `mutedTeamShades(mainHex: string): { T: string; U: string; V: string }`: T is a 35% team, 65% `#9a8f86` mix; U and V are derived as in `teamShades`.
  - `Atlas.get(id, teamColor, muted?: boolean)`: muted variants are cached under the key `id|color|m`.

- [ ] **Step 1: Write failing tests.**
  - `mutedTeamShades('#c9463d').T` is closer to `#9a8f86` than to `#c9463d` (RGB distance).
  - It is deterministic for the same input.
  - Two different nation colours still give different T values.
- [ ] **Step 2: Run** the test. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Building sprites in `TerrainLayer` use `atlas.get(id, color, true)`. Units, flags and borders keep full colour.
  - Pass 2 draws a 1-px street line in `ROAD_COLORS[max(1, roadTier)]` along shared edges of adjacent built city tiles (both `isDetailTile`).
  - Walkers:
    - at tilePx below 20, draw at half size: `ctx.scale(0.5)` around the anchor;
    - at tilePx 20 and above, draw at `1/DETAIL` size on sidewalk positions taken from the block plan (`plan.streets` with `sidewalk`);
    - the count is unchanged.
  - Road vehicles at tilePx 20 and above are drawn at quarter scale in street lanes.
- [ ] **Step 4: Run** the unit tests and e2e. Expected: PASS. Take screenshots at mid and maximum zoom, and compare them with `city-max.png` from before (scratchpad).
- [ ] **Step 5: Commit** `feat(city): street-scale walkers and traffic, muted nation tint, street lines`.

### Task 5: Planning rule

**Files:**
- Modify: `src/civilizations/urban.ts` (`findSite`, `placementScore`, `planConstruction` park target)
- Modify: `src/config/balance.ts` (`streetAccess: true`, `parkPerResidential: 8`, `parkMinPop: 2000`, `urbanAdjBonus: 1.0`, `enclosedPenalty: 2.0`)
- Test: `tests/civilizations/planning.test.ts` (create)

**Interfaces:**
- Produces:
  - `export function isOpenTile(m: TileMap, j: number): boolean` (in bounds and one of: unbuilt land, water, `B.PARK`, or a `food`-category building; out of bounds counts as open)
  - `export function keepsAccess(sim: Sim, i: number): boolean` (true when, with *i* treated as built, *i* and each built 4-neighbour of *i* still have at least one open 4-neighbour)

- [ ] **Step 1: Write failing tests.**
  - `isOpenTile`: true for an unbuilt grass tile, a lake, a park and a farm; false for a house, a factory or a wall.
  - Placement probe: run `makeSim('plan-1', 96, c => c.settings.startEra = 6)` for 60 years and wrap `placeBuilding` with a spy. For every non-food placement on a new site, `keepsAccess` was true just before it.
  - Parks: in the same world, every settlement with more than 2,000 people and at least 8 residential districts has at least one `B.PARK`.
  - Counterfactual: clone the same early world twice, with `BALANCE.streetAccess` true and false. After 150 years, the share of open tiles inside settlements with more than 5,000 people is higher with the rule.
  - Review Focus 5: build a settlement whose own tiles are all built (set the tiles directly). After 5 years, `planConstruction` has still started at least one upgrade in place, and no exception was thrown.
- [ ] **Step 2: Run** `npx vitest run tests/civilizations/planning.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - In `findSite`, skip a candidate when `BALANCE.streetAccess && def.category !== 'food' && !keepsAccess(sim, i)`.
  - In the 'urban' score, use `adj × urbanAdjBonus − (adj === 4 ? enclosedPenalty : 0)`.
  - In `planConstruction`, when the population is above `parkMinPop` and `s.bld[B.PARK] < residential / parkPerResidential`, raise the park weight to 2.0.
  - Upgrades and redevelopment on the building's own tile are untouched.
- [ ] **Step 4: Run** the planning tests (expected: PASS), then the full suite `npm test`.
  - Rebuild any trajectory-sensitive test that now fails as a probe-based counterfactual, with the same method and no weakened assertion, and record each one in the commit message.
- [ ] **Step 5: Check the balance tolerance.**
  - Run the four standard runs, in the background, writing to `docs/data/round6/`:
    - `npx tsx scripts/modernization.ts modern-1 1000 128`
    - `npx tsx scripts/modernization.ts modern-2 1000 128`
    - `npx tsx scripts/modernization.ts modern-3 1000 128`
    - `npx tsx scripts/modernization.ts realistic-1 1000 128 realistic`
  - Run `npm run stats -- 20 600 96`.
  - Compare against the Global Constraints tolerance. If a run falls outside, weaken the rule as described there and re-run.
- [ ] **Step 6: Commit** `feat(planning): street-access rule, parks for large cities, compactness` with the measured comparison in the body.

### Task 6: Photos use the city drawing

**Files:**
- Modify: `src/rendering/photos.ts` (`drawAerial`, `drawPostcard`)
- Test: `tests/history/album.test.ts` (format unchanged), e2e

**Interfaces:**
- Consumes: `CityLayer.drawBlock` (Task 3).

- [ ] **Step 1: Write a failing e2e check.** In the nation overview, the aerial canvas has at least 2% street-palette pixels (same sampler and `STREET_COLORS` as Task 3).
- [ ] **Step 2: Run** e2e. Expected: the new check FAILS.
- [ ] **Step 3: Implement.**
  - `drawAerial` renders the window at block resolution: tiles × 32, capped at 1024 px on the long side, with the photo window shrunk around the centre if needed.
  - It draws the normal layer scaled ×4 with smoothing off, then `drawBlock` for each detail tile, then the existing era grading.
  - `drawPostcard` inserts a 2-px street gap between adjacent columns whose records come from different blocks. It draws columns recorded as parks as trees.
  - The snapshot format is unchanged.
- [ ] **Step 4: Run** the album tests and e2e. Expected: PASS. Look at the aerial and postcard screenshots.
- [ ] **Step 5: Commit** `feat(photos): aerial and postcard use the close-up city drawing`.

### Task 7: Design review, part 1: capture and findings

**Files:**
- Create: `tools/design-capture.mjs` (captures every screen in the spec §5.8 list at iPhone SE, iPhone 13, iPhone 13 landscape, iPad and 1280×800, into `docs/images/design-review/before/`)
- Create: `docs/DESIGN-REVIEW.md`

- [ ] **Step 1: Run the capture tool** against the preview build. Expected: one PNG for each screen and device, and the script prints the count.
- [ ] **Step 2: Review the captures** with the `design-skills:design-critique`, `design-skills:accessibility-audit` and `design-skills:interaction-design` skills. Use the UI Design Review and Axe plugins too if the owner installed them; check with `ListPlugins`.
  - In `docs/DESIGN-REVIEW.md`, record each finding as: ID, screen and device, screenshot, issue, severity (high/medium/low), proposed fix, identity change yes/no.
  - Also measure with scripts: computed font sizes, touch-target sizes, contrast of text against its background, and the durations of CSS transitions and animations.
- [ ] **Step 3: Commit** `docs: design review findings with captures`.

### Task 8: Design review, part 2: fixes and a design system

**Files:**
- Modify: `src/ui/styles.css` (tokens: a spacing scale `--s1..--s8` on a 4-px base; a type scale `--t-xs 12px … --t-xl`; motion `--dur-fast 120ms`, `--dur-sheet 200ms`, `--ease-out`; colour tokens checked for AA)
- Modify: components named in the findings
- Modify: `src/ui/screens/SettingsScreen.tsx` (a `reduceMotion: boolean` preference, default from `matchMedia('(prefers-reduced-motion: reduce)')`, applied as a `reduce-motion` class on the root)
- Modify: `src/rendering/renderer.ts` (when `reduceMotion` is set, animated tiles and weather advance at most once per second; walkers and traffic freeze)
- Add, if the findings call for a readable body font (identity change): `@fontsource/atkinson-hyperlegible` (OFL) for body text, with Pixelify Sans kept for display and headings
- Test: `tests/security/hardening.test.ts` (`sanitizePrefs` accepts a boolean `reduceMotion` and rejects other types); `tools/viewports.mjs` (Task 9)

- [ ] **Step 1: Write failing tests.**
  - `sanitizePrefs({ reduceMotion: true }).reduceMotion === true`.
  - `sanitizePrefs({ reduceMotion: 'yes' }).reduceMotion === DEFAULT_PREFS.reduceMotion`.
  - `DEFAULT_PREFS` has `reduceMotion` set to false.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Fix the findings.**
  - Fix every high and medium finding. Fix low findings that are cheap; defer the rest in `DESIGN-REVIEW.md` with reasons.
  - Bring every hard-coded size, spacing and duration in `styles.css` onto the tokens.
  - Record each identity change with before and after captures.
- [ ] **Step 4: Run** the unit tests, the build and e2e. Expected: PASS. Re-run `tools/design-capture.mjs` into `docs/images/design-review/after/`.
- [ ] **Step 5: Commit** `feat(ui): design system tokens, review fixes, reduce-motion setting`.

### Task 9: Enforce the design floor

**Files:**
- Modify: `tools/viewports.mjs`

- [ ] **Step 1: Extend the checks.** On each of the 6 profiles, for every visible interactive element and text node, the check fails when:
  - a touch target is under 44 CSS px on a touch profile;
  - computed text is under 12 CSS px;
  - key text (headings, body, buttons) has contrast below 4.5:1 for normal text or 3:1 for large text, against the computed background, walking up to the nearest opaque ancestor.

  Print the offending selectors.
- [ ] **Step 2: Run** `node tools/viewports.mjs`. Expected: 6/6 OK. Any failure is a Task 8 fix, not a threshold change.
- [ ] **Step 3: Commit** `test(ui): viewport check enforces touch, text-size and contrast floors`.

### Task 10: Verification, docs and the standing to-dos (last)

**Files:**
- Modify: `docs/VALIDATION.md` (a round-6 section: the gate, the planning-rule comparison, the performance figure), `docs/PERFORMANCE.md`, `docs/STATUS.md`, `docs/ARCHITECTURE.md` (city layer and planning rule), `README.md` (close-up city screenshots), `docs/ROADMAP.md`, `docs/SECURITY.md` (if any dependency was added)

- [ ] **Step 1: Measure performance.**
  - With a Playwright script, run a modern capital at maximum zoom for 10 s with and without the close-up layer, in Chromium with CPU throttling ×4 (CDP `Emulation.setCPUThrottlingRate`).
  - Record the median and p95 frame time, and the heap. Write that this is emulation, not a phone.
- [ ] **Step 2: Run the full gate.**
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - `npm run e2e`
  - `node tools/viewports.mjs`
  - `npm audit`
  - `npm outdated`

  Expected: all green, 0 vulnerabilities, nothing outdated (upgrade if anything is).
- [ ] **Step 3: Push** and confirm the CI and Pages runs are green with `mcp__github__actions_list`. Confirm the live site loads and the close-up appears there.
- [ ] **Step 4: Run the CLAUDE.md standing to-dos:**
  - audit the GitHub Actions runs (failures, flaky e2e, stale steps, skipped jobs) and record the findings in VALIDATION;
  - check for the newest packages and Actions versions, and record them in SECURITY and STATUS.
- [ ] **Step 5: Commit** `docs: round 6 verification, city detail and design review`, then push.
