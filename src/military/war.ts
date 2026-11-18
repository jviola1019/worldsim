/**
 * Warfare.
 *
 * ARMIES are raised from settlements' working-age people (reducing labour),
 * equipped from the national ARMS stock and paid from the military budget.
 * They move along A* paths (roads/rails speed them; terrain slows them), need
 * supply (attrition far from friendly land), and fight when they meet.
 *
 * BATTLES use Lanchester-style attrition evaluated per tick: each side's
 * effective strength combines manpower, weapons tier, equipment, training,
 * morale, supply, generalship, air support, terrain and fortifications.
 * Losses reduce morale; the side that breaks retreats. This is not a single
 * strength comparison: a smaller, better-supplied force defending hills
 * behind walls can win.
 *
 * SIEGES capture settlements (occupation), damaging buildings and people.
 * WAR SCORE and WAR EXHAUSTION (casualties, occupation, duration, economic
 * strain) drive peace negotiations; most wars end in limited settlements,
 * not total conquest. NUCLEAR weapons are abstract strategic capabilities:
 * they deter war, and in extreme losing situations may be used with
 * catastrophic humanitarian, environmental and diplomatic consequences.
 */
import { flow } from '../population/ledger';
import { onBattle } from '../population/development';
import type { Sim } from '../sim/context';
import type { Army, Civ, Settlement, War } from '../sim/types';
import { BALANCE } from '../config/balance';
import { clamp, clamp01 } from '../core/math';
import { findPath } from '../world/pathfinding';
import { TERRAIN, T } from '../world/terrain';
import { Good } from '../world/resources';
import { B } from '../civilizations/buildingTypes';
import { removePeople, workforceFromCohorts } from '../population/demography';
import { logEvent } from '../history/events';
import { addFx, markTile } from '../sim/context';
import { makePeace, inAnyWar } from '../politics/diplomacy';
import { createPerson } from '../population/persons';
import { removeBuilding } from '../civilizations/urban';
import { ensureRelation } from '../civilizations/knowledge';
import { HAZARD } from '../world/tilemap';
import { isKnown } from '../civilizations/knowledge';

export function armyStrength(sim: Sim, a: Army, civ: Civ | undefined): number {
  if (!civ) return 0;
  const c = civ.caps;
  const tierMult = 1 + a.tier * 0.55;
  const gen = sim.w.persons.get(a.generalId);
  const generalship = gen ? 1 + gen.skills.military * 0.03 : 1;
  const air = 1 + c.airPower * 0.4 + c.autonomousWeapons * 0.3;
  return a.manpower * tierMult * (0.4 + 0.6 * a.equipment) * (0.5 + 0.5 * a.training) * (0.3 + 0.7 * a.morale) * (0.4 + 0.6 * a.supply) * (1 + c.militaryAttack) * generalship * air;
}

export function civMilitaryPower(sim: Sim, civ: Civ): number {
  let p = 0;
  for (const id of civ.armies) {
    const a = sim.w.armies.get(id);
    if (a) p += armyStrength(sim, a, civ);
  }
  // latent capacity: garrisons and fortifications
  p += civ.population * 0.002 * (1 + civ.caps.landTier * 0.55) * (1 + civ.caps.militaryDefense);
  return p;
}

function unitTier(civ: Civ): number {
  return Math.round(civ.caps.landTier);
}

