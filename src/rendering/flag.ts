/**
 * Procedural pixel flags from a civilization's emblem (field division + charge)
 * and its two colors. Flags are 12×8 art pixels, drawn once per (civ colors,
 * emblem) and cached as canvases; the UI uses data URLs of the same canvases.
 * Every flag is generated — no external heraldry is copied.
 */
export interface FlagSpec {
  color: string;
  emblem: { shape: number; symbol: number; c2: string };
}

export const FLAG_W = 12;
export const FLAG_H = 8;

/** 5×5 charges (1 = filled). Index = emblem.symbol (0..11). */
const CHARGES: string[] = [
  '', // 0 none
  '00100,01110,11111,01110,00100', // 1 diamond star
  '01110,11111,11111,11111,01110', // 2 sun disc
  '01110,11000,10000,11000,01110', // 3 crescent
  '10101,01110,11111,01110,10101', // 4 radiant star
  '10101,11111,01110,01110,11111', // 5 tower
  '00100,01110,00100,00100,01110', // 6 sword
  '10001,11011,01110,00100,00100', // 7 horns
  '00100,01010,10001,01010,00100', // 8 ring-diamond
  '01010,11111,11111,01110,00100', // 9 heart
  '00100,00100,11111,00100,00100', // 10 cross
  '11111,10101,11111,00100,01110', // 11 crown-tree
];

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1, 7), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

/** Fill the 12×8 pixel grid for a flag (returns a color per pixel). */
export function flagPixels(f: FlagSpec): string[] {
  const a = f.color;
  let b = f.emblem.c2;
  // keep the two fields distinguishable even when colors collide
  if (Math.abs(luminance(a) - luminance(b)) < 40) b = luminance(a) > 128 ? '#1b2238' : '#ece2c8';
  const px: string[] = new Array(FLAG_W * FLAG_H).fill(a);
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && y >= 0 && x < FLAG_W && y < FLAG_H) px[y * FLAG_W + x] = c;
  };
  for (let y = 0; y < FLAG_H; y++)
    for (let x = 0; x < FLAG_W; x++) {
      switch (f.emblem.shape % 8) {
        case 1: if (y >= 4) set(x, y, b); break; // horizontal bicolor
        case 2: if (x >= 6) set(x, y, b); break; // vertical bicolor
        case 3: if (Math.abs(x * 2 / 3 - y) < 1 || Math.abs((11 - x) * 2 / 3 - y) < 1) set(x, y, b); break; // saltire
        case 4: if (x === 4 || x === 5 || y === 3 || y === 4) set(x, y, b); break; // offset cross
        case 5: if (x < 5 && y < 4) set(x, y, b); break; // canton
        case 6: if (x < 4 - Math.abs(y - 3.5) * 1.1) set(x, y, b); break; // hoist chevron
        case 7: if (x === 0 || y === 0 || x === 11 || y === 7) set(x, y, b); break; // bordure
      }
    }
  const ch = CHARGES[f.emblem.symbol % CHARGES.length];
  if (ch) {
    const rows = ch.split(',');
    // charge sits in the canton for shape 5, centered otherwise; contrast against the pixel under it
    const canton = f.emblem.shape % 8 === 5;
    const ox = canton ? 0 : 4;
    const oy = canton ? 0 : 2;
    for (let y = 0; y < (canton ? 4 : 5); y++)
      for (let x = 0; x < 5; x++) {
        if (rows[y][x] !== '1') continue;
        const under = px[(oy + y) * FLAG_W + ox + x];
        set(ox + x, oy + y, under === b ? a : b);
      }
  }
  // 1px darker trim on the fly edge for depth
  for (let y = 0; y < FLAG_H; y++) {
    const i = y * FLAG_W + FLAG_W - 1;
    px[i] = px[i].startsWith('#') ? shade(px[i], 0.8) : px[i];
  }
  return px;
}

const cache = new Map<string, HTMLCanvasElement>();
const urlCache = new Map<string, string>();

function key(f: FlagSpec): string {
  return `${f.color}|${f.emblem.c2}|${f.emblem.shape}|${f.emblem.symbol}`;
}

/** Cached 12×8 canvas of the flag (1 canvas px per art px). */
export function flagCanvas(f: FlagSpec): HTMLCanvasElement {
  const k = key(f);
  let c = cache.get(k);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = FLAG_W;
  c.height = FLAG_H;
  const ctx = c.getContext('2d')!;
  const px = flagPixels(f);
  for (let i = 0; i < px.length; i++) {
    ctx.fillStyle = px[i];
    ctx.fillRect(i % FLAG_W, Math.floor(i / FLAG_W), 1, 1);
  }
  if (cache.size > 400) cache.clear();
  cache.set(k, c);
  return c;
}

export function flagUrl(f: FlagSpec): string {
  const k = key(f);
  let u = urlCache.get(k);
  if (!u) {
    u = flagCanvas(f).toDataURL();
    urlCache.set(k, u);
  }
  return u;
}
