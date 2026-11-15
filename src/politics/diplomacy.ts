/**
 * Diplomacy (yearly).
 *
 * Relations between civs that have met are persistent state: opinion, trust,
 * trade, shared border, disputed tiles, grievances (memory of wars and lost
 * land), rivalry and treaties. Each year civs update relations from measured
 * drivers and make utility-based choices: trade agreements, non-aggression
 * pacts, defensive alliances, international organizations, federations,
 * embargoes — and war. A war decision weighs expected gains (territory,
 * resources it lacks, revenge, expansionist leadership, faction pressure,
 * doctrine) against costs (relative power, the target's allies, distance,
 * trade interdependence, war exhaustion, nuclear deterrence, shared democratic
 * institutions). The factors that actually tipped the decision are stored as
 * the war's recorded causes. Decisions use noisy power estimates (better with
 * intelligence) — no omniscient AI.
 */
import { onWarEnd } from '../population/development';
import type { Sim } from '../sim/context';
import type { Cause, Civ, IntlOrg, Relation, Treaty, TreatyKind, War } from '../sim/types';
import { clamp, clamp01, saturate } from '../core/math';
import { ensureRelation, getRelation } from '../civilizations/knowledge';
import { logEvent } from '../history/events';
import { isDemocratic } from './govforms';
import { makeName } from '../culture/language';
import { phonOfCulture } from '../population/persons';
import { transferSettlement } from '../civilizations/settlement';
import { killCiv } from '../civilizations/civ';
import { Good, GOOD_COUNT } from '../world/resources';
import { BALANCE } from '../config/balance';

export function militaryEstimate(sim: Sim, observer: Civ, target: Civ): number {
  const noise = 1 + sim.rng.normal() * clamp(0.35 - observer.caps.intelligence * 0.1, 0.05, 0.35);
  return Math.max(0, target.militaryPower * noise);
}

export function treatiesBetween(sim: Sim, a: number, b: number): Treaty[] {
  const rel = getRelation(sim, a, b);
  if (!rel) return [];
  const out: Treaty[] = [];
  for (const id of rel.treaties) {
    const t = sim.w.treaties.get(id);
    if (t?.active) out.push(t);
  }
  return out;
}

export function hasTreaty(sim: Sim, a: number, b: number, kind: TreatyKind): boolean {
  return treatiesBetween(sim, a, b).some((t) => t.kind === kind);
}

export function makeTreaty(sim: Sim, a: Civ, b: Civ, kind: TreatyKind, years = 30, quiet = false): Treaty {
  const w = sim.w;
  const t: Treaty = { id: ++w.ids.treaty, kind, a: a.id, b: b.id, start: sim.year, end: sim.year + years, active: true };
  w.treaties.set(t.id, t);
  const rel = ensureRelation(sim, a.id, b.id);
  rel.treaties.push(t.id);
  if (rel.treaties.length > 12) rel.treaties = rel.treaties.filter((id) => w.treaties.get(id)?.active);
  const label: Record<string, string> = { trade: 'a trade agreement', nonaggression: 'a non-aggression pact', defensive: 'a defensive alliance', alliance: 'an alliance', vassal: 'vassalage terms', ceasefire: 'a ceasefire', peace: 'a peace treaty', federation: 'a federation', embargo: 'an embargo', research: 'a research partnership' };
  if (!quiet)
    logEvent(sim, {
      type: 'treaty_' + kind,
      cat: 'diplomacy',
      title: `${a.name} and ${b.name} signed ${label[kind] ?? kind}`,
      civs: [a.id, b.id],
      importance: kind === 'alliance' || kind === 'defensive' || kind === 'federation' ? 2 : 1,
    });
  return t;
}

export function atWarWith(sim: Sim, a: number, b: number): War | undefined {
  for (const wr of sim.w.wars.values()) {
    if (wr.end) continue;
    if ((wr.attackers.includes(a) && wr.defenders.includes(b)) || (wr.attackers.includes(b) && wr.defenders.includes(a))) return wr;
  }
  return undefined;
}

export function inAnyWar(sim: Sim, c: number): boolean {
  for (const wr of sim.w.wars.values()) if (!wr.end && (wr.attackers.includes(c) || wr.defenders.includes(c))) return true;
  return false;
}

