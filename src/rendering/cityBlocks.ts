/**
 * Close-up city blocks (round 6). Pure functions: one tile's real data in, a 32×32 draw plan out.
 *
 * A map tile is a whole district (~10 km across). At close zoom each city district is drawn as a
 * block: streets on the edges that face other blocks, plots with open ground between buildings,
 * yards, trees, and a share of shops, gyms, cafés, clinics and other amenities that grows with the
 * settlement's size band and leans with the owner's ethos. Everything comes from simulation state
 * plus a tile hash; nothing here touches sim.rng, so drawing never changes history.
 */
import type { Sim } from '../sim/context';
import type { TileMap } from '../world/tilemap';
import { BLDF } from '../world/tilemap';
import { B } from '../civilizations/buildingTypes';
import { BUILDINGS } from '../civilizations/buildings';
import type { EthosKey } from '../civilizations/ethos';
import { hash3 } from '../core/rng';
import { DX8, DY8 } from '../core/math';

export const BLOCK = 32;

export type SizeBand = 'village' | 'town' | 'city' | 'metropolis';
export type NeighbourKind = 'built' | 'water' | 'open' | 'farm';

export const AMENITY_KINDS = [
  'firepit', 'granary', 'shrine', 'bakery', 'tavern', 'smithy', 'bathhouse', 'training', 'cafe', 'pharmacy', 'school', 'boxinggym',
  'grocery', 'gym', 'clinic', 'cinema', 'garage', 'vertfarm', 'dronepad', 'wellness',
] as const;
export type AmenityKind = (typeof AMENITY_KINDS)[number];
export type LotKind = 'hut' | 'house' | 'rowhouse' | 'apartment' | 'tower' | 'shop' | 'office' | 'warehouse' | 'civic' | 'industry' | 'park' | AmenityKind;

export interface BlockContext {
  b: number;
  tier: number;
  band: SizeBand;
  ethos?: EthosKey;
  color?: string;
  /** Neighbour kinds in DX8 order: E, SE, S, SW, W, NW, N, NE. */
  nb: NeighbourKind[];
  road: number;
  h: number;
}

export interface Lot {
  x: number; y: number; w: number; h: number; kind: LotKind; sprite: string; yard: 'grass' | 'dirt' | 'paved' | 'garden';
  /** Draw the district's own map sprite (×2) instead of `sprite`: civic buildings and industry keep their identity. */
  mapSprite?: boolean;
}
export interface Feature { x: number; y: number; w: number; h: number; kind: 'field' | 'parking' | 'yard' | 'court' }
export interface StreetSeg { x: number; y: number; w: number; h: number; surface: 'dirt' | 'cobble' | 'paved'; sidewalk: boolean }
export interface BlockPlan {
  ground: string;
  streets: StreetSeg[];
  edges: { side: 0 | 1 | 2 | 3; kind: 'fence' | 'hedge' | 'wall' | 'quay' }[];
  lots: Lot[];
  /** Grounds of civic and industrial blocks: sports fields, car parks, work yards, courtyards. */
  features: Feature[];
  trees: { x: number; y: number; size: 0 | 1 | 2 }[];
}

/** Paved, cobbled, dirt, sidewalk and lane-mark colours (also used by the e2e pixel samplers). */
export const STREET_COLORS = ['#55535a', '#8a8580', '#a08660', '#b9b4ab', '#e8d27a'] as const;
const SURFACE_COLOR: Record<StreetSeg['surface'], string> = { paved: STREET_COLORS[0], cobble: STREET_COLORS[1], dirt: STREET_COLORS[2] };
export const streetColor = (s: StreetSeg['surface']): string => SURFACE_COLOR[s];

export function sizeBand(pop: number): SizeBand {
  return pop < 2000 ? 'village' : pop < 20000 ? 'town' : pop < 200000 ? 'city' : 'metropolis';
}

