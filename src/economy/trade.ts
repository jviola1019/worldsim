/**
 * Transport networks & trade (yearly).
 *
 * INTERNAL LINKS: each settlement connects to its nearest same-civ
 * neighbours; civs with road/rail technology physically BUILD roads and rails
 * tile by tile along the A* path (consuming stone/metal), which lowers
 * movement cost for everyone (settlers, traders, armies) and raises market
 * access of connected settlements.
 *
 * INTERNATIONAL TRADE: civs with a trade agreement (and no war/embargo)
 * establish a route between their nearest settlements (land, river or sea).
 * Each year goods flow from the partner with surplus to the one with deficit,
 * in proportion to a gravity-style factor (economic size / route cost);
 * values are recorded as exports/imports, build trade dependence (relations)
 * and carry knowledge, religion and disease along the route. War or embargo
 * blocks the route: dependent importers lose those goods.
 */
import type { Sim } from '../sim/context';
import type { Civ, Settlement, TradeRoute } from '../sim/types';
import { findPath } from '../world/pathfinding';
import { GOOD_COUNT, Good, GOODS } from '../world/resources';
import { clamp, saturate } from '../core/math';
import { markTile } from '../sim/context';
import { ensureRelation, revealAround } from '../civilizations/knowledge';
import { atWarWith, hasTreaty } from '../politics/diplomacy';
import { logEvent } from '../history/events';
import { INFRA } from '../world/tilemap';

function nearestOwn(sim: Sim, s: Settlement, civ: Civ, k: number): Settlement[] {
  const out: { s: Settlement; d: number }[] = [];
  for (const id of civ.settlements) {
    const o = sim.w.settlements.get(id);
    if (!o || o === s) continue;
    const d = Math.hypot(o.x - s.x, o.y - s.y);
    if (d < 30) out.push({ s: o, d });
  }
  out.sort((a, b) => a.d - b.d || a.s.id - b.s.id);
  return out.slice(0, k).map((x) => x.s);
}

/** Build/upgrade infrastructure along a path, limited by a yearly tile budget. */
function improvePath(sim: Sim, civ: Civ, path: number[], budget: number): number {
  const m = sim.w.map;
  const road = Math.min(4, Math.round(civ.caps.roadTier));
  const rail = Math.min(4, Math.round(civ.caps.railTier));
  let used = 0;
  for (const i of path) {
    if (used >= budget) break;
    if (m.isWater(i)) continue;
    if (m.owner[i] && m.owner[i] !== civ.id) continue;
    let changed = false;
    if (road > 0 && m.roadTier(i) < road) {
      const stone = road >= 3 ? 6 : 2;
      if (civ.stock[Good.STONE] < stone) break;
      civ.stock[Good.STONE] -= stone;
      civ.acc.use[Good.STONE] += stone;
      civ.acc.inv += stone * civ.prices[Good.STONE];
      m.setRoad(i, road);
      if (m.river[i] > 0) m.infra[i] |= INFRA.BRIDGE;
      changed = true;
    }
    if (rail > 0 && m.railTier(i) < rail) {
      const metal = 4 * rail;
      if (civ.stock[Good.METAL] >= metal) {
        civ.stock[Good.METAL] -= metal;
        civ.acc.use[Good.METAL] += metal;
        civ.acc.inv += metal * civ.prices[Good.METAL];
        m.setRail(i, rail);
        changed = true;
      }
    }
    if (civ.caps.electrification > 0.5 && !(m.infra[i] & INFRA.GRID)) {
      m.infra[i] |= INFRA.GRID;
      changed = true;
    }
    if (changed) {
      markTile(sim, i);
      used++;
    }
  }
  return used;
}