function similarity(sim: Sim, a: Civ, b: Civ): number {
  const w = sim.w;
  let s = 0;
  const ca = w.cultures.get(a.cultureId);
  const cb = w.cultures.get(b.cultureId);
  if (ca && cb) {
    if (ca.id === cb.id) s += 0.4;
    else if (w.languages.get(ca.languageId)?.rootId === w.languages.get(cb.languageId)?.rootId) s += 0.2;
  }
  if (a.stateReligion && a.stateReligion === b.stateReligion) s += 0.25;
  else if (a.stateReligion && b.stateReligion) {
    const ra = w.religions.get(a.stateReligion);
    const tolerant = ra?.doctrines.includes('tolerance');
    if (!tolerant) s -= 0.15 * a.inst.religiousAuthority;
  }
  if (isDemocratic(a) && isDemocratic(b)) s += 0.25;
  return s;
}

/** Update relation state between two civs from measured drivers. */
function updateRelation(sim: Sim, rel: Relation, a: Civ, b: Civ): void {
  const sim01 = similarity(sim, a, b);
  const war = atWarWith(sim, a.id, b.id);
  let drift = sim01 * 8 + saturate(rel.trade, 3000) * 15 - saturate(rel.disputes, 20) * 12 - (rel.grievAB + rel.grievBA) * 0.08;
  for (const t of treatiesBetween(sim, a.id, b.id)) {
    if (t.kind === 'alliance' || t.kind === 'defensive') drift += 8;
    if (t.kind === 'trade' || t.kind === 'research') drift += 4;
    if (t.kind === 'embargo') drift -= 10;
    if (t.end < sim.year) t.active = false;
  }
  if (war) drift = -40;
  rel.opinion = clamp(rel.opinion + (drift - rel.opinion) * 0.15, -100, 100);
  rel.trust = clamp01(rel.trust + (rel.opinion > 20 ? 0.02 : rel.opinion < -20 ? -0.03 : 0) - (war ? 0.08 : 0));
  rel.grievAB *= 0.97;
  rel.grievBA *= 0.97;
  rel.rival = rel.opinion < -35 && Math.abs(Math.log((a.militaryPower + 1) / (b.militaryPower + 1))) < 1.2;
}

export function diplomacyYearly(sim: Sim, civ: Civ): void {
  const w = sim.w;
  const rng = sim.rng;
  if (!civ.alive) return;
  civ.knownCivs = civ.knownCivs.filter((id) => w.civs.get(id)?.alive);
  for (const oid of civ.knownCivs) {
    const other = w.civs.get(oid)!;
    const rel = ensureRelation(sim, civ.id, oid);
    if (civ.id < oid) updateRelation(sim, rel, civ, other);
  }
  // decisions: consider a few counterparts per year (bounded attention)
  const order = rng.shuffle([...civ.knownCivs]).slice(0, 4);
  for (const oid of order) {
    const other = w.civs.get(oid);
    if (!other || !other.alive || !civ.settlements.length || !other.settlements.length) continue;
    const rel = ensureRelation(sim, civ.id, oid);
    if (atWarWith(sim, civ.id, oid)) continue;
    // trade agreement
    if (civ.caps.currency > 0 && rel.opinion > 5 && !hasTreaty(sim, civ.id, oid, 'trade') && !hasTreaty(sim, civ.id, oid, 'embargo') && rng.chance(0.3 * civ.personality.trade + 0.05)) makeTreaty(sim, civ, other, 'trade', 25);
    // non-aggression with a stronger neighbour
    if (rel.border > 0 && militaryEstimate(sim, civ, other) > civ.militaryPower * 1.3 && rel.opinion > -20 && !hasTreaty(sim, civ.id, oid, 'nonaggression') && rng.chance(0.25 * civ.personality.caution)) makeTreaty(sim, civ, other, 'nonaggression', 20);
    // defensive alliance against a shared rival
    if (rel.opinion > 30 && rel.trust > 0.5 && !hasTreaty(sim, civ.id, oid, 'defensive') && sharedRival(sim, civ, other) && rng.chance(0.4)) makeTreaty(sim, civ, other, 'defensive', 40);
    // research partnership in the modern era
    if (civ.caps.internationalOrgs > 0 && rel.opinion > 40 && !hasTreaty(sim, civ.id, oid, 'research') && rng.chance(0.15)) makeTreaty(sim, civ, other, 'research', 20, true);
    // embargo a hated rival
    if (rel.opinion < -50 && hasTreaty(sim, civ.id, oid, 'trade')) {
      for (const t of treatiesBetween(sim, civ.id, oid)) if (t.kind === 'trade') t.active = false;
      makeTreaty(sim, civ, other, 'embargo', 10);
    }
    // federation of close, democratic/federal, similar peoples under a common threat
    if (rel.opinion > 70 && rel.trust > 0.8 && civ.inst.federalism > 0.55 && other.inst.federalism > 0.55 && similarity(sim, civ, other) > 0.4 && sharedRival(sim, civ, other) && rng.chance(0.1)) federate(sim, civ, other);
    // war
    if (w.laws.warfare) considerWar(sim, civ, other, rel);
  }
  organizationsYearly(sim, civ);
  // vassals pay tribute; strong vassals break free
  if (civ.overlord) {
    const lord = w.civs.get(civ.overlord);
    if (!lord || !lord.alive) civ.overlord = 0;
    else {
      const tribute = civ.treasury * 0.15;
      civ.treasury -= tribute;
      lord.treasury += tribute;
      if (civ.militaryPower > lord.militaryPower * 0.8 && rng.chance(0.2)) {
        civ.overlord = 0;
        logEvent(sim, { type: 'independence', cat: 'diplomacy', title: `${civ.name} threw off the overlordship of ${lord.name}`, civs: [civ.id, lord.id], importance: 3 });
      }
    }
  }
}