const SHARE: Record<SizeBand, number> = { village: 0.05, town: 0.12, city: 0.2, metropolis: 0.3 };
export function amenityShare(band: SizeBand): number {
  return SHARE[band];
}

/** Amenity era band: tiers 0–1, 2–3 (classical and medieval), 4–5, 6, 7. */
export function tierBand(tier: number): number {
  return tier <= 1 ? 0 : tier <= 3 ? 1 : tier <= 5 ? 2 : tier === 6 ? 3 : 4;
}

export const AMENITIES_BY_TIER: readonly (readonly AmenityKind[])[] = [
  ['firepit', 'granary', 'shrine'],
  ['bakery', 'tavern', 'smithy', 'bathhouse', 'training'],
  ['cafe', 'pharmacy', 'school', 'boxinggym', 'bakery', 'tavern'],
  ['grocery', 'cafe', 'gym', 'clinic', 'cinema', 'garage'],
  ['vertfarm', 'dronepad', 'wellness', 'cafe', 'clinic', 'gym'],
];

/** How much each ethos favours an amenity (default 1). */
const ETHOS_BIAS: Partial<Record<EthosKey, Partial<Record<LotKind, number>>>> = {
  mercantile: { shop: 1.6, grocery: 1.6, cafe: 1.6, bakery: 1.4, tavern: 1.4, cinema: 1.3 },
  egalitarian: { clinic: 1.6, school: 1.6, pharmacy: 1.4, wellness: 1.4, bathhouse: 1.3 },
  militarist: { training: 1.8, boxinggym: 1.8, gym: 1.8, smithy: 1.4 },
  theocratic: { shrine: 1.8 },
  technocratic: { dronepad: 1.6, school: 1.3 },
  artistic: { cinema: 1.6, cafe: 1.3 },
};

/** Sprite variants per lot kind (Task 2 authors lot.<kind>.<band>.<v> for v < count). */
export const LOT_VARIANTS: Readonly<Record<string, number>> = { house: 3, rowhouse: 2, apartment: 2, hut: 2, shop: 2, office: 2 };

/** Sprite era band letter: a = tiers 0–2, b = 3–4, c = 5–6, d = 7. */
export function lotBand(tier: number): 'a' | 'b' | 'c' | 'd' {
  return tier <= 2 ? 'a' : tier <= 4 ? 'b' : tier <= 6 ? 'c' : 'd';
}

export function lotSprite(kind: LotKind, tier: number, h: number): string {
  return `lot.${kind}.${lotBand(tier)}.${h % (LOT_VARIANTS[kind] ?? 1)}`;
}

const DETAIL_CATS = new Set(['residential', 'commerce', 'civic', 'industry', 'energy']);
const NEVER = new Set<number>([B.NONE, B.RUINS, B.CONSTRUCTION, B.CRATER]);

/** True for city districts drawn as close-up blocks (anchor tiles only). */
export function isDetailTile(m: TileMap, i: number): boolean {
  const b = m.bld[i];
  if (!b || NEVER.has(b) || !m.settle[i] || m.bldFlags[i] & BLDF.PART) return false;
  return b === B.PARK || DETAIL_CATS.has(BUILDINGS[b].category);
}

function neighbourKind(m: TileMap, x: number, y: number): NeighbourKind {
  if (!m.inBounds(x, y)) return 'open';
  const j = m.idx(x, y);
  if (m.isWater(j)) return 'water';
  const b = m.bld[j];
  if (!b || b === B.PARK || NEVER.has(b)) return 'open';
  return BUILDINGS[b].category === 'food' ? 'farm' : 'built';
}

export function blockContext(sim: Sim, i: number): BlockContext | null {
  const m = sim.w.map;
  if (!isDetailTile(m, i)) return null;
  const x = m.xOf(i), y = m.yOf(i);
  const s = sim.w.settlements.get(m.settle[i]);
  const civ = m.owner[i] ? sim.w.civs.get(m.owner[i]) : undefined;
  const nb: NeighbourKind[] = [];
  for (let d = 0; d < 8; d++) nb.push(neighbourKind(m, x + DX8[d], y + DY8[d]));
  return {
    b: m.bld[i],
    tier: m.bldFlags[i] & BLDF.TIER_MASK,
    band: sizeBand(s?.pop ?? 0),
    ethos: civ?.ethos?.key,
    color: civ?.color,
    nb,
    road: m.roadTier(i),
    h: hash3(x, y, 61),
  };
}

