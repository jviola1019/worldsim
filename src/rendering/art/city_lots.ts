/**
 * Close-up city lot sprites (round 6): lot.<kind>.<band>.<variant> and street props (lot.tree.n,
 * lot.fence.h/v, lot.hedge.h/v, lot.pool.0, lot.car.h/v.n, lot.bench.0, lot.lamp.0, lot.fountain.0).
 *
 * These are drawn at DETAIL scale (4 detail px per map art px), so a house is 8–10 px wide on a
 * 32 px block. Every sprite is generated here from small shape builders into the usual palette-key
 * rows, so it validates and rasterizes like the hand-authored sheets. Era bands follow cityBlocks.ts:
 * a = tiers 0–2, b = 3–4, c = 5–6, d = 7. The nation colour (T/U/V) appears only as an accent:
 * awning stripes, a door, a flag or a sign (kept under 15% of opaque pixels by test).
 */
import { S, type SpriteSheet } from './types';

type Band = 'a' | 'b' | 'c' | 'd';
const BANDS: Band[] = ['a', 'b', 'c', 'd'];

class G {
  g: string[][];
  constructor(public w: number, public h: number) {
    this.g = Array.from({ length: h }, () => Array(w).fill('.'));
  }
  set(x: number, y: number, c: string): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y][x] = c;
    return this;
  }
  rect(x: number, y: number, w: number, h: number, c: string): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
    return this;
  }
  /** Filled rectangle with a dark outline. */
  box(x: number, y: number, w: number, h: number, fill: string, line = '0'): this {
    this.rect(x, y, w, h, line);
    if (w > 2 && h > 2) this.rect(x + 1, y + 1, w - 2, h - 2, fill);
    return this;
  }
  /** Gabled roof over [x, x+w) whose eaves sit on row `base`. */
  gable(x: number, w: number, base: number, fill: string, ridge: string): this {
    const rows = Math.ceil(w / 2);
    for (let r = 0; r < rows; r++) {
      const y = base - r;
      const x0 = x + r, x1 = x + w - 1 - r;
      if (x0 > x1 || y < 0) break;
      for (let i = x0; i <= x1; i++) this.set(i, y, i === x0 || i === x1 ? '0' : r === rows - 1 ? ridge : fill);
    }
    return this;
  }
  /** Window grid inside a facade. */
  windows(x: number, y: number, w: number, h: number, c: string, stepX = 2, stepY = 2): this {
    for (let j = y; j < y + h; j += stepY) for (let i = x; i < x + w; i += stepX) this.set(i, j, c);
    return this;
  }
  rows(): string[] {
    return this.g.map((r) => r.join(''));
  }
}

/** Material set by era band: wall, wall shade, roof, roof ridge, window, door. */
const MAT: Record<Band, { wall: string; shade: string; roof: string; ridge: string; win: string; door: string }> = {
  a: { wall: 'u', shade: 't', roof: 'e', ridge: 'd', win: 'c', door: 'b' },
  b: { wall: 'u', shade: 't', roof: 'm', ridge: 'r', win: '2', door: 'c' },
  c: { wall: 'A', shade: 'B', roof: '2', ridge: '1', win: 'L', door: 'c' },
  d: { wall: '6', shade: '5', roof: 'N', ridge: 'M', win: 'G', door: '3' },
};
const ROOF_VARIANTS: Record<Band, string[]> = { a: ['e', 'd', 'C'], b: ['m', 's', 'c'], c: ['2', 'm', 'M'], d: ['N', 'i', '5'] };
const WALL_VARIANTS: Record<Band, string[]> = { a: ['u', 'B', 't'], b: ['u', 'A', 't'], c: ['A', '5', 'e'], d: ['6', 'L', '5'] };

function house(band: Band, v: number): string[] {
  const m = MAT[band];
  const w = band === 'a' || band === 'b' ? 8 : 10;
  const g = new G(w, 9);
  const wall = WALL_VARIANTS[band][v % 3], roof = ROOF_VARIANTS[band][v % 3];
  g.box(0, 4, w, 5, wall);
  g.gable(0, w, 4, roof, m.ridge);
  g.set(Math.floor(w / 2), 7, m.door).set(Math.floor(w / 2), 6, m.door);
  g.set(2, 6, m.win).set(w - 3, 6, m.win);
  g.set(Math.floor(w / 2), 8, 'T'); // doorstep mat in the nation's colour
  if (band !== 'a' && v === 1) g.rect(w - 3, 1, 1, 2, '2'); // chimney
  return g.rows();
}

