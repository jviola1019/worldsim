/**
 * Labelled contact sheet of EVERY registered sprite (all frames), grouped by
 * family, for visual review of the pixel art.
 *
 *   npm run sprites:sheet                 -> docs/images/sprites/contact-sheet.png
 *   npm run sprites:sheet -- --split      -> also tools/output/contact-<group>.png per group
 *   npm run sprites:sheet -- --prefix veh. --out tools/output/veh.png
 *   npm run sprites:sheet -- --tint #3a7bd5   (team colour slots tinted with that colour)
 *
 * Node only: sprites go through the same DOM-free rasterizer the game atlas
 * uses (src/rendering/art/raster.ts), labels use tools/pixel-font.ts and the
 * PNG encoder is tools/png.ts, so no browser is needed.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ALL_SPRITES } from '../src/rendering/art/index';
import { PALETTE, teamShades } from '../src/rendering/art/palette';
import { validateSheet } from '../src/rendering/art/types';
import { rasterizeSprite } from '../src/rendering/art/raster';
import { drawText, textWidth, FONT_H } from './pixel-font';
import { encodePng } from './png';
import { SPORTS_VENUES } from '../src/rendering/art/select';

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const OUT = opt('--out') ?? 'docs/images/sprites/contact-sheet.png';
const PREFIX = opt('--prefix') ?? '';
const TINT = opt('--tint');
const SPLIT = args.includes('--split');

const SCALE = Number(opt('--scale') ?? 3); // sprite magnification
const LABEL = 2; // font magnification
const SHEET_W = 1680;
const PAD = 10;

const RES_ORDER = ['CAMP', 'HUT', 'HOUSE', 'TOWNHOUSE', 'TENEMENT', 'APARTMENT', 'SUBURB', 'TOWER', 'ARCOLOGY'];
const RESIDENTIAL = new Set(RES_ORDER);
const GROUP_TITLES: Record<string, string> = {
  ter: 'Terrain tiles (ter.*)',
  mtn: 'Mountains (mtn.*)',
  veg: 'Vegetation (veg.*)',
  unit: 'Units (unit.*)',
  char: 'Characters and jobs (char.*)',
  ani: 'Animals (ani.*)',
  mon: 'Creatures (mon.*)',
  veh: 'Vehicles (veh.*)',
  fx: 'Effects (fx.*)',
  ico: 'Icons (ico.*)',
  'bld.res': 'Housing by tier, with variants (bld.<KEY>.<tier>[b|c|d])',
  'bld.style': 'Housing style sets by ethos (bld.<KEY>.atomic.<n>, bld.<KEY>.eco.<n>)',
  'bld.dist': 'Districts (bld.<KEY>.<tier>)',
  'bld.sport': 'Sports venues (bld.sport.*)',
  'bld.port': 'Ports by era (bld.port.*)',
  'bld.air': 'Airports by era (bld.air.*)',
};
const GROUP_ORDER = ['bld.res', 'bld.style', 'bld.dist', 'bld.sport', 'bld.port', 'bld.air', 'veh', 'char', 'unit', 'ani', 'mon', 'fx', 'ter', 'mtn', 'veg', 'ico'];

function groupOf(id: string): string {
  const parts = id.split('.');
  if (parts[0] !== 'bld') return parts[0];
  if (/^[a-z]/.test(parts[1])) return `bld.${parts[1]}`;
  if (parts.length >= 4) return 'bld.style';
  return RESIDENTIAL.has(parts[1]) ? 'bld.res' : 'bld.dist';
}

/** Natural sort so bld.HOUSE.2 < bld.HOUSE.10 and variants follow their base. */
/** Venues, ports and airports are listed in era order rather than alphabetically. */
const ERA_ORDER = [
  ...SPORTS_VENUES.map((v) => v.id),
  ...['jetty', 'sail_harbour', 'steam', 'container', 'sea_launch'].map((k) => `bld.port.${k}`),
  ...['airfield', 'regional', 'international', 'vertiport', 'spaceplane'].map((k) => `bld.air.${k}`),
];
const natural = (a: string, b: string) => {
  const ea = ERA_ORDER.indexOf(a);
  const eb = ERA_ORDER.indexOf(b);
  if (ea >= 0 && eb >= 0) return ea - eb;
  const ra = RES_ORDER.indexOf(a.split('.')[1] ?? '');
  const rb = RES_ORDER.indexOf(b.split('.')[1] ?? '');
  if (ra >= 0 && rb >= 0 && ra !== rb) return ra - rb;
  return a.localeCompare(b, 'en', { numeric: true });
};

const problems = validateSheet(ALL_SPRITES, PALETTE);
if (problems.length) {
  console.error(`VALIDATION PROBLEMS (${problems.length}):`);
  for (const p of problems.slice(0, 100)) console.error('  ' + p);
  process.exit(1);
}

