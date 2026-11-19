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
  /** Round 7: the owner's living standard (0–3) and inequality (0–4) buckets: they shape the mix of homes. */
  wealth?: number;
  ineq?: number;
  /** Round 7: the settlement's park districts as a share of its city districts, in 2% steps (0–25). */
  parks?: number;
}

/** Round 7: the forms homes take past huts and caves (drawn with the lot sprites, sized by plot). */
export const DWELLING_FORMS = [
  'hut', 'cottage', 'longhouse', 'courtyard', 'villa', 'terrace', 'tenement', 'manor',
  'detached', 'duplex', 'midrise', 'highrise', 'mansion', 'ecopod', 'terraced_tower', 'sky_villa',
] as const;
export type DwellingForm = (typeof DWELLING_FORMS)[number];
export const DWELLING_LABEL: Readonly<Record<DwellingForm, string>> = {
  hut: 'Huts', cottage: 'Cottages', longhouse: 'Longhouses', courtyard: 'Courtyard houses', villa: 'Villas', terrace: 'Terraced houses',
  tenement: 'Tenements', manor: 'Manor houses', detached: 'Detached houses', duplex: 'Duplexes', midrise: 'Mid-rise flats',
  highrise: 'High-rise flats', mansion: 'Mansions', ecopod: 'Eco-pods', terraced_tower: 'Terraced towers', sky_villa: 'Sky villas',
};
/** How each form is drawn: its sprite kind, a big plot (two cells), a smaller house on its plot. */
const FORM_LOOK: Readonly<Record<DwellingForm, { kind: LotKind; big?: boolean; inset?: number; yard?: Lot['yard'] }>> = {
  hut: { kind: 'hut' }, cottage: { kind: 'house', inset: 1, yard: 'garden' }, longhouse: { kind: 'rowhouse' }, courtyard: { kind: 'house', yard: 'paved' },
  villa: { kind: 'house', big: true, yard: 'garden' }, terrace: { kind: 'rowhouse' }, tenement: { kind: 'apartment' }, manor: { kind: 'house', big: true, yard: 'garden' },
  detached: { kind: 'house' }, duplex: { kind: 'rowhouse' }, midrise: { kind: 'apartment' }, highrise: { kind: 'tower' },
  mansion: { kind: 'house', big: true, yard: 'grass' }, ecopod: { kind: 'house', inset: 2, yard: 'garden' }, terraced_tower: { kind: 'apartment' }, sky_villa: { kind: 'tower' },
};

export interface Lot {
  x: number; y: number; w: number; h: number; kind: LotKind; sprite: string; yard: 'grass' | 'dirt' | 'paved' | 'garden';
  /** Round 7: the form of a home lot (absent for shops, amenities and parks). */
  form?: DwellingForm;
  /** Draw the district's own map sprite (×2) instead of `sprite`: civic buildings and industry keep their identity. */
  mapSprite?: boolean;
}
export interface Feature { x: number; y: number; w: number; h: number; kind: 'field' | 'parking' | 'yard' | 'court' }
export interface StreetSeg {
  x: number; y: number; w: number; h: number; surface: 'dirt' | 'cobble' | 'paved' | 'transit'; sidewalk: boolean;
  /** Round 7: an arterial on a simulated road: 2 = centre line, 4 = divided highway with a median. */
  lanes?: number;
}
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
export const STREET_COLORS = ['#55535a', '#8a8580', '#c9b184', '#b9b4ab', '#e8d27a', '#c9d3d8', '#3fd6e0', '#6b8f5a'] as const; // dirt lanes are packed light earth, distinct from dirt yards; then transit deck, guide rail, median
const SURFACE_COLOR: Record<StreetSeg['surface'], string> = { paved: STREET_COLORS[0], cobble: STREET_COLORS[1], dirt: STREET_COLORS[2], transit: STREET_COLORS[5] };
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
    ...(civ ? wealthBuckets(civ.econ.livingStandard, civ.econ.inequality) : { wealth: 0, ineq: 0 }),
    parks: s ? parkStep(s.bld) : 0,
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
  s = (s * 7 + c.road) | 0;
  s = (s * 17 + (c.wealth ?? 0) * 5 + (c.ineq ?? 0)) | 0;
  return (s * 31 + (c.parks ?? 0)) >>> 0;
}

// ------------------------------------------------------------------- composition

