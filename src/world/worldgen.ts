/**
 * Procedural world generation.
 *
 * Pipeline (all seeded, deterministic):
 *  1. Tectonic plates: warped Voronoi partition; plates are continental or
 *     oceanic and drift. Convergent boundaries raise mountain ranges and
 *     volcanic arcs; divergent continental boundaries open rifts.
 *  2. Elevation: blurred plate base + domain-warped fBm + boundary ridges,
 *     sea level chosen by quantile to hit the requested ocean coverage.
 *  3. Temperature: latitude curve + elevation lapse rate + noise.
 *  4. Precipitation: prevailing-wind sweep by latitude band (trade winds,
 *     westerlies, polar easterlies) carrying humidity from the sea; rain falls
 *     with orographic lift, producing rain shadows; multiplied by a latitude
 *     circulation factor (wet ITCZ, dry subtropics, mid-latitude storm tracks).
 *  5. Hydrology: priority-flood depression filling (Barnes et al. 2014); deep
 *     closed basins become lakes; D8 flow directions on the filled surface;
 *     rainfall-weighted flow accumulation; rivers where accumulation exceeds a
 *     threshold, so every river flows downhill to a lake or the sea.
 *  6. Light erosion: river valley carving and thermal smoothing.
 *  7. Biomes from temperature x precipitation (Whittaker-style table) plus
 *     elevation classes, beaches, wetlands and volcanic land.
 *  8. Soil fertility, vegetation and geology-aware resource deposits.
 *
 * These are stylized physical abstractions — plausible patterns, not a
 * geophysical model. See docs/MODEL.md.
 */
import { Rng } from '../core/rng';
import { Simplex2 } from '../core/noise';
import { MinHeap } from '../core/heap';
import { clamp, clamp01, lerp, smoothstep, DX8, DY8, DX4, DY4 } from '../core/math';
import { TileMap, HAZARD } from './tilemap';
import { T, TERRAIN, isWaterTerrain } from './terrain';
import { Deposit, DEPOSITS } from './resources';

export type LandmassType = 'continents' | 'pangaea' | 'archipelago' | 'islands';

export interface WorldGenParams {
  seed: string;
  width: number;
  height: number;
  landmass: LandmassType;
  /** Fraction of the map covered by water, 0.2..0.9. */
  oceanCoverage: number;
  /** 0 = few large plates/smooth coasts, 1 = many plates/fragmented coasts. */
  fragmentation: number;
  /** Mountain building strength 0..1. */
  mountains: number;
  /** River density 0..1. */
  rivers: number;
  /** Latitude span / climate contrast 0..1. */
  climateVariation: number;
  /** Planet temperature offset -1 (ice age) .. 1 (hothouse). */
  temperature: number;
  /** Planet moisture -1 (arid) .. 1 (wet). */
  moisture: number;
  /** Resource abundance multiplier 0..2. */
  resources: number;
  alien: boolean;
  fantasy: boolean;
}

export const DEFAULT_GEN: WorldGenParams = {
  seed: 'epoch',
  width: 192,
  height: 192,
  landmass: 'continents',
  oceanCoverage: 0.6,
  fragmentation: 0.45,
  mountains: 0.5,
  rivers: 0.5,
  climateVariation: 0.6,
  temperature: 0,
  moisture: 0,
  resources: 1,
  alien: false,
  fantasy: false,
};

export interface WorldGenResult {
  map: TileMap;
  latSpan: number;
}