const team = TINT ? teamShades(TINT) : undefined;
const ids = Object.keys(ALL_SPRITES).filter((id) => id.startsWith(PREFIX));
const groups = new Map<string, string[]>();
for (const id of ids) {
  const g = groupOf(id);
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g)!.push(id);
}
const orderedGroups = [...groups.keys()].sort((a, b) => {
  const ia = GROUP_ORDER.indexOf(a);
  const ib = GROUP_ORDER.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || natural(a, b);
});

interface Cell {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Section {
  title: string;
  y: number;
  cells: Cell[];
}

function cellSize(id: string): [number, number] {
  const d = ALL_SPRITES[id];
  const frames = Math.min(d.frames.length, 4);
  const fw = frames * d.w * SCALE + (frames - 1) * 6;
  const label = textWidth(id) * LABEL;
  return [Math.max(fw, label, 64) + PAD * 2, d.h * SCALE + FONT_H * LABEL + PAD * 3];
}

function layout(groupIds: string[]): { sections: Section[]; height: number } {
  const sections: Section[] = [];
  let y = PAD;
  for (const g of groupIds) {
    const list = groups.get(g)!.sort(natural);
    const sec: Section = { title: `${GROUP_TITLES[g] ?? g}  -  ${list.length} sprites`, y, cells: [] };
    y += FONT_H * 3 + PAD * 2;
    let x = PAD;
    let shelf = 0;
    for (const id of list) {
      const [w, h] = cellSize(id);
      if (x + w > SHEET_W - PAD && x > PAD) {
        x = PAD;
        y += shelf + 4;
        shelf = 0;
      }
      sec.cells.push({ id, x, y, w, h });
      x += w + 4;
      shelf = Math.max(shelf, h);
    }
    y += shelf + PAD * 2;
    sections.push(sec);
  }
  return { sections, height: y };
}

function render(groupIds: string[], out: string): void {
  const { sections, height } = layout(groupIds);
  const W = SHEET_W;
  const H = height;
  const px = new Uint8Array(W * H * 4);
  const fill = (x0: number, y0: number, w: number, h: number, rgb: [number, number, number]) => {
    for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++)
      for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) {
        const i = (y * W + x) * 4;
        px[i] = rgb[0];
        px[i + 1] = rgb[1];
        px[i + 2] = rgb[2];
        px[i + 3] = 255;
      }
  };
  fill(0, 0, W, H, [20, 24, 36]);
  for (const sec of sections) {
    fill(0, sec.y, W, FONT_H * 3 + PAD, [40, 48, 70]);
    drawText(px, W, H, sec.title, PAD, sec.y + 5, 3, [240, 214, 140]);
    for (const c of sec.cells) {
      const d = ALL_SPRITES[c.id];
      const spriteH = d.h * SCALE;
      // checkerboard so transparency and dark outlines both read
      for (let y = c.y; y < c.y + spriteH + PAD * 2; y++)
        for (let x = c.x; x < c.x + c.w; x++) {
          const chk = (Math.floor((x - c.x) / (SCALE * 2)) + Math.floor((y - c.y) / (SCALE * 2))) % 2;
          const v = chk ? 92 : 104;
          fill(x, y, 1, 1, [v, v + 10, v + 4]);
        }
      fill(c.x, c.y + spriteH + PAD * 2, c.w, c.h - spriteH - PAD * 2, [30, 36, 52]);
      const img = rasterizeSprite(d, team);
      const frames = Math.min(d.frames.length, 4);
      const fwTotal = frames * d.w * SCALE + (frames - 1) * 6;
      let ox = c.x + Math.floor((c.w - fwTotal) / 2);
      for (let f = 0; f < frames; f++) {
        for (let y = 0; y < d.h; y++)
          for (let x = 0; x < d.w; x++) {
            const o = (y * img.width + f * d.w + x) * 4;
            if (!img.data[o + 3]) continue;
            fill(ox + x * SCALE, c.y + PAD + y * SCALE, SCALE, SCALE, [img.data[o], img.data[o + 1], img.data[o + 2]]);
          }
        ox += d.w * SCALE + 6;
      }
      drawText(px, W, H, c.id, c.x + Math.floor((c.w - textWidth(c.id) * LABEL) / 2), c.y + spriteH + PAD * 2 + 4, LABEL, [230, 230, 236]);
      if (d.frames.length > 1) drawText(px, W, H, `${d.frames.length}f`, c.x + 3, c.y + 3, 1, [255, 240, 150]);
    }
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, encodePng(W, H, px));
  console.log(`wrote ${out} (${W}x${H}), ${sections.reduce((n, s) => n + s.cells.length, 0)} sprites`);
}

render(orderedGroups, OUT);
if (SPLIT) for (const g of orderedGroups) render([g], `tools/output/contact-${g.replace(/[^a-z0-9]/gi, '_')}.png`);
