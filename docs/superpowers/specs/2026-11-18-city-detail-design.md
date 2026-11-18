# City detail, planning rule and full design review: design

Status: **approved by the owner** · 2026-11-18 · branch `claude/epoch-civilizations-unbound-dap8pc`

## 1. Intent

When the owner zoomed into a city, the city read as a solid wall of identical, nation-tinted buildings, with people as large as houses. Cities should look like real places: streets between blocks, houses with yards, shops, gyms, cafés, schools, parks and parking, and space between buildings. Everything shown should still come from what the simulation actually contains. The second request is a full design review of the game, covering spacing, fonts, layout, animation and overall polish, with the problems fixed.

Owner decisions:

- **Visual detail plus a light planning rule.** The simulation does not start modelling gyms or stores as economic entities.
- **Approach 1:** a close-up city layer, drawn at four times the current resolution when zoomed in. The aerial photo uses the same drawing.
- The full design review is part of this work.

## 2. Goals, non-goals, anti-goals

**Goals**

1. At close zoom, every built city district shows as a block: streets with sidewalks on its edges, lots, and buildings with space around them (yards, courtyards, lawns, parking, trees). Density and style follow what the district really is.
2. The mix of homes, shops, gyms, cafés, schools, clinics and parks reflects real state:
   - the district's building type and era tier;
   - the settlement's size and employment mix;
   - the owner's ethos (for example atomic-age chrome, ecological green roofs);
   - pre-industrial cities are organic, industrial and later cities follow a grid.
3. A block's look is stable. It changes only when something real about the block changes, so a city is recognizable across sessions. The drawing has no effect on the simulation.
4. People and vehicles are drawn at street scale in the close-up layer.
5. The zoomed-out map gets lighter nation colours (an accent, not a full tint) and visible streets inside cities.
6. A light planning rule in the simulation, so even the zoomed-out map shows breathing room. Every built urban tile keeps access to a street or open tile. Cities keep a share of green space. Buildings are no longer rewarded for being boxed in on all four sides.
7. The aerial photo uses the close-up drawing. Postcard skylines leave gaps for streets and parks.
8. A full design review of every screen at phone and desktop sizes, with fixes and a written record.

**Non-goals**

- No new economic entities. Shops, gyms and cafés are drawn from existing state and have no simulated effects.
- No change to what a tile means (about 100 km² per tile), and no higher-resolution terrain or rebuilt art for the whole map.
- No 3D, isometric or perspective projection.

**Anti-goals** (failure even if it technically works)

- Close-up detail that contradicts the simulation. A farm district must not show apartment towers, and a prehistoric camp must not show cars.
- Frame drops on phones when zoomed in, or memory growth that crashes mobile Safari.
- The simulation becoming non-deterministic or depending on the renderer.
- A design review that only produces a document. Problems found must be fixed or explicitly deferred with a reason.

## 3. Constraints (from the code today)

- **World scale.** One map tile is 8×8 art pixels (`camera.ts: TILE = 8`). Zoom runs up to 8 CSS px per art px, so a tile is at most 64 CSS px on screen.
- **Map layer.** `TerrainLayer` caches 16×16-tile chunk canvases (128×128 px plus 24 px of overhang padding). The cache is an LRU of 220, and dirty chunks are redrawn a few per frame. Below 2.6 px per tile, a 1-px-per-tile overview image is used instead.
- **Buildings.** There is one sprite per built tile, chosen by `spriteFor` (building key, tier, hashed variant, ethos housing style, special venues, ports and airports) and team-tinted through T/U/V palette keys (`atlas.ts`).
- **Ambient life.** Walkers (`drawAmbient`, tilePx ≥ 9) and traffic (tilePx ≥ 4) are drawn per frame from settlement state.
- **Planner.** `findSite` and `placementScore` in `civilizations/urban.ts`. The 'urban' placement gives +1.5 per built neighbour, which produces compact blobs. `PARK` exists, with a planner weight of 0.7.
- **Determinism.** Rendering may only use hashes such as `hash3(x, y, salt)` and must never touch `sim.rng`. The planning rule changes simulation trajectories, which is allowed, but saves must still round-trip identically.
- **Content-Security-Policy.** No `unsafe-eval` and no inline styles. Canvas only.
- **Art.** Sprites are authored as palette-key rows (`art/types.ts`, `S(...)`) and checked by `validateSheet` and the sprite tests. Contact-sheet tooling exists (`tools/contact-sheet.ts`).

