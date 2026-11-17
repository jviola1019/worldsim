/**
 * Space programs & off-world settlement (yearly).
 *
 * Civs with rocketry and a spaceport invest a share of output in launches.
 * Capabilities unlock milestones (satellites, crewed flight, stations, lunar
 * base, colonies). Colonies are real populations with growth limited by
 * closed-loop habitats and supply; they contribute output (asteroid metals,
 * orbital power) back home, and — when distant, large and culturally drifting —
 * can declare independence, creating spacefaring civilizations. Speculative
 * steps are only reachable with the speculative-technology law.
 */
import { removePeople } from '../population/demography';
import { record, transfer } from '../population/ledger';
import type { Sim } from '../sim/context';
import type { Civ, Colony } from '../sim/types';
import { B } from '../civilizations/buildingTypes';
import { clamp01 } from '../core/math';
import { logEvent } from '../history/events';
import { Good } from '../world/resources';
import { makeName } from '../culture/language';
import { phonOfCulture } from '../population/persons';
import { createCiv, createCulture } from '../civilizations/civ';

function hasSpaceport(sim: Sim, civ: Civ): boolean {
  for (const id of civ.settlements) if ((sim.w.settlements.get(id)?.bld[B.SPACEPORT] ?? 0) > 0) return true;
  return false;
}

function milestone(sim: Sim, civ: Civ, key: string, title: string): void {
  const k = `space:${key}`;
  const first = sim.w.milestones[k] === undefined;
  if (first) sim.w.milestones[k] = sim.year;
  logEvent(sim, { type: 'space_' + key, cat: 'space', title: `${civ.name} ${title}${first ? ' — a first for the world' : ''}`, civs: [civ.id], importance: first ? 4 : 2 });
}

export function spaceYearly(sim: Sim, civ: Civ): void {
  const w = sim.w;
  const c = civ.caps;
  const sp = civ.space;
  if (c.spaceTier < 1 || !hasSpaceport(sim, civ)) return;
  sp.investment = clamp01(0.002 + civ.personality.science * 0.004 + (c.spaceTier >= 4 ? 0.004 : 0));
  const budget = civ.econ.gdp * sp.investment;
  const launchCost = 2000 / (1 + c.orbitalIndustry + (civ.techs['reusable_rockets']?.adoption ?? 0) * 4);
  const launches = Math.min(50, Math.floor(budget / launchCost));
  if (launches <= 0) return;
  if (sp.launches === 0) milestone(sim, civ, 'first_launch', 'launched its first rocket into space');
  sp.launches += launches;
  if (c.spaceTier >= 2) {
    const before = sp.satellites;
    sp.satellites += Math.ceil(launches * 0.6);
    if (before === 0) milestone(sim, civ, 'satellite', 'placed its first satellite in orbit');
  }
  if (c.spaceTier >= 3 && !w.milestones[`civ_crewed:${civ.id}`]) {
    w.milestones[`civ_crewed:${civ.id}`] = sim.year;
    milestone(sim, civ, 'crewed', 'sent people into orbit');
  }
  if (c.spaceTier >= 4 && sp.stations < 1 + Math.floor(c.orbitalIndustry * 3)) {
    sp.stations++;
    if (sp.stations === 1) milestone(sim, civ, 'station', 'built a permanent space station');
  }
  if (c.spaceTier >= 5 && !sp.lunarBase) {
    sp.lunarBase = true;
    milestone(sim, civ, 'lunar_base', 'established a base on the Moon');
  }
  sp.orbitalIndustry = c.orbitalIndustry * sp.stations;
  // orbital industry returns materials & energy
  if (sp.orbitalIndustry > 0) {
    civ.stock[Good.METAL] += sp.orbitalIndustry * 2000;
    civ.stock[Good.RARE] += sp.orbitalIndustry * 50;
    civ.acc.prod[Good.METAL] += sp.orbitalIndustry * 2000;
  }
  // colonies
  if (c.offworld > 0 && sp.colonies.length < 1 + Math.floor(c.offworld * 2) && sim.rng.chance(0.2)) foundColony(sim, civ);
  for (const id of sp.colonies) {
    const col = w.colonies.get(id);
    if (!col || col.independentCiv) continue;
    const growth = 0.03 * (1 + c.orbitalIndustry * 0.3);
    record(sim, col.civId, 'births', col.pop * growth); // net natural increase of the colony (stylized)
    col.pop *= 1 + growth;
    col.output = col.pop * 0.5;
    civ.stock[Good.RARE] += col.pop * 0.002;
    // independence drive: distance, size, cultural drift, weak ties
    col.independence = clamp01(col.independence + 0.01 + (col.pop > 100000 ? 0.01 : 0) - civ.caps.communication * 0.001 - civ.legitimacy * 0.005);
    if (col.independence > 0.8 && sim.rng.chance(0.2)) colonyIndependence(sim, civ, col);
  }
}

function foundColony(sim: Sim, civ: Civ): void {
  const w = sim.w;
  const phon = phonOfCulture(sim, civ.cultureId);
  const bodies: Colony['body'][] = civ.caps.spaceTier >= 7 ? ['Mars', 'Belt', 'Orbit', 'Outer'] : ['Moon', 'Mars', 'Orbit'];
  const body = sim.rng.pick(bodies);
  const col: Colony = {
    id: ++w.ids.colony,
    civId: civ.id,
    name: `${phon ? makeName(sim.rng, phon, 'place') : 'New Hope'} ${body === 'Orbit' ? 'Station' : 'Colony'}`,
    body,
    pop: takeColonists(sim, civ, 500),
    founded: sim.year,
    independence: 0,
    independentCiv: 0,
    output: 0,
    cultureId: civ.cultureId,
  };
  w.colonies.set(col.id, col);
  civ.space.colonies.push(col.id);
  milestone(sim, civ, 'colony', `founded ${col.name} (${body})`);
}

function colonyIndependence(sim: Sim, civ: Civ, col: Colony): void {
  const culture = createCulture(sim, { parentId: col.cultureId, originCiv: 0 });
  const cap = sim.w.settlements.get(civ.capital);
  const nc = createCiv(sim, { species: civ.species, x: cap?.x ?? 0, y: cap?.y ?? 0, cultureId: culture.id, parentId: civ.id, inheritFrom: civ, quiet: true, name: col.name.split(' ')[0] });
  culture.originCiv = nc.id;
  nc.population = col.pop;
  transfer(sim, civ.id, nc.id, col.pop);
  col.independentCiv = nc.id;
  col.cultureId = culture.id;
  civ.space.colonies = civ.space.colonies.filter((id) => id !== col.id);
  nc.space.colonies.push(col.id);
  col.civId = nc.id;
  logEvent(sim, {
    type: 'colony_independence',
    cat: 'space',
    title: `${col.name} declared independence from ${civ.name}, founding ${nc.name}`,
    civs: [civ.id, nc.id],
    importance: 4,
    causes: [{ label: 'Distance and separate interests of an off-world society', weight: 0.6 }, { label: `Population of ${Math.round(col.pop).toLocaleString('en-US')}`, weight: 0.4 }],
  });
}

/** Colonists leave the capital (moving people inside the nation, not creating them). */
function takeColonists(sim: Sim, civ: Civ, n: number): number {
  const cap = sim.w.settlements.get(civ.capital);
  return cap ? removePeople(sim, cap, n, 'emigration') : 0;
}