function sharedRival(sim: Sim, a: Civ, b: Civ): boolean {
  for (const oid of a.knownCivs) {
    if (oid === b.id) continue;
    const ra = getRelation(sim, a.id, oid);
    const rb = getRelation(sim, b.id, oid);
    if (ra && rb && ra.opinion < -25 && rb.opinion < -25) return true;
  }
  return false;
}

function considerWar(sim: Sim, civ: Civ, other: Civ, rel: Relation): void {
  const w = sim.w;
  const rng = sim.rng;
  if (inAnyWar(sim, civ.id) && rng.chance(0.8)) return;
  if (sim.year - rel.lastWar < 15 && rng.chance(0.8)) return;
  if (civ.overlord === other.id || other.overlord === civ.id) return;
  const mine = civ.militaryPower;
  const theirs = militaryEstimate(sim, civ, other);
  let allies = 0;
  for (const oid of other.knownCivs) if (hasTreaty(sim, other.id, oid, 'defensive') || hasTreaty(sim, other.id, oid, 'alliance')) allies += w.civs.get(oid)?.militaryPower ?? 0;
  const ratio = (mine + 1) / (theirs + allies * 0.6 + 1);
  const griev = civ.id === rel.a ? rel.grievAB : rel.grievBA;
  // what do we lack that they have?
  let resourceWant = 0;
  for (const g of [Good.COPPER, Good.TIN, Good.IRON, Good.COAL, Good.OIL, Good.URANIUM, Good.RARE, Good.HORSES]) if (civ.access[g] < 0.3 && other.access[g] > 0.6) resourceWant += 0.12;
  const crowded = civ.econ.livingStandard < 1.1 ? 0.15 : 0;
  const zeal = civ.stateReligion && other.stateReligion && civ.stateReligion !== other.stateReligion && w.religions.get(civ.stateReligion)?.doctrines.includes('holy_struggle') ? 0.15 * civ.inst.religiousAuthority : 0;
  const military = civ.factions.find((f) => f.key === 'military');
  const gains: Cause[] = [
    { label: 'Territorial dispute along the border', weight: saturate(rel.disputes, 15) * 0.35 },
    { label: 'Competition for resources it lacked', weight: resourceWant },
    { label: 'Grievances from past conflicts', weight: saturate(griev, 30) * 0.3 },
    { label: 'Expansionist leadership', weight: Math.max(0, civ.personality.aggression - 0.4) * 0.5 },
    { label: 'Military faction pressure', weight: military && military.power > 0.2 ? military.power * 0.3 : 0 },
    { label: 'Population pressure on land', weight: crowded },
    { label: 'Religious zeal', weight: zeal },
    { label: 'Deteriorating relations', weight: Math.max(0, -rel.opinion) / 250 },
    { label: 'Perceived military superiority', weight: clamp((ratio - 1) * 0.25, 0, 0.5) },
  ];
  const gain = gains.reduce((a, c) => a + c.weight, 0);
  let cost = 0.15 + civ.warExhaustion * 0.8 + saturate(rel.trade, 3000) * 0.35 + (ratio < 1 ? (1 - ratio) * 1.2 : 0);
  if (isDemocratic(civ) && isDemocratic(other)) cost += 0.5; // democratic-peace tendency (stylized)
  if (hasTreaty(sim, civ.id, other.id, 'nonaggression')) cost += 0.4 * (1 - civ.personality.aggression * 0.5);
  if (other.nukes > 0 && w.laws.advancedWeapons) cost += 1.5 + (civ.nukes > 0 ? 0.5 : 0); // deterrence
  const dist = distanceBetween(sim, civ, other);
  cost += clamp(dist / (40 + civ.caps.logistics * 20 + civ.caps.navalTier * 6) - 0.3, 0, 1.2);
  const propensity = 0.15 * w.meta.settings.aggressiveness * BALANCE.warPropensity;
  if (gain > cost && rng.chance(propensity * (gain - cost + 0.2))) {
    const goal = resourceWant > 0.2 ? 'resources' : griev > 15 ? 'revenge' : rel.disputes > 8 ? 'border' : 'conquest';
    declareWar(sim, civ, other, goal, [...gains.filter((g) => g.weight > 0.02), { label: `Military balance estimated at ${ratio.toFixed(1)}:1`, weight: 0.05 }]);
  } else if (gain > cost * 0.7 && rng.chance(0.1)) {
    // threats and failed negotiations sour relations
    rel.opinion -= 8;
    if (rng.chance(0.3))
      logEvent(sim, { type: 'ultimatum', cat: 'diplomacy', title: `${civ.name} issued an ultimatum to ${other.name}`, civs: [civ.id, other.id], importance: 1 });
  }
}