const rnd = (c: BlockContext, salt: number) => hash3(c.h, salt, 977) / 4294967296;

/**
 * Streets sized to real-world street shares (traffic.ts STREET_SHARE): early towns have one lane per
 * block (~9%), medieval and early-modern towns lanes on two sides (~18%), industrial cities 4-px
 * streets (~23%), modern cities 5-px streets with sidewalks (~29%), future cities transit decks (~23%).
 */
export function streetFor(tier: number): { w: number; surface: StreetSeg['surface']; sidewalk: boolean; oneSide: boolean } {
  if (tier <= 2) return { w: 3, surface: 'dirt', sidewalk: false, oneSide: true };
  if (tier <= 4) return { w: 3, surface: 'cobble', sidewalk: false, oneSide: false };
  if (tier === 5) return { w: 4, surface: 'paved', sidewalk: true, oneSide: false };
  if (tier === 6) return { w: 5, surface: 'paved', sidewalk: true, oneSide: false };
  return { w: 4, surface: 'transit', sidewalk: true, oneSide: false };
}

/** Share of a block's area that is street (for tests and the rate table). */
export function streetShare(plan: BlockPlan): number {
  let a = 0;
  for (const s of plan.streets) a += s.w * s.h;
  // E and S streets overlap in the corner
  const e = plan.streets.find((s) => s.h === BLOCK && s.x > 0), so = plan.streets.find((s) => s.w === BLOCK && s.y > 0);
  if (e && so) a -= e.w * so.h;
  return a / (BLOCK * BLOCK);
}

/** The settlement's simulated park districts as a share of its city districts, in 2% steps. */
export function parkStep(bld: readonly number[]): number {
  let city = 0;
  for (let t = 1; t < bld.length; t++) if (bld[t] && BUILDINGS[t] && (t === B.PARK || DETAIL_CATS.has(BUILDINGS[t].category))) city += bld[t];
  return city ? Math.min(25, Math.round(((bld[B.PARK] ?? 0) / city) * 50)) : 0;
}

/**
 * Pocket parks: the share of home lots given to green space, so that a town's or city's green space
 * (its simulated park districts plus pocket parks) reaches its era's park share (traffic.ts PARK_SHARE).
 * Cities whose park districts already exceed it get none.
 */
export function pocketParkShare(tier: number, band: SizeBand, parks = 0): number {
  if (band === 'village') return 0;
  const target = [0.01, 0.03, 0.06, 0.09, 0.14][tier <= 2 ? 0 : tier <= 4 ? 1 : tier === 5 ? 2 : tier === 6 ? 3 : 4];
  return Math.max(0, (target - parks * 0.02) * 1.6); // home blocks are ~60% of city blocks
}

/** Relative weights of the home forms a district of type b shows in its era, for its owner's wealth and inequality. */
export function dwellingMix(b: number, tier: number, wealth = 0, ineq = 0): Partial<Record<DwellingForm, number>> {
  const rich = 0.3 + wealth * 0.5 + ineq * 0.6;
  if (tier <= 1) return { hut: 1 };
  switch (b) {
    case B.CAMP: case B.HUT: case B.HOUSE:
      if (tier <= 3) return { cottage: 4, longhouse: 2, courtyard: 2, villa: rich };
      if (tier <= 5) return { cottage: 3, terrace: 2, manor: rich };
      if (tier === 6) return { detached: 5, duplex: 2, mansion: rich * 0.6 };
      return { ecopod: 5, detached: 2, mansion: rich * 0.4 };
    case B.SUBURB: return tier >= 7 ? { ecopod: 4, detached: 3, mansion: rich * 0.5 } : { detached: 5, duplex: 2, mansion: rich * 0.6 };
    case B.TOWNHOUSE: case B.TENEMENT:
      if (tier <= 3) return { longhouse: 3, courtyard: 2 };
      if (tier === 4) return { terrace: 5, tenement: 2, manor: rich * 0.3 };
      if (tier === 5) return { tenement: 4, terrace: 3 };
      return { duplex: 3, midrise: 3, terrace: 2 };
    case B.APARTMENT: return tier <= 5 ? { tenement: 3, midrise: 4 } : { midrise: 5, highrise: 1 };
    case B.TOWER: return tier >= 7 ? { highrise: 3, terraced_tower: 2, sky_villa: rich * 0.5 } : { highrise: 5, midrise: 1 };
    case B.ARCOLOGY: return { terraced_tower: 5, sky_villa: 1 + rich * 0.3 };
  }
  return { detached: 1 };
}