/** Separable box blur (in place, `passes` times) on a Float32Array field. */
export function boxBlur(src: Float32Array, w: number, h: number, r: number, passes = 2): Float32Array {
  if (r < 1) return src;
  const tmp = new Float32Array(src.length);
  const out = src;
  const win = 2 * r + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += out[row + clamp(k, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc / win;
        acc += out[row + Math.min(w - 1, x + r + 1)] - out[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += tmp[clamp(k, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc / win;
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
  }
  return out;
}

function quantile(values: Float32Array, q: number): number {
  const s = Float32Array.from(values).sort();
  return s[clamp(Math.floor(q * (s.length - 1)), 0, s.length - 1)];
}

export function generateWorld(p: WorldGenParams): WorldGenResult {
  const W = p.width;
  const H = p.height;
  const n = W * H;
  const S = Math.max(W, H);
  const rng = new Rng('worldgen:' + p.seed);
  const nElev = new Simplex2(p.seed + ':elev');
  const nWarp = new Simplex2(p.seed + ':warp');
  const nRidge = new Simplex2(p.seed + ':ridge');
  const nClim = new Simplex2(p.seed + ':climate');
  const map = new TileMap(W, H);

  // ---------- 1. tectonic plates ----------
  const sizeFactor = Math.sqrt(n / 65536);
  let plateCount = Math.round(lerp(6, 20, p.fragmentation) * sizeFactor);
  if (p.landmass === 'archipelago') plateCount = Math.round(plateCount * 1.6);
  plateCount = clamp(plateCount, 4, 48);
  const px = new Float32Array(plateCount);
  const py = new Float32Array(plateCount);
  const vx = new Float32Array(plateCount);
  const vy = new Float32Array(plateCount);
  for (let k = 0; k < plateCount; k++) {
    px[k] = rng.range(0.04, 0.96) * W;
    py[k] = rng.range(0.04, 0.96) * H;
    const a = rng.range(0, Math.PI * 2);
    const sp = rng.range(0.3, 1);
    vx[k] = Math.cos(a) * sp;
    vy[k] = Math.sin(a) * sp;
  }
  const plate = new Uint8Array(n);
  const area = new Float64Array(plateCount);
  const warpAmp = S * 0.09;
  const wf = 2.2 / S;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const wx = x + warpAmp * nWarp.fbm(x * wf, y * wf, 3);
      const wy = y + warpAmp * nWarp.fbm(x * wf + 31.7, y * wf - 12.3, 3);
      let best = 0;
      let bd = Infinity;
      for (let k = 0; k < plateCount; k++) {
        const d = (wx - px[k]) ** 2 + (wy - py[k]) ** 2;
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      plate[y * W + x] = best;
      area[best]++;
    }
  // choose continental plates
  const continental = new Uint8Array(plateCount);
  const targetLand = (1 - p.oceanCoverage) * n * 1.25;
  const order = Array.from({ length: plateCount }, (_, k) => k);
  if (p.landmass === 'pangaea') {
    order.sort((a, b) => (px[a] - W / 2) ** 2 + (py[a] - H / 2) ** 2 - ((px[b] - W / 2) ** 2 + (py[b] - H / 2) ** 2));
  } else {
    rng.shuffle(order);
  }
  let landArea = 0;
  for (const k of order) {
    if (landArea >= targetLand) break;
    if (p.landmass === 'islands' && landArea > targetLand * 0.4) break;
    continental[k] = 1;
    landArea += area[k];
  }

  // ---------- 2. boundary effects (multi-source BFS) ----------
  const bDist = new Float32Array(n).fill(1e9);
  const bConv = new Float32Array(n); // convergence of nearest boundary
  const bOcean = new Uint8Array(n); // nearest boundary involves an oceanic plate
  const queue = new Int32Array(n);
  let qh = 0;
  let qt = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const a = plate[i];
      for (let d = 0; d < 4; d++) {
        const nx = x + DX4[d];
        const ny = y + DY4[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const b = plate[ny * W + nx];
        if (b === a) continue;
        let nxv = px[b] - px[a];
        let nyv = py[b] - py[a];
        const len = Math.hypot(nxv, nyv) || 1;
        nxv /= len;
        nyv /= len;
        // relative velocity of a toward b along the normal: positive = converging
        const conv = (vx[a] - vx[b]) * nxv + (vy[a] - vy[b]) * nyv;
        bDist[i] = 0;
        bConv[i] = conv;
        bOcean[i] = continental[a] && continental[b] ? 0 : 1;
        queue[qt++] = i;
        break;
      }
    }
  const R = S * 0.07;
  while (qh < qt) {
    const i = queue[qh++];
    const x = i % W;
    const y = (i / W) | 0;
    const nd = bDist[i] + 1;
    if (nd > R) continue;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX4[d];
      const ny = y + DY4[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (bDist[j] <= nd) continue;
      bDist[j] = nd;
      bConv[j] = bConv[i];
      bOcean[j] = bOcean[i];
      queue[qt++] = j;
    }
  }

  // ---------- 3. elevation ----------
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) e[i] = continental[plate[i]] ? 0.42 : -0.5;
  boxBlur(e, W, H, Math.max(2, Math.round(S * 0.03)), 3);
  const f = lerp(2.2, 5.5, p.fragmentation) / S;
  const ridgeF = 4.5 / S;
  const mStrength = lerp(0.25, 1.25, p.mountains);
  const hotspots: [number, number, number, number][] = [];
  const hotCount =
    p.landmass === 'islands' ? Math.round(14 * sizeFactor) : p.landmass === 'archipelago' ? Math.round(10 * sizeFactor) : Math.round(3 * sizeFactor);
  const islandWorld = p.landmass === 'islands' || p.landmass === 'archipelago';
  for (let k = 0; k < hotCount; k++)
    hotspots.push([
      rng.range(0.1, 0.9) * W,
      rng.range(0.1, 0.9) * H,
      islandWorld ? rng.range(S * 0.02, S * 0.06) : rng.range(S * 0.01, S * 0.025),
      islandWorld ? rng.range(0.4, 0.9) : rng.range(0.15, 0.35),
    ]);
  const margin = S * 0.07;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const wx = x + S * 0.04 * nWarp.noise(x * wf * 2, y * wf * 2);
      const wy = y + S * 0.04 * nWarp.noise(x * wf * 2 + 7.1, y * wf * 2 + 3.3);
      let v = e[i] + 0.42 * nElev.fbm(wx * f, wy * f, 6);
      // boundary ridges / rifts
      if (bDist[i] < R) {
        const fall = (1 - bDist[i] / R) ** 2;
        const c = bConv[i];
        if (c > 0) {
          const ridge = nRidge.ridged(x * ridgeF, y * ridgeF, 5);
          v += fall * c * mStrength * (0.35 + 0.9 * ridge) * (bOcean[i] ? 0.75 : 1);
        } else if (continental[plate[i]]) {
          v += fall * c * 0.18;
        }
      }
      // ancient interior ranges
      const r2 = nRidge.ridged(x * ridgeF * 0.7 + 50, y * ridgeF * 0.7 - 20, 4);
      v += p.mountains * 0.22 * Math.max(0, r2 - 0.55);
      for (const [hx, hy, hr, ha] of hotspots) {
        const d2 = (x - hx) ** 2 + (y - hy) ** 2;
        if (d2 < hr * hr * 9) v += ha * Math.exp(-d2 / (2 * hr * hr));
      }
      if (p.landmass === 'pangaea') {
        const dc = Math.hypot((x - W / 2) / W, (y - H / 2) / H) * 2;
        v += 0.35 * (1 - dc) - 0.12;
      }
      // keep map edges as ocean so continents are never cut off
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y) / margin;
      if (edge < 1) v -= (1 - edge) * (1 - edge) * 1.3;
      e[i] = v;
    }
  // sea level by quantile
  const sea = quantile(e, clamp(p.oceanCoverage, 0.05, 0.95));
  let minWater = -1e-6;
  const landElev: number[] = [];
  for (let i = 0; i < n; i++) {
    e[i] -= sea;
    if (e[i] < minWater) minWater = e[i];
    if (e[i] > 0) landElev.push(e[i]);
  }
  landElev.sort((a, b) => a - b);
  // normalize land by a high percentile (not the single highest peak) so that
  // mountain/hill fractions are stable across seeds; the mountains parameter
  // shifts that percentile.
  const pk = landElev.length ? landElev[Math.floor((landElev.length - 1) * lerp(0.995, 0.955, p.mountains))] : 1;
  for (let i = 0; i < n; i++) {
    if (e[i] > 0) e[i] = Math.min(1, Math.pow(e[i] / pk, 1.1));
    else e[i] = -Math.pow(e[i] / minWater, 0.8);
    if (e[i] > 0 && e[i] < 0.004) e[i] = 0.004;
  }
  map.elev.set(e);

  const latSpan = lerp(48, 85, p.climateVariation);
  computeTemperature(map, latSpan, p.temperature, nClim);
  computeMoisture(map, latSpan, p.moisture, nClim);
  computeHydrology(map, p.rivers);
  carveAndSmooth(map);
  computeTemperature(map, latSpan, p.temperature, nClim);
  classifyBiomes(map, rng, bDist, bConv, bOcean, R, p);
  computeSoilAndVegetation(map, rng, nClim);
  placeDeposits(map, rng, bDist, R, p);
  return { map, latSpan };
}

/** Annual mean temperature from latitude, elevation and noise. */
export function computeTemperature(map: TileMap, latSpan: number, offset: number, noise: Simplex2): void {
  const { w: W, h: H } = map;
  const nf = 3 / Math.max(W, H);
  for (let y = 0; y < H; y++) {
    const lat = Math.abs(map.latitude(y, latSpan));
    const base = 28 - 48 * Math.pow(lat / 90, 1.6) + offset * 9;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const el = Math.max(0, map.elev[i]);
      const t = base - 30 * el + 3 * noise.noise(x * nf + 100, y * nf - 40);
      map.temp[i] = clamp(Math.round(t), -60, 50);
    }
  }
}

