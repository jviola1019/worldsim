/**
 * Territory: each settlement projects influence over nearby tiles (stronger
 * with population, culture, administration and transport). Unowned tiles in
 * range are claimed; tiles of a weaker same-civ settlement are reassigned;
 * empty tiles of a much weaker foreign settlement can be absorbed (border
 * friction is recorded as disputes); built-up foreign tiles change hands only
 * through conquest or treaties. Distant unused tiles are released when a
 * settlement shrinks.
 */
import type { Sim } from '../sim/context';
import type { Civ, Settlement } from '../sim/types';
import { markOverlay } from '../sim/context';
import { T } from '../world/terrain';
import { clamp } from '../core/math';
import { ensureRelation } from './knowledge';
import { markSitesDirty } from '../economy/production';

export function settlementRadius(s: Settlement, civ: Civ | undefined): number {
  const caps = civ?.caps;
  const admin = caps ? caps.adminCapacity * 0.08 + caps.roadTier * 0.12 + caps.communication * 0.03 : 0;
  const r = 1.6 + Math.sqrt(Math.max(0, s.pop)) / 22 * (1 + admin) + (s.capital ? 0.6 : 0);
  return clamp(r, 1.6, 13);
}

export function influence(s: Settlement, civ: Civ | undefined, d: number): number {
  const strength = 1 + Math.log10(Math.max(1, s.pop) + 10) + (civ ? civ.caps.culturalOutput * 0.5 : 0) + (s.capital ? 0.5 : 0);
  return strength / (1 + d);
}

/** Move a tile (and the building on it) to another settlement's control. */
export function setTileSettlement(sim: Sim, i: number, sid: number): void {
  const w = sim.w;
  const m = w.map;
  const prev = m.settle[i];
  if (prev === sid) return;
  const b = m.bld[i];
  if (prev) {
    const ps = w.settlements.get(prev);
    if (ps) {
      if (b && !(m.bldFlags[i] & 8)) ps.bld[b] = Math.max(0, ps.bld[b] - 1);
      ps.territory = Math.max(0, ps.territory - 1);
      markSitesDirty(sim, prev);
      removeBldTile(sim, prev, i);
    }
  }
  m.settle[i] = sid;
  const ns = sid ? w.settlements.get(sid) : undefined;
  m.owner[i] = ns ? ns.civId : 0;
  if (ns) {
    if (b && !(m.bldFlags[i] & 8)) ns.bld[b]++;
    ns.territory++;
    markSitesDirty(sim, sid);
    if (b) addBldTile(sim, sid, i);
  }
  markOverlay(sim, i);
}

export function bldTiles(sim: Sim, sid: number): number[] {
  let map = sim.cache.bldTiles as Map<number, number[]> | undefined;
  if (!map) sim.cache.bldTiles = map = new Map();
  let arr = map.get(sid);
  if (!arr) {
    arr = [];
    const s = sim.w.settlements.get(sid);
    const m = sim.w.map;
    if (s) m.forRadius(s.x, s.y, 16, (i) => {
      if (m.settle[i] === sid && m.bld[i]) arr!.push(i);
    });
    map.set(sid, arr);
  }
  return arr;
}

export function addBldTile(sim: Sim, sid: number, i: number): void {
  const arr = bldTiles(sim, sid);
  if (!arr.includes(i)) arr.push(i);
}

export function removeBldTile(sim: Sim, sid: number, i: number): void {
  const map = sim.cache.bldTiles as Map<number, number[]> | undefined;
  const arr = map?.get(sid);
  if (!arr) return;
  const k = arr.indexOf(i);
  if (k >= 0) arr.splice(k, 1);
}

export function recomputeTerritory(sim: Sim, s: Settlement): void {
  const w = sim.w;
  const m = w.map;
  const civ = w.civs.get(s.civId);
  const r = settlementRadius(s, civ);
  s.radius = r;
  const disputes = new Map<number, number>();
  m.forRadius(s.x, s.y, r, (i, x, y, d2) => {
    const t = m.terrain[i];
    if (t === T.DEEP || t === T.OCEAN) return;
    if (t === T.SHALLOW && d2 > 2.3) return; // keep only near-shore waters
    const d = Math.sqrt(d2);
    const cur = m.settle[i];
    if (cur === s.id) return;
    if (!cur) {
      setTileSettlement(sim, i, s.id);
      return;
    }
    const other = w.settlements.get(cur);
    if (!other) {
      setTileSettlement(sim, i, s.id);
      return;
    }
    const mine = influence(s, civ, d);
    const theirs = influence(other, w.civs.get(other.civId), Math.hypot(x - other.x, y - other.y));
    if (other.civId === s.civId) {
      if (mine > theirs * 1.05 && i !== m.idx(other.x, other.y)) setTileSettlement(sim, i, s.id);
    } else {
      disputes.set(other.civId, (disputes.get(other.civId) ?? 0) + 1);
      if (!m.bld[i] && mine > theirs * 1.4 && i !== m.idx(other.x, other.y)) setTileSettlement(sim, i, s.id);
    }
  });
  // release far, unbuilt tiles when shrinking
  const rr = r * 1.3 + 1;
  m.forRadius(s.x, s.y, rr + 3, (i, x, y, d2) => {
    if (m.settle[i] !== s.id || m.bld[i]) return;
    if (d2 > rr * rr) setTileSettlement(sim, i, 0);
  });
  for (const [oc, n] of disputes) {
    const rel = ensureRelation(sim, s.civId, oc);
    rel.disputes = Math.min(500, rel.disputes * 0.7 + n);
  }
  s.lastTerritory = w.tick;
}

/** Tiles controlled by a settlement (scan within a bounded radius). */
export function territoryTiles(sim: Sim, s: Settlement): number[] {
  const out: number[] = [];
  const m = sim.w.map;
  m.forRadius(s.x, s.y, Math.max(3, s.radius * 1.4 + 2), (i) => {
    if (m.settle[i] === s.id) out.push(i);
  });
  return out;
}