function pickForm(mix: Partial<Record<DwellingForm, number>>, r: number): DwellingForm {
  let total = 0;
  for (const v of Object.values(mix)) total += v ?? 0;
  let x = r * total;
  for (const f of DWELLING_FORMS) {
    const v = mix[f] ?? 0;
    if (v <= 0) continue;
    x -= v;
    if (x < 0) return f;
  }
  return (Object.keys(mix)[0] as DwellingForm) ?? 'detached';
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
  return yard === 'paved' ? '#8c8a86' : yard === 'dirt' ? '#8a7650' : yard === 'garden' ? '#7d8f52' : '#6f9a4e';
}

export function composeBlock(c: BlockContext): BlockPlan {
  const plan: BlockPlan = { ground: '', streets: [], edges: [], lots: [], features: [], trees: [] };
  const st = streetFor(c.tier);
  const grid = c.tier >= 5;
  // E and S streets are owned by this block; W and N streets belong to the neighbour on that side.
  const side = [c.nb[0], c.nb[2], c.nb[4], c.nb[6]];
  let ux0 = 0, uy0 = 0, ux1 = BLOCK, uy1 = BLOCK;
  // a paved road or highway the simulation built through this district becomes a wider arterial with lanes
  const arterial = c.road >= 3 && c.tier >= 3;
  const ew = arterial ? st.w + 2 : st.w;
  if (side[0] === 'built') { plan.streets.push({ x: BLOCK - ew, y: 0, w: ew, h: BLOCK, ...pick(st), ...(arterial ? { lanes: c.road >= 4 ? 4 : 2 } : {}) }); ux1 = BLOCK - ew; }
  if (side[1] === 'built' && !st.oneSide) { plan.streets.push({ x: 0, y: BLOCK - st.w, w: BLOCK, h: st.w, ...pick(st) }); uy1 = BLOCK - st.w; }
  for (let s = 0 as 0 | 1 | 2 | 3; s < 4; s = (s + 1) as 0 | 1 | 2 | 3) {
    const k = side[s];
    if (k === 'water') plan.edges.push({ side: s, kind: 'quay' });
    else if (k === 'open' || k === 'farm') plan.edges.push({ side: s, kind: c.tier >= 3 && (c.h >> s) & 1 ? 'fence' : 'hedge' });
  }
  // keep 1 px clear of every edge that has no street of ours (fences, the neighbour's street)
  if (side[0] !== 'built') ux1 -= 1;
  if (side[1] !== 'built' || st.oneSide) uy1 -= 1;
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
  const homes = HOME_KINDS.has(L.kind);
  const mix = homes ? dwellingMix(c.b, c.tier, c.wealth, c.ineq) : null;
  const parkP = homes ? pocketParkShare(c.tier, c.band, c.parks) : 0;
  for (let r = 0; r < L.rows; r++)
    for (let q = 0; q < L.cols; q++, n++) {
      let x = ux0 + q * (cw + gapX), y = uy0 + r * (ch + gapRow), w = cw, h = ch;
      let form: DwellingForm | undefined;
      let look: (typeof FORM_LOOK)[DwellingForm] | undefined;
      if (mix) {
        form = pickForm(mix, rnd(c, 300 + n));
        look = FORM_LOOK[form];
        // a big plot (villa, manor, mansion) takes this cell and the next one in the row
        if (look.big && q + 1 < L.cols && !L.shared) { w = cw * 2 + gapX; q++; n++; }
        else if (look.big) { form = mix.detached ? 'detached' : mix.cottage ? 'cottage' : form; look = FORM_LOOK[form]; if (look.big) look = { ...look, big: false }; }
      }
      if (!grid) {
        // organic plots: shrink-only jitter keeps the gaps
        const jx = (c.h >> (n * 2)) & 1, jy = (c.h >> (n * 2 + 1)) & 1;
        x += jx; w -= jx + ((c.h >> (n + 9)) & 1 && !L.shared ? 1 : 0);
        y += jy; h -= jy;
      }
      let kind: LotKind = look ? look.kind : L.kind;
      let yard = look?.yard ?? L.yard;
      if (kind === 'house' || kind === 'rowhouse' || kind === 'apartment' || kind === 'shop' || kind === 'hut') {
        const a = pickAmenity(c, 100 + n);
        if (a) { kind = a; form = undefined; }
        else if (form && parkP > 0 && L.cols * L.rows > 1 && rnd(c, 700 + n) < parkP) { kind = 'park'; form = undefined; yard = 'grass'; } // a pocket park
      }
      if (look?.inset && form) { x += look.inset; y += look.inset; w -= look.inset * 2; h -= look.inset; }
      if (L.shared && kind !== 'rowhouse') {
        // an amenity inside a terrace keeps a 1 px passage either side
        x += 1;
        w -= 2;
      }
      if (w < 4 || h < 4) continue;
      const vh = hash3(c.h, n, 41);
      plan.lots.push({ x, y, w, h, kind, sprite: lotSprite(kind, c.tier, vh), yard, ...(form ? { form } : {}) });
      if (form && look?.big && c.tier >= 2) plan.trees.push({ x: x + w - 3, y: y + 1, size: 2 }); // big gardens have a big tree
      if ((kind === 'house' || kind === 'apartment' || kind === 'park') && c.tier >= 2 && (vh & 3) !== 0) plan.trees.push({ x: x + 1 + (vh % Math.max(1, w - 2)), y: y + 2, size: ((vh >> 3) % 3) as 0 | 1 | 2 });
    }
  if (L.kind === 'park') for (let t = 0; t < 5; t++) {
    const th = hash3(c.h, t, 43);
    plan.trees.push({ x: ux0 + (th % Math.max(1, W)), y: uy0 + ((th >> 8) % Math.max(1, H)), size: ((th >> 16) % 3) as 0 | 1 | 2 });
  }
  return plan;
}