export function distanceBetween(sim: Sim, a: Civ, b: Civ): number {
  const ca = sim.w.settlements.get(a.capital);
  const cb = sim.w.settlements.get(b.capital);
  if (!ca || !cb) return 999;
  return Math.hypot(ca.x - cb.x, ca.y - cb.y);
}

export function declareWar(sim: Sim, attacker: Civ, defender: Civ, goal: string, causes: Cause[]): War {
  const w = sim.w;
  const phon = phonOfCulture(sim, attacker.cultureId);
  const region = phon ? makeName(sim.rng, phon, 'place') : 'Border';
  const names: Record<string, string> = { conquest: 'War of Conquest', resources: 'Resource War', revenge: 'War of Revenge', border: 'Border War', reconquest: 'War of Reunification', independence: 'War of Independence', holy: 'Holy War' };
  const war: War = {
    id: ++w.ids.war,
    name: `The ${region} ${names[goal] ?? 'War'}`,
    attackers: [attacker.id],
    defenders: [defender.id],
    leaderA: attacker.id,
    leaderD: defender.id,
    start: sim.year,
    goal,
    targets: [],
    causes,
    score: 0,
    casualties: {},
    battles: 0,
    nuclear: false,
    exhaustionA: 0,
    exhaustionD: 0,
    occupied: [],
  };
  // break treaties between them
  for (const t of treatiesBetween(sim, attacker.id, defender.id)) {
    if (t.kind === 'nonaggression' || t.kind === 'alliance' || t.kind === 'defensive') {
      // reputation damage for breaking a pact
      for (const oid of attacker.knownCivs) {
        const r = getRelation(sim, attacker.id, oid);
        if (r) r.opinion -= 10;
      }
    }
    t.active = false;
  }
  w.wars.set(war.id, war);
  const cap = w.settlements.get(defender.capital);
  logEvent(sim, {
    type: 'war_declared',
    cat: 'war',
    title: `${attacker.name} declared war on ${defender.name}: ${war.name}`,
    civs: [attacker.id, defender.id],
    x: cap?.x,
    y: cap?.y,
    importance: 3,
    causes,
  });
  // alliance obligations
  for (const oid of defender.knownCivs) {
    const ally = w.civs.get(oid);
    if (!ally || !ally.alive || oid === attacker.id) continue;
    if (hasTreaty(sim, defender.id, oid, 'defensive') || hasTreaty(sim, defender.id, oid, 'alliance')) {
      const honor = 0.5 + ally.inst.ruleOfLaw * 0.3 + (1 - ally.personality.caution) * 0.2;
      if (sim.rng.chance(honor)) {
        war.defenders.push(oid);
        logEvent(sim, { type: 'war_joined', cat: 'war', title: `${ally.name} joined ${war.name} to defend its ally ${defender.name}`, civs: [oid, defender.id, attacker.id], importance: 2, causes: [{ label: 'Defensive alliance obligation', weight: 1 }] });
      } else {
        for (const t of treatiesBetween(sim, defender.id, oid)) if (t.kind === 'defensive' || t.kind === 'alliance') t.active = false;
        const r = ensureRelation(sim, defender.id, oid);
        r.opinion -= 30;
        logEvent(sim, { type: 'alliance_broken', cat: 'diplomacy', title: `${ally.name} abandoned its ally ${defender.name}`, civs: [oid, defender.id], importance: 2 });
      }
    }
  }
  return war;
}