export function infrastructureYearly(sim: Sim, civ: Civ): void {
  const w = sim.w;
  const m = w.map;
  const budget = Math.round(4 + civ.budget.infrastructure * 40 + civ.caps.construction * 6);
  let left = budget;
  for (const id of civ.settlements) {
    const s = w.settlements.get(id);
    if (!s) continue;
    const near = nearestOwn(sim, s, civ, 2);
    s.links = s.links.filter((l) => w.settlements.has(l));
    for (const o of near) {
      if (!s.links.includes(o.id)) s.links.push(o.id);
      if (!o.links.includes(s.id)) o.links.push(s.id);
      if (left <= 0 || civ.caps.roadTier < 1 || s.id > o.id) continue;
      const routes = (s.routes ??= {});
      let path: number[] | undefined = routes[o.id];
      // re-plan a route the land has cut (a coast flooded, a lake filled a valley)
      if (path && path.some((i) => m.isWater(i))) path = undefined;
      if (!path) {
        path = findPath(m, m.idx(s.x, s.y), m.idx(o.x, o.y), { mode: 'land', maxNodes: 8000, planRoad: civ.id }) ?? [];
        routes[o.id] = path;
      }
      left -= improvePath(sim, civ, path, Math.min(left, 12));
    }
    if (s.links.length > 6) s.links.length = 6;
  }
}

/** Positive = exportable surplus; negative = unmet demand (from recorded requests). */
function surplusOf(civ: Civ, g: number): number {
  const demand = Math.max(civ.acc.use[g], civ.acc.want[g]);
  return civ.acc.prod[g] - demand + civ.stock[g] * 0.1;
}

