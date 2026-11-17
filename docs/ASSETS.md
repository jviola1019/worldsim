# Asset manifest

Every visual asset is **original and generated from code** in this repository. There are no image files,
downloaded sprites or third-party art. Sprites are text grids of palette letters (see
`src/rendering/art/types.ts`) that are rasterized into an atlas at startup (`src/rendering/atlas.ts`).
License: MIT, the same as the code. Render contact sheets with `npm run sprites`; PNGs go to `tools/output/`.

All art uses one palette (`src/rendering/art/palette.ts`) at one pixel density: 1 art pixel equals 1 world pixel,
and a tile is 8×8. Scaling is nearest-neighbor only (`image-rendering: pixelated`, smoothing disabled).
Letters `T`, `U` and `V` mark team-color slots, which are tinted per civilization on demand.

| Family (id prefix) | Count | Size (px) | Frames | Source file | Use |
|---|---|---|---|---|---|
| Terrain tiles (`ter.*`) | 72 | 8×8 | 1 | `art/terrain.ts` | 24 terrains with variants and coast/water transitions |
| Mountains (`mtn.*`) | 10 | 8×6 – 8×14 | ≤3 | `art/terrain.ts` | Hills, mountain and volcano overhangs (volcano animated) |
| Vegetation (`veg.*`) | 30 | 6×9 – 8×12 | 1 | `art/vegetation.ts` | Trees per biome, shrubs, crops, cacti, dead trees |
| Units (`unit.*`) | 46 | 7×8 – 9×10 | ≤2 | `art/units.ts` | Citizens per era, soldiers for military tiers 0–12, specialists |
| Animals (`ani.*`) | 22 | 9×6 – 11×10 | ≤2 | `art/animals.ts` | Wild and domesticated species |
| Creatures (`mon.*`) | 7 | 9×10 – 18×14 | ≤2 | `art/animals.ts` | Optional fantasy creatures (fantasy toggle only) |
| Vehicles (`veh.*`) | 47 | 9×5 – 17×12 | ≤2 | `art/vehicles.ts` | Carts, ships (galley → drone ship), trains, cars, aircraft, rockets |
| Effects (`fx.*`) | 34 | 5×5 – 24×24 | ≤6 | `art/effects.ts` | Fire, smoke, clash, construction, weather, explosions, selection, flag |
| Buildings (`bld.*`) | 138 | 8×7 – 16×16 | ≤4 | `art/buildings.ts`, `art/buildings_civic.ts` | 65 district types across era tiers (huts → arcologies); multi-tile landmarks |
| Icons (`ico.*`) | 189 | 16×16 | 1 | `art/icons.ts` | Tool categories, 97 powers, 16 overlays, UI glyphs, statistics |
| **Flags** (runtime) | unbounded | 12×8 | 1 | `rendering/flag.ts` | Per-civilization flag from its emblem: 8 field divisions × 12 charges × colors |
| **Total (static atlas)** | **595** | | | | |

## Animation

Animated: water shimmer (terrain layer), fire, smoke, construction scaffolding, walking units and
soldiers, ships, volcano, clash effects, weather and selection rings. Frame rates are set per sprite (`fps`,
default 4).

## Fonts and audio

- Font: **Pixelify Sans** (SIL Open Font License 1.1), loaded from Google Fonts in `index.html`. It is the
  only external asset; text falls back to `ui-monospace` when offline.
- Audio: synthesized at runtime with WebAudio oscillators (`src/ui/audio.ts`). There are no sound files.

## Status

The art is final-quality for this pixel style; nothing is a placeholder. The contact sheets were
reviewed visually during integration.