/**
 * End a war. Outcomes depend on the war score: white peace, concessions
 * (territory, reparations), vassalage, or — rarely — total annexation.
 */
export function makePeace(sim: Sim, war: War, reason: string): void {
  const w = sim.w;
  war.end = sim.year;
  const attacker = w.civs.get(war.leaderA);
  const defender = w.civs.get(war.leaderD);
  let outcome = 'White peace';
  const score = war.score;
  const winner = score > 0 ? attacker : defender;
  const loser = score > 0 ? defender : attacker;
  if (winner && loser && winner.alive && loser.alive && Math.abs(score) > 20) {
    const occupied = war.occupied.map((id) => w.settlements.get(id)).filter((s): s is NonNullable<typeof s> => !!s && s.civId === loser.id && s.occupiedBy === winner.id);
    if (Math.abs(score) > 85 && loser.settlements.length <= occupied.length + 1 && war.goal !== 'border') {
      for (const s of occupied) transferSettlement(sim, s, winner, 'Annexation after defeat', true);
      for (const id of [...loser.settlements]) {
        const s = w.settlements.get(id);
        if (s) transferSettlement(sim, s, winner, 'Annexation after defeat', true);
      }
      killCiv(sim, loser, `Conquered in ${war.name}`, winner);
      outcome = `${loser.name} was annexed by ${winner.name}`;
    } else if (Math.abs(score) > 60 && loser.militaryPower < winner.militaryPower * 0.4 && sim.rng.chance(0.4)) {
      loser.overlord = winner.id;
      makeTreaty(sim, winner, loser, 'vassal', 999, true);
      for (const s of occupied) s.occupiedBy = 0;
      outcome = `${loser.name} became a vassal of ${winner.name}`;
    } else {
      const ceded = occupied.filter((s) => !s.capital).slice(0, Math.max(1, Math.round(Math.abs(score) / 30)));
      for (const s of ceded) transferSettlement(sim, s, winner, `Ceded in the peace of ${war.name}`, true);
      const reparations = loser.treasury * 0.3;
      loser.treasury -= reparations;
      winner.treasury += reparations;
      outcome = ceded.length ? `${loser.name} ceded ${ceded.map((s) => s.name).join(', ')} to ${winner.name}` : `${loser.name} paid reparations to ${winner.name}`;
    }
    onWarEnd(sim, winner, loser, war.name, Math.abs(score) > 60);
    const rel = ensureRelation(sim, winner.id, loser.id);
    if (loser.id === rel.a) rel.grievAB += Math.abs(score) * 0.5;
    else rel.grievBA += Math.abs(score) * 0.5;
  }
  for (const id of war.occupied) {
    const s = w.settlements.get(id);
    if (s && s.occupiedBy) s.occupiedBy = 0;
  }
  // armies go home
  for (const a of w.armies.values()) if (a.warId === war.id) {
    a.warId = 0;
    a.state = 'idle';
    a.targetKind = 'home';
  }
  for (const a of [...war.attackers, ...war.defenders]) {
    for (const b of [...war.attackers, ...war.defenders]) {
      if (a < b) {
        const r = ensureRelation(sim, a, b);
        r.lastWar = sim.year;
      }
    }
  }
  if (attacker && defender && attacker.alive && defender.alive) makeTreaty(sim, attacker, defender, 'peace', 15, true);
  war.outcome = outcome;
  const totalDead = Object.values(war.casualties).reduce((a, b) => a + b, 0);
  logEvent(sim, {
    type: 'peace',
    cat: 'war',
    title: `${war.name} ended: ${outcome}`,
    text: `${war.battles} battles, about ${Math.round(totalDead).toLocaleString('en-US')} dead over ${sim.year - war.start} years.`,
    civs: [...war.attackers, ...war.defenders],
    importance: 3,
    causes: [{ label: reason, weight: 1 }],
  });
}