function raiseArmy(sim: Sim, civ: Civ, s: Settlement, manpower: number, warId: number): Army | null {
  const w = sim.w;
  const wf = s.mode === 'cohort' ? workforceFromCohorts(s.cohorts, 0.2) : s.members.length * 0.5;
  const avail = Math.max(0, wf * BALANCE.maxMobilization * (civ.policies.conscription ? 1.6 : 1) - s.garrison);
  const n = Math.floor(Math.min(manpower, avail));
  if (n < 10) return null;
  s.garrison += n;
  const armsPer = 0.05 + civ.caps.landTier * 0.04;
  const armsNeed = n * armsPer;
  const arms = Math.min(civ.stock[Good.ARMS], armsNeed);
  civ.stock[Good.ARMS] -= arms;
  const horses = civ.caps.cavalry > 0 ? Math.min(civ.stock[Good.HORSES], n * 0.1) : 0;
  civ.stock[Good.HORSES] -= horses;
  const general = n < 300 ? undefined : createPerson(sim, { born: sim.year - sim.rng.int(28, 50), species: civ.species, civId: civ.id, settlementId: s.id, cultureId: civ.cultureId, religionId: civ.stateReligion, role: 'general', notable: true });
  general?.titles.push('General');
  const a: Army = {
    id: ++w.ids.army,
    civId: civ.id,
    kind: 'army',
    x: s.x + 0.5,
    y: s.y + 0.5,
    path: [],
    pathPos: 0,
    targetKind: 'none',
    targetId: 0,
    manpower: n,
    equipment: armsNeed > 0 ? clamp01(arms / armsNeed + 0.3) : 1,
    training: clamp01(0.3 + (s.bld[B.BARRACKS] > 0 ? 0.3 : 0) + civ.budget.military),
    morale: 0.8,
    supply: 1,
    tier: unitTier(civ),
    generalId: general?.id ?? 0,
    warId,
    state: 'idle',
    home: s.id,
    siege: 0,
    battleWith: 0,
    comp: [1, horses > 0 ? 0.3 : 0, civ.caps.siege > 0 ? 0.2 : 0, civ.caps.landTier >= 9 ? 0.4 : 0, civ.caps.airTier > 0 ? 0.2 : 0],
    carried: 0,
    raised: sim.year,
  };
  w.armies.set(a.id, a);
  civ.armies.push(a.id);
  return a;
}

export function disbandArmy(sim: Sim, a: Army): void {
  const w = sim.w;
  const home = w.settlements.get(a.home);
  if (home) home.garrison = Math.max(0, home.garrison - a.manpower - (home.garrison > 0 ? 0 : 0));
  // soldiers killed are already removed; survivors return to work
  w.armies.delete(a.id);
  const civ = w.civs.get(a.civId);
  if (civ) civ.armies = civ.armies.filter((id) => id !== a.id);
}

function killSoldiers(sim: Sim, a: Army, n: number, war: War | undefined): void {
  const w = sim.w;
  n = Math.min(n, a.manpower);
  if (n <= 0) return;
  a.manpower -= n;
  const home = w.settlements.get(a.home);
  if (home) {
    home.garrison = Math.max(0, home.garrison - n);
    const removed = removePeople(sim, home, n, 'war', 1);
    flow(sim, home, 'war', removed);
  }
  if (war) war.casualties[a.civId] = (war.casualties[a.civId] ?? 0) + n;
}

