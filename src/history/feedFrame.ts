/**
 * The interface AROUND the feed, in the medium of the nation's era: a cave wall, a scribe's tablet
 * house, a scriptorium with a town crier, a printing house, a newspaper front page, a broadcast
 * set, a social app or a holographic interface. Everything shown is derived from state: real
 * outlets and platforms of that nation (with their measured reach), trending topics counted from
 * the nation's recorded events, and real notable people to "follow". Never changes the simulation.
 */
import type { Sim } from '../sim/context';
import type { Civ, Medium, MediaOutlet, Person } from '../sim/types';
import { mediumOf } from '../media/medium';

export interface FeedFrame {
  medium: Medium;
  /** The frame's title: the cave, the scriptorium, the masthead, the channel or the app. */
  title: string;
  subtitle: string;
  /** Platforms or outlets of that kind, largest reach first (for the switcher / dial). */
  outlets: { name: string; reach: number; stateRun: boolean }[];
  /** Topics most talked about recently (from recorded events). */
  trending: { tag: string; count: number }[];
  /** Notable living people of the nation. */
  people: { id: number; name: string; role: string; handle: string }[];
}

const KIND_FOR: Record<Medium, MediaOutlet['kind'][]> = {
  carving: [], tablet: ['chronicle'], scroll: ['chronicle'], broadsheet: ['press'], newspaper: ['newspaper'],
  broadcast: ['broadcaster'], social: ['platform'], holo: ['holonet', 'platform'],
};

const TOPIC: Record<string, string> = {
  war_declared: 'War', peace: 'Peace', battle: 'Frontline', siege: 'Siege', epidemic: 'Outbreak', disaster: 'Disaster',
  technology: 'Discovery', tech_discovered: 'Discovery', ai_launched: 'AI', ai_incident: 'AIScandal', online_protest: 'Protest',
  election: 'Election', revolution: 'Revolution', coup: 'Coup', mission_start: 'Mission', mission_success: 'Victory',
  mission_failed: 'Setback', outlet_founded: 'NewMedia', founding: 'NewTown', religion: 'Faith', space: 'Space',
  ethos_change: 'Values', economy: 'Economy', diplomacy: 'Treaty', culture: 'Culture', politics: 'Politics',
};

/** The most advanced medium among living nations (for the world view). */
export function worldMedium(sim: Sim): Medium {
  const order: Medium[] = ['carving', 'tablet', 'scroll', 'broadsheet', 'newspaper', 'broadcast', 'social', 'holo'];
  let best = 0;
  for (const c of sim.w.civs.values()) if (c.alive && c.settlements.length) best = Math.max(best, order.indexOf(mediumOf(c)));
  return order[best];
}

/** Share of people online: the nation's own, or for the world view the population-weighted share of all living nations. */
export function onlineShare(sim: Sim, civ: Civ | undefined): number {
  if (civ) return civ.media?.online ?? 0;
  let pop = 0, online = 0;
  for (const c of sim.w.civs.values()) {
    if (!c.alive || !c.population) continue;
    pop += c.population;
    online += c.population * (c.media?.online ?? 0);
  }
  return pop > 0 ? online / pop : 0;
}

export function feedFrame(sim: Sim, civ: Civ | undefined): FeedFrame {
  const medium = civ ? mediumOf(civ) : worldMedium(sim);
  const capital = civ ? sim.w.settlements.get(civ.capital)?.name ?? civ.baseName : 'the world';
  const outlets: FeedFrame['outlets'] = [];
  for (const o of sim.w.outlets.values()) {
    if ((civ && o.civId !== civ.id) || o.closed !== undefined || !KIND_FOR[medium].includes(o.kind)) continue;
    outlets.push({ name: o.name, reach: o.reach, stateRun: o.stateRun });
  }
  outlets.sort((a, b) => b.reach - a.reach);
  const lead = outlets[0]?.name;
  // trending: recorded event topics of the last 15 years
  const counts = new Map<string, number>();
  const evs = sim.w.events;
  for (let k = evs.length - 1; k >= 0; k--) {
    const e = evs[k];
    if (sim.year - e.year > 15) break;
    if (civ && !e.civs.includes(civ.id)) continue;
    const t = TOPIC[e.type] ?? TOPIC[e.cat];
    if (t) counts.set(t, (counts.get(t) ?? 0) + e.importance);
  }
  const trending = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, c]) => ({ tag: `#${(civ?.baseName ?? '')}${t}`, count: c }));
  const people: FeedFrame['people'] = [];
  if (civ) {
    const add = (p: Person | undefined, role: string) => {
      if (!p || p.died !== undefined || people.some((x) => x.id === p.id)) return;
      people.push({ id: p.id, name: `${p.name}${p.family ? ' ' + p.family : ''}`, role, handle: '@' + (p.name + (p.family ?? '')).toLowerCase().replace(/[^a-z]/g, '').slice(0, 14) });
    };
    add(sim.w.persons.get(civ.rulerId), 'leader');
    add(sim.w.persons.get(civ.heirId), 'heir');
    for (const p of sim.w.persons.values()) {
      if (people.length >= 4) break;
      if (p.civId === civ.id && p.notable && p.died === undefined && p.role !== 'ruler') add(p, p.role);
    }
  }
  const titles: Record<Medium, [string, string]> = {
    carving: [`The painted cave of ${capital}`, 'News is charcoal and ochre on stone'],
    tablet: [`Tablet house of ${capital}`, lead ? `Kept by ${lead}` : 'Pressed into wet clay by scribes'],
    scroll: [`Scriptorium of ${capital}`, 'Quill, ink and the town crier: "Hear ye, hear ye!"'],
    broadsheet: [lead ?? `Printers of ${capital}`, 'Freshly pulled from the press'],
    newspaper: [lead ?? `The ${capital} Gazette`, 'Morning edition'],
    broadcast: [lead ?? `${civ?.adjective ?? 'World'} Broadcasting`, 'Live'],
    social: [lead ?? 'Feed', `${outlets.length} platform${outlets.length === 1 ? '' : 's'} · ${Math.round(onlineShare(sim, civ) * 100)}% of ${civ ? 'people' : 'the world'} online`],
    holo: [lead ?? 'Holonet', 'Neural sync active'],
  };
  return { medium, title: titles[medium][0], subtitle: titles[medium][1], outlets: outlets.slice(0, 5), trending, people };
}
