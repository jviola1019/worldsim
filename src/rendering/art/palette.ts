/**
 * EPOCH master palette.
 *
 * Every pixel-art sprite in the game is authored as rows of single-character
 * palette keys. Keeping the whole game on one curated palette is what makes
 * terrain, buildings, units and UI icons read as a single coherent style.
 *
 * '.' is transparent. 'T', 'U', 'V' are TEAM COLOR keys: they are replaced at
 * runtime with the owning civilization's main / dark / light colors (banners,
 * roofs, uniforms, flags). Sprites rendered without an owner use the neutral
 * fallback colors defined below.
 */
export const PALETTE: Readonly<Record<string, string>> = {
  // neutrals / outline
  '0': '#120d17', // outline, deepest shadow
  '1': '#2b2534', // very dark gray
  '2': '#4b4455', // dark gray
  '3': '#716a7a', // gray
  '4': '#9d96a3', // light gray
  '5': '#c8c2c9', // pale gray
  '6': '#edeaec', // near white
  '7': '#ffffff', // white
  // browns (wood, earth, leather)
  a: '#2f1c13',
  b: '#51301e',
  c: '#794a2b',
  d: '#a16a3b',
  e: '#c99159',
  // stone
  s: '#6e655a',
  t: '#978c7c',
  u: '#c3b8a3',
  // greens
  g: '#15392a', // darkest green (forest shadow)
  h: '#23592f', // dark green
  i: '#3a8238', // green
  j: '#6aac47', // light green
  k: '#a6d264', // pale green / grass highlight
  l: '#d9ec96', // lime highlight
  K: '#2a4a3a', // muted teal (taiga, swamp)
  X: '#5c7a46', // olive (steppe, savanna)
  Y: '#8a9a5a', // dry olive
  // blues / water
  w: '#0e2449', // deep ocean
  x: '#173f78', // ocean
  y: '#2b6cb0', // water
  z: '#4fa3dc', // shallow water
  q: '#9fdcf0', // foam, ice highlight
  // reds / oranges / yellows
  r: '#5e1620', // dark red
  m: '#9b2730', // red
  n: '#d34a3b', // bright red
  f: '#e8762b', // orange (fire)
  F: '#f6a945', // light orange
  o: '#e8c034', // gold / yellow
  O: '#f8e889', // pale yellow
  // purples
  p: '#3a2550',
  P: '#6b3f8f',
  Q: '#a77fcf',
  // skin tones
  S: '#f2c7a0',
  D: '#c78f63',
  E: '#7d5236',
  // sand
  A: '#efdfa8',
  B: '#d7bd78',
  C: '#a88a4b',
  // steel / glass / tech
  M: '#4b5a6b',
  N: '#7d93a8',
  L: '#b6c8d8',
  G: '#3fd6e0', // cyan glow
  H: '#b9fbff', // bright glow
  // team color placeholders (neutral fallbacks)
  T: '#c9463d',
  U: '#7a2620',
  V: '#ef8a72',
};

export const TEAM_KEYS = ['T', 'U', 'V'] as const;

/** Parse '#rrggbb' to packed 0xAABBGGRR (little-endian ImageData friendly). */
export function hexToRgba32(hex: string, alpha = 255): number {
  const v = parseInt(hex.slice(1), 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  return ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Derive dark/light team shades from a main civ color. */
export function teamShades(mainHex: string): { T: string; U: string; V: string } {
  const [r, g, b] = hexToRgb(mainHex);
  return {
    T: mainHex,
    U: rgbToHex(r * 0.55, g * 0.55, b * 0.6),
    V: rgbToHex(r + (255 - r) * 0.45, g + (255 - g) * 0.45, b + (255 - b) * 0.45),
  };
}
