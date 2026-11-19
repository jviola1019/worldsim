/**
 * Round 9: WorldBox-style close zoom. Above 20 px per tile, people, animals, units and vehicles are drawn at a
 * readable size on screen (about 3 screen pixels per art pixel) instead of to scale, so you can see who is who:
 * a farmer, a soldier, a wolf. Where the simulation has real individuals (small towns, bands, notable people),
 * those are the people drawn, and tapping one opens them. Pure helpers; nothing here touches sim.rng.
 */
import type { Civ, Person, Settlement } from '../sim/types';
import { characterSprite, soldierSprite } from './art/select';

/** Screen pixels per art pixel at close zoom (WorldBox-like chunky sprites). */
export const READABLE_PX = 3;

/**
 * World-space scale for an actor sprite at this camera zoom (CSS px per art px): 1 (normal size) until the
 * sprite would be drawn larger than READABLE_PX screen px per art px, then shrinking so its screen size stays put.
 */
export function readableScale(zoom: number): number {
  return Math.max(0.2, Math.min(1, READABLE_PX / Math.max(0.01, zoom)));
}

/** Most real people drawn per settlement or band (the rest are summarized by the crowd). */
export const MAX_PEOPLE = 40;

/** A real person's sprite: their role first (rulers, generals, prophets, scholars), then age, then their work. */
export function personSprite(p: Person, year: number, tier: number, landTier: number, workSprite: (h: number) => string): string {
  const age = year - p.born;
  switch (p.role) {
    case 'ruler': case 'chief': case 'heir': case 'consort': return 'unit.ruler';
    case 'general': return 'unit.general';
    case 'prophet': return 'unit.priest';
    case 'scholar': return tier >= 5 ? 'char.scientist' : 'unit.scholar';
  }
  if (age < 12) return `unit.citizen.${Math.min(7, tier)}`; // children: townsfolk, drawn smaller
  if (p.job === 'soldier' || p.job === 'warrior') return soldierSprite(landTier);
  if (p.job === 'forager') return 'unit.farmer';
  return workSprite(p.id);
}

/** Children are drawn at 70% of an adult's size, elders slightly stooped (90%). */
export function personSize(p: Person, year: number): number {
  const age = year - p.born;
  return age < 12 ? 0.7 : age >= 65 ? 0.9 : 1;
}

/**
 * A worker sprite for hash h, from a settlement's real employment mix (sector shares): farmers, miners and smiths,
 * merchants, scholars and priests, soldiers.
 */
export function workSprite(emp: readonly number[], tier: number, landTier: number, h: number): string {
  let total = 0;
  for (const v of emp) total += Math.max(0, v);
  if (total <= 0 || h % 4 === 0) return `unit.citizen.${Math.min(7, tier)}`;
  let r = (((h >>> 3) % 1000) / 1000) * total;
  let sector = 0;
  for (; sector < emp.length - 1; sector++) { r -= Math.max(0, emp[sector]); if (r <= 0) break; }
  switch (sector) {
    case 0: return characterSprite('farmer', tier, h);
    case 1: return characterSprite('miner', tier, h);
    case 2: return characterSprite('smith', tier, h);
    case 3: return 'unit.builder';
    case 4: return characterSprite(h % 3 === 0 ? 'scholar' : h % 5 === 0 ? 'priest' : 'merchant', tier, h);
    case 5: return soldierSprite(landTier);
    default: return characterSprite('walker', tier, h);
  }
}

/**
 * The real people to draw for a settlement: every living member of a small (individual-mode) town, up to MAX_PEOPLE,
 * plus its notable residents (rulers, generals, prophets, scholars) in a big city. Ordered by id, so the choice is stable.
 */
export function peopleOf(s: Settlement, persons: ReadonlyMap<number, Person>, notables: readonly number[]): Person[] {
  const out: Person[] = [];
  const ids = s.mode === 'individual' ? s.members : notables;
  for (const id of ids) {
    const p = persons.get(id);
    if (p && p.died === undefined) out.push(p);
    if (out.length >= MAX_PEOPLE) break;
  }
  return out;
}

/** How many representative townsfolk a big city shows up close, from its population (at most 24). */
export function crowdSize(pop: number): number {
  return Math.min(24, Math.round(Math.log2(Math.max(2, pop)) * 1.6));
}

/** How many animals a herd shows up close (at most 6), from its size. */
export function herdShown(count: number, close: boolean): number {
  const n = Math.max(1, Math.round(Math.log10(count + 1) * 1.5));
  return Math.min(close ? 6 : 3, n);
}

/** Notable residents of each settlement (non-commoners), rebuilt yearly by the renderer. */
export function notablesBySettlement(persons: ReadonlyMap<number, Person>): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const p of persons.values()) {
    if (p.died !== undefined || p.role === 'commoner' || !p.settlementId) continue;
    const l = out.get(p.settlementId) ?? [];
    l.push(p.id);
    out.set(p.settlementId, l);
  }
  for (const l of out.values()) l.sort((a, b) => a - b);
  return out;
}

export type { Civ };
