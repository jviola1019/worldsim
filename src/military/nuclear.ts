/**
 * Nuclear weapons: programmes, doctrine, deterrence, escalation, strikes, fallout, nuclear winter and
 * arms control.
 *
 * PROGRAMME: a nation with nuclear-weapons technology, uranium and a reason (a nuclear-armed rival,
 * an enemy, an aggressive leadership) builds warheads at a rate set by industry and uranium. Its
 * target arsenal grows with rivals' arsenals (arms race), halves under an arms-control treaty and
 * shrinks for decades after any nuclear use (the taboo). Surplus warheads are dismantled.
 *
 * DOCTRINE (derived yearly): no first use (participatory, law-bound, cautious states), assured
 * retaliation (default) or first strike (aggressive or military-led states).
 *
 * DETERRENCE: `deterrenceCost` is the war-utility cost of attacking a nuclear-armed state (or one
 * protected by nuclear allies). It grows with warheads and delivery, plus a mutual-destruction term
 * when the attacker is armed too. See politics/diplomacy.ts `warUtility`.
 *
 * ESCALATION happens only in desperate wars; a struck nuclear state retaliates with high probability,
 * so a first use can become an exchange. Missile defence intercepts some warheads; hypersonic
 * missiles evade it.
 *
 * EFFECTS: blast deaths, destroyed districts, craters, radiation, pollution, fallout deaths and
 * illness downwind (all ledger 'war' with 'nuclear_war' pressure) and stratospheric SOOT from burning
 * cities, which cools the planet for years (nuclear winter; crop losses in economy/production.ts).
 * A strike on a settlement stands for an attack on a metropolitan region of this scaled-down world.
 */
import type { Sim } from '../sim/context';
import type { Cause, Civ, NuclearDoctrine, Settlement, War, Arsenal } from '../sim/types';
import { clamp01, saturate } from '../core/math';
import { Good } from '../world/resources';
import { B } from '../civilizations/buildingTypes';
import { ignite } from '../world/environment';
import { HAZARD } from '../world/tilemap';
import { removePeople } from '../population/demography';
import { flow } from '../population/ledger';
import { removeBuilding } from '../civilizations/urban';
import { markTile } from '../sim/context';
import { emitFx, STATE_FX } from '../sim/conceptFx';
import { logEvent } from '../history/events';
import { ensureRelation, getRelation } from '../civilizations/knowledge';
import { addPressure, logCatastrophe, worldEndings } from '../civilizations/endings';
import { fields } from './weapons';

const TREATY_ACTIVE = (sim: Sim, a: number, b: number, kind: string): boolean => {
  const rel = getRelation(sim, a, b);
  if (!rel) return false;
  for (const id of rel.treaties) {
    const t = sim.w.treaties.get(id);
    if (t?.active && t.kind === kind) return true;
  }
  return false;
};

export function doctrineFor(civ: Civ): NuclearDoctrine {
  const i = civ.inst;
  const p = civ.personality;
  if (i.participation > 0.5 && i.ruleOfLaw > 0.45 && p.caution > 0.5) return 'no_first_use';
  if (p.aggression > 0.7 || i.militaryInfluence > 0.65) return 'first_strike';
  return 'retaliation';
}

/** Delivery capability 0.55 (bombers only) .. 1 (missiles). */
function delivery(civ: Civ): number {
  return 0.55 + 0.45 * Math.min(1, civ.caps.missiles + civ.caps.airPower * 0.5);
}

/**
 * War-utility cost for `civ` of attacking `other`, from `other`'s nuclear arsenal and its nuclear
 * allies' (extended deterrence), plus mutual destruction when `civ` is armed too.
 */
export function deterrenceCost(sim: Sim, civ: Civ, other: Civ): number {
  if (!sim.w.laws.advancedWeapons) return 0;
  let d = other.nukes > 0 ? saturate(other.nukes, 3) * delivery(other) : 0;
  for (const oid of other.knownCivs) {
    if (oid === civ.id) continue;
    const ally = sim.w.civs.get(oid);
    if (!ally?.alive || ally.nukes <= 0) continue;
    if (TREATY_ACTIVE(sim, other.id, oid, 'defensive') || TREATY_ACTIVE(sim, other.id, oid, 'alliance')) d += 0.5 * saturate(ally.nukes, 3) * delivery(ally);
  }
  d = Math.min(1.5, d);
  if (d <= 0) return 0;
  return 2.4 * d + (civ.nukes > 0 ? 0.6 * d : 0);
}

function arsenalOf(sim: Sim, civ: Civ): Arsenal {
  return (civ.arsenal ??= { doctrine: doctrineFor(civ), progress: 0, started: sim.year, launched: 0 });
}

