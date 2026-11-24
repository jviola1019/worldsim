/**
 * A* pathfinding on the tile grid. Land movement costs come from terrain,
 * rivers (bridges), and infrastructure (roads, rails) — so building roads
 * genuinely shortens travel for settlers, traders and armies. Sea mode moves
 * over water (coastal/shallow cheaper than deep ocean for early navies).
 */
import { MinHeap } from '../core/heap';
import { DX8, DY8, DIST8 } from '../core/math';
import type { TileMap } from './tilemap';
import { T } from './terrain';

export interface PathOpts {
  mode: 'land' | 'sea' | 'any';
  /** Max expanded nodes (safety bound for mobile). */
  maxNodes?: number;
  railTier?: number;
  /** Allow deep ocean for sea mode (ocean navigation). */
  deepOk?: boolean;
  /** Extra per-tile cost hook (e.g. avoid enemy land). */
  extra?: (i: number) => number;
  /**
   * Round 7, planning a road: reusing an existing road is nearly free and a new road costs its
   * construction, so networks share trunk lines instead of laying parallel roads.
   */
  planRoad?: boolean | number;
}

let gScore = new Float32Array(0);
let came = new Int32Array(0);
let stamp = new Uint32Array(0);
let curStamp = 0;
const heap = new MinHeap(4096);

export function tileCost(map: TileMap, i: number, o: PathOpts): number {
  const t = map.terrain[i];
  const water = t <= T.LAKE;
  if (o.mode === 'land') {
    if (water) return Infinity;
    let c = map.landMoveCost(i);
    // a number is the planning nation: only its own (or unowned) roads are reused, since it never builds on foreign land
    if (o.planRoad) return map.roadTier(i) > 0 && (o.planRoad === true || !map.owner[i] || map.owner[i] === o.planRoad) ? 0.15 : c + 0.6;
    const rail = map.railTier(i);
    if (rail > 0 && (o.railTier ?? 0) > 0) c = Math.min(c, 0.12);
    return c;
  }
  if (o.mode === 'sea') {
    if (!water) return Infinity;
    if (t === T.DEEP && !o.deepOk) return 6;
    return t === T.OCEAN ? 0.8 : 0.6;
  }
  return water ? 0.7 : map.landMoveCost(i);
}

export function findPath(map: TileMap, from: number, to: number, o: PathOpts): number[] | null {
  const n = map.n;
  if (gScore.length !== n) {
    gScore = new Float32Array(n);
    came = new Int32Array(n);
    stamp = new Uint32Array(n);
    curStamp = 0;
  }
  curStamp++;
  if (curStamp === 0xffffffff) {
    stamp.fill(0);
    curStamp = 1;
  }
  const W = map.w;
  const tx = to % W;
  const ty = (to / W) | 0;
  const minCost = o.mode === 'land' ? 0.12 : 0.6;
  heap.clear();
  stamp[from] = curStamp;
  gScore[from] = 0;
  came[from] = -1;
  heap.push(from, 0);
  const maxNodes = o.maxNodes ?? 40000;
  let expanded = 0;
  while (heap.size > 0) {
    const cur = heap.pop();
    if (cur === to) break;
    if (++expanded > maxNodes) return null;
    const cx = cur % W;
    const cy = (cur / W) | 0;
    const g = gScore[cur];
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX8[d];
      const ny = cy + DY8[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= map.h) continue;
      const j = ny * W + nx;
      let c = j === to ? 1 : tileCost(map, j, o);
      if (!Number.isFinite(c)) continue;
      if (o.extra) c += o.extra(j);
      const ng = g + c * DIST8[d];
      if (stamp[j] === curStamp && ng >= gScore[j]) continue;
      stamp[j] = curStamp;
      gScore[j] = ng;
      came[j] = cur;
      const h = Math.max(Math.abs(nx - tx), Math.abs(ny - ty)) * minCost;
      heap.push(j, ng + h);
    }
  }
  if (stamp[to] !== curStamp) return null;
  const path: number[] = [];
  for (let c = to; c !== -1; c = came[c]) path.push(c);
  path.reverse();
  return path;
}

export function pathCost(map: TileMap, path: number[], o: PathOpts): number {
  let c = 0;
  for (let k = 1; k < path.length; k++) c += tileCost(map, path[k], o);
  return c;
}

/** Round 10: the nearest water tile within 2 tiles of (x, y), where a port's ships leave from; -1 if none. */
export function portTile(map: TileMap, x: number, y: number): number {
  let best = -1, bd = 99;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const px = x + dx, py = y + dy;
    if (!map.inBounds(px, py)) continue;
    const i = map.idx(px, py);
    const d = dx * dx + dy * dy;
    if (map.isWater(i) && d < bd) { bd = d; best = i; }
  }
  return best;
}

/** Round 10: a ship's path between two coastal land tiles: over water only (deep ocean needs deepOk), with the
 *  two shore tiles at its ends; null if no voyage exists. */
export function voyagePath(map: TileMap, from: number, to: number, deepOk: boolean, maxNodes = 20000): number[] | null {
  const a = portTile(map, map.xOf(from), map.yOf(from)), b = portTile(map, map.xOf(to), map.yOf(to));
  if (a < 0 || b < 0) return null;
  const sea = findPath(map, a, b, { mode: 'sea', maxNodes, deepOk });
  return sea ? [from, ...sea, to] : null;
}