## 4. Approaches considered

| Approach | Summary | Trade-off | Decision |
|---|---|---|---|
| 1. Close-up city layer | Past a zoom threshold, built city tiles are redrawn as 32×32-pixel blocks in a separate cached layer over the normal map | New layer and a set of small "lot" sprites; memory bounded to visible chunks | **Chosen by the owner** |
| 2. Redraw at 8 px | Each tile becomes a tiny block with 1-px streets | Cheap, but houses, gyms and shops are 2–3 pixels and cannot be told apart, and yards are single pixels | Rejected: fails goal 2 |
| 3. Higher resolution everywhere | 16 or 32 px per tile for the whole map | Every terrain and building sprite redrawn, 4–16× memory, slower on phones | Rejected: largest effort for the same city result |

## 5. Design

### 5.1 Close-up layer (`rendering/cityLayer.ts`, new)

- **When it shows.** At `tilePx ≥ 20` it fades in over the normal chunks: alpha ramps from 20 to 26 px, then it is fully on. The maximum zoom rises from 8 to 12, so that a tile is up to 96 CSS px and one detail pixel up to 3 CSS px.
- **Resolution.** Each city tile is drawn into a 32×32 "block" (scale ×4 against the map). Detail chunks cover 8×8 tiles, so each is a 256×256 canvas plus overhang padding for tall buildings, and is drawn back at world size (64×64 world px).
- **What gets the close-up.** A tile is drawn in detail when it belongs to a settlement (`map.settle[i] > 0`) and holds an urban, civic, commercial, industrial or park building, or is a street tile inside a settlement. Farms, pastures, mines, wilderness and water stay on the normal 8-px layer underneath, so the countryside around a city is unchanged.
- **Cache.** Same pattern as `TerrainLayer`: an LRU of at most 48 detail chunks (about 12 MB of canvas memory) that are invalidated through the same `chunkDirty` flags, mapped to detail chunks. At most 2 are redrawn per frame, nearest first. When the cache is cold, the normal layer shows until the detail chunk is ready, so there is never a blank.
- **Ordering.** The normal chunks are drawn first, then the city layer, then traffic, walkers, armies, weather and labels, as today.

### 5.2 Block composition (`rendering/cityBlocks.ts`, new, pure functions)

`composeBlock(ctx: BlockContext): BlockPlan` takes the tile's data and returns a list of draw operations (ground fills, street segments, lot rectangles, sprite placements). It is pure and deterministic, so tests can check it without a canvas.

**Inputs (`BlockContext`):**
- building id and tier;
- the settlement's **size band**: village < 2k, town < 20k, city < 200k, metropolis above. Live employment shares are not used;
- the owner's ethos key and colour;
- the eight neighbours' kinds: built city, water, open land or farm;
- road tier on the tile;
- `hash3(x, y, salt)`.