/** Yearly: programme, arms race, dismantling, doctrine and arms control. */
export function nuclearYearly(sim: Sim, civ: Civ, atWar: boolean): void {
  const w = sim.w;
  if (!w.laws.advancedWeapons) return;
  if (civ.caps.nuclearWeapons <= 0 && !civ.arsenal) return;
  // a reason to build: nuclear-armed rivals or enemies, war, or an aggressive leadership
  let rivalWarheads = 0;
  let motive = atWar || civ.personality.aggression > 0.6;
  for (const oid of civ.knownCivs) {
    const o = w.civs.get(oid);
    if (!o?.alive) continue;
    const rel = getRelation(sim, civ.id, oid);
    const hostile = !!rel && (rel.rival || rel.opinion < -20);
    if (o.nukes > 0 && (hostile || rel?.opinion === undefined || (rel?.opinion ?? 0) < 20)) {
      motive = true;
      rivalWarheads = Math.max(rivalWarheads, o.nukes);
    } else if (hostile) motive = true;
  }
  if (!civ.arsenal && !motive) return;
  const a = arsenalOf(sim, civ);
  a.doctrine = doctrineFor(civ);
  const e = worldEndings(sim);
  let want = 2 + civ.personality.caution * 4 + (civ.caps.missiles > 0.5 ? 6 : 0) + rivalWarheads * 0.6 + (civ.military?.armsRace ?? 0) * 6;
  if (civ.knownCivs.some((oid) => TREATY_ACTIVE(sim, civ.id, oid, 'arms_control'))) want *= 0.5;
  if (e.lastNuclearUse && sim.year - e.lastNuclearUse < 50) want *= 0.7; // the taboo, renewed
  if (!motive) want *= 0.5;
  want = Math.min(60, Math.round(want));
  if (civ.caps.nuclearWeapons > 0 && civ.nukes < want && civ.access[Good.URANIUM] > 0.3) {
    a.progress += 0.3 * (0.5 + Math.min(1, civ.access[Good.URANIUM])) * (1 + Math.min(1, civ.caps.industry) * 0.3);
    while (a.progress >= 1 && civ.nukes < want) {
      a.progress -= 1;
      civ.nukes++;
      if (civ.nukes === 1) {
        const first = w.milestones['nuclear_power_state'] === undefined;
        if (first) w.milestones['nuclear_power_state'] = sim.year;
        logEvent(sim, { type: 'nuclear_state', cat: 'war', title: `${civ.name} became a nuclear-armed state`, civs: [civ.id], importance: first ? 4 : 3, causes: nuclearMotives(sim, civ, rivalWarheads, atWar) });
      }
    }
    a.progress = Math.min(a.progress, 1);
  } else if (civ.nukes > want + 1) {
    civ.nukes--; // dismantled under treaty or in calmer times
  }
  // arms control between nuclear states on good terms
  if (civ.nukes > 0 && civ.caps.internationalOrgs > 0 && !atWar) {
    for (const oid of civ.knownCivs) {
      const o = w.civs.get(oid);
      if (!o?.alive || o.nukes <= 0 || o.caps.internationalOrgs <= 0) continue;
      const rel = getRelation(sim, civ.id, oid);
      if (!rel || rel.opinion < 5 || TREATY_ACTIVE(sim, civ.id, oid, 'arms_control') || TREATY_ACTIVE(sim, civ.id, oid, 'embargo')) continue;
      if (!sim.rng.chance(0.12 + (e.lastNuclearUse ? 0.1 : 0))) continue;
      const t = { id: ++w.ids.treaty, kind: 'arms_control' as const, a: civ.id, b: oid, start: sim.year, end: sim.year + 30, active: true };
      w.treaties.set(t.id, t);
      ensureRelation(sim, civ.id, oid).treaties.push(t.id);
      logEvent(sim, { type: 'treaty_arms_control', cat: 'diplomacy', title: `${civ.name} and ${o.name} signed an arms-control treaty`, civs: [civ.id, oid], importance: 3, causes: [{ label: `${civ.nukes} and ${o.nukes} warheads`, weight: 0.5 }, { label: 'Cooperation through international organizations', weight: 0.5 }] });
      break;
    }
  }
}

function nuclearMotives(sim: Sim, civ: Civ, rivalWarheads: number, atWar: boolean): Cause[] {
  const out: Cause[] = [];
  if (rivalWarheads > 0) out.push({ label: `Nuclear-armed rivals (up to ${rivalWarheads} warheads)`, weight: 0.5 });
  if (atWar) out.push({ label: 'At war', weight: 0.3 });
  if (civ.personality.aggression > 0.6) out.push({ label: 'Aggressive leadership', weight: 0.3 });
  if ((civ.military?.armsRace ?? 0) > 0.2) out.push({ label: 'Arms race', weight: civ.military!.armsRace });
  if (!out.length) out.push({ label: 'Hostile neighbours', weight: 1 });
  void sim;
  return out;
}