function federate(sim: Sim, a: Civ, b: Civ): void {
  // the smaller joins the larger as a federal member; the union keeps both peoples
  const [big, small] = a.population >= b.population ? [a, b] : [b, a];
  for (const id of [...small.settlements]) {
    const s = sim.w.settlements.get(id);
    if (s) transferSettlement(sim, s, big, 'Federal union', true);
  }
  big.inst.federalism = clamp01(big.inst.federalism + 0.15);
  killCiv(sim, small, `Joined ${big.name} in a federal union`, big);
  logEvent(sim, { type: 'federation', cat: 'diplomacy', title: `${small.name} united with ${big.name} in a federation`, civs: [big.id, small.id], importance: 4, causes: [{ label: 'Close cultural ties and trust', weight: 0.5 }, { label: 'A common rival', weight: 0.5 }] });
}

function organizationsYearly(sim: Sim, civ: Civ): void {
  const w = sim.w;
  if (civ.caps.internationalOrgs <= 0) return;
  let member = [...w.orgs.values()].find((o) => !o.dissolved && o.members.includes(civ.id));
  if (!member) {
    // join an existing organization of friends, or found one
    for (const o of w.orgs.values()) {
      if (o.dissolved) continue;
      const friendly = o.members.filter((m) => (getRelation(sim, civ.id, m)?.opinion ?? -100) > 10).length;
      if (friendly >= Math.ceil(o.members.length / 2) && sim.rng.chance(0.4)) {
        o.members.push(civ.id);
        member = o;
        logEvent(sim, { type: 'org_join', cat: 'diplomacy', title: `${civ.name} joined the ${o.name}`, civs: [civ.id], importance: 2 });
        break;
      }
    }
    if (!member) {
      const friends = civ.knownCivs.filter((id) => (getRelation(sim, civ.id, id)?.opinion ?? 0) > 25 && (w.civs.get(id)?.caps.internationalOrgs ?? 0) > 0);
      if (friends.length >= 2 && sim.rng.chance(0.3)) {
        const phon = phonOfCulture(sim, civ.cultureId);
        const word = phon ? makeName(sim.rng, phon, 'word') : 'Concord';
        const org: IntlOrg = { id: ++w.ids.org, name: `${word} ${sim.rng.pick(['League', 'Union', 'Compact', 'Council of Nations', 'Assembly'])}`, kind: 'league', founded: sim.year, founder: civ.id, members: [civ.id, ...friends.slice(0, 5)] };
        w.orgs.set(org.id, org);
        logEvent(sim, { type: 'org_founded', cat: 'diplomacy', title: `The ${org.name} was founded`, civs: org.members, importance: 3 });
      }
    }
  }
  // membership improves relations and mediates disputes
  if (member) {
    for (const m of member.members) {
      if (m === civ.id) continue;
      const r = getRelation(sim, civ.id, m);
      if (r) {
        r.opinion = Math.min(100, r.opinion + 2);
        r.disputes *= 0.9;
      }
    }
    member.members = member.members.filter((id) => w.civs.get(id)?.alive);
    if (member.members.length < 2) member.dissolved = sim.year;
  }
}

/** Value of goods a civ would like to import (for trade). */
export function importNeeds(civ: Civ): number[] {
  const out = new Array(GOOD_COUNT).fill(0);
  for (let g = 0; g < GOOD_COUNT; g++) out[g] = Math.max(0, civ.acc.use[g] - civ.acc.prod[g]);
  return out;
}
