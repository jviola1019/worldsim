/**
 * World history: every meaningful development is recorded as a HistoryEvent
 * with the entities involved, a map location, an importance level and — for
 * decisions such as wars, revolutions or collapses — the CAUSES that were
 * actually measured when the decision was made (factor label + weight).
 * Explanations shown to the player are built only from these recorded inputs.
 */
import { eventFx } from '../sim/conceptFx';
import type { Sim } from '../sim/context';
import type { Cause, EventCategory, HistoryEvent } from '../sim/types';
import { headlineFor } from './newspaper';
import { mediumOf } from '../media/medium';

export interface EventInput {
  type: string;
  cat: EventCategory;
  title: string;
  text?: string;
  civs?: number[];
  settlements?: number[];
  persons?: number[];
  x?: number;
  y?: number;
  importance?: number;
  causes?: Cause[];
}

const MAX_EVENTS = 20000;

export function logEvent(sim: Sim, e: EventInput): HistoryEvent {
  const w = sim.w;
  const id = ++w.ids.event;
  const ev: HistoryEvent = {
    id,
    tick: w.tick,
    year: sim.year,
    type: e.type,
    cat: e.cat,
    title: e.title,
    text: e.text ?? '',
    civs: e.civs ?? [],
    settlements: e.settlements ?? [],
    persons: e.persons ?? [],
    x: e.x ?? -1,
    y: e.y ?? -1,
    importance: e.importance ?? 2,
    causes: e.causes && e.causes.length ? normalizeCauses(e.causes) : undefined,
  };
  // the medium is fixed when the news happens: later technology does not rewrite how it was told
  let teller = ev.civs.length ? w.civs.get(ev.civs[0]) : undefined;
  for (const cid of ev.civs) { const c = w.civs.get(cid); if (c && teller && c.era > teller.era) teller = c; }
  if (teller) ev.medium = mediumOf(teller);
  ev.headline = headlineFor(sim, ev);
  w.events.push(ev);
  eventFx(sim, ev); // the concept's map effect (visual only)
  if (w.events.length > MAX_EVENTS) pruneEvents(sim);
  for (const cid of ev.civs) {
    const c = w.civs.get(cid);
    if (c) {
      c.events.push(id);
      if (c.events.length > 600) c.events.splice(0, c.events.length - 600);
    }
  }
  for (const sid of ev.settlements) {
    const s = w.settlements.get(sid);
    if (s) {
      s.events.push(id);
      if (s.events.length > 120) s.events.splice(0, s.events.length - 120);
    }
  }
  for (const pid of ev.persons) {
    const p = w.persons.get(pid);
    if (p) p.events.push(id);
  }
  for (const l of sim.listeners) l(ev);
  return ev;
}

/** Keep causes sorted by weight and expressed as shares of the total. */
function normalizeCauses(causes: Cause[]): Cause[] {
  const pos = causes.filter((c) => c.weight > 0.001);
  const total = pos.reduce((s, c) => s + c.weight, 0) || 1;
  return pos
    .map((c) => ({ label: c.label, weight: Math.round((c.weight / total) * 1000) / 1000 }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);
}

/** Drop the least important old events when the log grows very large. */
function pruneEvents(sim: Sim): void {
  const evs = sim.w.events;
  const keep = evs.filter((e, idx) => e.importance >= 3 || idx > evs.length - MAX_EVENTS * 0.6);
  sim.w.events = keep;
}

export function eventById(sim: Sim, id: number): HistoryEvent | undefined {
  // events are id-ordered: binary search
  const evs = sim.w.events;
  let lo = 0;
  let hi = evs.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (evs[m].id === id) return evs[m];
    if (evs[m].id < id) lo = m + 1;
    else hi = m - 1;
  }
  return undefined;
}

/** Build a plain-language explanation from recorded causes. */
export function explainCauses(causes: Cause[] | undefined): string[] {
  if (!causes || !causes.length) return [];
  return causes.map((c) => `${c.label} (${Math.round(c.weight * 100)}%)`);
}
