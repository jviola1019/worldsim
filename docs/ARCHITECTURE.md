# Architecture

TypeScript 5.9, built with Vite 7. The UI is Preact 10 (about 4 KB). Rendering uses Canvas2D and Vitest runs the tests.
There are no other runtime dependencies.

## Module map (`src/`)

| Module | Responsibility |
|---|---|
| `core/` | Seeded RNG (sfc32, with state kept in the world), simplex noise, hashing and digest, math helpers, binary heap, calendar. |
| `config/` | World laws, `BALANCE` constants, world-size presets, scenario presets, engine and save versions. |
| `world/` | Terrain enum, `TileMap` (typed arrays per field), world generation (plates, rain shadow, hydrology, biomes, deposits), A* pathfinding, environment (fire, disasters, regional climate AR(1), CO₂ forcing, sea level). |
| `sim/` | `WorldState` types, world creation, the `Simulation` orchestrator, the per-civilization yearly cycle, bootstrap (later-era starts, collapse scenario), maintenance. |
| `population/` | Individuals (`persons.ts`), traits, **character development** (`development.ts`), demography (age cohorts, mortality and fertility schedules), bands, agents, migration, SIR disease. |
| `civilizations/` | Settlements (monthly cycle), building types, urban planning and construction, territory, civilization identity, knowledge and contact. |
| `economy/` | Production per settlement, the national market and public finance (`market.ts`), trade, routes and infrastructure. |
| `technology/` | 207-tech dependency graph, research with discovery kept separate from adoption, capability aggregation, forgetting. |
| `politics/` | Institutions, factions, elections, coups and revolutions, secession; succession, dynasties and notables; diplomacy, treaties and organizations. |
| `military/` | Armies, A* movement, Lanchester battles (linear before gunpowder, square after), sieges, supply, nuclear deterrence. |
| `culture/` | Languages (phonology, drift), religions (emergence, doctrines, schism), culture traits and blending. |
| `ecology/` | Species, herds, predation, domestication, subspecies divergence, monsters (fantasy toggle). |
| `future/` | Space programs, colonies. |
| `history/` | Event log with causes, newspaper text, sampled statistics, **historical territory snapshots**. |
| `persistence/` | Binary save format, IndexedDB slots, autosave rotation, export and import, migrations. |
| `powers/` | God-power definitions (97 tools in 10 categories), undo stack. |
| `rendering/` | Procedural pixel-art atlas (595 sprites), camera, chunked terrain layer, overlays (16), renderer, **procedural flags**. |
| `ui/` | Screens, HUD, tool dock, inspectors, panels, charts, input classification, audio, preferences. |
| `workers/` | World generation in a Web Worker, so the UI never freezes during creation. |

## Time and the tick model

- 1 tick ≈ 3 days, 10 ticks make a month and 120 ticks make a year (`core/time.ts`).
- Per tick: fire and environment, herds, bands, agents, armies, monsters, and one vegetation slice.
- Monthly, staggered: settlement `s` runs on tick slot `s.id % 10`, which spreads the load.
- Yearly, staggered: civilization `c` runs on day `(c.id·37) % 120`. Global yearly systems (stats, trade,
  species census, evolution, religion, culture, climate, notables) run on day 0.
- `Simulation.advance(realMs, ticksPerSecond, budgetMs)` converts real time into ticks under a wall-time budget,
  so input stays responsive. Rendering never drives simulation logic. Frame rate and simulation rate are
  independent; a test checks that frame slicing gives identical results.

## Data model

`WorldState` (`sim/types.ts`) is plain data: a `TileMap` of typed arrays (terrain, elevation, owner, settle,
bld, bldFlags, veg, fert, temp, moist, river, flow, infra, hazard, pollution, fire, dep, and so on) plus
id-keyed `Map`s of civilizations, settlements, persons, dynasties, armies, wars, herds, bands, religions,
cultures, languages, diseases and relations. It also holds the event log, statistics, climate, laws and RNG state.

A tile represents about 100 km² (8×8 art pixels). Buildings are *districts*: non-agricultural job counts are
scaled ×10. A settlement keeps individuals while it has fewer than 150 people and switches to 17 age-band cohorts
above that, with hysteresis back to individuals below 60. Notable persons (rulers, heirs, generals, founders,
prophets) are always individuals and are kept after death for history and biographies.

## Determinism rules

1. All randomness comes from `sim.rng`, whose state is in `w.rng` and is synced before saving.
2. `sim.cache` holds **derived data only**. Anything that affects a later result must either live in
   `WorldState`, so it is serialized, or be recomputable from current state within the same tick.
   Writing the round-trip test enforced this and found seven violations, each fixed:
   - The yearly site survey moved to `Settlement.sites`.
   - Last year's stock value and money supply moved to `Civ.prevStockValue` and `Civ.prevMoney`.
   - Trade totals moved to `Civ.tradeExp` and `Civ.tradeImp`.
   - Planned road routes moved to `Settlement.routes`.
   - Building-tile lists and live population are now memoized per tick.
   - Fire iteration is index-ordered.
3. The tests check that the same seed and config give identical digests after 60 years. A save at an arbitrary
   tick, mid-month and mid-year, followed by a load gives the same digest every year for the next 40 years,
   including in an industrial-era world (`tests/persistence/roundtrip.test.ts`).

## Rendering

The renderer is Canvas2D, chosen because a static pixel-art map with chunk caches needs no GPU pipeline and
Safari support is universal. Terrain is drawn into 16×16-tile chunk canvases (LRU of 220, with a 24 px overhang for
mountains and trees). Below 2.6 px per tile it switches to a single overview image. Overlays render into a
4-px-per-tile canvas. Units, vehicles and buildings are tinted with team colors lazily. Traffic is drawn
from real roads, rails and trade routes, and weather from real rain anomalies. Civilization flags are generated from
`civ.emblem` (eight field divisions × twelve charges) and cached as canvases. The UI uses them as data URLs.

## Persistence

The `EPCH` binary format is a JSON header (meta, ids, entity arrays, a typed-array table) followed by
4-byte-aligned typed-array payloads. It is wrapped in an `EPZ1` frame with a CRC32 and gzip via `CompressionStream`
when available. Saves live in IndexedDB slots with metadata (name, thumbnail, year, seed, engine and format
version, last played) and a rotating autosave. Export and import use `.epoch` files, and branching copies a slot with
lineage. Corrupt frames (CRC mismatch or failed decompression) raise a typed `SaveError` without touching the store.

## Testing

`tests/` holds unit tests (worldgen, tech graph, flags, gesture classification, development) and determinism
and round-trip tests. A stress test runs 300 years and checks bounded growth, the GDP identity and border
consistency. Counterfactual integration tests clone a world exactly, intervene in one copy and compare
(drought, roads, war, legitimacy collapse, cross-border religion, industrial pollution). Every preset is
exercised. `tests/e2e/run-e2e.mjs` drives the built app in emulated iPhone 13 and desktop Chromium.
