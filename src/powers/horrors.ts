/**
 * Fictional horrors: GOD MODE ONLY. They never appear in Realistic (observer) worlds: the powers
 * refuse to apply there and random outbreaks need the "Fictional horrors" world law, which the
 * Realistic preset forces off.
 *
 *  - ZOMBIE OUTBREAK: a horde grows in a settlement by turning the living (ledger 'disease', 'zombies'
 *    pressure). Garrisons and townsfolk destroy the dead (scaled by weapons tier, walls and doctrine);
 *    hordes spill along road and trade links; survivors of an overrun town flee to the nearest safe one;
 *    nations with medicine research a CURE (stored per civ), which stops new infections. An outbreak is
 *    contained when every horde is destroyed.
 *  - GHOUL PACKS: nocturnal scavengers that breed on battlefields and in ruins and raid the town
 *    (ledger 'disaster', 'ghouls' pressure). Garrisons and the lights of electrified cities drive them off.
 *  - THE CREEPING BLIGHT: a fungal rot that destroys crops in the fields and in store (production.ts),
 *    spreads to linked towns and burns out over a few years; agricultural science contains it. Famine
 *    under the blight is attributed to it.
 */
import { godMode } from './powerSet';
import type { Sim } from '../sim/context';
import type { Civ, HorrorKind, Settlement } from '../sim/types';
import { clamp01 } from '../core/math';
import { removePeople, addPeople } from '../population/demography';
import { flow, migrate } from '../population/ledger';
import { logEvent } from '../history/events';
import { addPressure, worldEndings } from '../civilizations/endings';
import { emitFx, STATE_FX } from '../sim/conceptFx';
import { B } from '../civilizations/buildingTypes';
import { HAZARD } from '../world/tilemap';

export const HORROR_LABEL: Record<HorrorKind, string> = { zombie: 'zombie horde', ghoul: 'ghoul pack', blight: 'Creeping Blight' };

/** God-mode-only threats: refused in Observer and Realistic worlds (round 10: only power set 'all'). */
export function horrorsAllowed(sim: Sim): boolean {
  return godMode(sim.w.meta.settings);
}

/** Start (or feed) a horror in a settlement. Returns false in observer worlds. */
export function unleashHorror(sim: Sim, s: Settlement, kind: HorrorKind, level?: number): boolean {
  if (!horrorsAllowed(sim)) return false;
  const start = level ?? (kind === 'blight' ? 0.15 : kind === 'zombie' ? Math.max(5, s.pop * 0.01) : Math.max(4, Math.min(60, s.pop * 0.004)));
  if (s.horror && s.horror.kind === kind) s.horror.level += start;
  else s.horror = { kind, level: start, since: sim.year };
  return true;
}

function nearestSafe(sim: Sim, s: Settlement, sameCiv: boolean): Settlement | undefined {
  let best: Settlement | undefined;
  let bd = Infinity;
  for (const o of sim.w.settlements.values()) {
    if (o === s || o.horror || o.pop < 10 || (sameCiv && o.civId !== s.civId)) continue;
    const d = (o.x - s.x) ** 2 + (o.y - s.y) ** 2;
    if (d < bd && d < 40 * 40) {
      bd = d;
      best = o;
    }
  }
  return best;
}

