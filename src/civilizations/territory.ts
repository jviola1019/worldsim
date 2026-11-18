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
  forgetOwnTiles(sim, prev);
  forgetOwnTiles(sim, sid);
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

/**
 * Built tiles of a settlement, scanned from the map and memoized for the current tick only.
 * (A long-lived incremental list could drift from the map and make a restored save diverge.)
 */
export function bldTiles(sim: Sim, sid: number): number[] {
  let c = sim.cache.bldTiles as { tick: number; map: Map<number, number[]> } | undefined;
  if (!c || c.tick !== sim.w.tick) sim.cache.bldTiles = c = { tick: sim.w.tick, map: new Map() };
  let arr = c.map.get(sid);
  if (!arr) {
    arr = [];
    const s = sim.w.settlements.get(sid);
    const m = sim.w.map;
    if (s) m.forRadius(s.x, s.y, 16, (i) => {
      if (m.settle[i] === sid && m.bld[i]) arr!.push(i);
    });
    c.map.set(sid, arr);
  }
  return arr;
}

/** Kept for call sites that announce building changes: drop this tick's memo for the settlement. */
export function addBldTile(sim: Sim, sid: number, _i: number): void {
  (sim.cache.bldTiles as { map: Map<number, number[]> } | undefined)?.map.delete(sid);
}

export function removeBldTile(sim: Sim, sid: number, _i: number): void {
  (sim.cache.bldTiles as { map: Map<number, number[]> } | undefined)?.map.delete(sid);
}

export function recomputeTerritory(sim: Sim, s: Settlement): void {
  const w = sim.w;
  const m = w.map;
  const civ = w.civs.get(s.civId);
  const r = settlementRadius(s, civ);
  if (s.radius !== r) forgetOwnTiles(sim, s.id);
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

/** A settlement's own tiles near its centre, in raster order (see eachOwnTile). Tick-memoized, derived only. */
type OwnTiles = { r: number; i: number[]; x: number[]; y: number[]; d2: number[] };

function ownTiles(sim: Sim, s: Settlement): OwnTiles {
  let c = sim.cache.ownTiles as { tick: number; map: Map<number, OwnTiles> } | undefined;
  if (!c || c.tick !== sim.w.tick) sim.cache.ownTiles = c = { tick: sim.w.tick, map: new Map() };
  const R = Math.max(2, s.radius + 1);
  let t = c.map.get(s.id);
  if (!t || t.r !== R) {
    const m = sim.w.map;
    const nt: OwnTiles = { r: R, i: [], x: [], y: [], d2: [] };
    m.forRadius(s.x, s.y, R, (i, x, y, d2) => {
      if (m.settle[i] !== s.id) return;
      nt.i.push(i); nt.x.push(x); nt.y.push(y); nt.d2.push(d2);
    });
    c.map.set(s.id, nt);
    t = nt;
  }
  return t;
}

/** Drop the memo for a settlement whose tiles changed. */
export function forgetOwnTiles(sim: Sim, sid: number): void {
  if (sid) (sim.cache.ownTiles as { map: Map<number, OwnTiles> } | undefined)?.map.delete(sid);
}

/**
 * Visit the settlement's own tiles within radius r (r ≤ max(2, radius + 1)) in exactly the order
 * map.forRadius(s.x, s.y, r, …) would, skipping tiles that belong to other settlements.
 */
export function eachOwnTile(sim: Sim, s: Settlement, r: number, fn: (i: number, x: number, y: number, d2: number) => void): void {
  const t = ownTiles(sim, s);
  if (r > t.r) throw new Error('eachOwnTile radius beyond memo');
  const r2 = r * r;
  for (let k = 0; k < t.i.length; k++) if (t.d2[k] <= r2) fn(t.i[k], t.x[k], t.y[k], t.d2[k]);
}