**Stability (builder's call).** These inputs change rarely, so a block keeps its look between real changes. The detail cache stores a cheap signature for each tile (building, tier, size band, ethos, neighbour kinds). Chunks whose signatures changed are redrawn: the building-related inputs are covered by the map's dirty flags, and settlement size bands and civ ethos are checked once a simulated year.

**Streets.** Every block edge that faces a street tile, a road, or a different block gets street width:

| Era tier | Street |
|---|---|
| 0–2 | 3 px dirt lane |
| 3–4 | 4 px cobbled street |
| 5 and later | 6 px paved road with 1 px sidewalks, lane marks, and crosswalks at corners |

Edges facing open land get a fence, hedge or wall instead of a street. Edges facing water get a quay or promenade.

**Layout style.**
- Tiers 0–4 are organic: lot lines jitter by ±1 px, there is no straight grid, and plots are irregular.
- Tiers 5 and later follow a grid: straight rectangular lots, aligned frontages, and a building setback from the sidewalk.

**Lots by district type.** Every lot keeps at least 1 px of open ground between neighbouring buildings.

| District | Lots per block | What is drawn |
|---|---|---|
| Huts, camps (tier 0–1) | 3–5 round huts | Fire pit, drying racks, bare ground |
| House (tier 2–4) | 4–6 | House plus garden or yard, well or tree |
| House or Suburb (tier 5+) | 4–6 | Detached house, front lawn, backyard, driveway; trees; pools from tier 6 |
| Townhouse, Tenement | 6–8 | Row houses sharing walls within the row; a back court and small back gardens |
| Apartment | 2–3 | Mid-rise blocks around a courtyard; a parking lot from tier 5 |
| Tower, Arcology | 1–2 | One tower or megastructure on a plaza, with trees and fountains |
| Market, Bank, Office, Warehouse | 3–6 | Stalls, shopfronts with awnings, or office blocks; loading yard for warehouses |
| Civic (Temple, School, Library, University, Hospital, Palace, Monument) | 1 main building | The main building on its own grounds (lawn, courtyard, sports field for schools); its existing sprite is reused at ×4 detail where one exists, otherwise redrawn |
| Industrial (Workshop → Robot factory, power plants) | 1–3 | Building with yard, stacks, piles and tanks |
| Park | — | Paths, trees, pond, benches; a playground from tier 5 |

**Amenities in residential and commercial blocks.**
- A hashed share of lots become amenities. The share rises with the settlement's size band: about 5% in a village, 12% in a town, 20% in a city and 30% in a metropolis.
- Amenity types depend on the era:

  | Era | Amenities |
  |---|---|
  | Tiers 0–2 | Communal fire, granary corner, shrine |
  | Classical and medieval | Bakery, tavern, smithy stall, bathhouse, training yard |
  | Renaissance and industrial | Shop, café, pharmacy, school corner, boxing gym |
  | Modern | Grocery, café, gym, clinic, cinema, parking garage |
  | Future | Vertical farm, drone pad, wellness centre |

- Ethos shifts the mix. For example, egalitarian and welfare-minded nations get more clinics and schools, mercantile nations more shops, militarist nations training grounds, and ecological nations more parks and green roofs.

**Nation identity.** The owner's colour appears as an accent only (awnings, flags, roof trim on civic buildings), never as a full building tint.

### 5.3 New art (`rendering/art/city_lots.ts`, new)

Small sprites at detail scale (detail pixels):
- houses: 8–12 px wide, in 3–4 variants per tier band;
- row houses, apartment blocks, shopfronts with awnings, a gym (dumbbell sign; a classical gymnasium with columns), a café with tables, a clinic (cross), a grocery, a school corner;
- trees in 3 sizes, fences, hedges, pools, cars parked in 2 orientations, benches, lamps, a fountain;
- market stalls, bathhouse, tavern, huts.

They use the existing palette and authoring format. The palette's team keys are used only for accents. New tests extend `tests/rendering/sprites.test.ts`: every sprite validates and every era has a complete amenity set. The contact sheet is regenerated.

### 5.4 Street-scale life

- In the close-up layer, walkers are drawn at about 1/4 of their current size, on sidewalks. Cars and buses drive in street lanes, using the existing era vehicle choice (`vehicleSprite`) with small new sprite sizes.
- The density of walkers and traffic follows the settlement's population, as today.
- Below the close-up threshold the current walkers stay, but shrink to half size so they are no longer as big as buildings.

### 5.5 Zoomed-out map changes

- **Lighter nation colour.** Team tint on building sprites becomes an accent: roofs keep a natural material colour, and trim and flags take the nation colour. Borders and the political overlay keep full colour, so nations stay identifiable.
- **Street lines.** The normal layer draws a 1-px street line between adjacent built city tiles, in the road colour of the tier.

### 5.6 Planning rule (`civilizations/urban.ts`)

**Definitions (builder's call, made after the builder check).** The simulation has no separate street tile: a road is a bit in `map.infra` that can sit under buildings, and trade routes run through built tiles. So the rule does **not** treat roads as access.

- **Built:** a tile with any non-food building (urban, residential, commercial, civic, industrial, military, wall).
- **Open:** an unbuilt land tile, a park, water, or a food tile (farm, pasture, plantation, greenhouse, fishery). Fields count as breathing room.

The close-up layer draws a street on every block edge (see 5.2), including edges between two built blocks. The look therefore does not depend on how many open tiles the planner leaves; the rule adds real breathing room on top.

1. **Access.** A new non-food building may be placed on tile *i* only if, after placing it, *i* and each built 4-neighbour of *i* still have at least one open 4-neighbour. Otherwise the site is skipped and the planner takes the next-best site. No roads are laid by this rule, and road state is untouched.
2. **Green space.** Settlements above 2,000 people aim for one park per 8 residential districts, raising the existing park weight when they are below that. Parks count as open.
3. **Compactness.** The 'urban' placement score changes from `+1.5 × built neighbours` to `+1.0 × built neighbours, −2.0 when all four neighbours would be built`.
4. **Scope.** The rule governs new placements and upgrades on new sites. Existing cities, including preset bootstraps and old saves, are not rebuilt. Redevelopment in place (upgrading a district on its own tile) is allowed even when the tile is enclosed, so old cities improve without being demolished. Tests measure cities grown under the rule, and a counterfactual with the rule on and off.

**Expected effects.** Cities cover somewhat more land and reach high-density housing a little earlier.

**Balance tolerance (builder's call).**
- The multi-seed invariants (ledger, finite values, GDP identity) must still hold in 20/20 seeds.
- On the four standard 1,000-year runs, the year each milestone era is reached must stay within ±15% of the round-5 figures (VALIDATION §R5), and food shortfall and unemployment must not get worse by more than 5 percentage points.
- If a run falls outside these bounds, the rule is weakened first: the green-space target, then compactness, before any retuning of the economy.
- Trajectory-sensitive tests are rebuilt as probe-based counterfactuals where needed.

Save files are unaffected, because no new state is added.

### 5.7 Photos

- **Aerial view.** `drawAerial` renders through the city layer at its native resolution (a 32×32 block per tile, scaled to fit the frame), so photos show streets, yards and parks. Era grading is unchanged.
- **Postcard.** The skyline record already has one column per west–east tile. Rendering inserts a street gap between columns of different blocks, and draws park columns as trees. The snapshot format and album storage are unchanged.

### 5.8 Full design review

**Owner decisions (2026-11-18).**
- The review **may change the visual identity**: font pairing (for example a readable body font beside the pixel display font), palette, era frames and HUD layout, where that improves quality.
- **Fix bar:** fix every high and medium finding, and fix low findings when they are cheap. Every remaining finding goes into `docs/DESIGN-REVIEW.md` as deferred, with a reason.
- Identity-level changes are shown with before and after screenshots, so the owner can revert them.

**Process.**
- **Capture every screen** at iPhone SE, iPhone 13, iPhone 13 landscape, iPad and a 1280×800 desktop, using a Playwright script added to `tools/`:
  - title, new world, load, settings;
  - in-game HUD, every sheet (layers, nations, nation tabs, feed and every era frame, history, statistics, laws, menu), inspectors for a person, an army and a settlement, and toasts;
  - the tutorial;
  - close-up and normal map zooms.
- **Review each screen** with the design-critique, accessibility-audit and interaction-design skills (and the UI Design Review and Axe plugins if the owner installs them).

**Checklist.**
- **Spacing.** One spacing scale (4-px base), consistent padding in sheets and cards, and alignment. No text touching edges.
- **Type.** One type scale, with Pixelify Sans used only at sizes where it renders crisply. Body text is legible at phone sizes, with no text under 12 CSS px. Line lengths are kept in check, and the era-frame fonts are consistent.
- **Colour and contrast.** WCAG AA for text (4.5:1 body, 3:1 large). Button states are distinguishable.
- **Touch and keyboard.** Targets of at least 44 px on touch (currently 32 px are allowed), visible focus rings, a sensible Escape and back behaviour, keyboard navigation of sheets.
- **Motion.** One set of durations and easings (for example 120 ms for small changes, 200 ms for sheets, ease-out) with no janky or layout-shifting animations. The `prefers-reduced-motion` setting is respected, and an in-game "Reduce motion" setting is added. Map animations (water, smoke, weather) are throttled under reduced motion.
- **States.** Empty, loading and error states for every panel. Long names are truncated with ellipsis and a full-name tooltip or long-press.
- **Consistency.** Icons, button styles, sheet headers and close buttons.

**Output.**
- `docs/DESIGN-REVIEW.md`: every finding with a screenshot reference, its severity, and whether it was fixed or deferred with a reason.
- Fixes in the CSS and components.
- Before and after screenshots.
- The viewport tool is extended to fail on text under 12 px, touch targets under 44 px, and contrast below AA on key text.

## 6. Verification

- **Unit tests.**
  - `composeBlock` is deterministic for the same tile.
  - Every lot has open ground between buildings.
  - Every edge facing a street has a street.
  - The era gates hold: no cars before tier 5, no huts after tier 4.
  - Amenity share rises with settlement size.
  - Ethos shifts the amenity mix.
  - Farm and wilderness tiles are never given city detail.
- **Planning-rule tests.**
  - No building placed under the rule is fully enclosed (no open 4-neighbour) when it is placed; checked by a placement probe.
  - Large cities have parks.
  - A counterfactual with the rule on and off, from the same early start, shows more open tiles inside cities after 150 years.
  - The multi-seed invariants still hold.
- **Rendering performance.** Frame time at maximum zoom over a large modern city, measured in headless Chromium before and after. Detail chunk memory stays at or below the LRU cap. The CPU is throttled to 4× to approximate a phone. This is emulation only, and the docs will say so.
- **Browser tests.**
  - Zooming into a city shows the close-up layer, with streets and lots visible in pixel samples.
  - The aerial photo has street pixels.
  - Reduced motion is respected.
- **The full gate:** tsc, all tests, build, e2e, viewports, `npm audit`, `npm outdated`, a CI check, and the CLAUDE.md standing to-dos at the end.

## 7. Calls made by the builder (owner may override)

These were not discussed with the owner; each is marked as a builder's call.

- The close-up threshold (20–26 px per tile, fading in) and the new maximum zoom of 12.
- Organic layouts before the industrial era and a grid from industrial onward.
- Amenity shares of 5–30% and the era and ethos amenity lists above.
- Walkers at a quarter of their size in close-up and half size at normal zoom.
- The nation colour becomes an accent on buildings; borders keep full colour.
- Planning-rule numbers: one park per 8 residential districts above 2,000 people, and the compactness weights.
- Touch targets raised to 44 px, and the 12-px minimum text size.
- A "Reduce motion" setting in Settings.
- Planning rule: what counts as built and open, that roads do not count as access, scope limited to new placements, and the balance tolerance (5.6).
- Block looks keyed to the settlement's size band rather than live statistics (5.2).

## 8. Left to the builder

- Exact sprite designs, palettes and variant counts within the existing art style.
- Detail-cache sizing within the memory bound, and the chunk redraw budget.
- How the road for an enclosed block is chosen (nearest connectable tile).
- The order of design-review fixes, by severity.
