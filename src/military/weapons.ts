/**
 * Weapons by era, land doctrine, arms races and special operations.
 *
 * WEAPON CONCEPTS are fielded from adopted technology (never bought as items): chariots and siege
 * engines, gunpowder artillery, machine guns, chemical weapons, tanks, strategic bombing, radar air
 * defence, missile defence, precision strike, drones, cyberwarfare, hypersonic missiles, high-altitude
 * EMP, autonomous swarms, engineered bioweapons and orbital strike platforms. Strategic concepts need
 * the advanced-weapons law. Each adds to attack, defence or siege strength (read by war.ts).
 *
 * LAND DOCTRINE (massed, firepower, maneuver, networked) follows culture, institutions and what is
 * fielded, and shifts after defeat. The ARMS-RACE index rises when a rival or enemy is stronger and
 * feeds military spending and military research (Richardson-style action-reaction, stylized).
 *
 * SPECIAL OPERATIONS run yearly in active wars and differ by concept: cyberattacks drain an enemy's
 * energy and can tip it into economic crisis; chemical attacks kill soldiers and civilians but cause
 * world outrage and lead to a ban (law-bound states keep it, desperate ones break it); bombing,
 * drones and orbital platforms strike without risking soldiers; an EMP blacks out an electrified
 * enemy; a desperate, lawless state may release an engineered pathogen that can blow back on itself.
 * Every death is a ledger flow ('war') with typed existential pressure.
 */
import type { Sim } from '../sim/context';
import type { Army, Civ, LandDoctrine, MilitaryState, Settlement, War } from '../sim/types';
import { clamp01 } from '../core/math';
import { Good } from '../world/resources';
import { removePeople } from '../population/demography';
import { flow } from '../population/ledger';
import { logEvent } from '../history/events';
import { addPressure, worldEndings } from '../civilizations/endings';
import { ensureRelation } from '../civilizations/knowledge';
import { removeBuilding } from '../civilizations/urban';
import { markTile } from '../sim/context';
import { emitFx, STATE_FX } from '../sim/conceptFx';
import { infect } from '../population/disease';
import { makeName } from '../culture/language';
import { phonOfCulture } from '../population/persons';

export interface WeaponDef {
  key: string;
  name: string;
  /** All of these technologies must be adopted (>= 0.5). */
  techs: string[];
  /** Strategic: needs the advanced-weapons world law. */
  adv?: boolean;
  attack: number;
  defense: number;
  siege: number;
  desc: string;
}

