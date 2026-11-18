# Feature-parity matrix (genre reference: WorldBox)

The reference inventory, with sources and confidence levels, is in
[research/worldbox-feature-inventory.md](research/worldbox-feature-inventory.md) (F-numbers below refer to it).
EPOCH is not a clone. It takes the genre's *sandbox god-game* premise and goes deeper on
history, economy and technology, with no copied code, art, names, icons or layouts.

Legend: **✓** comparable capability, of original design · **◐** partial · **✕** not implemented ·
**⇄** deliberately different.

| # | Reference area | EPOCH | Notes |
|---|---|---|---|
| 1 | Terrain painting, height tools, brushes (F01–F04) | ✓ | 37 terrain and biome tools, brush sizes with preview, raise and lower, undo. Hydrology is recomputed after each stroke. |
| 1 | Walls, stamps, cellular automata (F03, F05, F10) | ✕ | Not planned. They are decorative in the reference and have no simulation meaning here. |
| 2 | Procedural generation, map sizes (F11–F17) | ✓ | Plates, rain shadow, rivers to the sea or lakes, 24 terrains, 9 presets (incl. Realistic observer), **17 map shapes** (circle, square, donut, crescent, spiral, shards, checkerboard, mirrored, highlands, arid, waterworld, frozen, pangaea, twin, many continents, rift, natural), 4 sizes (128²–320²), plus a "complete randomization" option. Generation runs in a Web Worker. |
| 3 | Biomes and environmental change (F18–F25) | ✓ | Seasons, droughts (AR(1)), fire spread, floods, storms, quakes, volcanoes, desertification, pollution, CO₂-driven warming and sea level. |
| 4 | Animals, plants, ecosystems (F26–F33) | ✓ | Herds, predation, grazing, domestication, migration, extinction. Plants are vegetation density on tiles, not individuals. |
| 5 | Civilizations, cities, borders (F34–F42) | ✓ | Emergent from bands, era-specific districts, territory growth, capitals, secession and merger. Original **procedural flags** from emblems. |
| 6 | Unit stats and attributes (F43) | ✓ | Administration, military, diplomacy and learning skills with genes; skills feed leadership and battles. |
| 6 | Levels and experience (F44) | ✓ | **Skill development**: growth toward a potential set by genes and schooling, experience from role practice, decline with age. |
| 6 | Creature traits and trait editor (F46) | ✓ | 31 innate and 12 **acquired** traits earned from events, with a "divine touch" trait editor in the person inspector. 43 traits versus the reference's ~116: fewer, but every trait has a mechanical effect. |
| 6 | Status effects, mood, emotions (F47, F48, F50) | ◐ | **Stress** (from war, grief, defeat and illegitimacy) with mortality and personality effects. No per-unit happiness or friendships for commoners, which are aggregated as cohorts. |
| 6 | Spells (F51) | ⇄ | No magic system. The fantasy toggle adds creatures only. |
| 6 | Ruler personalities (F52) | ✓ | Leader traits shift national decision weights (war, expansion, science, piety, trade, caution). |
| 7 | Genetics, subspecies, evolution (F53–F62) | ◐ | Four heritable genes in people. Animal subspecies diverge under isolation. There is no gene editor and no player-designed species. |
| 8 | Families, dynasties, clans (F63–F70) | ✓ | Dynasties, regnal numbers, heirs, diplomatic marriages, succession crises, family links in biographies. No clans for commoners. |
| 9 | Languages and cultures (F71–F78) | ✓ | Generated phonologies, language drift and families, culture traits, blending and divergence, language overlay. |
| 10 | Religions (F79–F85) | ✓ | Emergence from conditions, founders, myths, doctrines, schisms, syncretism, missionaries, sacred sites, secularization, state faith. |
| 11 | Technology (F86–F92) | ⇄ | The reference has flat per-culture knowledge. EPOCH has a 207-tech dependency graph, 15 eras, discovery separate from adoption, diffusion and knowledge loss. |
| 12 | Economy and resources (F93–F99) | ⇄ | Much deeper: 21 goods, national markets, prices, trade routes, public finance, debt, inflation, crises, GDP identity. |
| 13 | Armies and warfare (F100–F106) | ✓ | Visible armies by era, ships, Lanchester battles, sieges, supply, war score, negotiated peace. Aircraft are abstracted as air support. |
| 14 | Diplomacy, alliances, rebellions (F107–F111) | ✓ | Relations with memory, treaties, alliances, vassals, federations, organizations, embargoes, coups, revolutions, secession. |
| 15 | Unit possession, Crabzilla (F112, F114) | ⇄ | Not planned: EPOCH is an observer and creator game. |
| 15 | Spectate and follow, selection (F113, F117) | ◐ | Tap to inspect anything, focus on events from history. No continuous follow camera and no hotkey groups. |
| 15 | Map layers (F116) | ✓ | 16 overlays, including **past borders** with a year slider. |
| 15 | Time controls (F118) | ✓ | Pause and five speeds. Simulation speed is independent of frame rate. |
| 16 | World ages and eras (F119–F123) | ⇄ | No global "ages". Each civilization advances through its own eras; climate change is modeled. |
| 17 | Disasters and destructive powers (F124–F131) | ✓ | 11 disaster tools, natural disasters with causal effects, and catastrophes at real-order base rates (airbursts, impacts, VEI-7/8 eruptions, geomagnetic storms, superflares, gamma-ray bursts). Nuclear arsenals with doctrine, deterrence, fallout and nuclear winter. |
| 18 | Fantasy creatures (F132–F138) | ◐ | 7 optional creature types behind the fantasy toggle, plus god-mode-only horrors (zombies, ghouls, blight) that can never appear in Realistic worlds. Human-only worlds are the default. |
| 19 | Statistics, history, favorites (F139–F145) | ✓ / ✕ | Global and per-civ charts with event markers, filterable history, causes, newspaper. **Favorites are not implemented.** |
| 20 | World laws (F146–F152) | ✓ | 15 laws plus live tuning of the balance constants in the World laws panel. |
| 21 | Saving, loading, sharing (F153–F158) | ✓ | IndexedDB slots, autosave, thumbnails, export and import files, timeline branching. Saves are exactly deterministic. No online sharing. |

## Beyond the reference (EPOCH-specific)

The reference has none of these:

- Demographic transition with cohorts.
- National accounts that satisfy the GDP identity.
- Factions that drive institution vectors, with derived government labels.
- Counterfactual-tested causal chains (drought → prices, instability → regime change).
- Modern and future systems: automation, space programs, colonies, fusion.
- An era-medium news feed (cave wall → tablets → scriptorium → press → newspaper → broadcast → social app → holonet), derived from recorded events, with generated outlets, platforms and AI systems.
- Live city photos (aerial from the real tiles, street-level postcard) and a 50-year album per nation.
- National values (11 ethos archetypes) and emergent missions that change how each nation works.
- Sports leagues, cups and world games; ports, airports and visitor accords; transport by era.
- Typed endings with recorded causes, including AI takeover, engineered pandemics, nuclear winter and grey goo; technological leapfrogging.
- Characters' life logs with recorded causes.
