/** Geometry and terrain measurements used by the map-shape tests (tests/world/presets.test.ts). */
import { generateWorld, DEFAULT_GEN } from '../../src/world/worldgen';
import { applyMapShape } from '../../src/config/laws';
import type { MapShape } from '../../src/world/mapShapes';
import type { TileMap } from '../../src/world/tilemap';
import { T, TERRAIN } from '../../src/world/terrain';

export function shapedWorld(shape: MapShape, size: number, seed: string): TileMap {
  return generateWorld(applyMapShape({ ...DEFAULT_GEN, seed, width: size, height: size }, shape)).map;
}

/** Centred, size-normalised coordinates of a tile: u, v in -1..1, r = distance from the centre. */
export function polar(m: TileMap, i: number): { u: number; v: number; r: number; cheb: number } {
  const half = Math.max(m.w, m.h) / 2;
  const u = (m.xOf(i) + 0.5 - m.w / 2) / half;
  const v = (m.yOf(i) + 0.5 - m.h / 2) / half;
  return { u, v, r: Math.hypot(u, v), cheb: Math.max(Math.abs(u), Math.abs(v)) };
}

export function landFraction(m: TileMap): number {
  let land = 0;
  for (let i = 0; i < m.n; i++) if (m.isLand(i)) land++;
  return land / m.n;
}

/** Share of land among tiles matching a region predicate (NaN if the region is empty). */
export function landShareIn(m: TileMap, region: (p: ReturnType<typeof polar>) => boolean): number {
  let tiles = 0;
  let land = 0;
  for (let i = 0; i < m.n; i++) {
    if (!region(polar(m, i))) continue;
    tiles++;
    if (m.isLand(i)) land++;
  }
  return land / tiles;
}

/** Share of all land tiles that lie in a region. */
export function shareOfLandIn(m: TileMap, region: (p: ReturnType<typeof polar>) => boolean): number {
  let land = 0;
  let inRegion = 0;
  for (let i = 0; i < m.n; i++) {
    if (!m.isLand(i)) continue;
    land++;
    if (region(polar(m, i))) inRegion++;
  }
  return inRegion / land;
}

/** Sizes of 4-connected components of tiles matching `pred`, largest first. */
export function components(m: TileMap, pred: (i: number) => boolean): number[] {
  const seen = new Uint8Array(m.n);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let s = 0; s < m.n; s++) {
    if (seen[s] || !pred(s)) continue;
    let size = 0;
    seen[s] = 1;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = m.xOf(i);
      const y = m.yOf(i);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!m.inBounds(nx, ny)) continue;
        const j = ny * m.w + nx;
        if (!seen[j] && pred(j)) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => b - a);
}

/** Land components as fractions of all land, largest first. */
export function landComponents(m: TileMap): number[] {
  const sizes = components(m, (i) => m.isLand(i));
  const land = sizes.reduce((a, b) => a + b, 0);
  return sizes.map((s) => s / land);
}

/** True if the water body containing the map centre never reaches the map's outer ring. */
export function centreSeaEnclosed(m: TileMap): boolean {
  const start = m.idx(m.w >> 1, m.h >> 1);
  if (!m.isWater(start)) return false;
  const seen = new Uint8Array(m.n);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    if (polar(m, i).r > 0.9) return false;
    const x = m.xOf(i);
    const y = m.yOf(i);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!m.inBounds(nx, ny)) continue;
      const j = ny * m.w + nx;
      if (!seen[j] && m.isWater(j)) {
        seen[j] = 1;
        stack.push(j);
      }
    }
  }
  return true;
}

/** Land share in each of `n` angular sectors of an annulus around the centre. */
export function sectorLand(m: TileMap, rIn: number, rOut: number, n: number): number[] {
  const tiles = new Array(n).fill(0);
  const land = new Array(n).fill(0);
  for (let i = 0; i < m.n; i++) {
    const p = polar(m, i);
    if (p.r < rIn || p.r > rOut) continue;
    const k = Math.min(n - 1, Math.floor(((Math.atan2(p.v, p.u) + Math.PI) / (2 * Math.PI)) * n));
    tiles[k]++;
    if (m.isLand(i)) land[k]++;
  }
  return land.map((l, k) => l / tiles[k]);
}

/** Land/sea switches met walking once around a circle of radius r (ignoring runs shorter than `minRun` samples). */
export function ringSwitches(m: TileMap, r: number, samples = 720, minRun = 6): number {
  const half = Math.max(m.w, m.h) / 2;
  const seq: boolean[] = [];
  for (let k = 0; k < samples; k++) {
    const a = (k / samples) * Math.PI * 2;
    const x = Math.floor(m.w / 2 + Math.cos(a) * r * half);
    const y = Math.floor(m.h / 2 + Math.sin(a) * r * half);
    seq.push(m.isLand(m.idx(x, y)));
  }
  // collapse into runs, drop short runs, count changes around the loop
  const runs: { land: boolean; len: number }[] = [];
  for (const s of seq) {
    const last = runs[runs.length - 1];
    if (last && last.land === s) last.len++;
    else runs.push({ land: s, len: 1 });
  }
  if (runs.length > 1 && runs[0].land === runs[runs.length - 1].land) runs[0].len += runs.pop()!.len;
  const kept = runs.filter((x) => x.len >= minRun);
  let switches = 0;
  for (let k = 0; k < kept.length; k++) if (kept[k].land !== kept[(k + 1) % kept.length].land) switches++;
  return switches;
}

/** Share of tiles whose land/sea state equals that of their east-west mirror tile. */
export function mirrorAgreement(m: TileMap): number {
  let same = 0;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.isLand(m.idx(x, y)) === m.isLand(m.idx(m.w - 1 - x, y))) same++;
  return same / m.n;
}

export function terrainShareOfLand(m: TileMap, kinds: number[]): number {
  let land = 0;
  let hit = 0;
  for (let i = 0; i < m.n; i++) {
    if (!m.isLand(i)) continue;
    land++;
    if (kinds.includes(m.terrain[i])) hit++;
  }
  return hit / land;
}

export const COLD = [T.SNOW, T.GLACIER, T.TUNDRA, T.TAIGA];

/** Tiles where a people could start (the start-site rule: habitable, buildable land). */
export const isHabitable = (m: TileMap, i: number): boolean => m.isLand(i) && TERRAIN[m.terrain[i]].habitability >= 0.6 && TERRAIN[m.terrain[i]].buildable;

/**
 * Inside the continent body (r < 0.5), compare tiles where the land target is
 * strongly negative (a sunken trough) with the rest: tile count, water share
 * and mean elevation of each.
 */
export function sunkenInterior(m: TileMap, field: Float32Array): { tiles: number; water: number; elev: number; restElev: number } {
  let tiles = 0;
  let water = 0;
  let elev = 0;
  let rest = 0;
  let restElev = 0;
  for (let i = 0; i < m.n; i++) {
    if (polar(m, i).r >= 0.5) continue;
    if (field[i] < -0.3) {
      tiles++;
      elev += m.elev[i];
      if (m.isWater(i)) water++;
    } else {
      rest++;
      restElev += m.elev[i];
    }
  }
  return { tiles, water: water / Math.max(1, tiles), elev: elev / Math.max(1, tiles), restElev: restElev / Math.max(1, rest) };
}