/**
 * Consider nuclear use in a war (yearly). Returns true if `civ` launched. First use needs a desperate
 * war; no-first-use states launch only after being struck in this war.
 */
export function considerNuclearUse(sim: Sim, civ: Civ, war: War, enemies: number[]): boolean {
  const w = sim.w;
  if (civ.nukes <= 0 || !w.laws.advancedWeapons) return false;
  const a = arsenalOf(sim, civ);
  const isAtt = war.attackers.includes(civ.id);
  const score = isAtt ? war.score : -war.score;
  const capital = w.settlements.get(civ.capital);
  const capitalLost = !capital || capital.occupiedBy !== 0;
  const struck = (war.nukesUsedBy ?? []).some((id) => enemies.includes(id));
  const desperate = score < -70 && capitalLost;
  const losing = score < -55;
  if (a.doctrine === 'no_first_use' && !struck) return false;
  if (!struck && !desperate && !(a.doctrine === 'first_strike' && losing)) return false;
  const restraint = civ.personality.caution * 0.5 + civ.inst.participation * 0.3 + civ.inst.ruleOfLaw * 0.2;
  const aiTrigger = Math.min(1, civ.media?.aiDefense ?? 0) * 0.5;
  let p = struck ? 0.5 : 0.15 * (1 - restraint) * (a.doctrine === 'first_strike' ? 1.6 : 1) * (1 + aiTrigger);
  // the enemy's own arsenal deters first use (unless the state plans a disarming first strike)
  if (!struck && enemies.some((id) => (w.civs.get(id)?.nukes ?? 0) > 0) && a.doctrine !== 'first_strike') p *= 0.5;
  if (!sim.rng.chance(p)) return false;
  const causes: Cause[] = struck
    ? [{ label: `Retaliation for nuclear attacks in ${war.name}`, weight: 0.8 }, { label: `Doctrine: ${a.doctrine.replace(/_/g, ' ')}`, weight: 0.2 }]
    : [
        { label: `Facing total defeat in ${war.name} (war score ${Math.round(score)})`, weight: 0.5 },
        ...(capitalLost ? [{ label: 'Its capital occupied', weight: 0.3 }] : []),
        { label: `Weak institutional restraints (${Math.round(restraint * 100)}%)`, weight: 1 - restraint },
        { label: `Doctrine: ${a.doctrine.replace(/_/g, ' ')}`, weight: a.doctrine === 'first_strike' ? 0.4 : 0.1 },
        ...(aiTrigger > 0.1 ? [{ label: 'Autonomous military AI in the launch chain', weight: aiTrigger }] : []),
      ];
  const salvo = struck ? Math.min(civ.nukes, 1 + sim.rng.int(1, 3)) : a.doctrine === 'first_strike' && enemies.some((id) => (w.civs.get(id)?.nukes ?? 0) > 0) ? Math.min(civ.nukes, 3) : 1;
  launchSalvo(sim, civ, war, enemies, salvo, causes, 0);
  return true;
}

/**
 * Launch `n` warheads at the largest enemy cities; nuclear-armed victims retaliate with high
 * probability (an exchange can escalate for a few rounds). Returns warheads that detonated.
 */