function hut(_band: Band, v: number): string[] {
  const g = new G(8, 7);
  const f = v ? 'd' : 'e';
  g.rect(2, 1, 4, 1, '0').rect(1, 2, 6, 1, '0').rect(0, 3, 8, 4, '0');
  g.rect(2, 2, 4, 1, f).rect(1, 3, 6, 3, f);
  g.rect(3, 4, 2, 2, 'b').set(4, 0, 'T');
  return g.rows();
}

function rowhouse(band: Band, v: number): string[] {
  const m = MAT[band];
  const g = new G(6, 12);
  const wall = WALL_VARIANTS[band][v % 3];
  g.box(0, 3, 6, 9, wall);
  g.gable(0, 6, 3, ROOF_VARIANTS[band][(v + 1) % 3], m.ridge);
  g.windows(2, 5, 3, 4, m.win, 2, 2);
  g.rect(2, 10, 1, 1, m.door).set(3, 10, v ? 'T' : m.door);
  return g.rows();
}

function apartment(band: Band, v: number): string[] {
  const m = MAT[band];
  const h = band === 'a' ? 10 : band === 'b' ? 12 : 14;
  const g = new G(10, h);
  g.box(0, 1, 10, h - 1, WALL_VARIANTS[band][v % 3]);
  g.rect(0, 0, 10, 1, '0').rect(1, 1, 8, 1, m.roof);
  g.windows(2, 3, 7, h - 6, m.win, 2, 2);
  g.rect(4, h - 3, 2, 2, m.door).set(5, 1, 'T');
  return g.rows();
}

function tower(band: Band): string[] {
  const m = MAT[band];
  const w = band === 'a' ? 12 : band === 'b' ? 14 : band === 'c' ? 16 : 18;
  const h = band === 'a' ? 18 : 28;
  const g = new G(w, h);
  if (band === 'a' || band === 'b') {
    // stepped stone keep
    g.box(2, 0, w - 4, 6, m.shade).box(0, 5, w, h - 5, m.wall);
    g.windows(3, 8, w - 5, h - 11, '1', 3, 3).rect(Math.floor(w / 2) - 1, h - 4, 2, 4, m.door).set(Math.floor(w / 2), 0, 'T');
  } else {
    g.box(0, 2, w, h - 2, band === 'c' ? 'N' : 'L').rect(0, 0, w, 2, '0').rect(Math.floor(w / 2), 0, 1, 2, 'T');
    g.windows(2, 4, w - 3, h - 7, band === 'c' ? 'L' : 'H', 2, 2).rect(Math.floor(w / 2) - 1, h - 3, 3, 2, '2');
  }
  return g.rows();
}

/** A storefront: awning stripes alternate nation colour and white (an accent, not a fill). */
function shop(band: Band, v: number): string[] {
  const m = MAT[band];
  const g = new G(10, 9);
  g.box(0, 2, 10, 7, WALL_VARIANTS[band][v % 3]).rect(0, 0, 10, 2, '0');
  g.rect(1, 1, 8, 1, m.roof);
  if (band === 'a') {
    g.rect(1, 3, 8, 1, 'e'); // cloth over a stall
  } else for (let i = 1; i < 9; i++) g.set(i, 3, i % 2 ? 'T' : '6');
  g.rect(2, 5, 3, 2, m.win).rect(6, 5, 2, 3, m.door);
  return g.rows();
}

function office(band: Band, v: number): string[] {
  const m = MAT[band];
  const g = new G(10, band === 'a' ? 10 : 14);
  const h = g.h;
  g.box(0, 1, 10, h - 1, band === 'c' || band === 'd' ? (v ? 'N' : 'L') : WALL_VARIANTS[band][v % 3]).rect(0, 0, 10, 1, '0');
  g.windows(2, 3, 7, h - 6, band === 'd' ? 'H' : m.win, 2, 2).rect(4, h - 3, 2, 2, m.door).set(9, 0, 'T');
  return g.rows();
}

function warehouse(band: Band): string[] {
  const m = MAT[band];
  const g = new G(20, 10);
  g.box(0, 3, 20, 7, m.shade).gable(0, 20, 3, band === 'a' ? 'e' : 's', m.ridge);
  for (let i = 3; i < 18; i += 5) g.rect(i, 6, 3, 4, '2');
  g.set(1, 4, 'T');
  return g.rows();
}

function civic(band: Band): string[] {
  const m = MAT[band];
  const g = new G(16, 14);
  g.gable(0, 16, 5, band === 'a' ? 'e' : 'u', m.ridge);
  g.box(0, 5, 16, 9, band === 'd' ? '6' : 'u').rect(0, 12, 16, 2, 't');
  for (let i = 2; i < 15; i += 3) g.rect(i, 6, 1, 6, band === 'c' || band === 'd' ? '5' : 't');
  g.rect(7, 9, 2, 3, m.door).rect(8, 0, 1, 2, '2').set(9, 0, 'T');
  return g.rows();
}

