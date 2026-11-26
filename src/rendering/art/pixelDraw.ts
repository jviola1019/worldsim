/** Author-time raster helpers for the effect sprites (effects.ts, effects_disaster.ts). */
// ---------------------------------------------------------------- author-time raster helpers
// Small generators used to build the geometric effects (fireballs, clouds, rings). They run once
// at module load and produce ordinary palette-key rows.
export type Canvas = string[][];
export type Blob = [cx: number, cy: number, r: number];
/** Cel-shading tones for cloud(): outline, shadow, main, light. */
export interface Tones {
  o?: string;
  s: string;
  m: string;
  l: string;
}

export const canvas = (w: number, h: number): Canvas => Array.from({ length: h }, () => Array<string>(w).fill('.'));
export const rowsOf = (c: Canvas): string[] => c.map((r) => r.join(''));

export function plot(c: Canvas, x: number, y: number, ch: string): void {
  if (y >= 0 && y < c.length && x >= 0 && x < c[0].length) c[y][x] = ch;
}
export function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  if (rx <= 0 || ry <= 0) return false;
  const dx = (x + 0.5 - cx) / rx;
  const dy = (y + 0.5 - cy) / ry;
  return dx * dx + dy * dy <= 1;
}
export function fillEllipse(c: Canvas, cx: number, cy: number, rx: number, ry: number, ch: string): void {
  for (let y = 0; y < c.length; y++)
    for (let x = 0; x < c[0].length; x++) if (inEllipse(x, y, cx, cy, rx, ry)) c[y][x] = ch;
}
/** 1px ellipse outline; `ch` may pick a color per pixel (null = skip). */
export function strokeEllipse(
  c: Canvas,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  ch: string | ((x: number, y: number) => string | null),
): void {
  const inside = (x: number, y: number) => inEllipse(x, y, cx, cy, rx, ry);
  for (let y = 0; y < c.length; y++)
    for (let x = 0; x < c[0].length; x++) {
      if (!inside(x, y)) continue;
      if (inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1)) continue;
      const v = typeof ch === 'string' ? ch : ch(x, y);
      if (v) c[y][x] = v;
    }
}
/** Cartoon cloud / fireball: union of round blobs, lit from the top-left. */
export function cloud(c: Canvas, blobs: Blob[], t: Tones): void {
  if (t.o) for (const [x, y, r] of blobs) fillEllipse(c, x, y, r + 1, r + 1, t.o);
  for (const [x, y, r] of blobs) fillEllipse(c, x, y, r, r, t.s);
  for (const [x, y, r] of blobs) fillEllipse(c, x - 0.6, y - 0.8, r - 0.8, r - 0.8, t.m);
  for (const [x, y, r] of blobs) fillEllipse(c, x - 1.2, y - 1.5, r * 0.45, r * 0.45, t.l);
}

export const FIRE: Tones = { o: 'n', s: 'f', m: 'F', l: 'O' };
export const BURN: Tones = { o: 'm', s: 'f', m: 'F', l: 'O' };
export const EMBER: Tones = { o: 'r', s: 'm', m: 'n', l: 'f' };
export const SMOKE: Tones = { o: '2', s: '3', m: '4', l: '5' };
export const DUST: Tones = { o: '3', s: '4', m: '5', l: '6' };
export const HAZE: Tones = { s: '3', m: '4', l: '5' };

