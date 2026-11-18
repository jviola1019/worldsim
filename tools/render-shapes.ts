/**
 * Render one small preview PNG per map shape (terrain colour per tile, rivers in blue).
 *   npx tsx tools/render-shapes.ts [outDir] [seed] [size] [scale]
 * Defaults: docs/images/maps, seed "preview", 128 tiles, 2 px per tile.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { generateWorld, DEFAULT_GEN } from '../src/world/worldgen';
import { MAP_SHAPES } from '../src/world/mapShapes';
import { applyMapShape } from '../src/config/laws';
import { TERRAIN } from '../src/world/terrain';
import { hexToRgb } from '../src/rendering/art/palette';
import type { TileMap } from '../src/world/tilemap';
import { encodePng } from './png';

const outDir = process.argv[2] ?? 'docs/images/maps';
const seed = process.argv[3] ?? 'preview';
const size = Number(process.argv[4] ?? 128);
const scale = Number(process.argv[5] ?? 2);

function tileColor(map: TileMap, i: number): [number, number, number] {
  if (map.river[i] > 0) return [60, 130, 210];
  const [r, g, b] = hexToRgb(TERRAIN[map.terrain[i]].color);
  return [r, g, b];
}

function renderMap(map: TileMap): Buffer {
  const W = map.w * scale;
  const H = map.h * scale;
  const px = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [r, g, b] = tileColor(map, ((y / scale) | 0) * map.w + ((x / scale) | 0));
      const o = (y * W + x) * 4;
      px[o] = r;
      px[o + 1] = g;
      px[o + 2] = b;
      px[o + 3] = 255;
    }
  return encodePng(W, H, px);
}

mkdirSync(outDir, { recursive: true });
for (const shape of MAP_SHAPES) {
  const gen = applyMapShape({ ...DEFAULT_GEN, seed, width: size, height: size }, shape.key);
  const { map } = generateWorld(gen);
  const out = `${outDir}/${shape.key}.png`;
  writeFileSync(out, renderMap(map));
  console.log('wrote', out);
}
