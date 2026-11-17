/**
 * Mobile groups: settlers (found new settlements), explorers (reveal the map),
 * migrants & refugees (move people between settlements), missionaries
 * (carry religion), colonists (overseas settlement). Agents follow A* paths;
 * their speed depends on terrain and roads. Arrival effects are applied to
 * real simulation state.
 */
import { migrate, record } from './ledger';
import type { Sim } from '../sim/context';
import type { Agent, AgentKind, Settlement, SpeciesKey } from '../sim/types';
import { findPath } from '../world/pathfinding';
import { BALANCE } from '../config/balance';
import { addPeople } from './demography';
import { foundSettlement, mixShares } from '../civilizations/settlement';
import { revealAround } from '../civilizations/knowledge';
import { logEvent } from '../history/events';
import { godSpreadReligion } from '../culture/religion';

export function spawnAgent(
  sim: Sim,
  kind: AgentKind,
  civId: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  o: { pop?: number; cultureId?: number; religionId?: number; species?: SpeciesKey; from?: number; leader?: number; sea?: boolean; path?: number[] } = {},
): Agent | null {
  const w = sim.w;
  const m = w.map;
  const path = o.path ?? findPath(m, m.idx(fromX, fromY), m.idx(toX, toY), { mode: o.sea ? 'any' : 'land', maxNodes: 12000 });
  if (!path || !path.length) return null;
  const a: Agent = {
    id: ++w.ids.agent,
    kind,
    civId,
    x: fromX + 0.5,
    y: fromY + 0.5,
    path,
    pathPos: 0,
    targetX: toX,
    targetY: toY,
    fromSettlement: o.from ?? 0,
    pop: o.pop ?? 0,
    cultureId: o.cultureId ?? 0,
    religionId: o.religionId ?? 0,
    speciesKey: o.species ?? 'human',
    leaderId: o.leader ?? 0,
    ttl: 120 * 8,
  };
  w.agents.set(a.id, a);
  return a;
}

export function agentsTick(sim: Sim): void {
  const w = sim.w;
  const m = w.map;
  const done: number[] = [];
  for (const a of w.agents.values()) {
    a.ttl--;
    const civ = w.civs.get(a.civId);
    const speedBonus = civ ? 1 + civ.caps.landSpeed * 0.5 : 1;
    if (a.pathPos >= a.path.length - 1 || a.ttl <= 0) {
      arrive(sim, a);
      done.push(a.id);
      continue;
    }
    const next = a.path[a.pathPos + 1];
    const nx = m.xOf(next) + 0.5;
    const ny = m.yOf(next) + 0.5;
    const dx = nx - a.x;
    const dy = ny - a.y;
    const d = Math.hypot(dx, dy);
    const cost = Math.max(0.15, m.isWater(next) ? 0.7 : m.landMoveCost(next));
    const step = (BALANCE.armyBaseSpeed * speedBonus) / cost;
    if (d <= step) {
      a.x = nx;
      a.y = ny;
      a.pathPos++;
      if (a.kind === 'explorer' && civ && a.pathPos % 3 === 0) revealAround(sim, civ, a.x, a.y, 6);
    } else {
      a.x += (dx / d) * step;
      a.y += (dy / d) * step;
    }
  }
  for (const id of done) w.agents.delete(id);
}

function arrive(sim: Sim, a: Agent): void {
  const w = sim.w;
  const m = w.map;
  const civ = w.civs.get(a.civId);
  const tx = a.targetX;
  const ty = a.targetY;
  const tile = m.idx(tx, ty);
  switch (a.kind) {
    case 'settler':
    case 'colonist': {
      // site taken meanwhile, or the nation is gone: settlers join the town there, else return home
      if (!civ || !civ.alive || m.settle[tile] || m.isWater(tile)) {
        joinOrLose(sim, a, w.settlements.get(m.settle[tile]) ?? w.settlements.get(a.fromSettlement));
        return;
      }
      const s = foundSettlement(sim, civ, tx, ty, { pop: a.pop, cultureId: a.cultureId, religionId: a.religionId, species: a.speciesKey, cause: a.kind === 'colonist' ? 'Overseas colonization' : 'Population pressure in ' + (w.settlements.get(a.fromSettlement)?.name ?? 'the homeland') });
      if (a.fromSettlement) {
        s.links.push(a.fromSettlement);
        w.settlements.get(a.fromSettlement)?.links.push(s.id);
      }
      break;
    }
    case 'migrant':
    case 'refugee': {
      const dest = w.settlements.get(m.settle[tile]) ?? [...w.settlements.values()].find((s) => s.x === tx && s.y === ty);
      // destination vanished on the way: go back to where they came from (or are lost)
      joinOrLose(sim, a, dest ?? w.settlements.get(a.fromSettlement));
      break;
    }
    case 'missionary': {
      const dest = w.settlements.get(m.settle[tile]);
      if (dest && a.religionId) godSpreadReligion(sim, dest, a.religionId, 0.04);
      break;
    }
    case 'explorer': {
      if (civ) {
        revealAround(sim, civ, a.x, a.y, 9);
        if (sim.rng.chance(0.3))
          logEvent(sim, { type: 'exploration', cat: 'founding', title: `Explorers of ${civ.name} charted distant lands`, civs: [civ.id], persons: a.leaderId ? [a.leaderId] : [], x: tx, y: ty, importance: 1 });
      }
      break;
    }
  }
}

/**
 * Put an arriving group's people into settlement `dest` (with culture/faith blending), or record them as
 * lost when no settlement can take them. Crossing into another nation is recorded as migration.
 */
function joinOrLose(sim: Sim, a: Agent, dest: Settlement | undefined): void {
  if (a.pop <= 0) return;
  if (!dest) {
    record(sim, a.civId, 'lost', a.pop);
    a.pop = 0;
    return;
  }
  addPeople(sim, dest, a.pop, a.cultureId, a.religionId);
  dest.flows.immigration += a.pop;
  migrate(sim, a.civId, dest.civId, a.pop);
  const frac = a.pop / Math.max(1, dest.pop + a.pop);
  mixShares(dest.cultures, a.cultureId, frac);
  if (a.religionId) mixShares(dest.religions, a.religionId, frac);
  a.pop = 0;
}
