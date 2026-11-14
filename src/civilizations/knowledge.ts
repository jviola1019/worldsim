/**
 * Civ knowledge of the map (non-omniscient AI). Each civ has a bitset of
 * tiles it knows; exploration, trade and communication reveal more. Decisions
 * such as founding sites or war targets only consider known tiles, and civs
 * only interact diplomatically after first contact.
 */
import type { Sim } from '../sim/context';
import type { Civ, Relation } from '../sim/types';
import { logEvent } from '../history/events';

export function isKnown(sim: Sim, civId: number, i: number): boolean {
  const bits = sim.w.knowledge.get(civId);
  return !!bits && (bits[i >>> 5] & (1 << (i & 31))) !== 0;
}

export function revealAround(sim: Sim, civ: Civ, x: number, y: number, r: number): void {
  const bits = sim.w.knowledge.get(civ.id);
  if (!bits) return;
  const m = sim.w.map;
  const met = new Set<number>();
  m.forRadius(x, y, r, (i) => {
    const word = i >>> 5;
    const bit = 1 << (i & 31);
    if (bits[word] & bit) return;
    bits[word] |= bit;
    civ.knownTiles++;
    const o = m.owner[i];
    if (o && o !== civ.id) met.add(o);
  });
  for (const o of met) makeContact(sim, civ.id, o);
}

export function relKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function getRelation(sim: Sim, a: number, b: number): Relation | undefined {
  return sim.w.relations.get(relKey(a, b));
}

export function ensureRelation(sim: Sim, a: number, b: number): Relation {
  const key = relKey(a, b);
  let r = sim.w.relations.get(key);
  if (!r) {
    r = { a: Math.min(a, b), b: Math.max(a, b), opinion: 0, trust: 0.3, contact: sim.year, trade: 0, border: 0, disputes: 0, grievAB: 0, grievBA: 0, lastWar: -1e9, rival: false, treaties: [] };
    sim.w.relations.set(key, r);
  }
  return r;
}

export function makeContact(sim: Sim, a: number, b: number): void {
  if (a === b) return;
  const ca = sim.w.civs.get(a);
  const cb = sim.w.civs.get(b);
  if (!ca || !cb || !ca.alive || !cb.alive) return;
  if (ca.knownCivs.includes(b)) return;
  ca.knownCivs.push(b);
  if (!cb.knownCivs.includes(a)) cb.knownCivs.push(a);
  const rel = ensureRelation(sim, a, b);
  // initial attitude from cultural and religious affinity
  const cuA = sim.w.cultures.get(ca.cultureId);
  const cuB = sim.w.cultures.get(cb.cultureId);
  let affinity = 0;
  if (cuA && cuB) {
    if (cuA.id === cuB.id || cuA.parentId === cuB.id || cuB.parentId === cuA.id) affinity += 20;
    else if (sim.w.languages.get(cuA.languageId)?.rootId === sim.w.languages.get(cuB.languageId)?.rootId) affinity += 10;
  }
  if (ca.stateReligion && ca.stateReligion === cb.stateReligion) affinity += 10;
  rel.opinion = affinity + sim.rng.range(-10, 10);
  const capA = sim.w.settlements.get(ca.capital);
  logEvent(sim, {
    type: 'first_contact',
    cat: 'diplomacy',
    title: `First contact between ${ca.name} and ${cb.name}`,
    civs: [a, b],
    x: capA?.x,
    y: capA?.y,
    importance: 2,
  });
}