export const WEAPONS: WeaponDef[] = [
  { key: 'chariots', name: 'Chariot corps', techs: ['chariots'], attack: 0.08, defense: 0, siege: 0, desc: 'Fast archery platforms on open ground.' },
  { key: 'siege_engines', name: 'Siege engines', techs: ['siege_engines'], attack: 0, defense: 0, siege: 0.25, desc: 'Rams, towers and torsion artillery against walls.' },
  { key: 'heavy_cavalry', name: 'Heavy cavalry', techs: ['stirrup'], attack: 0.1, defense: 0, siege: 0, desc: 'Armoured shock horsemen.' },
  { key: 'crossbow_militia', name: 'Crossbow militia', techs: ['crossbows'], attack: 0, defense: 0.08, siege: 0, desc: 'Townsmen who can pierce armour from the walls.' },
  { key: 'bombards', name: 'Gunpowder artillery', techs: ['gunpowder'], attack: 0.04, defense: 0, siege: 0.4, desc: 'Cannon that bring down medieval walls.' },
  { key: 'line_infantry', name: 'Line infantry', techs: ['muskets'], attack: 0.06, defense: 0.04, siege: 0, desc: 'Drilled musket volleys.' },
  { key: 'rifled_artillery', name: 'Rifled artillery', techs: ['rifles', 'bessemer_steel'], attack: 0.1, defense: 0, siege: 0.3, desc: 'Steel breech-loading guns firing far beyond sight.' },
  { key: 'machine_guns', name: 'Machine-gun lines', techs: ['machine_guns'], attack: 0, defense: 0.2, siege: 0, desc: 'Industrial firepower that favours the defender.' },
  { key: 'chemical', name: 'Chemical weapons', techs: ['chemical_fertilizer', 'machine_guns'], attack: 0.05, defense: 0, siege: 0.05, desc: 'Poison gas from industrial chemistry: indiscriminate and widely condemned.' },
  { key: 'tanks', name: 'Armoured divisions', techs: ['armored_warfare'], attack: 0.15, defense: 0.05, siege: 0.05, desc: 'Tanks break trench deadlock.' },
  { key: 'bombers', name: 'Strategic bombing', techs: ['military_aviation'], attack: 0.06, defense: 0, siege: 0.2, desc: 'Bombers strike cities and industry far behind the front.' },
  { key: 'air_defense', name: 'Radar air defence', techs: ['radar'], attack: 0, defense: 0.1, siege: 0, desc: 'Radar-directed fighters and guns blunt air raids.' },
  { key: 'missiles', name: 'Strategic missiles', techs: ['ballistic_missiles'], adv: true, attack: 0, defense: 0, siege: 0, desc: 'Intercontinental delivery for strategic weapons.' },
  { key: 'missile_defense', name: 'Missile defence', techs: ['radar', 'precision_weapons'], attack: 0, defense: 0.08, siege: 0, desc: 'Interceptors that can stop some incoming warheads.' },
  { key: 'precision', name: 'Precision strike', techs: ['precision_weapons'], attack: 0.1, defense: 0, siege: 0.1, desc: 'Guided munitions and networked forces.' },
  { key: 'drones', name: 'Combat drones', techs: ['precision_weapons', 'machine_learning'], attack: 0.12, defense: 0.04, siege: 0, desc: 'Remotely piloted strikes without risking crews.' },
  { key: 'cyber', name: 'Cyberwarfare', techs: ['internet'], attack: 0.02, defense: 0.02, siege: 0, desc: 'Attacks on grids, banks and command networks.' },
  { key: 'hypersonic', name: 'Hypersonic missiles', techs: ['precision_weapons', 'ballistic_missiles'], adv: true, attack: 0.05, defense: 0, siege: 0.05, desc: 'Manoeuvring glide vehicles that evade missile defences.' },
  { key: 'emp', name: 'High-altitude EMP', techs: ['nuclear_weapons', 'ballistic_missiles'], adv: true, attack: 0, defense: 0, siege: 0, desc: 'A nuclear burst high above a country burns out its electronics.' },
  { key: 'swarms', name: 'Autonomous swarms', techs: ['autonomous_weapons'], attack: 0.2, defense: 0.06, siege: 0.05, desc: 'Thousands of cheap robotic drones acting without human sign-off.' },
  { key: 'bioweapons', name: 'Engineered bioweapons', techs: ['synthetic_biology'], adv: true, attack: 0, defense: 0, siege: 0, desc: 'Designed pathogens: banned, uncontrollable and liable to blow back.' },
  { key: 'exosuits', name: 'Powered exosuits', techs: ['exoskeletons'], attack: 0.04, defense: 0.1, siege: 0, desc: 'Armoured infantry with machine strength.' },
  { key: 'orbital', name: 'Orbital strike platforms', techs: ['orbital_industry'], adv: true, attack: 0.1, defense: 0, siege: 0.15, desc: 'Kinetic projectiles dropped from orbit.' },
];
const BY_KEY = new Map(WEAPONS.map((d) => [d.key, d]));

const adopted = (civ: Civ, id: string): boolean => (civ.techs[id]?.adoption ?? 0) >= 0.5;

/** Military state, created on first use (older saves lack it). */
export function militaryState(civ: Civ): MilitaryState {
  return (civ.military ??= { doctrine: 'massed', weapons: [], armsRace: 0, attackMult: 1, defenseMult: 1, siegeMult: 1 });
}

export function fields(civ: Civ, key: string): boolean {
  return !!civ.military?.weapons.includes(key);
}

/** Which concepts a civ can field now (derived from adopted technology and the law). */
export function fieldable(sim: Sim, civ: Civ): string[] {
  const adv = sim.w.laws.advancedWeapons;
  return WEAPONS.filter((d) => (adv || !d.adv) && d.techs.every((t) => adopted(civ, t))).map((d) => d.key);
}