const BANDS: SizeBand[] = ['village', 'town', 'city', 'metropolis'];
const KINDS: NeighbourKind[] = ['built', 'water', 'open', 'farm'];
/** Cheap signature of everything that shapes a block except its tile hash. */
export function blockSignature(c: BlockContext): number {
  let s = c.b * 31 + c.tier;
  s = s * 7 + BANDS.indexOf(c.band);
  s = (s * 13 + (c.ethos ? c.ethos.length * 31 + c.ethos.charCodeAt(0) : 0)) | 0;
  for (const k of c.nb) s = (s * 5 + KINDS.indexOf(k)) | 0;
  return (s * 7 + c.road) >>> 0;
}

// ------------------------------------------------------------------- composition

const rnd = (c: BlockContext, salt: number) => hash3(c.h, salt, 977) / 4294967296;

function streetFor(tier: number): { w: number; surface: StreetSeg['surface']; sidewalk: boolean } {
  return tier <= 2 ? { w: 3, surface: 'dirt', sidewalk: false } : tier <= 4 ? { w: 4, surface: 'cobble', sidewalk: false } : { w: 6, surface: 'paved', sidewalk: true };
}

type Layout = { kind: LotKind; cols: number; rows: number; shared?: boolean; yard: Lot['yard'] };

function layoutFor(c: BlockContext): Layout {
  const { b, tier } = c;
  const yardRes: Lot['yard'] = tier < 2 ? 'dirt' : tier <= 4 ? 'garden' : 'grass';
  switch (b) {
    case B.CAMP: case B.HUT: return tier <= 1 ? { kind: 'hut', cols: 2, rows: 2, yard: 'dirt' } : { kind: 'house', cols: 3, rows: 2, yard: yardRes };
    case B.HOUSE: return tier <= 1 ? { kind: 'hut', cols: 2, rows: 2, yard: 'dirt' } : tier <= 4 ? { kind: 'house', cols: 3, rows: 2, yard: yardRes } : { kind: 'house', cols: 2, rows: 2, yard: 'grass' };
    case B.SUBURB: return { kind: 'house', cols: 2, rows: 2, yard: 'grass' };
    case B.TOWNHOUSE: case B.TENEMENT: return tier <= 1 ? { kind: 'hut', cols: 2, rows: 2, yard: 'dirt' } : { kind: 'rowhouse', cols: 4, rows: 2, shared: true, yard: tier <= 4 ? 'garden' : 'paved' };
    case B.APARTMENT: return { kind: 'apartment', cols: 2, rows: 1, yard: tier >= 5 ? 'paved' : 'garden' };
    case B.TOWER: case B.ARCOLOGY: return { kind: 'tower', cols: 1, rows: 1, yard: 'paved' };
    case B.MARKET: return { kind: 'shop', cols: 2, rows: 2, yard: tier >= 3 ? 'paved' : 'dirt' };
    case B.BANK: case B.OFFICE: return { kind: 'office', cols: 2, rows: 1, yard: 'paved' };
    case B.WAREHOUSE: return { kind: 'warehouse', cols: 1, rows: 1, yard: 'paved' };
    case B.PARK: return { kind: 'park', cols: 1, rows: 1, yard: 'grass' };
  }
  const cat = BUILDINGS[b].category;
  if (cat === 'industry' || cat === 'energy') return { kind: 'industry', cols: 1, rows: 1, yard: 'paved' };
  if (cat === 'commerce') return { kind: 'shop', cols: 2, rows: 1, yard: 'paved' };
  if (cat === 'residential') return { kind: 'house', cols: 2, rows: 2, yard: yardRes };
  return { kind: 'civic', cols: 1, rows: 1, yard: tier >= 2 ? 'grass' : 'dirt' };
}