function seaTemp(absLat: number): number {
  return 28 - 48 * Math.pow(absLat / 90, 1.6);
}

/** Precipitation via prevailing-wind humidity sweep with orographic rain shadows. */
export function computeMoisture(map: TileMap, latSpan: number, moistureParam: number, noise: Simplex2): void {
  const { w: W, h: H, n } = map;
  const precip = new Float32Array(n);
  for (let y = 0; y < H; y++) {
    const lat = map.latitude(y, latSpan);
    const al = Math.abs(lat);
    const dir = al < 30 ? -1 : al < 60 ? 1 : -1;
    const evap = clamp((seaTemp(al) + 6) / 34, 0.15, 1);
    let x = dir > 0 ? 0 : W - 1;
    let h = evap;
    let prevE = 0;
    for (let k = 0; k < W; k++, x += dir) {
      const i = y * W + x;
      const el = map.elev[i];
      if (el <= 0) {
        h += (evap - h) * 0.35;
        precip[i] = h * 0.6;
        prevE = 0;
      } else {
        const rise = Math.max(0, el - prevE);
        let r = h * (0.022 + rise * 2.6);
        r = Math.min(r, h * 0.5);
        precip[i] += r;
        h -= r * 0.62; // ~40% recycled by evapotranspiration
        prevE = el;
      }
    }
  }
  // latitude circulation factor
  for (let y = 0; y < H; y++) {
    const al = Math.abs(map.latitude(y, latSpan));
    const circ =
      0.75 +
      0.6 * Math.exp(-((al / 11) ** 2)) -
      0.5 * Math.exp(-(((al - 27) / 9) ** 2)) +
      0.3 * Math.exp(-(((al - 52) / 11) ** 2)) -
      0.35 * smoothstep(62, 85, al);
    for (let x = 0; x < W; x++) precip[y * W + x] *= Math.max(0.05, circ);
  }
  boxBlur(precip, W, H, 2, 2);
  const nf = 4 / Math.max(W, H);
  const mult = Math.pow(2, moistureParam);
  const landVals: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = i % W;
    const y = (i / W) | 0;
    precip[i] *= 1 + 0.3 * noise.fbm(x * nf - 300, y * nf + 120, 3);
    if (map.elev[i] > 0) landVals.push(precip[i]);
  }
  landVals.sort((a, b) => a - b);
  const med = (landVals.length ? landVals[landVals.length >> 1] : 1) || 1;
  // saturating map: median land precipitation -> ~0.45, 4x median -> ~0.9
  for (let i = 0; i < n; i++) map.moist[i] = clamp(Math.round(255 * (1 - Math.exp((-0.6 * mult * precip[i]) / med))), 0, 255);
}