function chooseDoctrine(sim: Sim, civ: Civ, weapons: string[]): LandDoctrine {
  const v = sim.w.cultures.get(civ.cultureId)?.values;
  const has = (k: string) => weapons.includes(k);
  if (has('drones') || has('swarms')) return 'networked';
  if (has('tanks') && civ.personality.aggression + (v?.martial ?? 0) * 0.2 > 0.45) return 'maneuver';
  if ((has('bombards') || has('rifled_artillery')) && civ.personality.caution > 0.5) return 'firepower';
  if (has('tanks')) return 'maneuver';
  if (has('bombards') || has('rifled_artillery') || has('siege_engines')) return civ.inst.capacity > 0.35 ? 'firepower' : 'massed';
  return 'massed';
}

const DOCTRINE_MULT: Record<LandDoctrine, [number, number, number]> = {
  massed: [1.04, 1.04, 1],
  firepower: [1, 1.06, 1.2],
  maneuver: [1.1, 1, 1.05],
  networked: [1.1, 1.05, 1.05],
};

/** Yearly: field weapons, choose doctrine, update the arms race. */
export function weaponsYearly(sim: Sim, civ: Civ, atWar: boolean, lostRecently: boolean): void {
  const w = sim.w;
  const m = militaryState(civ);
  const weapons = fieldable(sim, civ);
  const fresh = weapons.filter((k) => !m.weapons.includes(k));
  m.weapons = weapons;
  // a doctrine is rethought after defeat, or when new systems arrive
  if (fresh.length || lostRecently || m.weapons.length === 0) m.doctrine = chooseDoctrine(sim, civ, weapons);
  let a = 1;
  let d = 1;
  let s = 1;
  for (const k of weapons) {
    const def = BY_KEY.get(k)!;
    a += def.attack;
    d += def.defense;
    s += def.siege;
  }
  const [da, dd, ds] = DOCTRINE_MULT[m.doctrine];
  m.attackMult = a * da;
  m.defenseMult = d * dd;
  m.siegeMult = s * ds;
  // arms race: the strongest rival or enemy relative to us
  let threat = 0;
  for (const oid of civ.knownCivs) {
    const o = w.civs.get(oid);
    if (!o || !o.alive) continue;
    const key = civ.id < oid ? `${civ.id}-${oid}` : `${oid}-${civ.id}`;
    const rel = w.relations.get(key);
    if (!rel || (!rel.rival && rel.opinion > -30 && !atWar)) continue;
    threat = Math.max(threat, o.militaryPower / Math.max(1, civ.militaryPower) - 0.8);
  }
  m.armsRace = clamp01(m.armsRace + (clamp01(threat) - m.armsRace) * 0.3);
  if (fresh.length && weapons.length >= 3) {
    const def = BY_KEY.get(fresh[fresh.length - 1])!;
    const firstKey = `weapon:${def.key}`;
    if (w.milestones[firstKey] === undefined) {
      w.milestones[firstKey] = sim.year;
      logEvent(sim, { type: 'weapon_first', cat: 'war', title: `${civ.name} fielded the world's first ${def.name.toLowerCase()}`, text: def.desc, civs: [civ.id], importance: def.adv ? 3 : 2 });
    }
  }
}

/** Largest enemy settlement (optionally the nearest to a point). */
function enemyCity(sim: Sim, enemies: number[]): Settlement | undefined {
  let best: Settlement | undefined;
  for (const e of enemies) {
    const ec = sim.w.civs.get(e);
    if (!ec?.alive) continue;
    for (const sid of ec.settlements) {
      const s = sim.w.settlements.get(sid);
      if (s && (!best || s.pop > best.pop)) best = s;
    }
  }
  return best;
}

function enemyArmy(sim: Sim, enemies: number[]): Army | undefined {
  let best: Army | undefined;
  for (const a of sim.w.armies.values()) if (enemies.includes(a.civId) && (!best || a.manpower > best.manpower)) best = a;
  return best;
}

function civilianDeaths(sim: Sim, s: Settlement, share: number, cause: string, label: string): number {
  const dead = removePeople(sim, s, s.pop * share, cause);
  flow(sim, s, 'war', dead);
  addPressure(sim, s.civId, 'war', dead, label);
  return dead;
}

function outrage(sim: Sim, civ: Civ, amount: number): void {
  for (const o of sim.w.civs.values()) {
    if (!o.alive || o.id === civ.id) continue;
    const r = ensureRelation(sim, civ.id, o.id);
    r.opinion = Math.max(-100, r.opinion - amount);
  }
}