function pickAmenity(c: BlockContext, salt: number): AmenityKind | null {
  const list = AMENITIES_BY_TIER[tierBand(c.tier)];
  const bias = (c.ethos && ETHOS_BIAS[c.ethos]) || {};
  let total = 0;
  const w = list.map((k) => (bias[k] ?? 1));
  for (const x of w) total += x;
  // the ethos also raises how often its favoured places appear at all
  const p = amenityShare(c.band) * (total / list.length);
  if (rnd(c, salt) >= p) return null;
  let r = rnd(c, salt + 500) * total;
  for (let k = 0; k < list.length; k++) {
    r -= w[k];
    if (r < 0) return list[k];
  }
  return list[list.length - 1];
}

function groundFor(c: BlockContext, yard: Lot['yard']): string {
  return yard === 'paved' ? '#8c8a86' : yard === 'dirt' ? '#9a8660' : yard === 'garden' ? '#7d8f52' : '#6f9a4e';
}

export function composeBlock(c: BlockContext): BlockPlan {
  const plan: BlockPlan = { ground: '', streets: [], edges: [], lots: [], features: [], trees: [] };
  const st = streetFor(c.tier);
  const grid = c.tier >= 5;
  // E and S streets are owned by this block; W and N streets belong to the neighbour on that side.
  const side = [c.nb[0], c.nb[2], c.nb[4], c.nb[6]];
  let ux0 = 0, uy0 = 0, ux1 = BLOCK, uy1 = BLOCK;
  if (side[0] === 'built') { plan.streets.push({ x: BLOCK - st.w, y: 0, w: st.w, h: BLOCK, ...pick(st) }); ux1 = BLOCK - st.w; }
  if (side[1] === 'built') { plan.streets.push({ x: 0, y: BLOCK - st.w, w: BLOCK, h: st.w, ...pick(st) }); uy1 = BLOCK - st.w; }
  for (let s = 0 as 0 | 1 | 2 | 3; s < 4; s = (s + 1) as 0 | 1 | 2 | 3) {
    const k = side[s];
    if (k === 'water') plan.edges.push({ side: s, kind: 'quay' });
    else if (k === 'open' || k === 'farm') plan.edges.push({ side: s, kind: c.tier >= 3 && (c.h >> s) & 1 ? 'fence' : 'hedge' });
  }
  // keep 1 px clear of every edge that has no street of ours (fences, the neighbour's street)
  if (side[0] !== 'built') ux1 -= 1;
  if (side[1] !== 'built') uy1 -= 1;
  ux0 += 1;
  uy0 += 1;
  if (grid) { ux0 += ux0 & 1; uy0 += uy0 & 1; ux1 -= ux1 & 1; uy1 -= uy1 & 1; }
  const L = layoutFor(c);
  plan.ground = groundFor(c, L.yard);
  if (L.kind === 'civic' || L.kind === 'industry') {
    groundsBlock(c, plan, L, ux0, uy0, ux1, uy1, grid);
    return plan;
  }
  const gapX = L.shared ? 0 : 2, gapRow = 2;
  const W = ux1 - ux0, H = uy1 - uy0;
  const cw = Math.floor((W - gapX * (L.cols - 1)) / L.cols / 2) * 2;
  const ch = Math.floor((H - gapRow * (L.rows - 1)) / L.rows / 2) * 2;
  let n = 0;
  for (let r = 0; r < L.rows; r++)
    for (let q = 0; q < L.cols; q++, n++) {
      let x = ux0 + q * (cw + gapX), y = uy0 + r * (ch + gapRow), w = cw, h = ch;
      if (!grid) {
        // organic plots: shrink-only jitter keeps the gaps
        const jx = (c.h >> (n * 2)) & 1, jy = (c.h >> (n * 2 + 1)) & 1;
        x += jx; w -= jx + ((c.h >> (n + 9)) & 1 && !L.shared ? 1 : 0);
        y += jy; h -= jy;
      }
      let kind: LotKind = L.kind;
      if (kind === 'house' || kind === 'rowhouse' || kind === 'apartment' || kind === 'shop' || kind === 'hut') {
        const a = pickAmenity(c, 100 + n);
        if (a) kind = a;
      }
      if (L.shared && kind !== 'rowhouse') {
        // an amenity inside a terrace keeps a 1 px passage either side
        x += 1;
        w -= 2;
      }
      if (w < 4 || h < 4) continue;
      const vh = hash3(c.h, n, 41);
      plan.lots.push({ x, y, w, h, kind, sprite: lotSprite(kind, c.tier, vh), yard: L.yard });
      if ((kind === 'house' || kind === 'apartment' || kind === 'park') && c.tier >= 2 && (vh & 3) !== 0) plan.trees.push({ x: x + 1 + (vh % Math.max(1, w - 2)), y: y + 2, size: ((vh >> 3) % 3) as 0 | 1 | 2 });
    }
  if (L.kind === 'park') for (let t = 0; t < 5; t++) {
    const th = hash3(c.h, t, 43);
    plan.trees.push({ x: ux0 + (th % Math.max(1, W)), y: uy0 + ((th >> 8) % Math.max(1, H)), size: ((th >> 16) % 3) as 0 | 1 | 2 });
  }
  return plan;
}

