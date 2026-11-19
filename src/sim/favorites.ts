/**
 * Round 9: the player's favourites (places, nations, people, armies, bands, herds), kept with the world in
 * meta.favorites so they travel with the save. Never read by the simulation.
 */
import type { Favorite, WorldState } from './types';

export const FAVORITES_MAX = 50;
const KINDS = new Set(['settlement', 'civ', 'person', 'army', 'band', 'herd']);

export function isFavorite(w: WorldState, kind: Favorite['kind'], id: number): boolean {
  return !!w.meta.favorites?.some((f) => f.kind === kind && f.id === id);
}

/** Add or remove a favourite; returns whether it is now a favourite. */
export function toggleFavorite(w: WorldState, kind: Favorite['kind'], id: number, label: string): boolean {
  const list = w.meta.favorites ?? [];
  const at = list.findIndex((f) => f.kind === kind && f.id === id);
  if (at >= 0) {
    list.splice(at, 1);
    w.meta.favorites = list;
    return false;
  }
  if (list.length >= FAVORITES_MAX) list.pop();
  list.unshift({ kind, id, label: label.slice(0, 80) });
  w.meta.favorites = list;
  return true;
}

/** Where a favourite is now (tile coordinates), or null when it no longer exists. */
export function favoritePosition(w: WorldState, f: Favorite): { x: number; y: number } | null {
  switch (f.kind) {
    case 'settlement': { const s = w.settlements.get(f.id); return s ? { x: s.x, y: s.y } : null; }
    case 'civ': { const c = w.civs.get(f.id); const s = c?.alive ? w.settlements.get(c.capital) : undefined; return s ? { x: s.x, y: s.y } : null; }
    case 'army': { const a = w.armies.get(f.id); return a ? { x: a.x, y: a.y } : null; }
    case 'band': { const b = w.bands.get(f.id); return b ? { x: b.x, y: b.y } : null; }
    case 'herd': { const h = w.herds.get(f.id); return h ? { x: h.x, y: h.y } : null; }
    case 'person': {
      const p = w.persons.get(f.id);
      if (!p || p.died !== undefined) return null;
      const home = p.settlementId ? w.settlements.get(p.settlementId) : undefined;
      if (home) return { x: home.x, y: home.y };
      const band = p.bandId ? w.bands.get(p.bandId) : undefined;
      return band ? { x: band.x, y: band.y } : null;
    }
  }
}

/** Decoder check for meta.favorites (imported files are untrusted). */
export function validFavorites(v: unknown): boolean {
  if (v === undefined) return true;
  if (!Array.isArray(v) || v.length > FAVORITES_MAX) return false;
  return v.every((f) => f && typeof f === 'object' && KINDS.has(f.kind) && Number.isInteger(f.id) && f.id > 0 && typeof f.label === 'string' && f.label.length <= 80);
}
