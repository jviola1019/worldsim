/**
 * City pictures.
 *
 * POSTCARD: a street-level skyline drawn ONLY from a layout record (history/album.ts): every column
 * of the city from west to east, its tallest building behind and its nearest building in front, in
 * the style of the era the building was built in (thatch and timber, stone and tile, brick, concrete
 * and glass, neon and domes) and of the nation's values (atomic-age chrome, green roofs), with the sea
 * or river where the city really meets the water, the nation's flag on a stamp and the year.
 * Sky, hills and light come from a hash of the city and year, so the same save draws the same card.
 *
 * AERIAL: a top-down picture of the real tiles around a city, rendered by the map's own chunk
 * renderer (every road and building where it is), graded by era: an ink survey map before flight,
 * monochrome film once aircraft exist, colour film, then a crisp satellite image.
 * Pure drawing: nothing here changes the simulation.
 */
import type { Sim } from '../sim/context';
import type { Settlement } from '../sim/types';
import type { Atlas } from './atlas';
import { TerrainLayer, PAD } from './terrainLayer';
import { CHUNK } from '../sim/context';
import { TILE } from './camera';
import { B } from '../civilizations/buildingTypes';
import { unb64, heightOf, type CitySnapshot } from '../history/album';
import { flagCanvas } from './flag';

export const POSTCARD_W = 480;
export const POSTCARD_H = 300;

