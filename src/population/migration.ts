/**
 * Migration: people leave settlements suffering hunger, unrest or
 * overcrowding and move toward known settlements that are more prosperous,
 * better fed and have room — preferring their own civilization; foreign
 * destinations depend on migration policies. Migration carries culture and
 * religion with it.
 */
import { findPath } from '../world/pathfinding';
import type { Sim } from '../sim/context';
import type { Civ, Settlement } from '../sim/types';
import { BALANCE } from '../config/balance';
import { clamp } from '../core/math';
import { removePeople } from './demography';
import { spawnAgent } from './agents';
import { isKnown } from '../civilizations/knowledge';

export function emigrate(sim: Sim, s: Settlement, civ: Civ, adequacy: number): void {
  const w = sim.w;
  if (!w.laws.migration || s.pop < 20) return;
  if (civ.policies.migration === 'closed') return;
  const distress = clamp((1 - adequacy) * 1.2 + Math.max(0, s.unrest - 0.5) + Math.max(0, s.pop / Math.max(1, s.housing) - 1.3) * 0.3, 0, 1);
  if (distress < 0.08) return;
  const amount = (s.pop * BALANCE.maxEmigration * distress) / 4; // quarterly
  if (amount < 5) return;
  // choose destination
  let best: Settlement | null = null;
  let bestScore = 0;
  for (const o of w.settlements.values()) {
    if (o === s || o.pop < 20) continue;
    const d = Math.hypot(o.x - s.x, o.y - s.y);
    if (d > 40) continue;
    if (o.civId !== civ.id) {
      if (!isKnown(sim, civ.id, w.map.idx(o.x, o.y))) continue;
      const oc = w.civs.get(o.civId);
      if (!oc || oc.policies.migration === 'closed') continue;
    }
    const room = clamp(1.2 - o.pop / Math.max(1, o.housing), 0, 1);
    let score = (o.prosperity - s.prosperity + 0.5) * (0.3 + room) / (1 + d / 10);
    if (o.civId === civ.id) score *= 1.5;
    if (o.epidemics.length) score *= 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  if (!best) return;
  const removed = removePeople(sim, s, amount, 'emigration');
  if (removed <= 0) return;
  s.flows.emigration += removed;
  // migrants follow known corridors: reuse (and remember) the settlement's planned route to this destination
  const routes = (s.routes ??= {});
  let path = routes[best.id];
  if (!path) {
    path = findPath(w.map, w.map.idx(s.x, s.y), w.map.idx(best.x, best.y), { mode: 'land', maxNodes: 12000 }) ?? [];
    routes[best.id] = path;
    const keys = Object.keys(routes);
    if (keys.length > 16) delete routes[Number(keys[0])]; // bounded memory per settlement
  }
  const a = spawnAgent(sim, distress > 0.6 ? 'refugee' : 'migrant', civ.id, s.x, s.y, best.x, best.y, {
    path,
    pop: removed,
    cultureId: s.cultures[0]?.id ?? civ.cultureId,
    religionId: s.religions[0]?.id ?? 0,
    species: s.species,
    from: s.id,
  });
  if (!a) {
    // unreachable: they settle directly (short-range move)
    best.flows.immigration += removed;
  }
}