/**
 * Priority-flood depression filling, lake formation, D8 flow directions and
 * rainfall-weighted flow accumulation -> rivers. Safe to call again after
 * terrain edits (god powers): existing lakes are re-derived from elevation.
 */
export function computeHydrology(map: TileMap, riverDensity: number): void {
  const { w: W, h: H, n } = map;
  const e = map.elev;
  const filled = new Float32Array(n);
  const done = new Uint8Array(n);
  const heap = new MinHeap(4096);
  const EPS = 1e-5;
  // outlets: sea water (elev <= 0) and map border
  for (let i = 0; i < n; i++) {
    const x = i % W;
    const y = (i / W) | 0;
    if (e[i] <= 0 || x === 0 || y === 0 || x === W - 1 || y === H - 1) {
      filled[i] = e[i];
      done[i] = 1;
      heap.push(i, e[i]);
    }
  }
  while (heap.size > 0) {
    const i = heap.pop();
    const x = i % W;
    const y = (i / W) | 0;
    const fi = Math.max(filled[i], 0);
    for (let d = 0; d < 8; d++) {
      const nx = x + DX8[d];
      const ny = y + DY8[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (done[j]) continue;
      done[j] = 1;
      filled[j] = Math.max(e[j], fi + EPS);
      heap.push(j, filled[j]);
    }
  }
  // lakes: connected depressions deeper than a threshold
  const isLakeCand = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (e[i] > 0 && filled[i] - e[i] > 0.012) isLakeCand[i] = 1;
  const comp = new Int32Array(n).fill(-1);
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!isLakeCand[i] || comp[i] >= 0) continue;
    const members: number[] = [];
    stack.push(i);
    comp[i] = i;
    while (stack.length) {
      const c = stack.pop()!;
      members.push(c);
      const x = c % W;
      const y = (c / W) | 0;
      for (let d = 0; d < 8; d++) {
        const nx = x + DX8[d];
        const ny = y + DY8[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (isLakeCand[j] && comp[j] < 0) {
          comp[j] = i;
          stack.push(j);
        }
      }
    }
    const asLake = members.length >= 3;
    for (const m of members) {
      if (asLake) map.terrain[m] = T.LAKE;
      else {
        e[m] = filled[m]; // shallow pit: just fill it
        if (map.terrain[m] === T.LAKE) map.terrain[m] = T.GRASS;
      }
    }
  }
  // stale lakes (from previous runs) that are no longer depressions
  for (let i = 0; i < n; i++) if (map.terrain[i] === T.LAKE && !isLakeCand[i] && e[i] > 0) map.terrain[i] = T.GRASS;

  // flow directions on the filled surface
  const flow = map.flow;
  flow.fill(-1);
  for (let i = 0; i < n; i++) {
    if (e[i] <= 0) continue;
    const x = i % W;
    const y = (i / W) | 0;
    let best = -1;
    let bv = filled[i];
    for (let d = 0; d < 8; d++) {
      const nx = x + DX8[d];
      const ny = y + DY8[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      const v = filled[j] + (d & 1 ? 1e-7 : 0); // slight preference for orthogonal moves
      if (v < bv) {
        bv = v;
        best = d;
      }
    }
    flow[i] = best;
  }
  // accumulation, processing tiles from high to low filled elevation
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  const keys = filled;
  const sorted = Array.from(idx).sort((a, b) => keys[b] - keys[a]);
  const acc = new Float32Array(n);
  for (let i = 0; i < n; i++) acc[i] = e[i] > 0 ? 0.04 + map.moist[i] / 255 : 0;
  for (const i of sorted) {
    const d = flow[i];
    if (d < 0) continue;
    const j = (((i / W) | 0) + DY8[d]) * W + (i % W) + DX8[d];
    acc[j] += acc[i];
  }
  const sizeFactor = Math.max(W, H) / 256;
  const thr = lerp(70, 9, clamp01(riverDensity)) * Math.max(0.7, Math.sqrt(sizeFactor));
  for (let i = 0; i < n; i++) {
    if (e[i] > 0 && map.terrain[i] !== T.LAKE && acc[i] > thr) map.river[i] = Math.min(65535, Math.round((acc[i] / thr) * 8));
    else map.river[i] = 0;
  }
}

/** Carve river valleys slightly and smooth over-steep slopes (cheap erosion stand-in). */
function carveAndSmooth(map: TileMap): void {
  const { w: W, h: H, n } = map;
  const e = map.elev;
  for (let i = 0; i < n; i++) {
    if (map.river[i] > 0) e[i] = Math.max(0.006, e[i] - 0.025 * Math.log1p(map.river[i] / 8));
  }
  const copy = new Float32Array(e);
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (copy[i] <= 0) continue;
      let s = 0;
      let c = 0;
      for (let d = 0; d < 8; d++) {
        const j = (y + DY8[d]) * W + x + DX8[d];
        if (copy[j] > 0) {
          s += copy[j];
          c++;
        }
      }
      if (c) {
        const avg = s / c;
        if (Math.abs(copy[i] - avg) > 0.12) e[i] = copy[i] * 0.7 + avg * 0.3;
      }
    }
}