function industry(band: Band): string[] {
  const g = new G(18, 16);
  g.box(0, 7, 18, 9, band === 'a' ? 'c' : band === 'd' ? '5' : 's');
  for (let i = 0; i < 18; i += 6) g.gable(i, 6, 7, '2', '1');
  if (band !== 'a') g.box(13, 0, 3, 8, band === 'd' ? 'N' : 'm');
  g.windows(2, 10, 14, 3, band === 'd' ? 'G' : 'o', 3, 3).set(1, 8, 'T');
  return g.rows();
}

/** Park furniture drawn over the grass ground: a winding path and a pond. */
function park(band: Band): string[] {
  const g = new G(20, 16);
  for (let i = 0; i < 20; i++) g.set(i, 8 + Math.round(Math.sin(i / 3) * 2), band === 'a' ? 'C' : 'B');
  g.rect(12, 2, 5, 3, 'y').rect(13, 1, 3, 1, 'y').rect(13, 5, 3, 1, 'y').set(14, 3, 'q');
  if (band === 'c' || band === 'd') g.box(2, 11, 5, 4, 'o', '2').set(4, 12, 'T'); // playground frame
  return g.rows();
}

/** A small amenity building with its sign motif on the facade. */
function amenity(kind: string, band: Band): string[] {
  const m = MAT[band];
  const g = new G(8, 9);
  const open = kind === 'firepit' || kind === 'training' || kind === 'dronepad';
  if (!open) {
    g.box(0, 3, 8, 6, kind === 'clinic' || kind === 'wellness' ? '6' : WALL_VARIANTS[band][kind.length % 3]);
    g.gable(0, 8, 3, kind === 'granary' ? 'e' : m.roof, m.ridge);
    g.rect(3, 7, 2, 2, m.door);
  }
  switch (kind) {
    case 'firepit': g.rect(2, 6, 4, 2, 's').rect(3, 4, 2, 2, 'f').set(3, 3, 'F').set(4, 8, 'T'); break;
    case 'granary': g.rect(1, 4, 6, 1, 'd').set(6, 5, 'T'); break;
    case 'shrine': g.rect(3, 5, 2, 2, 'o').set(4, 4, 'F').set(4, 0, 'T'); break;
    case 'bakery': g.rect(1, 5, 2, 1, 'F').rect(5, 5, 2, 1, 'd').set(6, 4, 'T'); break;
    case 'tavern': g.rect(1, 4, 2, 2, 'o').set(2, 6, '6').set(6, 4, 'T'); break;
    case 'smithy': g.rect(1, 5, 2, 1, '2').set(6, 5, 'f').set(6, 4, 'T'); break;
    case 'bathhouse': for (let i = 1; i < 7; i += 2) g.rect(i, 4, 1, 3, '5'); g.rect(1, 8, 6, 1, 'z').set(4, 1, 'T'); break;
    case 'training': g.rect(0, 8, 8, 1, 'c').rect(0, 5, 1, 3, 'c').rect(7, 5, 1, 3, 'c').rect(3, 3, 2, 5, 'e').set(4, 2, 'T'); break;
    case 'cafe': g.rect(1, 5, 2, 1, '6').set(2, 4, 'c').rect(5, 4, 2, 2, m.win).set(1, 3, 'T').set(2, 3, '6'); break;
    case 'pharmacy': g.rect(5, 4, 1, 3, 'i').rect(4, 5, 3, 1, 'i').set(1, 4, 'T'); break;
    case 'school': g.set(4, 0, 'o').rect(1, 5, 2, 1, m.win).rect(5, 5, 2, 1, m.win).set(4, 1, 'T'); break;
    case 'boxinggym': g.rect(1, 4, 2, 2, 'n').set(6, 4, 'T'); break;
    case 'grocery': g.set(1, 5, 'n').set(2, 5, 'o').set(3, 5, 'j').set(1, 6, 'F').set(2, 6, 'n').set(6, 4, 'T'); break;
    case 'gym': g.rect(2, 5, 4, 1, '1').rect(1, 4, 1, 3, '1').rect(6, 4, 1, 3, '1').set(4, 1, 'T'); break; // dumbbell sign
    case 'clinic': g.rect(4, 4, 1, 3, 'n').rect(3, 5, 3, 1, 'n').set(1, 4, 'T'); break;
    case 'cinema': for (let i = 1; i < 7; i++) g.set(i, 4, i % 2 ? 'o' : 'O'); g.set(4, 1, 'T'); break;
    case 'garage': g.rect(1, 4, 6, 1, '2').rect(1, 6, 6, 1, '2').set(2, 5, 'n').set(5, 5, 'y').set(4, 1, 'T'); break;
    case 'vertfarm': g.rect(1, 4, 6, 1, 'j').rect(1, 6, 6, 1, 'i').set(4, 1, 'T'); break;
    case 'dronepad': g.box(0, 3, 8, 6, '3', '2').rect(2, 4, 1, 4, '6').rect(5, 4, 1, 4, '6').rect(2, 6, 4, 1, '6').set(7, 2, 'T'); break;
    case 'wellness': g.set(2, 5, 'j').set(3, 4, 'i').set(3, 5, 'i').set(6, 4, 'T'); break;
  }
  return g.rows();
}