const HOME_KINDS = new Set<LotKind>(['hut', 'house', 'rowhouse', 'apartment', 'tower']);
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

/**
 * A point on one of the block's streets for walkers (sidewalk edge) and vehicles (inside the lane),
 * chosen by hash `h` and moved along the street by `t` in [0, 1). Null when the block has no street.
 */
export function streetPoint(plan: BlockPlan, h: number, t: number, lane: boolean): { x: number; y: number; horiz: boolean; seg: number } | null {
  if (!plan.streets.length) return null;
  const seg = h % plan.streets.length;
  const s = plan.streets[seg];
  const horiz = s.w > s.h;
  const len = horiz ? s.w : s.h, width = horiz ? s.h : s.w;
  const along = Math.min(len - 1, Math.floor((((t % 1) + 1) % 1) * len));
  let across: number;
  if (lane) across = width <= 2 ? Math.min(1, width - 1) : 1 + ((h >> 3) % (width - 2));
  else across = (h >> 5) & 1 ? width - 1 : 0;
  return horiz ? { x: s.x + along, y: s.y + across, horiz, seg } : { x: s.x + across, y: s.y + along, horiz, seg };
}

/** Round 7: the expected share of each home form across a settlement's home districts (for the inspector). */
export function homeForms(bld: readonly number[], tier: number, wealth = 0, ineq = 0): { form: DwellingForm; label: string; share: number }[] {
  const RES = [B.HUT, B.HOUSE, B.TOWNHOUSE, B.TENEMENT, B.APARTMENT, B.SUBURB, B.TOWER, B.ARCOLOGY];
  const acc: Partial<Record<DwellingForm, number>> = {};
  let all = 0;
  for (const t of RES) {
    const n = bld[t] ?? 0;
    if (!n) continue;
    const mix = dwellingMix(t, tier, wealth, ineq);
    let sum = 0;
    for (const v of Object.values(mix)) sum += v ?? 0;
    for (const [f, v] of Object.entries(mix) as [DwellingForm, number][]) {
      acc[f] = (acc[f] ?? 0) + (n * v) / sum;
      all += (n * v) / sum;
    }
  }
  return (Object.entries(acc) as [DwellingForm, number][])
    .map(([form, v]) => ({ form, label: DWELLING_LABEL[form], share: v / all }))
    .sort((a, b) => b.share - a.share);
}

/** The wealth and inequality buckets used by blockContext, for a nation. */
export function wealthBuckets(livingStandard: number, inequality: number): { wealth: number; ineq: number } {
  return { wealth: Math.max(0, Math.min(3, Math.floor((livingStandard - 1) / 1.5))), ineq: Math.max(0, Math.min(4, Math.round((inequality - 0.2) / 0.1))) };
}