/** Classify a single land tile's biome from its climate. Exported for god powers. */
export function biomeFor(elev: number, temp: number, moist: number, alien: boolean): number {
  const P = moist / 255;
  let b: number;
  if (elev > 0.62) b = T.MOUNTAIN;
  else if (temp < -14) b = T.GLACIER;
  else if (temp < -5) b = T.SNOW;
  else if (temp < 0) b = P > 0.45 ? T.TAIGA : T.TUNDRA;
  else if (elev > 0.42) b = T.HILLS;
  else if (temp < 7) b = P > 0.38 ? T.TAIGA : P > 0.16 ? T.STEPPE : T.TUNDRA;
  else if (temp < 19) b = P < 0.14 ? T.DESERT : P < 0.3 ? T.STEPPE : P < 0.56 ? T.GRASS : T.FOREST;
  else b = P < 0.16 ? T.DESERT : P < 0.36 ? T.SAVANNA : P < 0.62 ? T.GRASS : T.JUNGLE;
  if (alien) {
    if (b === T.GRASS || b === T.FOREST || b === T.JUNGLE || b === T.TAIGA) b = T.ALIEN_GRASS;
    else if (b === T.DESERT || b === T.STEPPE || b === T.SAVANNA || b === T.TUNDRA) b = T.ALIEN;
  }
  return b;
}

