/**
 * DOM-free sprite rasterizer. Turns a palette-keyed SpriteDef into an RGBA
 * pixel buffer with all frames laid out left to right (frame f occupies
 * columns f*w .. f*w+w-1). The browser atlas copies this buffer into a
 * canvas; tools and tests use it directly in node.
 */
import type { SpriteDef } from './types';
import { PALETTE, hexToRgb } from './palette';

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const rgbCache = new Map<string, [number, number, number]>();

/** RGB of a palette key; T/U/V use the team shades when given. Unknown keys are magenta. */
export function keyRgb(key: string, team?: Readonly<Record<string, string>>): [number, number, number] {
  if (team && (key === 'T' || key === 'U' || key === 'V')) return hexToRgb(team[key]);
  let c = rgbCache.get(key);
  if (!c) rgbCache.set(key, (c = hexToRgb(PALETTE[key] ?? '#ff00ff')));
  return c;
}

/** Rasterize every frame of a sprite into one RGBA strip. */
export function rasterizeSprite(def: SpriteDef, team?: Readonly<Record<string, string>>): RgbaImage {
  const n = def.frames.length;
  const width = def.w * n;
  const height = def.h;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let f = 0; f < n; f++) {
    const rows = def.frames[f];
    for (let y = 0; y < height; y++) {
      const row = rows[y] ?? '';
      for (let x = 0; x < def.w; x++) {
        const ch = row[x];
        if (!ch || ch === '.') continue;
        const [r, g, b] = keyRgb(ch, team);
        const o = (y * width + f * def.w + x) * 4;
        data[o] = r;
        data[o + 1] = g;
        data[o + 2] = b;
        data[o + 3] = 255;
      }
    }
  }
  return { width, height, data };
}

/** Count of opaque pixels in one frame of a rasterized sprite. */
export function opaquePixels(img: RgbaImage, def: SpriteDef, frame: number): number {
  let n = 0;
  for (let y = 0; y < def.h; y++)
    for (let x = 0; x < def.w; x++) if (img.data[(y * img.width + frame * def.w + x) * 4 + 3] > 0) n++;
  return n;
}