/** Yearly international trade; returns per-civ export/import values. */
export function tradeYearly(sim: Sim): Map<number, { exp: number; imp: number }> {
  const w = sim.w;
  const m = w.map;
  const totals = new Map<number, { exp: number; imp: number }>();
  const tot = (id: number) => {
    let t = totals.get(id);
    if (!t) totals.set(id, (t = { exp: 0, imp: 0 }));
    return t;
  };
  // establish routes for trade agreements
  for (const t of w.treaties.values()) {
    if (!t.active || t.kind !== 'trade') continue;
    const exists = [...w.routes.values()].some((r) => r.active && ((r.civA === t.a && r.civB === t.b) || (r.civA === t.b && r.civB === t.a)));
    if (exists) continue;
    const a = w.civs.get(t.a);
    const b = w.civs.get(t.b);
    if (!a || !b || !a.alive || !b.alive) continue;
    let best: [Settlement, Settlement, number] | null = null;
    for (const ia of a.settlements) for (const ib of b.settlements) {
      const sa = w.settlements.get(ia);
      const sb = w.settlements.get(ib);
      if (!sa || !sb) continue;
      const d = Math.hypot(sa.x - sb.x, sa.y - sb.y);
      if (!best || d < best[2]) best = [sa, sb, d];
    }
    if (!best) continue;
    const [sa, sb] = best;
    const sea = sa.coastal && sb.coastal && Math.min(a.caps.navalTier, b.caps.navalTier) >= 2;
    let path = findPath(m, m.idx(sa.x, sa.y), m.idx(sb.x, sb.y), { mode: 'land', maxNodes: 12000 });
    let mode: TradeRoute['mode'] = 'land';
    if (!path && sea) {
      path = findPath(m, m.idx(sa.x, sa.y), m.idx(sb.x, sb.y), { mode: 'any', maxNodes: 20000, deepOk: Math.min(a.caps.navalTier, b.caps.navalTier) >= 4 });
      mode = 'sea';
    }
    if (!path) continue;
    const r: TradeRoute = { id: ++w.ids.route, a: sa.id, b: sb.id, civA: a.id, civB: b.id, path, mode, length: path.length, cost: 0, capacity: 0, volume: 0, flows: new Array(GOOD_COUNT).fill(0), established: sim.year, active: true, blockedUntil: 0 };
    w.routes.set(r.id, r);
    if (!sa.links.includes(sb.id)) sa.links.push(sb.id);
    if (!sb.links.includes(sa.id)) sb.links.push(sa.id);
    for (let k = 0; k < path.length; k += 6) {
      revealAround(sim, a, m.xOf(path[k]), m.yOf(path[k]), 3);
      revealAround(sim, b, m.xOf(path[k]), m.yOf(path[k]), 3);
    }
    const firstKey = 'trade_route';
    if (w.milestones[firstKey] === undefined) w.milestones[firstKey] = sim.year;
    logEvent(sim, { type: 'trade_route', cat: 'economy', title: `A ${mode} trade route linked ${sa.name} (${a.name}) and ${sb.name} (${b.name})`, civs: [a.id, b.id], settlements: [sa.id, sb.id], x: sa.x, y: sa.y, importance: 1 });
  }
  // flows along routes
  for (const r of w.routes.values()) {
    const a = w.civs.get(r.civA);
    const b = w.civs.get(r.civB);
    const sa = w.settlements.get(r.a);
    const sb = w.settlements.get(r.b);
    if (!a || !b || !a.alive || !b.alive || !sa || !sb || sa.civId !== a.id || sb.civId !== b.id) {
      r.active = false;
      continue;
    }
    const blocked = atWarWith(sim, a.id, b.id) || hasTreaty(sim, a.id, b.id, 'embargo') || a.policies.trade === 'autarky' || b.policies.trade === 'autarky';
    if (blocked) {
      if (r.volume > 0)
        logEvent(sim, { type: 'trade_disrupted', cat: 'economy', title: `Trade between ${a.name} and ${b.name} was cut off`, civs: [a.id, b.id], importance: r.volume > 5000 ? 3 : 1 });
      r.volume = 0;
      r.flows.fill(0);
      continue;
    }
    const eff = 1 - clamp(Math.max(a.caps.tradeEfficiency, b.caps.tradeEfficiency), 0, 0.9);
    r.cost = (r.length / 10) * eff * (r.mode === 'sea' ? 0.6 : 1);
    const gravity = Math.sqrt(Math.max(1, a.econ.gdp) * Math.max(1, b.econ.gdp)) / (1 + r.cost);
    r.capacity = gravity * 0.15;
    const tariff = (c: Civ) => (c.policies.trade === 'tariffs' ? 0.85 : 1);
    let volume = 0;
    for (let g = 0; g < GOOD_COUNT; g++) {
      if (g === Good.ENERGY && !(a.caps.electrification > 0 && b.caps.electrification > 0 && r.mode === 'land')) continue;
      const sA = surplusOf(a, g);
      const sB = surplusOf(b, g);
      let from: Civ | null = null;
      let to: Civ | null = null;
      if (sA > 0 && sB < 0) {
        from = a;
        to = b;
      } else if (sB > 0 && sA < 0) {
        from = b;
        to = a;
      }
      if (!from || !to) {
        r.flows[g] = 0;
        continue;
      }
      const price = (from.prices[g] + to.prices[g]) / 2;
      const want = Math.min(Math.abs(surplusOf(from, g)), Math.abs(surplusOf(to, g)), from.stock[g]);
      const cap = r.capacity / Math.max(0.5, GOODS[g].basePrice);
      const amount = Math.max(0, Math.min(want, cap) * tariff(to) * tariff(from));
      if (amount <= 0) continue;
      from.stock[g] -= amount;
      to.stock[g] += amount;
      from.acc.use[g] += amount;
      const value = amount * price;
      tot(from.id).exp += value;
      tot(to.id).imp += value;
      volume += value;
      r.flows[g] = from === a ? amount : -amount;
      // imports count toward strategic access
      to.access[g] = Math.min(1, to.access[g] + amount / Math.max(1, to.population * 0.0004));
    }
    r.volume = volume;
    const rel = ensureRelation(sim, a.id, b.id);
    rel.trade = rel.trade * 0.5 + volume * 0.5;
  }
  return totals;
}

/** Share of a civ's imports flowing through blocked routes (for explanations). */
export function tradeDependence(sim: Sim, civ: Civ): number {
  let total = 0;
  for (const r of sim.w.routes.values()) if (r.civA === civ.id || r.civB === civ.id) total += r.volume;
  return saturate(total, Math.max(1, civ.econ.gdp * 0.1));
}
