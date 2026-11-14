/**
 * Render a generated world overview to PNG (terrain colors + hillshade + rivers + deposits).
 *   npx tsx tools/render-map.ts [seed] [landmass] [size] [scale]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { generateWorld, DEFAULT_GEN, type LandmassType } from '../src/world/worldgen';
import { TERRAIN } from '../src/world/terrain';
import { hexToRgb } from '../src/rendering/art/palette';
import { encodePng } from './png';

const seed = process.argv[2] ?? 'demo';
const landmass = (process.argv[3] ?? 'continents') as LandmassType;
const size = Number(process.argv[4] ?? 192);
const scale = Number(process.argv[5] ?? 3);
const { map } = generateWorld({ ...DEFAULT_GEN, seed, landmass, width: size, height: size });
const W = map.w * scale;
const H = map.h * scale;
const px = new Uint8Array(W * H * 4);
const depColors: Record<number, [number, number, number]> = { 1: [200, 110, 50], 2: [180, 180, 190], 3: [140, 80, 60], 4: [250, 210, 40], 5: [80, 230, 220], 6: [20, 20, 20], 7: [60, 20, 70], 8: [120, 200, 255], 9: [120, 255, 60], 10: [255, 60, 200], 11: [255, 120, 0], 12: [120, 70, 30], 13: [255, 255, 255] };
for (let y = 0; y < map.h; y++)
  for (let x = 0; x < map.w; x++) {
    const i = y * map.w + x;
    let [r, g, b] = hexToRgb(TERRAIN[map.terrain[i]].color);
    if (map.isLand(i)) {
      const ex = map.elev[Math.max(0, i - 1)] ?? 0;
      const ey = map.elev[Math.max(0, i - map.w)] ?? 0;
      const shade = 1 + (map.elev[i] - (ex + ey) / 2) * 6;
      r *= shade; g *= shade; b *= shade;
    }
    if (map.river[i] > 0) { r = 60; g = 130; b = 210; }
    for (let sy = 0; sy < scale; sy++)
      for (let sx = 0; sx < scale; sx++) {
        const o = ((y * scale + sy) * W + x * scale + sx) * 4;
        px[o] = Math.max(0, Math.min(255, r)); px[o + 1] = Math.max(0, Math.min(255, g)); px[o + 2] = Math.max(0, Math.min(255, b)); px[o + 3] = 255;
      }
    const d = map.dep[i];
    if (d && d !== 13 && scale >= 3) {
      const c = depColors[d] ?? [255, 0, 255];
      const o = ((y * scale + 1) * W + x * scale + 1) * 4;
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
    }
  }
mkdirSync('tools/output', { recursive: true });
const out = `tools/output/map-${seed}-${landmass}-${size}.png`;
writeFileSync(out, encodePng(W, H, px));
console.log('wrote', out);