const FIELD_CIVIC = new Set<number>([B.SCHOOL, B.UNIVERSITY, B.LIBRARY]);
const PARK_CIVIC = new Set<number>([B.HOSPITAL, B.LAB, B.DATA_CENTER]);

/** One main building on its grounds: fields for schools, car parks for hospitals, courts for temples, yards for industry. */
function groundsBlock(c: BlockContext, plan: BlockPlan, L: Layout, ux0: number, uy0: number, ux1: number, uy1: number, grid: boolean): void {
  const W = ux1 - ux0, H = uy1 - uy0;
  let mw = Math.max(8, Math.round((W * 0.56) / 2) * 2);
  if (!grid) mw -= (c.h & 1);
  const main: Lot = { x: ux0, y: uy0, w: mw, h: H, kind: L.kind, sprite: lotSprite(L.kind, c.tier, c.h), yard: L.yard, mapSprite: true };
  plan.lots.push(main);
  const fx = ux0 + mw + 2, fw = ux1 - fx;
  if (fw < 4) return;
  const modern = c.tier >= 5;
  if (L.kind === 'industry') {
    if (modern) {
      const hh = Math.floor((H - 2) / 2);
      plan.features.push({ x: fx, y: uy0, w: fw, h: hh, kind: 'yard' }, { x: fx, y: uy0 + hh + 2, w: fw, h: H - hh - 2, kind: 'parking' });
    } else plan.features.push({ x: fx, y: uy0, w: fw, h: H, kind: 'yard' });
    return;
  }
  if (FIELD_CIVIC.has(c.b) && c.tier >= 2) plan.features.push({ x: fx, y: uy0, w: fw, h: H, kind: 'field' });
  else if (PARK_CIVIC.has(c.b) && modern) plan.features.push({ x: fx, y: uy0, w: fw, h: H, kind: 'parking' });
  else {
    plan.features.push({ x: fx, y: uy0, w: fw, h: H, kind: 'court' });
    for (let t = 0; t < 2; t++) plan.trees.push({ x: fx + 1 + ((c.h >> (t * 4)) % Math.max(1, fw - 2)), y: uy0 + 2 + t * Math.max(2, (H >> 1)), size: 1 });
  }
}

function pick(st: { surface: StreetSeg['surface']; sidewalk: boolean }): Pick<StreetSeg, 'surface' | 'sidewalk'> {
  return { surface: st.surface, sidewalk: st.sidewalk };
}