/** Yearly military planning for a civ. */
export function militaryYearly(sim: Sim, civ: Civ): void {
  const w = sim.w;
  if (!civ.alive) return;
  const wars = [...w.wars.values()].filter((x) => !x.end && (x.attackers.includes(civ.id) || x.defenders.includes(civ.id)));
  const atWar = wars.length > 0;
  const base = civ.population * 0.004 * (0.4 + civ.budget.military * 3);
  const target = atWar ? civ.population * BALANCE.maxMobilization * 0.35 * (civ.policies.conscription ? 1.5 : 1) : base;
  let current = 0;
  for (const id of civ.armies) current += w.armies.get(id)?.manpower ?? 0;
  civ.mobilization = civ.population > 0 ? current / civ.population : 0;
  // upkeep and morale
  const upkeepOk = civ.treasury > 0 || civ.budget.military > 0.15;
  for (const id of civ.armies) {
    const a = w.armies.get(id);
    if (!a) continue;
    a.training = clamp01(a.training + (upkeepOk ? 0.03 : -0.05));
    if (!atWar) a.morale = clamp01(a.morale + 0.1);
    a.tier = Math.max(a.tier, unitTier(civ)); // re-equipped with new weapons over time
    if (a.manpower < 5) disbandArmy(sim, a);
  }
  if (current < target * 0.8 && civ.settlements.length) {
    const s = pickMusterPoint(sim, civ, wars) ?? sim.w.settlements.get(civ.capital);
    if (s) raiseArmy(sim, civ, s, Math.max(20, (target - current) * 0.6), wars[0]?.id ?? 0);
  } else if (!atWar && current > target * 1.6 && civ.armies.length) {
    const a = w.armies.get(civ.armies[civ.armies.length - 1]);
    if (a) disbandArmy(sim, a);
  }
  // assign targets in wars
  for (const war of wars) {
    const enemies = war.attackers.includes(civ.id) ? war.defenders : war.attackers;
    for (const id of civ.armies) {
      const a = w.armies.get(id);
      if (!a || a.state === 'battle' || a.state === 'sieging') continue;
      a.warId = war.id;
      const tgt = chooseTarget(sim, civ, a, enemies);
      // an army that just gave up on a city does not march straight back to it
      const alreadyOnIt = tgt && a.state === 'moving' && a.targetKind === 'settlement' && a.targetId === tgt.id && a.path.length > 0;
      // an army that just gave up on a city does not march straight back to it; one already marching keeps its path
      if (tgt && !alreadyOnIt && !(tgt.id === a.liftedTarget && sim.year - (a.liftedYear ?? -99) < 5)) setArmyTarget(sim, a, tgt.x, tgt.y, 'settlement', tgt.id);
    }
    // exhaustion
    const isAtt = war.attackers.includes(civ.id);
    const losses = (war.casualties[civ.id] ?? 0) / Math.max(1, civ.population);
    const occupiedOwn = civ.settlements.filter((sid) => (w.settlements.get(sid)?.occupiedBy ?? 0) !== 0).length / Math.max(1, civ.settlements.length);
    const ex = clamp01(losses * 25 + occupiedOwn * 0.6 + (sim.year - war.start) * 0.025 + (civ.econ.growth < 0 ? 0.05 : 0));
    if (isAtt) war.exhaustionA = Math.max(war.exhaustionA, ex);
    else war.exhaustionD = Math.max(war.exhaustionD, ex);
    civ.warExhaustion = Math.max(civ.warExhaustion, ex);
    if (war.leaderA === civ.id || war.leaderD === civ.id) peaceCheck(sim, war);
    nuclearCheck(sim, civ, war, enemies);
  }
  if (!atWar) civ.warExhaustion *= 0.8;
  // strategic arsenal (abstract)
  if (civ.caps.nuclearWeapons > 0 && w.laws.advancedWeapons) {
    const want = Math.round(2 + civ.personality.caution * 4 + (civ.caps.missiles > 0.5 ? 6 : 0));
    if (civ.nukes < want && civ.access[Good.URANIUM] > 0.3 && sim.rng.chance(0.3)) {
      civ.nukes++;
      if (civ.nukes === 1) {
        const first = w.milestones['nuclear_power_state'] === undefined;
        if (first) w.milestones['nuclear_power_state'] = sim.year;
        logEvent(sim, { type: 'nuclear_state', cat: 'war', title: `${civ.name} became a nuclear-armed state`, civs: [civ.id], importance: first ? 4 : 3 });
      }
    }
  }
  civ.militaryPower = civMilitaryPower(sim, civ);
}

