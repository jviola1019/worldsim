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