/**
 * Yearly special operations of `civ` in `war`. `kill` removes soldiers from an army (ledger-correct,
 * provided by war.ts).
 */
export function warOperations(sim: Sim, civ: Civ, war: War, enemies: number[], kill: (a: Army, n: number) => void): void {
  const w = sim.w;
  const rng = sim.rng;
  const m = civ.military;
  if (!m || !m.weapons.length) return;
  const isAtt = war.attackers.includes(civ.id);
  const losing = isAtt ? war.score < -30 : war.score > 30;
  const desperate = isAtt ? war.score < -60 : war.score > 60;
  const e = worldEndings(sim);
  const city = enemyCity(sim, enemies);
  const army = enemyArmy(sim, enemies);
  const enemy = city ? w.civs.get(city.civId) : undefined;
  // cyberwarfare: grids and banks
  if (m.weapons.includes('cyber') && enemy && enemy.caps.electrification > 0 && rng.chance(0.35)) {
    const resilience = fields(enemy, 'cyber') ? 0.5 : 1;
    enemy.stock[Good.ENERGY] *= 1 - 0.4 * resilience;
    enemy.stock[Good.ELECTRONICS] *= 1 - 0.15 * resilience;
    const crisis = rng.chance(0.3 * resilience);
    if (crisis) enemy.crisis = Math.max(enemy.crisis, 1);
    logEvent(sim, {
      type: 'cyberattack', cat: 'war',
      title: `${civ.name} launched a cyberattack that blacked out grids across ${enemy.name}${crisis ? ' and set off a financial panic' : ''}`,
      civs: [civ.id, enemy.id], importance: crisis ? 3 : 2,
      causes: [{ label: `${war.name}`, weight: 0.6 }, { label: fields(enemy, 'cyber') ? 'Partly blunted by cyber defences' : 'Undefended networks', weight: 0.4 }],
    });
  }
  // chemical weapons: used when losing unless a ban holds; law-bound states keep the ban
  if (m.weapons.includes('chemical') && losing && army && rng.chance(0.25)) {
    const banned = e.chemBan > 0;
    const breaks = !banned || (civ.inst.ruleOfLaw < 0.4 && desperate);
    if (breaks) {
      kill(army, army.manpower * 0.06);
      const s = sim.w.settlements.get(army.home);
      if (s) civilianDeaths(sim, s, 0.002, 'poison gas', `Poison gas used by ${civ.name}`);
      outrage(sim, civ, banned ? 25 : 12);
      logEvent(sim, {
        type: 'chemical_attack', cat: 'war', title: `${civ.name} used poison gas in ${war.name}${banned ? ', breaking the ban' : ''}`,
        civs: [civ.id, army.civId], importance: 3,
        causes: [{ label: 'Losing the war', weight: 0.5 }, ...(banned ? [{ label: `Weak rule of law (${Math.round(civ.inst.ruleOfLaw * 100)}%)`, weight: 0.5 }] : [{ label: 'No treaty banned chemical weapons yet', weight: 0.5 }])],
      });
      // revulsion produces a ban once nations have international organizations
      if (!banned && [...w.civs.values()].some((c) => c.alive && c.caps.internationalOrgs > 0)) {
        e.chemBan = sim.year;
        logEvent(sim, { type: 'chemical_ban', cat: 'diplomacy', title: 'Nations signed a convention banning chemical weapons', importance: 3, causes: [{ label: `Revulsion at gas attacks in ${war.name}`, weight: 1 }] });
      }
    }
  }
  // strategic bombing of cities and industry
  if (m.weapons.includes('bombers') && city && rng.chance(0.3)) {
    const blunted = enemy && fields(enemy, 'air_defense') ? 0.5 : 1;
    const dead = civilianDeaths(sim, city, rng.range(0.001, 0.004) * blunted, 'bombing', `Bombing of ${city.name}`);
    wreck(sim, city, 1);
    if (dead > 1000 && rng.chance(0.3)) logEvent(sim, { type: 'bombing', cat: 'war', title: `${civ.name} bombed ${city.name} (${Math.round(dead).toLocaleString('en-US')} dead)`, civs: [civ.id, city.civId], settlements: [city.id], x: city.x, y: city.y, importance: 2 });
  }
  // drones: strikes without risking crews
  if (m.weapons.includes('drones') && army && rng.chance(0.5)) kill(army, army.manpower * (m.weapons.includes('swarms') ? 0.05 : 0.025));
  // orbital kinetic strikes
  if (m.weapons.includes('orbital') && city && rng.chance(0.2)) {
    const dead = civilianDeaths(sim, city, 0.01, 'orbital strike', `Orbital strike on ${city.name}`);
    wreck(sim, city, 2);
    emitFx(sim, STATE_FX.orbitalStrike, city.x, city.y);
    logEvent(sim, { type: 'orbital_strike', cat: 'war', title: `Projectiles from ${civ.adjective} orbital platforms struck ${city.name}`, text: `About ${Math.round(dead).toLocaleString('en-US')} died.`, civs: [civ.id, city.civId], settlements: [city.id], x: city.x, y: city.y, importance: 3, causes: [{ label: war.name, weight: 1 }] });
  }
  // EMP: a nuclear burst high above an electrified enemy (no blast deaths; breaks the taboo)
  if (m.weapons.includes('emp') && desperate && enemy && enemy.caps.electrification > 0 && civ.nukes > 0 && civ.arsenal?.doctrine !== 'no_first_use' && rng.chance(0.08 * (1 - civ.personality.caution * 0.5))) {
    civ.nukes--;
    enemy.stock[Good.ENERGY] = 0;
    enemy.stock[Good.ELECTRONICS] *= 0.4;
    enemy.crisis = Math.max(enemy.crisis, 2);
    e.lastNuclearUse = sim.year;
    outrage(sim, civ, 30);
    logEvent(sim, { type: 'emp_strike', cat: 'war', title: `${civ.name} detonated a nuclear weapon high above ${enemy.name}, burning out its electronics`, civs: [civ.id, enemy.id], importance: 4, causes: [{ label: `Facing defeat in ${war.name}`, weight: 0.7 }, { label: 'An electrified, networked enemy', weight: 0.3 }] });
  }
  // engineered bioweapons: only desperate, lawless states; the pathogen can spread back home
  if (m.weapons.includes('bioweapons') && desperate && city && civ.inst.ruleOfLaw < 0.35 && rng.chance(0.05)) {
    const d = engineeredDisease(sim, city, civ, false);
    infect(sim, city, d, 0.01);
    outrage(sim, civ, 40);
    logEvent(sim, {
      type: 'bioweapon', cat: 'war', title: `${civ.name} released an engineered pathogen, the ${d.name}, in ${city.name}`,
      civs: [civ.id, city.civId], settlements: [city.id], x: city.x, y: city.y, importance: 5,
      causes: [{ label: `Facing total defeat in ${war.name}`, weight: 0.5 }, { label: `Weak rule of law (${Math.round(civ.inst.ruleOfLaw * 100)}%)`, weight: 0.3 }, { label: 'A synthetic-biology weapons programme', weight: 0.2 }],
    });
  }
}