const AMENITY_BANDS: Record<string, Band[]> = {
  firepit: ['a'], granary: ['a'], shrine: ['a'],
  bakery: ['a', 'b', 'c'], tavern: ['a', 'b', 'c'], smithy: ['a', 'b'], bathhouse: ['a', 'b'], training: ['a', 'b'],
  cafe: ['b', 'c', 'd'], pharmacy: ['b', 'c'], school: ['b', 'c'], boxinggym: ['b', 'c'],
  grocery: ['c'], gym: ['c', 'd'], clinic: ['c', 'd'], cinema: ['c'], garage: ['c'],
  vertfarm: ['d'], dronepad: ['d'], wellness: ['d'],
};

function props(sheet: SpriteSheet): void {
  const tree = (s: number) => {
    const w = 3 + s * 2, h = 4 + s * 2;
    const g = new G(w, h);
    g.rect(1, 0, w - 2, 1, 'h').rect(0, 1, w, h - 3, 'i').rect(1, 1, w - 2, 1, 'j').rect(Math.floor(w / 2), h - 2, 1, 2, 'c');
    return g.rows();
  };
  for (let s = 0; s < 3; s++) sheet[`lot.tree.${s}`] = S(tree(s));
  sheet['lot.fence.h'] = S(['0c0c0c0c', 'cccccccc']);
  sheet['lot.fence.v'] = S(['0', 'c', 'c', '0', 'c', 'c', '0', 'c']);
  sheet['lot.hedge.h'] = S(['ijijijij', 'hhhhhhhh']);
  sheet['lot.hedge.v'] = S(['i', 'h', 'j', 'h', 'i', 'h', 'j', 'h']);
  sheet['lot.pool.0'] = S(['55555', '5zqz5', '5zzz5', '55555']);
  const CAR = ['n', 'y', '6'];
  for (let v = 0; v < 3; v++) {
    sheet[`lot.car.h.${v}`] = S([`.${CAR[v]}${CAR[v]}.`, `${CAR[v]}LL${CAR[v]}`, '0..0']);
    sheet[`lot.car.v.${v}`] = S([`${CAR[v]}${CAR[v]}`, 'LL', `${CAR[v]}${CAR[v]}`, '00']);
  }
  sheet['lot.bench.0'] = S(['ccc', '0.0']);
  sheet['lot.lamp.0'] = S(['O', '2', '2', '2']);
  sheet['lot.fountain.0'] = S(['.ttt.', 'tzqzt', 'tzzzt', '.ttt.']);
}

function build(): SpriteSheet {
  const sheet: SpriteSheet = {};
  for (const band of BANDS) {
    for (let v = 0; v < 3; v++) sheet[`lot.house.${band}.${v}`] = S(house(band, v));
    for (let v = 0; v < 2; v++) {
      sheet[`lot.rowhouse.${band}.${v}`] = S(rowhouse(band, v));
      sheet[`lot.apartment.${band}.${v}`] = S(apartment(band, v));
      sheet[`lot.shop.${band}.${v}`] = S(shop(band, v));
      sheet[`lot.office.${band}.${v}`] = S(office(band, v));
    }
    sheet[`lot.tower.${band}.0`] = S(tower(band));
    sheet[`lot.warehouse.${band}.0`] = S(warehouse(band));
    sheet[`lot.civic.${band}.0`] = S(civic(band));
    sheet[`lot.industry.${band}.0`] = S(industry(band));
    sheet[`lot.park.${band}.0`] = S(park(band));
  }
  for (let v = 0; v < 2; v++) sheet[`lot.hut.a.${v}`] = S(hut('a', v));
  for (const [kind, bands] of Object.entries(AMENITY_BANDS)) for (const band of bands) sheet[`lot.${kind}.${band}.0`] = S(amenity(kind, band));
  props(sheet);
  return sheet;
}

export const CITY_LOT_SPRITES: SpriteSheet = build();
