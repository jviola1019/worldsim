/**
 * App icons for "Add to Home Screen" (iPhone) and installable web app (PC), drawn from the game's own
 * pixel art: a globe-and-crown sprite centered on the midnight-ink background, nearest-neighbor scaled.
 *   npx tsx tools/make-icons.ts   → public/icon-180.png, icon-192.png, icon-512.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { PALETTE, hexToRgb } from '../src/rendering/art/palette';
import { ALL_SPRITES } from '../src/rendering/art/index';
import { encodePng } from './png';

const SPRITE = process.argv[2] ?? 'ico.ov_political';
const def = ALL_SPRITES[SPRITE];
if (!def) throw new Error(`no sprite ${SPRITE}`);
const bg = hexToRgb('#141c30');
mkdirSync('public', { recursive: true });
for (const size of [180, 192, 512]) {
  const rgba = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) rgba.set([bg[0], bg[1], bg[2], 255], i * 4);
  const scale = Math.floor((size * 0.72) / Math.max(def.w, def.h));
  const ox = Math.floor((size - def.w * scale) / 2), oy = Math.floor((size - def.h * scale) / 2);
  const rows = def.frames[0];
  for (let y = 0; y < def.h; y++)
    for (let x = 0; x < def.w; x++) {
      const ch = rows[y][x];
      const hex = (PALETTE as Record<string, string>)[ch];
      if (!hex || ch === '.') continue;
      const [r, g, b] = hexToRgb(hex);
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) rgba.set([r, g, b, 255], ((oy + y * scale + dy) * size + ox + x * scale + dx) * 4);
    }
  writeFileSync(`public/icon-${size}.png`, encodePng(size, size, rgba));
}
console.log('icons written from', SPRITE);