export function launchSalvo(sim: Sim, civ: Civ, war: War | undefined, enemies: number[], n: number, causes: Cause[], depth: number): number {
  const w = sim.w;
  const e = worldEndings(sim);
  const a = arsenalOf(sim, civ);
  const targets: Settlement[] = [];
  for (const id of enemies) {
    const ec = w.civs.get(id);
    for (const sid of ec?.settlements ?? []) {
      const s = w.settlements.get(sid);
      if (s) targets.push(s);
    }
  }
  if (!targets.length) return 0;
  targets.sort((x, y) => y.pop - x.pop || x.id - y.id);
  let hits = 0;
  const struckCivs = new Set<number>();
  for (let k = 0; k < n && civ.nukes > 0; k++) {
    const target = targets[k % targets.length];
    civ.nukes--;
    a.launched++;
    const victim = w.civs.get(target.civId);
    // missile defence intercepts some warheads; hypersonic delivery evades it
    const defence = victim && fields(victim, 'missile_defense') ? 0.3 * (fields(civ, 'hypersonic') ? 0.25 : 1) : 0;
    if (sim.rng.chance(defence)) continue;
    const dead = nuclearStrike(sim, target, civ.id);
    hits++;
    struckCivs.add(target.civId);
    logEvent(sim, {
      type: 'nuclear_strike', cat: 'war',
      title: `${civ.name} ${depth > 0 ? 'retaliated with a nuclear strike on' : 'used a nuclear weapon against'} ${target.name}`,
      text: `About ${Math.round(dead).toLocaleString('en-US')} died in the blast and fallout.`,
      civs: [civ.id, target.civId], settlements: [target.id], x: target.x, y: target.y, importance: 5, causes,
    });
  }
  if (war && hits) {
    war.nuclear = true;
    if (!(war.nukesUsedBy ??= []).includes(civ.id)) war.nukesUsedBy.push(civ.id);
  }
  if (hits) {
    e.lastNuclearUse = sim.year;
    for (const o of w.civs.values()) {
      if (!o.alive || o.id === civ.id) continue;
      const r = ensureRelation(sim, civ.id, o.id);
      r.opinion = Math.max(-100, r.opinion - 50);
    }
  }
  // retaliation: an assured second strike, which can escalate into an exchange
  if (depth < 4) {
    for (const vid of struckCivs) {
      const v = w.civs.get(vid);
      if (!v?.alive || v.nukes <= 0) continue;
      if (!sim.rng.chance(depth === 0 ? 0.85 : 0.6)) continue;
      const salvo = Math.min(v.nukes, n + 1);
      launchSalvo(sim, v, war, [civ.id], salvo, [{ label: `Second strike after ${civ.name}'s nuclear attack`, weight: 0.8 }, { label: `Doctrine: ${arsenalOf(sim, v).doctrine.replace(/_/g, ' ')}`, weight: 0.2 }], depth + 1);
    }
  }
  return hits;
}

/**
 * A nuclear detonation on a settlement (also used by the god power). Returns people killed (blast and
 * fallout, all ledger 'war'). Lofts soot proportional to the city burned.
 */
export function nuclearStrike(sim: Sim, s: Settlement, byCiv = 0): number {
  const w = sim.w;
  const m = w.map;
  const e = worldEndings(sim);
  const before = s.pop;
  let dead = removePeople(sim, s, s.pop * sim.rng.range(0.25, 0.45), 'nuclear strike');
  flow(sim, s, 'war', dead);
  addPressure(sim, s.civId, 'nuclear_war', dead, `Nuclear destruction of ${s.name}`);
  m.forRadius(s.x, s.y, 3.5, (i, _x, _y, d2) => {
    if (m.bld[i] && d2 < 6) removeBuilding(sim, i, true);
    if (d2 < 2) {
      m.bld[i] = B.CRATER;
      m.bldFlags[i] = 0;
    }
    m.hazard[i] |= HAZARD.RADIATION;
    m.pollution[i] = Math.min(255, m.pollution[i] + 180);
    m.veg[i] = 0;
    ignite(sim, i, 120); // through ignite, so the fire is tracked (and a save resumes identically)
    markTile(sim, i);
  });
  // fallout: deaths and illness in nearby towns, falling with distance
  for (const o of w.settlements.values()) {
    const d = Math.hypot(o.x - s.x, o.y - s.y);
    if (d > 7) continue;
    const share = 0.03 * (1 - d / 7);
    const f = removePeople(sim, o, o.pop * share, 'radiation sickness');
    flow(sim, o, 'war', f);
    addPressure(sim, o.civId, 'nuclear_war', f, `Fallout from ${s.name}`);
    o.health = clamp01(o.health - 0.25 * (1 - d / 7));
    o.unrest = clamp01(o.unrest + 0.3 * (1 - d / 7));
    dead += f;
  }
  // firestorm soot (stylized: one city strike stands for a metropolitan region)
  w.climate.soot = (w.climate.soot ?? 0) + Math.min(6, 1.2 * Math.sqrt(before / 100000));
  w.climate.aerosol += 0.15;
  e.coolingSource = 'nuclear_winter';
  e.lastNuclearUse = sim.year;
  logCatastrophe(sim, 'nuclear_strike', s.x, s.y);
  s.unrest = 1;
  emitFx(sim, STATE_FX.nuclearBlast, s.x, s.y);
  void byCiv;
  return dead;
}

/**
 * A full nuclear exchange between two states (god power and tests): `a` strikes first with `n`
 * warheads, and `b` retaliates under its doctrine.
 */
export function forceExchange(sim: Sim, a: Civ, b: Civ, n: number): number {
  const w = sim.w;
  if (a.nukes < n) a.nukes = n;
  if (b.nukes < n) b.nukes = n;
  arsenalOf(sim, a);
  arsenalOf(sim, b);
  let war: War | undefined;
  for (const x of w.wars.values()) if (!x.end && ((x.attackers.includes(a.id) && x.defenders.includes(b.id)) || (x.attackers.includes(b.id) && x.defenders.includes(a.id)))) war = x;
  return launchSalvo(sim, a, war, [b.id], n, [{ label: 'Divine incitement', weight: 1 }], 0);
}