function pickMusterPoint(sim: Sim, civ: Civ, wars: War[]): Settlement | undefined {
  const w = sim.w;
  if (!wars.length) return w.settlements.get(civ.capital);
  let best: Settlement | undefined;
  let bestD = Infinity;
  const enemyCaps: Settlement[] = [];
  for (const war of wars) for (const e of war.attackers.includes(civ.id) ? war.defenders : war.attackers) {
    const ec = w.civs.get(e);
    const s = ec ? w.settlements.get(ec.capital) : undefined;
    if (s) enemyCaps.push(s);
  }
  for (const id of civ.settlements) {
    const s = w.settlements.get(id);
    if (!s || s.occupiedBy) continue;
    for (const e of enemyCaps) {
      const d = Math.hypot(e.x - s.x, e.y - s.y) - Math.log10(s.pop + 10) * 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
  }
  return best;
}

function chooseTarget(sim: Sim, civ: Civ, a: Army, enemies: number[]): Settlement | null {
  const w = sim.w;
  let best: Settlement | null = null;
  let bestScore = -Infinity;
  for (const e of enemies) {
    const ec = w.civs.get(e);
    if (!ec) continue;
    for (const sid of ec.settlements) {
      const s = w.settlements.get(sid);
      if (!s || s.occupiedBy === civ.id) continue;
      if (!isKnown(sim, civ.id, w.map.idx(s.x, s.y))) continue;
      const d = Math.hypot(s.x - a.x, s.y - a.y);
      const score = Math.log10(s.pop + 10) * 3 - d * 0.25 - s.wallTier * 0.5 + (s.capital ? 2 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
  }
  // defenders also protect their own occupied cities
  for (const id of civ.settlements) {
    const s = w.settlements.get(id);
    if (s && s.occupiedBy) {
      const score = 6 - Math.hypot(s.x - a.x, s.y - a.y) * 0.25;
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
  }
  return best;
}

export function setArmyTarget(sim: Sim, a: Army, x: number, y: number, kind: Army['targetKind'], id: number): void {
  const m = sim.w.map;
  const civ = sim.w.civs.get(a.civId);
  const from = m.idx(Math.floor(a.x), Math.floor(a.y));
  const to = m.idx(x, y);
  const sea = (civ?.caps.navalTier ?? 0) >= 3;
  let path = findPath(m, from, to, { mode: 'land', maxNodes: 15000, railTier: civ?.caps.railTier });
  if (!path && sea) path = findPath(m, from, to, { mode: 'any', maxNodes: 20000 });
  if (!path) return;
  a.path = path;
  a.pathPos = 0;
  a.targetKind = kind;
  a.targetId = id;
  a.state = 'moving';
}

/** Per-tick army movement, battles and sieges. */
export function armiesTick(sim: Sim): void {
  const w = sim.w;
  const m = w.map;
  for (const a of [...w.armies.values()]) {
    if (!w.armies.has(a.id)) continue;
    const civ = w.civs.get(a.civId);
    if (!civ || !civ.alive) {
      w.armies.delete(a.id);
      continue;
    }
    const war = a.warId ? w.wars.get(a.warId) : undefined;
    if (a.state === 'battle') {
      battleTick(sim, a, war);
      continue;
    }
    // look for enemies nearby
    if (war && !war.end) {
      const enemy = findEnemyArmy(sim, a, war);
      if (enemy) {
        a.state = 'battle';
        a.battleWith = enemy.id;
        enemy.state = 'battle';
        enemy.battleWith = a.id;
        continue;
      }
    }
    if (a.state === 'sieging') {
      siegeTick(sim, a, civ, war);
      continue;
    }
    if (a.state === 'moving' || a.targetKind === 'home') {
      if (a.targetKind === 'home' && !a.path.length) {
        const home = w.settlements.get(a.home);
        if (home) setArmyTarget(sim, a, home.x, home.y, 'home', home.id);
        if (!a.path.length) a.targetKind = 'none';
      }
      if (a.pathPos >= a.path.length - 1) {
        if (a.targetKind === 'settlement' && war && !war.end) {
          a.state = 'sieging';
          a.siege = 0;
          a.siegeTicks = 0;
        } else {
          a.state = 'idle';
          a.targetKind = 'none';
          a.path = [];
        }
        continue;
      }
      const next = a.path[a.pathPos + 1];
      const nx = m.xOf(next) + 0.5;
      const ny = m.yOf(next) + 0.5;
      const dx = nx - a.x;
      const dy = ny - a.y;
      const d = Math.hypot(dx, dy);
      const water = m.isWater(next);
      const cost = water ? 1.6 : Math.max(0.12, m.landMoveCost(next) * (m.railTier(next) > 0 && civ.caps.railTier > 0 ? 0.25 : 1));
      const step = (BALANCE.armyBaseSpeed * (1 + civ.caps.mobility * 0.5 + civ.caps.landSpeed * 0.3)) / cost;
      if (d <= step) {
        a.x = nx;
        a.y = ny;
        a.pathPos++;
      } else {
        a.x += (dx / d) * step;
        a.y += (dy / d) * step;
      }
    }
    // supply
    const here = m.idx(Math.floor(a.x), Math.floor(a.y));
    const friendly = m.owner[here] === civ.id;
    const range = 0.04 + civ.caps.logistics * 0.04;
    a.supply = clamp01(a.supply + (friendly ? 0.02 : -0.004 / Math.max(0.25, range * 10)));
    if (a.supply < 0.3 && w.tick % 30 === a.id % 30) killSoldiers(sim, a, a.manpower * 0.01, war);
  }
}

function findEnemyArmy(sim: Sim, a: Army, war: War): Army | null {
  const enemies = war.attackers.includes(a.civId) ? war.defenders : war.attackers;
  for (const o of sim.w.armies.values()) {
    if (o === a || !enemies.includes(o.civId) || o.state === 'battle') continue;
    if ((o.x - a.x) ** 2 + (o.y - a.y) ** 2 < 2.2) return o;
  }
  return null;
}

function defenseMultiplier(sim: Sim, a: Army): number {
  const m = sim.w.map;
  const i = m.idx(Math.floor(a.x), Math.floor(a.y));
  const t = m.terrain[i];
  let mult = 1;
  if (t === T.HILLS) mult *= 1.3;
  else if (t === T.MOUNTAIN) mult *= 1.6;
  else if (t === T.FOREST || t === T.JUNGLE || t === T.SWAMP || t === T.TAIGA) mult *= 1.2;
  if (m.river[i] > 0) mult *= 1.1;
  const civ = sim.w.civs.get(a.civId);
  if (m.owner[i] === a.civId) mult *= 1.1 + (civ?.caps.militaryDefense ?? 0) * 0.5;
  return mult;
}

function battleTick(sim: Sim, a: Army, war: War | undefined): void {
  const w = sim.w;
  const b = w.armies.get(a.battleWith);
  if (!b || b.state !== 'battle' || !war || war.end) {
    a.state = 'idle';
    a.battleWith = 0;
    return;
  }
  if (a.id > b.id) return; // resolve each pair once per tick
  const ca = w.civs.get(a.civId);
  const cb = w.civs.get(b.civId);
  const sa = armyStrength(sim, a, ca) * defenseMultiplier(sim, a) * (0.9 + sim.rng.float() * 0.2);
  const sb = armyStrength(sim, b, cb) * defenseMultiplier(sim, b) * (0.9 + sim.rng.float() * 0.2);
  // linear law for melee eras, square law (aimed fire) from gunpowder on
  const square = Math.max(a.tier, b.tier) >= 5;
  const k = BALANCE.attrition;
  const lossA = Math.min(0.08, k * (square ? sb / Math.max(1, sa) : Math.sqrt(sb / Math.max(1, sa)))) * a.manpower;
  const lossB = Math.min(0.08, k * (square ? sa / Math.max(1, sb) : Math.sqrt(sa / Math.max(1, sb)))) * b.manpower;
  killSoldiers(sim, a, lossA, war);
  killSoldiers(sim, b, lossB, war);
  a.morale = clamp01(a.morale - (lossA / Math.max(1, a.manpower + lossA)) * 3);
  b.morale = clamp01(b.morale - (lossB / Math.max(1, b.manpower + lossB)) * 3);
  if (w.tick % 8 === 0) addFx(sim, 'fx.clash', (a.x + b.x) / 2, (a.y + b.y) / 2, 0.6);
  const aBroke = a.morale < BALANCE.moraleBreak || a.manpower < 10;
  const bBroke = b.morale < BALANCE.moraleBreak || b.manpower < 10;
  if (aBroke || bBroke) {
    const winner = aBroke && !bBroke ? b : a;
    const loser = winner === a ? b : a;
    war.battles++;
    const attackerWon = war.attackers.includes(winner.civId);
    war.score = clamp(war.score + (attackerWon ? 1 : -1) * (6 + Math.min(14, loser.manpower / 500)), -100, 100);
    const i = sim.w.map.idx(Math.floor(winner.x), Math.floor(winner.y));
    sim.w.map.hazard[i] |= HAZARD.BATTLEFIELD;
    const big = loser.manpower + winner.manpower > 20000;
    if (war.battles <= 2 || big)
      logEvent(sim, {
        type: 'battle',
        cat: 'war',
        title: `Battle near ${nearestName(sim, winner.x, winner.y)}: ${w.civs.get(winner.civId)?.name} defeated ${w.civs.get(loser.civId)?.name}`,
        civs: [winner.civId, loser.civId],
        persons: [winner.generalId, loser.generalId].filter((x) => x),
        x: Math.floor(winner.x),
        y: Math.floor(winner.y),
        importance: big ? 2 : 1,
      });
    const place = nearestName(sim, winner.x, winner.y);
    if (winner.generalId) onBattle(sim, winner.generalId, true, place, big);
    if (loser.generalId) onBattle(sim, loser.generalId, false, place, big);
    for (const x of [a, b]) {
      x.state = 'idle';
      x.battleWith = 0;
    }
    // loser retreats home
    loser.targetKind = 'home';
    loser.path = [];
    if (loser.manpower < 10) disbandArmy(sim, loser);
  }
}

function nearestName(sim: Sim, x: number, y: number): string {
  let best = 'the wilds';
  let bd = Infinity;
  for (const s of sim.w.settlements.values()) {
    const d = (s.x - x) ** 2 + (s.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = s.name;
    }
  }
  return best;
}

function siegeTick(sim: Sim, a: Army, civ: Civ, war: War | undefined): void {
  const w = sim.w;
  const s = w.settlements.get(a.targetId);
  if (!s || !war || war.end || s.civId === civ.id || s.occupiedBy === civ.id) {
    a.state = 'idle';
    a.targetKind = 'none';
    return;
  }
  const defender = w.civs.get(s.civId);
  const walls = s.bld[B.WALL] > 0 ? 1 + (defender?.caps.fortification ?? 0) * 0.35 : 1;
  const fort = s.bld[B.FORT] > 0 ? 1.4 : 1;
  const defense = (s.garrison * 0.5 + s.pop * 0.01 + 20) * (1 + (defender?.caps.landTier ?? 0) * 0.5) * walls * fort;
  const attack = armyStrength(sim, a, civ) * (1 + civ.caps.siege);
  const rate = clamp((attack / Math.max(1, defense)) / BALANCE.siegeBaseTicks, 0.0005, 0.05);
  a.siegeTicks = (a.siegeTicks ?? 0) + 1;
  // a hopeless or endless siege is lifted: the army marches home instead of starving at the walls
  if (attack < defense * 0.2 || a.siegeTicks > 3 * 120) {
    a.liftedTarget = s.id;
    a.liftedYear = sim.year;
    a.state = 'idle';
    a.siege = 0;
    a.siegeTicks = 0;
    a.targetKind = 'home';
    a.path = [];
    return;
  }
  a.siege += rate;
  if (w.tick % 20 === 0) {
    killSoldiers(sim, a, a.manpower * 0.003 * walls, war);
    addFx(sim, 'fx.smoke', s.x, s.y, 1);
  }
  if (a.siege >= 1) {
    s.occupiedBy = civ.id;
    if (!war.occupied.includes(s.id)) war.occupied.push(s.id);
    const attackerSide = war.attackers.includes(civ.id);
    war.score = clamp(war.score + (attackerSide ? 1 : -1) * (s.capital ? 30 : 12), -100, 100);
    // sacking: deaths, destroyed districts, loot, refugees
    const dead = removePeople(sim, s, s.pop * sim.rng.range(0.02, 0.08), 'sack');
    flow(sim, s, 'war', dead);
    const loot = (defender?.treasury ?? 0) * 0.1;
    if (defender) defender.treasury -= loot;
    civ.treasury += loot;
    let wrecked = 0;
    sim.w.map.forRadius(s.x, s.y, s.radius, (i) => {
      if (wrecked < 3 && sim.w.map.settle[i] === s.id && sim.w.map.bld[i] && sim.w.map.bld[i] !== B.FARM && sim.rng.chance(0.15)) {
        removeBuilding(sim, i, true);
        markTile(sim, i);
        wrecked++;
      }
    });
    s.unrest = clamp01(s.unrest + 0.3);
    if (defender) {
      const rel = ensureRelation(sim, civ.id, defender.id);
      if (defender.id === rel.a) rel.grievAB += 10;
      else rel.grievBA += 10;
    }
    logEvent(sim, {
      type: 'siege',
      cat: 'war',
      title: `${civ.name} captured ${s.name}`,
      text: `About ${Math.round(dead).toLocaleString('en-US')} people died in the sack.`,
      civs: [civ.id, s.civId],
      settlements: [s.id],
      x: s.x,
      y: s.y,
      importance: s.capital ? 3 : 2,
    });
    a.state = 'idle';
    a.targetKind = 'none';
    a.siege = 0;
  }
}

function peaceCheck(sim: Sim, war: War): void {
  const w = sim.w;
  const years = sim.year - war.start;
  const ex = Math.max(war.exhaustionA, war.exhaustionD);
  const a = w.civs.get(war.leaderA);
  const d = w.civs.get(war.leaderD);
  if (!a || !d || !a.alive || !d.alive) {
    makePeace(sim, war, 'A belligerent ceased to exist');
    return;
  }
  if (Math.abs(war.score) >= 80) makePeace(sim, war, 'Decisive military outcome');
  else if (ex > BALANCE.peaceExhaustion && sim.rng.chance(0.5)) makePeace(sim, war, 'War exhaustion forced negotiations');
  else if (years > 8 && sim.rng.chance(0.15 + years * 0.01)) makePeace(sim, war, 'Prolonged stalemate');
  else if (years >= 1 && Math.abs(war.score) < 10 && sim.rng.chance(0.1)) makePeace(sim, war, 'Ceasefire after inconclusive fighting');
}

function nuclearCheck(sim: Sim, civ: Civ, war: War, enemies: number[]): void {
  const w = sim.w;
  if (civ.nukes <= 0 || !w.laws.advancedWeapons) return;
  const losing = war.attackers.includes(civ.id) ? war.score < -70 : war.score > 70;
  const capital = w.settlements.get(civ.capital);
  const existential = losing && (!capital || capital.occupiedBy !== 0);
  if (!existential) return;
  const restraint = civ.personality.caution * 0.5 + civ.inst.participation * 0.3 + civ.inst.ruleOfLaw * 0.2;
  if (!sim.rng.chance(0.15 * (1 - restraint))) return;
  // strike the largest enemy city
  let target: Settlement | undefined;
  for (const e of enemies) {
    const ec = w.civs.get(e);
    for (const sid of ec?.settlements ?? []) {
      const s = w.settlements.get(sid);
      if (s && (!target || s.pop > target.pop)) target = s;
    }
  }
  if (!target) return;
  civ.nukes--;
  war.nuclear = true;
  nuclearStrike(sim, target, civ.id);
  logEvent(sim, {
    type: 'nuclear_strike',
    cat: 'war',
    title: `${civ.name} used a nuclear weapon against ${target.name}`,
    civs: [civ.id, target.civId],
    settlements: [target.id],
    x: target.x,
    y: target.y,
    importance: 5,
    causes: [{ label: 'Facing total defeat in ' + war.name, weight: 0.7 }, { label: 'Weak institutional restraints', weight: 1 - restraint }],
  });
  // world outrage
  for (const o of w.civs.values()) {
    if (!o.alive || o.id === civ.id) continue;
    const r = ensureRelation(sim, civ.id, o.id);
    r.opinion = Math.max(-100, r.opinion - 50);
  }
}

/** Abstract catastrophic strike (also used by the god power). */
export function nuclearStrike(sim: Sim, s: Settlement, byCiv = 0): void {
  const w = sim.w;
  const m = w.map;
  const dead = removePeople(sim, s, s.pop * sim.rng.range(0.25, 0.45), 'nuclear strike');
  flow(sim, s, 'war', dead);
  m.forRadius(s.x, s.y, 3.5, (i, x, y, d2) => {
    if (m.bld[i] && d2 < 6) removeBuilding(sim, i, true);
    if (d2 < 2) {
      m.bld[i] = B.CRATER;
      m.bldFlags[i] = 0;
    }
    m.hazard[i] |= HAZARD.RADIATION;
    m.pollution[i] = Math.min(255, m.pollution[i] + 180);
    m.veg[i] = 0;
    m.fire[i] = 120;
    markTile(sim, i);
  });
  w.climate.aerosol += 0.15;
  s.unrest = 1;
  addFx(sim, 'fx.nuke', s.x, s.y, 4);
  void byCiv;
}

export { inAnyWar, TERRAIN };