function hash(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

interface Palette { wall: string; roof: string; win: string; trim: string }

/** Building materials by the tier a building was built in. */
function palette(tier: number, ethos?: string): Palette {
  if (ethos === 'atomic' && tier >= 5) return { wall: '#c9d3dc', roof: '#e2654e', win: '#fff3a8', trim: '#6fd3e6' };
  if (ethos === 'ecological' && tier >= 5) return { wall: '#d8e3cf', roof: '#5f9e4f', win: '#e9f7ff', trim: '#3f7a38' };
  return [
    { wall: '#8a6a45', roof: '#c9a45a', win: '#3a2a18', trim: '#5c4024' }, // 0 timber & thatch
    { wall: '#9c7a52', roof: '#b98d4c', win: '#3a2a18', trim: '#6a4a2c' }, // 1
    { wall: '#c8b89a', roof: '#a8483a', win: '#3b3328', trim: '#7d6a50' }, // 2 stone & tile
    { wall: '#d2c3a2', roof: '#8a3a30', win: '#3b3328', trim: '#857358' }, // 3
    { wall: '#a8553f', roof: '#5a4a48', win: '#f0d890', trim: '#6e3426' }, // 4 brick
    { wall: '#9c8f86', roof: '#4a4f58', win: '#f3e2a0', trim: '#5a5550' }, // 5 industrial
    { wall: '#8fa6b8', roof: '#56687a', win: '#dff2ff', trim: '#3f5366' }, // 6 concrete & glass
    { wall: '#6fa0c8', roof: '#4fe3ff', win: '#e9fbff', trim: '#b05bfa' }, // 7 future
  ][Math.max(0, Math.min(7, tier))];
}

type Sky = 'dawn' | 'day' | 'dusk' | 'night';

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, sky: Sky, seed: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const stops: Record<Sky, [string, string]> = { dawn: ['#f7b48a', '#fbe3c4'], day: ['#6fb3e8', '#cfe8f7'], dusk: ['#4a3a78', '#f29a6a'], night: ['#0b1230', '#26305a'] };
  g.addColorStop(0, stops[sky][0]);
  g.addColorStop(1, stops[sky][1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (sky === 'night') {
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 60; k++) { const r = hash(seed, k); ctx.fillRect(r % w, (r >>> 9) % Math.floor(h * 0.6), 1, 1); }
    ctx.fillStyle = '#f2f0d8';
    ctx.beginPath(); ctx.arc(w * 0.8, h * 0.18, 10, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = sky === 'day' ? '#fff6c8' : '#ffd48a';
    ctx.beginPath(); ctx.arc(sky === 'dawn' ? w * 0.18 : sky === 'dusk' ? w * 0.82 : w * 0.7, sky === 'day' ? h * 0.16 : h * 0.42, 14, 0, Math.PI * 2); ctx.fill();
    // a few clouds
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let k = 0; k < 4; k++) { const r = hash(seed, k + 99); const cx = r % w, cy = 20 + ((r >>> 10) % 60); ctx.fillRect(cx, cy, 30 + (r % 30), 6); ctx.fillRect(cx + 6, cy - 4, 18, 4); }
  }
}

function drawHills(ctx: CanvasRenderingContext2D, w: number, base: number, seed: number, sky: Sky): void {
  ctx.fillStyle = sky === 'night' ? '#1a2238' : '#7c9a6a';
  ctx.beginPath();
  ctx.moveTo(0, base);
  for (let x = 0; x <= w; x += 8) ctx.lineTo(x, base - 18 - 14 * Math.sin((x + (seed % 200)) / 47) - 8 * Math.sin((x + (seed % 97)) / 13));
  ctx.lineTo(w, base);
  ctx.fill();
}

function windows(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: Palette, lit: boolean, seed: number): void {
  for (let wy = y + 4; wy < y + h - 4; wy += 6)
    for (let wx = x + 2; wx < x + w - 2; wx += 5) {
      const on = lit ? hash(seed, wx, wy) % 3 !== 0 : true;
      ctx.fillStyle = lit ? (on ? '#ffd970' : '#1b2238') : p.win;
      ctx.fillRect(wx, wy, 2, 3);
    }
}

/** One building seen from the street. */
function drawBuilding(ctx: CanvasRenderingContext2D, bld: number, tier: number, x: number, base: number, w: number, scale: number, snap: CitySnapshot, lit: boolean, seed: number): void {
  if (!bld) return;
  const p = palette(tier, snap.ethos);
  const h = Math.max(6, heightOf(bld, tier) * scale);
  const top = base - h;
  ctx.fillStyle = p.wall;
  switch (bld) {
    case B.TEMPLE:
      if (tier <= 1) { ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + w / 2, top); ctx.lineTo(x + w, base); ctx.fill(); return; } // stepped pyramid shape
      ctx.fillRect(x + 1, top + h * 0.35, w - 2, h * 0.65);
      ctx.fillStyle = p.roof;
      if (tier >= 6) { ctx.beginPath(); ctx.arc(x + w / 2, top + h * 0.35, w / 2 - 1, Math.PI, 0); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(x + w / 2 - 2, top + h * 0.35); ctx.lineTo(x + w / 2, top); ctx.lineTo(x + w / 2 + 2, top + h * 0.35); ctx.fill(); }
      return;
    case B.PALACE: {
      ctx.fillRect(x, top + h * 0.3, w, h * 0.7);
      ctx.fillStyle = p.roof;
      ctx.beginPath(); ctx.arc(x + w / 2, top + h * 0.3, w / 2.4, Math.PI, 0); ctx.fill();
      // the nation's flag on the palace
      ctx.fillStyle = '#333'; ctx.fillRect(x + w / 2, top - 14, 1, 16);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(flagCanvas({ color: snap.color, emblem: snap.emblem }), x + w / 2 + 1, top - 14, 12, 8);
      return;
    }
    case B.FACTORY: case B.STEEL_MILL: case B.POWER_FOSSIL: case B.REFINERY: {
      ctx.fillRect(x, top + h * 0.4, w, h * 0.6);
      ctx.fillStyle = p.trim;
      ctx.fillRect(x + w * 0.2, top, 3, h * 0.45);
      ctx.fillRect(x + w * 0.6, top + h * 0.1, 3, h * 0.35);
      ctx.fillStyle = 'rgba(120,120,120,0.55)';
      ctx.fillRect(x + w * 0.2 - 2, top - 6, 8, 5); ctx.fillRect(x + w * 0.2 + 2, top - 11, 7, 4);
      return;
    }
    case B.POWER_NUCLEAR: {
      ctx.fillStyle = '#d7dadf';
      ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + w * 0.3, top + h * 0.5, x + w * 0.15, top); ctx.lineTo(x + w * 0.85, top); ctx.quadraticCurveTo(x + w * 0.7, top + h * 0.5, x + w, base); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(x + w * 0.25, top - 6, w * 0.5, 5);
      return;
    }
    case B.SPACEPORT: {
      ctx.fillStyle = '#555c66'; ctx.fillRect(x + w * 0.2, top, 2, h); ctx.fillRect(x + w * 0.2, top + 6, w * 0.4, 1);
      ctx.fillStyle = '#eef1f4'; ctx.fillRect(x + w * 0.5, top + 2, 4, h - 2);
      ctx.fillStyle = '#e2654e'; ctx.beginPath(); ctx.moveTo(x + w * 0.5, top + 2); ctx.lineTo(x + w * 0.5 + 2, top - 4); ctx.lineTo(x + w * 0.5 + 4, top + 2); ctx.fill();
      return;
    }
    case B.ARENA: {
      ctx.fillStyle = p.wall;
      ctx.beginPath(); ctx.ellipse(x + w / 2, base - h * 0.35, w / 2 + 3, h * 0.35, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect(x - 3, base - h * 0.35, w + 6, h * 0.35);
      ctx.fillStyle = p.trim; for (let k = x - 1; k < x + w + 2; k += 4) ctx.fillRect(k, base - h * 0.3, 2, h * 0.25);
      return;
    }
    case B.WALL: case B.FORT: {
      ctx.fillRect(x, top + h * 0.3, w, h * 0.7);
      for (let k = x; k < x + w; k += 4) ctx.fillRect(k, top + h * 0.3 - 3, 2, 3);
      return;
    }
    case B.HARBOR: {
      ctx.fillRect(x, base - 6, w, 6);
      ctx.fillStyle = tier >= 5 ? '#e8a33a' : '#6a4a2c';
      if (tier >= 5) { ctx.fillRect(x + w / 2, top, 2, h); ctx.fillRect(x + w / 2 - w / 2, top, w, 2); }
      else { ctx.fillRect(x + w / 2, top, 1, h); ctx.fillStyle = '#efe6cf'; ctx.fillRect(x + w / 2 + 1, top + 2, 5, h * 0.4); }
      return;
    }
  }
  // homes and everything else: a block with an era roof
  const bw = Math.max(4, w - 1);
  ctx.fillRect(x, top, bw, h);
  if (tier <= 3 || bld === B.HUT || bld === B.HOUSE || bld === B.SUBURB) {
    ctx.fillStyle = p.roof;
    ctx.beginPath(); ctx.moveTo(x - 1, top); ctx.lineTo(x + bw / 2, top - Math.min(10, bw * 0.6)); ctx.lineTo(x + bw + 1, top); ctx.fill();
  } else if (bld === B.ARCOLOGY) {
    ctx.fillStyle = p.roof;
    ctx.beginPath(); ctx.arc(x + bw / 2, top, bw / 2, Math.PI, 0); ctx.fill();
  } else {
    ctx.fillStyle = p.roof;
    ctx.fillRect(x - 1, top - 2, bw + 2, 2);
    if (bld === B.TOWER && snap.ethos === 'atomic') { ctx.fillStyle = p.trim; ctx.fillRect(x + bw / 2, top - 8, 1, 8); ctx.beginPath(); ctx.arc(x + bw / 2, top - 9, 2, 0, Math.PI * 2); ctx.fill(); }
  }
  if (snap.ethos === 'ecological' && tier >= 5) { ctx.fillStyle = '#4f8e42'; ctx.fillRect(x, top - 3, bw, 3); }
  if (h > 10) windows(ctx, x, top, bw, h, p, lit, seed);
}