function classifyBiomes(
  map: TileMap,
  rng: Rng,
  bDist: Float32Array,
  bConv: Float32Array,
  bOcean: Uint8Array,
  R: number,
  p: WorldGenParams,
): void {
  const { w: W, h: H, n } = map;
  const e = map.elev;
  // distance to land for shelf classification (BFS up to 3)
  const dland = new Uint8Array(n).fill(255);
  const q = new Int32Array(n);
  let qh = 0;
  let qt = 0;
  for (let i = 0; i < n; i++)
    if (e[i] > 0) {
      dland[i] = 0;
      q[qt++] = i;
    }
  while (qh < qt) {
    const i = q[qh++];
    if (dland[i] >= 3) continue;
    const x = i % W;
    const y = (i / W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX4[d];
      const ny = y + DY4[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (dland[j] > dland[i] + 1) {
        dland[j] = dland[i] + 1;
        q[qt++] = j;
      }
    }
  }
  for (let i = 0; i < n; i++) {
    if (map.terrain[i] === T.LAKE) continue;
    if (e[i] <= 0) {
      const depth = -e[i];
      map.terrain[i] = depth < 0.1 || dland[i] <= 1 ? T.SHALLOW : depth < 0.42 ? T.OCEAN : T.DEEP;
      continue;
    }
    let b = biomeFor(e[i], map.temp[i], map.moist[i], p.alien);
    // wetlands: low, wet, flat, near rivers
    if ((b === T.GRASS || b === T.FOREST || b === T.JUNGLE || b === T.TAIGA) && e[i] < 0.09 && map.moist[i] > 150 && map.hasFreshWater(i))
      b = rng.chance(0.55) ? T.SWAMP : b;
    // volcanic arcs near oceanic convergent boundaries
    if (bDist[i] < R * 0.35 && bConv[i] > 0.4 && bOcean[i] && e[i] > 0.15 && rng.chance(0.18)) b = T.VOLCANIC;
    map.terrain[i] = b;
  }
  // beaches
  for (let i = 0; i < n; i++) {
    const t = map.terrain[i];
    if (isWaterTerrain(t) || e[i] > 0.05) continue;
    if (t === T.SWAMP || t === T.MOUNTAIN || t === T.GLACIER || map.temp[i] < 1) continue;
    if (map.isCoastal(i) && (map.moist[i] < 190 || rng.chance(0.5))) map.terrain[i] = T.BEACH;
  }
  // grow volcanic patches into small regions and mark vents at local highs
  for (let i = 0; i < n; i++) {
    if (map.terrain[i] !== T.VOLCANIC) continue;
    const x = i % W;
    const y = (i / W) | 0;
    let isPeak = true;
    for (let d = 0; d < 8; d++) {
      const nx = x + DX8[d];
      const ny = y + DY8[d];
      if (!map.inBounds(nx, ny)) continue;
      const j = ny * W + nx;
      if (e[j] > e[i]) isPeak = false;
      if (map.isLand(j) && map.terrain[j] !== T.MOUNTAIN && rng.chance(0.25)) map.terrain[j] = T.VOLCANIC;
    }
    if (isPeak && rng.chance(0.5)) map.hazard[i] |= HAZARD.VENT;
  }
  // fantasy: rare enchanted crystal fields
  if (p.fantasy) {
    const count = Math.round((n / 65536) * 3);
    for (let k = 0; k < count; k++) {
      const cx = rng.int(0, W - 1);
      const cy = rng.int(0, H - 1);
      map.forRadius(cx, cy, rng.range(2, 4.5), (j) => {
        if (map.isLand(j) && map.terrain[j] !== T.MOUNTAIN && rng.chance(0.8)) map.terrain[j] = T.CRYSTAL;
      });
    }
  }
}

function computeSoilAndVegetation(map: TileMap, rng: Rng, noise: Simplex2): void {
  const { w: W, n } = map;
  const nf = 6 / Math.max(map.w, map.h);
  for (let i = 0; i < n; i++) {
    const t = map.terrain[i];
    const def = TERRAIN[t];
    if (def.water) {
      map.fert[i] = 0;
      map.veg[i] = 0;
      continue;
    }
    const x = i % W;
    const y = (i / W) | 0;
    const P = map.moist[i] / 255;
    const nz = noise.noise(x * nf + 500, y * nf + 500);
    let fert = def.fertility * (0.55 + 0.6 * Math.min(1, P * 1.6)) + 18 * nz;
    if (map.hasFreshWater(i)) fert += 45; // floodplains & lakeshores
    map.fert[i] = clamp(Math.round(fert), 0, 255);
    const vcap = vegCapacity(map, i);
    map.veg[i] = clamp(Math.round(vcap * (0.75 + 0.25 * nz) * rng.range(0.85, 1)), 0, 255);
  }
}

/** Vegetation carrying capacity for a tile under current climate (0..255). */
export function vegCapacity(map: TileMap, i: number): number {
  const def = TERRAIN[map.terrain[i]];
  if (def.water) return 0;
  const P = map.moist[i] / 255;
  return clamp(def.vegCap * (0.5 + 0.7 * Math.min(1, P * 1.5)), 0, 255);
}

interface DepositRule {
  dep: number;
  perThousand: number;
  cluster: [number, number];
  suit: (map: TileMap, i: number, bd: number) => number;
}

function placeDeposits(map: TileMap, rng: Rng, bDist: Float32Array, R: number, p: WorldGenParams): void {
  const { n } = map;
  const e = map.elev;
  let land = 0;
  let water = 0;
  for (let i = 0; i < n; i++) e[i] > 0 ? land++ : water++;
  const isHighland = (t: number) => t === T.HILLS || t === T.MOUNTAIN;
  const rules: DepositRule[] = [
    { dep: Deposit.COPPER, perThousand: 2.2, cluster: [1, 3], suit: (m, i, bd) => (isHighland(m.terrain[i]) ? 1 : 0.1) * (0.4 + bd) },
    { dep: Deposit.TIN, perThousand: 0.75, cluster: [1, 2], suit: (m, i, bd) => (isHighland(m.terrain[i]) ? 1 : 0.05) * (1.3 - bd) },
    {
      dep: Deposit.IRON,
      perThousand: 3.0,
      cluster: [2, 4],
      suit: (m, i) => {
        const t = m.terrain[i];
        return t === T.HILLS ? 2 : t === T.MOUNTAIN ? 1.4 : t === T.SWAMP ? 1.5 : 0.5;
      },
    },
    { dep: Deposit.GOLD, perThousand: 0.9, cluster: [1, 2], suit: (m, i) => (isHighland(m.terrain[i]) ? 1 : 0.05) * (m.hasFreshWater(i) ? 2.5 : 1) },
    { dep: Deposit.GEMS, perThousand: 0.55, cluster: [1, 1], suit: (m, i) => (m.terrain[i] === T.MOUNTAIN ? 2 : m.terrain[i] === T.VOLCANIC ? 1.2 : m.terrain[i] === T.HILLS ? 0.5 : 0) },
    {
      dep: Deposit.COAL,
      perThousand: 2.2,
      cluster: [3, 6],
      suit: (m, i, bd) => {
        const t = m.terrain[i];
        const ok = t === T.GRASS || t === T.FOREST || t === T.TAIGA || t === T.STEPPE || t === T.HILLS || t === T.SWAMP;
        return ok && m.elev[i] < 0.45 && m.moist[i] > 50 ? 1.2 - bd * 0.6 : 0.02;
      },
    },
    {
      dep: Deposit.OIL,
      perThousand: 1.6,
      cluster: [2, 5],
      suit: (m, i) => {
        const t = m.terrain[i];
        const w = t === T.DESERT ? 2.6 : t === T.STEPPE ? 1.5 : t === T.SWAMP ? 1.6 : t === T.TUNDRA ? 1.2 : t === T.BEACH ? 1.4 : t === T.GRASS || t === T.SAVANNA ? 0.6 : 0.1;
        return m.elev[i] < 0.4 ? w : w * 0.2;
      },
    },
    {
      dep: Deposit.GAS,
      perThousand: 1.0,
      cluster: [2, 4],
      suit: (m, i) => {
        const t = m.terrain[i];
        return (t === T.TUNDRA ? 2 : t === T.DESERT || t === T.STEPPE ? 1.4 : t === T.SWAMP ? 1.2 : 0.3) * (m.elev[i] < 0.4 ? 1 : 0.2);
      },
    },
    {
      dep: Deposit.URANIUM,
      perThousand: 0.35,
      cluster: [1, 2],
      suit: (m, i) => {
        const t = m.terrain[i];
        return t === T.MOUNTAIN || t === T.HILLS ? 1 : t === T.DESERT ? 0.9 : 0.05;
      },
    },
    {
      dep: Deposit.RARE,
      perThousand: 0.45,
      cluster: [1, 2],
      suit: (m, i, bd) => {
        const t = m.terrain[i];
        return (t === T.VOLCANIC ? 2.2 : t === T.MOUNTAIN ? 1.4 : t === T.DESERT ? 0.8 : 0.05) * (0.5 + bd);
      },
    },
    {
      dep: Deposit.SPICES,
      perThousand: 1.5,
      cluster: [2, 4],
      suit: (m, i) => {
        const t = m.terrain[i];
        if (m.temp[i] < 19) return 0;
        return t === T.JUNGLE ? 2 : t === T.FOREST || t === T.SAVANNA || t === T.GRASS ? 0.6 : 0;
      },
    },
    {
      dep: Deposit.FURS,
      perThousand: 1.4,
      cluster: [2, 5],
      suit: (m, i) => {
        const t = m.terrain[i];
        return t === T.TAIGA ? 2 : t === T.TUNDRA ? 0.8 : t === T.FOREST && m.temp[i] < 9 ? 1 : 0;
      },
    },
  ];
  if (p.fantasy || p.alien) {
    rules.push({
      dep: Deposit.EXOTIC,
      perThousand: 0.15,
      cluster: [1, 1],
      suit: (m, i) => (m.terrain[i] === T.CRYSTAL ? 4 : m.terrain[i] === T.MOUNTAIN ? 0.6 : m.terrain[i] === T.ALIEN ? 0.5 : 0.02),
    });
  }
  const weights = new Float64Array(n);
  for (const rule of rules) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      let w = 0;
      if (e[i] > 0 && map.dep[i] === 0 && map.terrain[i] !== T.LAKE && map.terrain[i] !== T.GLACIER) {
        const bd = bDist[i] < R ? 1 - bDist[i] / R : 0;
        w = Math.max(0, rule.suit(map, i, bd));
      }
      total += w;
      weights[i] = total; // cumulative
    }
    if (total <= 0) continue;
    const clusters = Math.round(((land / 1000) * rule.perThousand * p.resources) * rng.range(0.8, 1.2));
    const def = DEPOSITS[rule.dep];
    for (let c = 0; c < clusters; c++) {
      const r = rng.float() * total;
      let lo = 0;
      let hi = n - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (weights[mid] < r) lo = mid + 1;
        else hi = mid;
      }
      let cur = lo;
      const size = rng.int(rule.cluster[0], rule.cluster[1]);
      for (let s = 0; s < size; s++) {
        const bdc = bDist[cur] < R ? 1 - bDist[cur] / R : 0;
        if (map.isLand(cur) && map.dep[cur] === 0 && map.terrain[cur] !== T.LAKE && rule.suit(map, cur, bdc) > 0) {
          map.dep[cur] = rule.dep;
          map.depAmt[cur] = Math.round(rng.range(def.amount[0], def.amount[1]));
        }
        const d = rng.int(0, 7);
        const nx = map.xOf(cur) + DX8[d];
        const ny = map.yOf(cur) + DY8[d];
        if (map.inBounds(nx, ny)) cur = ny * map.w + nx;
      }
    }
  }
  // fishing grounds: shallow coastal water, more near river mouths and in cool seas
  if (water > 0) {
    for (let i = 0; i < n; i++) {
      const t = map.terrain[i];
      if (t !== T.SHALLOW && t !== T.LAKE) continue;
      let chance = t === T.LAKE ? 0.12 : 0.1;
      const x = map.xOf(i);
      const y = map.yOf(i);
      for (let d = 0; d < 8; d++) {
        const nx = x + DX8[d];
        const ny = y + DY8[d];
        if (map.inBounds(nx, ny) && map.river[ny * map.w + nx] > 0) chance += 0.35;
      }
      if (map.temp[i] < 12 && map.temp[i] > -2) chance += 0.06;
      if (rng.chance(chance * Math.min(1.5, p.resources))) {
        map.dep[i] = Deposit.FISH;
        map.depAmt[i] = rng.int(160, 255);
      }
    }
  }
}