function wreck(sim: Sim, s: Settlement, n: number): void {
  const m = sim.w.map;
  let done = 0;
  m.forRadius(s.x, s.y, s.radius, (i) => {
    if (done < n && m.settle[i] === s.id && m.bld[i] && sim.rng.chance(0.2)) {
      removeBuilding(sim, i, true);
      markTile(sim, i);
      done++;
    }
  });
}

/** Create a laboratory pathogen (accident, terror or weapon). `sterilizing` makes an infertility pathogen. */
export function engineeredDisease(sim: Sim, s: Settlement, civ: Civ, sterilizing: boolean) {
  const w = sim.w;
  const rng = sim.rng;
  const phon = phonOfCulture(sim, civ.cultureId);
  const d = {
    id: ++w.ids.disease,
    name: `${phon ? makeName(rng, phon, 'word') : 'Grey'} ${sterilizing ? 'Barrenness' : rng.pick(['Agent', 'Strain', 'Fever', 'Syndrome'])}`,
    r0: sterilizing ? rng.range(4, 7) : rng.range(4, 9),
    lethality: sterilizing ? rng.range(0.001, 0.01) : rng.range(0.15, 0.55),
    duration: rng.range(0.8, 2.5),
    immunity: 1200,
    origin: s.id,
    emerged: sim.year,
    zoonotic: false,
    totalDeaths: 0,
    engineered: true,
    sterilizing: sterilizing || undefined,
  };
  w.diseases.set(d.id, d);
  return d;
}