/** Draw a postcard of a city from its layout record. */
export function drawPostcard(canvas: HTMLCanvasElement, snap: CitySnapshot): void {
  const W = POSTCARD_W, H = POSTCARD_H;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const seed = hash(snap.sid, snap.year, snap.civId);
  const sky: Sky = (['dawn', 'day', 'day', 'dusk', 'night'] as Sky[])[seed % 5];
  const lit = sky === 'night' || sky === 'dusk';
  // card
  ctx.fillStyle = '#f7f1e3';
  ctx.fillRect(0, 0, W, H);
  const px = 10, py = 10, pw = W - 20, ph = H - 54;
  ctx.save();
  ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
  ctx.translate(px, py);
  drawSky(ctx, pw, ph, sky, seed);
  const bytes = unb64(snap.cols);
  const n = snap.n;
  let anyWater = false;
  for (let k = 0; k < n; k++) if (bytes[k * 5 + 4] & 1) anyWater = true;
  const ground = anyWater ? ph - 46 : ph - 30;
  drawHills(ctx, pw, ground - 10, seed, sky);
  // tallest building sets the scale so a tower city fills the card and a village sits low
  let maxH = 1;
  for (let k = 0; k < n; k++) maxH = Math.max(maxH, heightOf(bytes[k * 5], bytes[k * 5 + 1]));
  const scale = Math.min(14, (ground - 30) / maxH);
  const colW = pw / n;
  for (let k = 0; k < n; k++) drawBuilding(ctx, bytes[k * 5], bytes[k * 5 + 1], k * colW, ground - 4, colW * 0.9, scale, snap, lit, seed + k);
  ctx.fillStyle = sky === 'night' ? 'rgba(10,14,30,0.35)' : 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, 0, pw, ground);
  for (let k = 0; k < n; k++) drawBuilding(ctx, bytes[k * 5 + 2], bytes[k * 5 + 3], k * colW + colW * 0.2, ground + 4, colW * 0.8, scale * 0.55, snap, lit, seed + 50 + k);
  // ground, road and the water the city really stands on
  ctx.fillStyle = snap.tier >= 5 ? '#4a4c52' : '#8a7452';
  ctx.fillRect(0, ground + 4, pw, 10);
  if (anyWater) {
    const g = ctx.createLinearGradient(0, ground + 14, 0, ph);
    g.addColorStop(0, sky === 'night' ? '#16223f' : '#3f7fb8');
    g.addColorStop(1, sky === 'night' ? '#0b1020' : '#2a5a8a');
    ctx.fillStyle = g;
    ctx.fillRect(0, ground + 14, pw, ph - ground - 14);
    ctx.fillStyle = lit ? 'rgba(255,217,112,0.35)' : 'rgba(255,255,255,0.35)';
    for (let k = 0; k < 40; k++) { const r = hash(seed, k, 7); ctx.fillRect(r % pw, ground + 18 + ((r >>> 8) % Math.max(1, ph - ground - 20)), 6, 1); }
  } else {
    ctx.fillStyle = snap.tier >= 5 ? '#6e7f5a' : '#8fa86a';
    ctx.fillRect(0, ground + 14, pw, ph - ground - 14);
  }
  // traffic of the era
  for (let k = 0; k < 5; k++) {
    const r = hash(seed, k, 3);
    const vx = r % (pw - 12);
    ctx.fillStyle = snap.tier <= 2 ? '#6a4a2c' : snap.tier <= 4 ? '#3a3a3a' : snap.tier <= 6 ? ['#d94848', '#3f7fd9', '#f2f2f2', '#2e8b57'][r % 4] : '#4fe3ff';
    const vy = snap.tier >= 7 ? ground - 10 - (r % 20) : ground + 6;
    ctx.fillRect(vx, vy, snap.tier <= 2 ? 6 : 9, 4);
    if (snap.tier <= 2) { ctx.fillStyle = '#5a3a20'; ctx.fillRect(vx - 5, vy - 1, 4, 4); } // the horse
  }
  ctx.restore();
  // frame line, caption and stamp
  ctx.strokeStyle = '#2b2620'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  ctx.fillStyle = '#2b2620';
  ctx.font = snap.tier <= 3 ? 'italic 18px Georgia, serif' : snap.tier <= 5 ? 'bold 18px Georgia, serif' : 'bold 18px system-ui, sans-serif';
  ctx.fillText(`Greetings from ${snap.name}!`, 14, H - 26);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`${snap.civName} · year ${snap.year} · ${snap.pop.toLocaleString('en-US')} people`, 14, H - 10);
  ctx.fillStyle = '#fff'; ctx.fillRect(W - 58, H - 46, 46, 38);
  ctx.strokeStyle = '#a33'; ctx.setLineDash([2, 2]); ctx.strokeRect(W - 58.5, H - 46.5, 47, 39); ctx.setLineDash([]);
  ctx.drawImage(flagCanvas({ color: snap.color, emblem: snap.emblem }), W - 53, H - 42, 36, 24);
  ctx.fillStyle = '#a33'; ctx.font = 'bold 9px system-ui, sans-serif'; ctx.fillText(String(snap.year), W - 50, H - 11);
}

