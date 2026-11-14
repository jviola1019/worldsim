/**
 * Renders every registered sprite sheet into a PNG contact sheet so that
 * pixel art can be reviewed visually (open the PNG with any image viewer).
 *
 *   npm run sprites -- [prefix] [scale]
 *
 * Writes tools/output/sprites-<prefix|all>.png and prints an index of which
 * sprite id is at which grid cell. Uses a tiny built-in PNG encoder (zlib),
 * so no browser or native canvas is required.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PALETTE, hexToRgb } from '../src/rendering/art/palette';
import { validateSheet, type SpriteDef } from '../src/rendering/art/types';
import { ALL_SPRITES } from '../src/rendering/art/index';

const prefix = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2] : '';
const scale = Number(process.argv[3] ?? 4);

const problems = validateSheet(ALL_SPRITES, PALETTE);
if (problems.length) {
  console.log(`VALIDATION PROBLEMS (${problems.length}):`);
  for (const p of problems.slice(0, 200)) console.log('  ' + p);
}

const ids = Object.keys(ALL_SPRITES)
  .filter((id) => id.startsWith(prefix))
  .sort();
if (!ids.length) {
  console.log('no sprites match prefix', prefix);
  process.exit(0);
}

const CELL = 28; // art pixels per cell (sprites up to 24px + margin)
const cols = Math.min(16, ids.length);
const rows = Math.ceil(ids.length / cols);
// each cell gets an extra column strip for all frames horizontally
let maxFrames = 1;
for (const id of ids) maxFrames = Math.max(maxFrames, ALL_SPRITES[id].frames.length);
const cellW = CELL * Math.min(maxFrames, 4);
const W = cols * cellW * scale;
const H = rows * CELL * scale;
const px = new Uint8Array(W * H * 4);

// checkerboard background to show transparency
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const cx = Math.floor(x / (cellW * scale));
    const cy = Math.floor(y / (CELL * scale));
    const alt = (cx + cy) % 2 === 0;
    const checker = (Math.floor(x / (2 * scale)) + Math.floor(y / (2 * scale))) % 2 === 0;
    const base = alt ? 70 : 58;
    const v = checker ? base : base + 8;
    const i = (y * W + x) * 4;
    px[i] = v;
    px[i + 1] = v + 6;
    px[i + 2] = v + 2;
    px[i + 3] = 255;
  }

const rgbCache = new Map<string, [number, number, number]>();
function rgb(key: string): [number, number, number] {
  let c = rgbCache.get(key);
  if (!c) {
    c = hexToRgb(PALETTE[key] ?? '#ff00ff');
    rgbCache.set(key, c);
  }
  return c;
}

function blit(def: SpriteDef, frame: number, ox: number, oy: number) {
  const f = def.frames[frame];
  for (let y = 0; y < def.h; y++) {
    const row = f[y] ?? '';
    for (let x = 0; x < def.w; x++) {
      const ch = row[x] ?? '.';
      if (ch === '.') continue;
      const [r, g, b] = rgb(ch);
      for (let sy = 0; sy < scale; sy++)
        for (let sx = 0; sx < scale; sx++) {
          const X = (ox + x) * scale + sx;
          const Y = (oy + y) * scale + sy;
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const i = (Y * W + X) * 4;
          px[i] = r;
          px[i + 1] = g;
          px[i + 2] = b;
          px[i + 3] = 255;
        }
    }
  }
}

const index: string[] = [];
ids.forEach((id, n) => {
  const def = ALL_SPRITES[id];
  const c = n % cols;
  const r = Math.floor(n / cols);
  index.push(`[r${r} c${c}] ${id} (${def.w}x${def.h}, ${def.frames.length}f)`);
  for (let f = 0; f < Math.min(def.frames.length, 4); f++) {
    const ox = c * cellW + f * CELL + Math.floor((CELL - def.w) / 2);
    const oy = r * CELL + Math.floor((CELL - def.h) / 2);
    blit(def, f, ox, oy);
  }
});

// --- minimal PNG encoder ---
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
const raw = new Uint8Array((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  raw.set(px.subarray(y * W * 4, (y + 1) * W * 4), y * (W * 4 + 1) + 1);
}
const ihdr = new Uint8Array(13);
const dv = new DataView(ihdr.buffer);
dv.setUint32(0, W);
dv.setUint32(4, H);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', new Uint8Array(0)),
]);
mkdirSync('tools/output', { recursive: true });
const out = `tools/output/sprites-${prefix ? prefix.replace(/[^a-z0-9]/gi, '_') : 'all'}.png`;
writeFileSync(out, png);
console.log(`wrote ${out} (${W}x${H}), ${ids.length} sprites`);
for (const line of index) console.log(line);