/** Monthly, per infested settlement (from settlementMonthly). */
export function horrorMonthly(sim: Sim, s: Settlement, civ: Civ): void {
  const h = s.horror;
  if (!h) return;
  const w = sim.w;
  const rng = sim.rng;
  if (!horrorsAllowed(sim)) {
    delete s.horror; // cannot exist in an observer world
    return;
  }
  const living = s.pop;
  const defense = (s.garrison + living * 0.02) * (1 + civ.caps.landTier * 0.25) * (s.bld[B.WALL] > 0 ? 1.5 : 1) * (civ.military?.defenseMult ?? 1);
  if (h.kind === 'zombie') {
    const cured = (worldEndings(sim).cure[civ.id] ?? 0) >= 1;
    const bite = cured ? 0 : Math.min(living * 0.3, h.level * 0.25 * (living / (living + h.level + 1)));
    const turned = removePeople(sim, s, bite, 'zombie bite');
    flow(sim, s, 'disease', turned);
    addPressure(sim, civ.id, 'zombies', turned, `The dead rose in ${s.name}`);
    h.level += turned;
    h.level = Math.max(0, h.level - defense * 0.08 * (cured ? 1.5 : 1));
    // hordes spill along links
    if (h.level > 20) {
      for (const lid of s.links) {
        const o = w.settlements.get(lid);
        if (!o || o.horror || !rng.chance(0.2 * Math.min(1, h.level / 200))) continue;
        const wander = h.level * 0.1;
        h.level -= wander;
        o.horror = { kind: 'zombie', level: wander, since: sim.year };
        logEvent(sim, { type: 'zombie_spread', cat: 'disaster', title: `The dead of ${s.name} reached ${o.name}`, civs: [o.civId], settlements: [o.id], x: o.x, y: o.y, importance: 3, causes: [{ label: `A horde of about ${Math.round(h.level)} in ${s.name}`, weight: 0.7 }, { label: 'Road and trade links', weight: 0.3 }] });
      }
    }
    // survivors of an overrun town flee
    if (h.level > living * 2 && living > 10) {
      const to = nearestSafe(sim, s, true) ?? nearestSafe(sim, s, false);
      if (to) {
        const moved = removePeople(sim, s, living * 0.3, 'emigration');
        s.flows.emigration += moved;
        addPeople(sim, to, moved, s.cultures[0]?.id ?? civ.cultureId, s.religions[0]?.id ?? 0);
        to.flows.immigration += moved;
        migrate(sim, s.civId, to.civId, moved);
        if (rng.chance(0.3)) logEvent(sim, { type: 'zombie_refugees', cat: 'disaster', title: `Survivors fled overrun ${s.name} for ${to.name}`, civs: [s.civId, to.civId], settlements: [s.id, to.id], x: s.x, y: s.y, importance: 2 });
      }
    }
    if (s.pop - turned < 1 && h.level > 1) {
      // the last living are gone: the horde moves on to the nearest town
      const to = nearestSafe(sim, s, false);
      if (to) to.horror = { kind: 'zombie', level: h.level * 0.5, since: sim.year };
    }
  } else if (h.kind === 'ghoul') {
    const lit = civ.caps.electrification > 0 ? 1.5 : 1;
    const dead = removePeople(sim, s, Math.min(living * 0.02, h.level * 0.5 * rng.range(0.3, 1)), 'ghoul raid');
    flow(sim, s, 'disaster', dead);
    addPressure(sim, civ.id, 'ghouls', dead, `Ghoul raids on ${s.name}`);
    // they breed on battlefields and in ruins nearby
    let lair = 0;
    w.map.forRadius(s.x, s.y, s.radius + 3, (i) => {
      if (w.map.hazard[i] & HAZARD.BATTLEFIELD || w.map.bld[i] === B.RUINS) lair++;
    });
    h.level = Math.max(0, h.level * (1 + Math.min(0.15, 0.04 + lair * 0.01)) - defense * 0.04 * lit);
    if (dead > 1) emitFx(sim, STATE_FX.horrorAttack, s.x, s.y);
  } else {
    // blight: rots stored food too; grows, spreads, burns out; agricultural science contains it
    s.food *= 1 - 0.1 * h.level;
    const contain = Math.min(0.9, civ.caps.biotech * 0.5 + civ.caps.diseaseControl * 0.3);
    const age = sim.year - h.since;
    h.level = clamp01(h.level + (age < 3 ? 0.06 : -0.05) * (1 - contain) - contain * 0.03);
    if (h.level > 0.3) {
      for (const lid of s.links) {
        const o = w.settlements.get(lid);
        if (o && !o.horror && rng.chance(0.1 * h.level)) o.horror = { kind: 'blight', level: 0.05, since: sim.year };
      }
    }
  }
  if (h.level < 1 && h.kind !== 'blight' || h.kind === 'blight' && h.level < 0.01) {
    delete s.horror;
    logEvent(sim, { type: 'horror_contained', cat: 'disaster', title: `The ${HORROR_LABEL[h.kind]} in ${s.name} was destroyed`, civs: [civ.id], settlements: [s.id], x: s.x, y: s.y, importance: 2 });
  }
}

/** Yearly (world): cure research against zombies, and random horrors when the law allows. */
export function horrorsYearly(sim: Sim): void {
  const w = sim.w;
  if (!horrorsAllowed(sim)) return;
  const infested = new Map<number, number>();
  for (const s of w.settlements.values()) if (s.horror?.kind === 'zombie') infested.set(s.civId, (infested.get(s.civId) ?? 0) + 1);
  if (infested.size) {
    const e = worldEndings(sim);
    for (const [cid] of infested) {
      const c = w.civs.get(cid);
      if (!c?.alive) continue;
      const before = e.cure[cid] ?? 0;
      if (before >= 1) continue;
      const rate = 0.02 + c.caps.healthcare * 0.15 + c.caps.biotech * 0.3 + c.caps.diseaseControl * 0.2;
      e.cure[cid] = Math.min(1, before + rate);
      if (e.cure[cid] >= 1) logEvent(sim, { type: 'zombie_cure', cat: 'technology', title: `Physicians in ${c.name} found a cure that stops the dead from rising`, civs: [cid], importance: 4, causes: [{ label: 'Medical research during the outbreak', weight: 1 }] });
    }
  }
  if (w.laws.horrors && sim.rng.chance(1 / 150)) {
    const towns = [...w.settlements.values()].filter((s) => s.pop > 200 && !s.horror);
    if (!towns.length) return;
    const s = sim.rng.pick(towns);
    const kind = sim.rng.pick(['zombie', 'ghoul', 'blight'] as HorrorKind[]);
    unleashHorror(sim, s, kind);
    logEvent(sim, { type: 'horror_' + kind, cat: 'disaster', title: kind === 'zombie' ? `The dead rose in ${s.name}` : kind === 'ghoul' ? `Ghouls crept out of the dark around ${s.name}` : `A creeping blight appeared in the fields of ${s.name}`, civs: [s.civId], settlements: [s.id], x: s.x, y: s.y, importance: 4, causes: [{ label: 'World law: fictional horrors', weight: 1 }] });
  }
}