export type AerialStyle = 'survey' | 'film-bw' | 'film' | 'satellite';

export function aerialStyle(era: number, hasFlight: boolean, hasSatellites: boolean): AerialStyle {
  if (hasSatellites) return 'satellite';
  if (hasFlight) return era >= 9 ? 'film' : 'film-bw';
  return 'survey';
}

/** Draw a top-down picture of the real tiles around a settlement. */
export function drawAerial(canvas: HTMLCanvasElement, sim: Sim, atlas: Atlas, s: Settlement, style: AerialStyle, sizePx = 320): void {
  const m = sim.w.map;
  const r = Math.ceil(s.radius) + 3;
  const x0 = Math.max(0, s.x - r), y0 = Math.max(0, s.y - r);
  const x1 = Math.min(m.w - 1, s.x + r), y1 = Math.min(m.h - 1, s.y + r);
  const tw = x1 - x0 + 1, th = y1 - y0 + 1;
  // render the needed chunks with the map's own renderer, then copy the window
  const layer = new TerrainLayer(sim, atlas);
  const cx = Math.ceil(m.w / CHUNK);
  const wanted: number[] = [];
  for (let ky = Math.floor(y0 / CHUNK); ky <= Math.floor(y1 / CHUNK); ky++)
    for (let kx = Math.floor(x0 / CHUNK); kx <= Math.floor(x1 / CHUNK); kx++) wanted.push(ky * cx + kx);
  layer.maxCached = wanted.length + 4;
  layer.refresh(wanted, wanted.length);
  const raw = document.createElement('canvas');
  raw.width = tw * TILE;
  raw.height = th * TILE;
  const rc = raw.getContext('2d')!;
  rc.imageSmoothingEnabled = false;
  for (const k of wanted) {
    const c = layer.get(k);
    if (!c) continue;
    const kx = (k % cx) * CHUNK, ky = Math.floor(k / cx) * CHUNK;
    rc.drawImage(c, 0, PAD, CHUNK * TILE, CHUNK * TILE, (kx - x0) * TILE, (ky - y0) * TILE, CHUNK * TILE, CHUNK * TILE);
  }
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const k = Math.min(sizePx / raw.width, sizePx / raw.height);
  const dw = raw.width * k, dh = raw.height * k;
  ctx.fillStyle = '#0c1220';
  ctx.fillRect(0, 0, sizePx, sizePx);
  ctx.filter = style === 'survey' ? 'sepia(0.85) contrast(1.1) brightness(1.05)' : style === 'film-bw' ? 'grayscale(1) contrast(1.15)' : style === 'film' ? 'saturate(0.8) contrast(1.05) sepia(0.15)' : 'saturate(1.15) contrast(1.05)';
  ctx.drawImage(raw, (sizePx - dw) / 2, (sizePx - dh) / 2, dw, dh);
  ctx.filter = 'none';
  // photographic finish: vignette, caption and (for satellites) a crosshair grid
  const v = ctx.createRadialGradient(sizePx / 2, sizePx / 2, sizePx * 0.3, sizePx / 2, sizePx / 2, sizePx * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, style === 'survey' ? 'rgba(80,50,20,0.45)' : 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, sizePx, sizePx);
  if (style === 'satellite') {
    ctx.strokeStyle = 'rgba(120,255,200,0.25)';
    for (let g = 0; g < sizePx; g += 40) { ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, sizePx); ctx.moveTo(0, g); ctx.lineTo(sizePx, g); ctx.stroke(); }
  }
  ctx.fillStyle = style === 'survey' ? '#3a2410' : '#ffffff';
  ctx.font = style === 'survey' ? 'italic 12px Georgia, serif' : '11px system-ui, monospace';
  const label = { survey: `Survey of ${s.name}, year ${sim.year}`, 'film-bw': `Aerial photograph · ${s.name} · ${sim.year}`, film: `Aerial photograph · ${s.name} · ${sim.year}`, satellite: `SAT ${s.name.toUpperCase()} · Y${sim.year} · ${s.x},${s.y}` }[style];
  ctx.fillText(label, 8, sizePx - 8);
}
