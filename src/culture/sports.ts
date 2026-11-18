/**
 * SPORTS, LEAGUES AND WORLD GAMES (yearly).
 *
 * Sports appear with the eras and inventions that made them possible: wrestling and ritual ball
 * games in the first towns, chariot racing with chariots, codified football, baseball, basketball
 * and gridiron in the industrial age, ice hockey with refrigeration and electric power, esports
 * with the internet, drone racing with robotics and zero-gravity ball games on space stations.
 * Each nation takes up the sports its culture favours and founds national LEAGUES with teams from
 * its biggest cities (named from the city and a mascot, partly in the local language). Every season
 * crowns a champion (stronger cities win more often, upsets happen). Nations in contact meet in
 * international CUPS, and the world holds GAMES every four years: "great games" among early states,
 * then modern world games with host bids, medal tables and wartime boycotts. Hosting and winning
 * bring PRESTIGE (a little legitimacy), visitors (income) and warmer relations; boycotts sour them.
 * All randomness comes from the simulation's stream; all of it is saved.
 */
import type { Sim } from '../sim/context';
import type { Civ, Settlement } from '../sim/types';
import { B } from '../civilizations/buildingTypes';
import { clamp01 } from '../core/math';
import { logEvent } from '../history/events';
import { makeName } from './language';
import { phonOfCulture } from '../population/persons';
import { ensureRelation } from '../civilizations/knowledge';
import { uniqueName } from './naming';

export type SportKey = 'wrestling' | 'ballgame' | 'chariot' | 'football' | 'baseball' | 'basketball' | 'gridiron' | 'hockey' | 'esports' | 'drone' | 'gravball';

export interface SportDef {
  key: SportKey;
  name: string;
  era: number;
  tech?: string;
  /** Sport fades from leagues after this era (chariot racing). */
  until?: number;
  venue: 'court' | 'arena' | 'field' | 'park' | 'rink' | 'track' | 'dome';
  /** Culture leaning that favours it. */
  likes?: 'martial' | 'mercantile' | 'collectivism' | 'piety' | 'nature';
}

export const SPORTS: SportDef[] = [
  { key: 'wrestling', name: 'Wrestling', era: 2, venue: 'arena', likes: 'martial' },
  { key: 'ballgame', name: 'Ritual ball game', era: 3, until: 7, venue: 'court', likes: 'piety' },
  { key: 'chariot', name: 'Chariot racing', era: 4, tech: 'chariots', until: 7, venue: 'track', likes: 'martial' },
  { key: 'football', name: 'Football', era: 7, venue: 'field', likes: 'collectivism' },
  { key: 'baseball', name: 'Baseball', era: 8, venue: 'park', likes: 'mercantile' },
  { key: 'basketball', name: 'Basketball', era: 8, venue: 'arena', likes: 'collectivism' },
  { key: 'gridiron', name: 'Gridiron football', era: 8, venue: 'field', likes: 'martial' },
  { key: 'hockey', name: 'Ice hockey', era: 8, tech: 'electric_power', venue: 'rink', likes: 'nature' },
  { key: 'esports', name: 'Esports', era: 11, tech: 'internet', venue: 'arena', likes: 'mercantile' },
  { key: 'drone', name: 'Drone racing', era: 12, tech: 'general_robotics', venue: 'track' },
  { key: 'gravball', name: 'Zero-gravity ball', era: 13, tech: 'space_stations', venue: 'dome' },
];
export const SPORT_BY_KEY = Object.fromEntries(SPORTS.map((s) => [s.key, s])) as Record<SportKey, SportDef>;

export interface Team {
  name: string;
  settlementId: number;
  rating: number;
  titles: number;
}

export interface League {
  id: number;
  civId: number;
  sport: SportKey;
  name: string;
  founded: number;
  teams: Team[];
  /** Champions by season, newest last (bounded). */
  champions: { year: number; team: string }[];
  active: boolean;
}

export interface GamesRecord {
  year: number;
  kind: 'great' | 'world';
  name: string;
  hostCiv: number;
  hostCity: number;
  /** Medal counts by civ id (gold-weighted points). */
  medals: Record<number, number>;
  boycotts: number[];
}

export interface SportsState {
  /** Name of the modern world games (fixed at the first edition). */
  worldGamesName?: string;
  next: number;
  held: GamesRecord[];
  cups: { year: number; sport: SportKey; winner: number }[];
}

const MASCOTS = ['Lions', 'Comets', 'Herons', 'Wolves', 'Falcons', 'Storm', 'Mariners', 'Bulls', 'Owls', 'Foxes', 'Titans', 'Rockets', 'Rangers', 'Badgers', 'Tide', 'Ravens', 'Stags', 'Pioneers', 'Sparks', 'Lynx', 'Thunder', 'Otters', 'Hornets', 'Glaciers'];

function adopted(civ: Civ, tech: string | undefined): boolean {
  return !tech || (civ.techs[tech]?.adoption ?? 0) >= 0.3;
}

function sportsState(sim: Sim): SportsState {
  return (sim.w.sports ??= { next: sim.year + 4, held: [], cups: [] });
}

function citiesOf(sim: Sim, civ: Civ, min: number): Settlement[] {
  const out: Settlement[] = [];
  for (const id of civ.settlements) { const s = sim.w.settlements.get(id); if (s && s.pop >= min) out.push(s); }
  return out.sort((a, b) => b.pop - a.pop);
}

function venues(s: Settlement): number {
  return s.bld[B.ARENA] + s.bld[B.PARK] * 0.3 + s.bld[B.MONUMENT] * 0.2;
}

/** How much a culture takes to a sport (0.2..1.6), deterministic per culture and sport. */
function affinity(sim: Sim, civ: Civ, sp: SportDef): number {
  const v = sim.w.cultures.get(civ.cultureId)?.values;
  const lean = v && sp.likes ? (v[sp.likes] + 1) / 2 : 0.5;
  // a stable per-culture taste so neighbours do not all play the same games
  const h = ((civ.cultureId * 2654435761) ^ (sp.key.length * 40503 + sp.key.charCodeAt(0) * 97)) >>> 0;
  return 0.2 + lean * 0.8 + (h % 1000) / 1666;
}

export function sportsYearly(sim: Sim): void {
  const w = sim.w;
  const st = sportsState(sim);
  for (const civ of w.civs.values()) {
    if (!civ.alive || !civ.settlements.length) continue;
    civ.prestige = (civ.prestige ?? 0) * 0.95;
    civ.legitimacy = clamp01(civ.legitimacy + civ.prestige * 0.01);
    foundLeagues(sim, civ);
  }
  for (const lg of w.leagues.values()) if (lg.active) season(sim, lg);
  if (sim.year % 4 === 2) cups(sim);
  if (sim.year >= st.next) worldGames(sim, st);
}

function foundLeagues(sim: Sim, civ: Civ): void {
  const w = sim.w;
  const cities = citiesOf(sim, civ, civ.era >= 7 ? 5000 : 800);
  if (cities.length < 2) return;
  const mine = [...w.leagues.values()].filter((l) => l.civId === civ.id && l.active);
  // retire sports that history left behind
  for (const l of mine) if ((SPORT_BY_KEY[l.sport].until ?? 99) < civ.era) { l.active = false; }
  const playing = mine.filter((l) => l.active).length;
  const capacity = civ.era <= 4 ? 1 : civ.era <= 7 ? 2 : 3;
  if (playing >= capacity || !sim.rng.chance(0.25)) return;
  const options = SPORTS.filter((sp) => sp.era <= civ.era && (sp.until ?? 99) >= civ.era && adopted(civ, sp.tech) && !mine.some((l) => l.sport === sp.key && l.active));
  if (!options.length) return;
  // people play the games of their own age: recent sports are far likelier than ancient ones
  const sp = options[Math.max(0, sim.rng.weighted(options.map((o) => affinity(sim, civ, o) * Math.pow(o.era / civ.era, 3))))];
  const phon = phonOfCulture(sim, civ.cultureId);
  const n = Math.min(cities.length, civ.era >= 8 ? 10 : 6);
  const teams: Team[] = cities.slice(0, n).map((s) => {
    const mascot = phon && sim.rng.chance(0.3) ? makeName(sim.rng, phon, 'word') : sim.rng.pick(MASCOTS);
    return { name: `${s.name} ${mascot}`, settlementId: s.id, rating: Math.log10(Math.max(10, s.pop)) + venues(s) * 0.2 + sim.rng.range(-0.3, 0.3), titles: 0 };
  });
  const leagueWord = sp.era <= 4 ? 'Games' : sp.era <= 8 ? 'League' : 'Premier Circuit';
  const lg: League = {
    id: (w.ids.league = (w.ids.league ?? 0) + 1), civId: civ.id, sport: sp.key,
    name: uniqueName(sim, () => `${civ.adjective} ${sp.name} ${leagueWord}${sim.rng.chance(0.3) && phon ? ' ' + makeName(sim.rng, phon, 'word') : ''}`),
    founded: sim.year, teams, champions: [], active: true,
  };
  w.leagues.set(lg.id, lg);
  const cap = w.settlements.get(civ.capital);
  logEvent(sim, { type: 'league_founded', cat: 'culture', title: `The ${lg.name} was founded in ${civ.name} with ${teams.length} teams`, civs: [civ.id], x: cap?.x ?? -1, y: cap?.y ?? -1, importance: 2 });
}

function season(sim: Sim, lg: League): void {
  const civ = sim.w.civs.get(lg.civId);
  if (!civ?.alive) { lg.active = false; return; }
  // teams follow their cities: lost cities leave, ratings track size, venues and luck
  lg.teams = lg.teams.filter((t) => sim.w.settlements.get(t.settlementId)?.civId === civ.id);
  if (lg.teams.length < 2) { lg.active = false; return; }
  for (const t of lg.teams) {
    const s = sim.w.settlements.get(t.settlementId)!;
    const base = Math.log10(Math.max(10, s.pop)) + venues(s) * 0.2 + s.prosperity * 0.2;
    t.rating += (base - t.rating) * 0.2 + sim.rng.range(-0.15, 0.15);
  }
  const k = sim.rng.weighted(lg.teams.map((t) => Math.exp(t.rating * 1.6)));
  const champ = lg.teams[Math.max(0, k)];
  champ.titles++;
  lg.champions.push({ year: sim.year, team: champ.name });
  if (lg.champions.length > 60) lg.champions.shift();
  const last = lg.champions.slice(-3);
  const dynasty = last.length === 3 && last.every((c) => c.team === champ.name);
  const s = sim.w.settlements.get(champ.settlementId)!;
  // every season is recorded in the league; only notable ones make history
  if (!dynasty && champ.titles !== 1) return;
  logEvent(sim, {
    type: 'sports_champion', cat: 'culture',
    title: dynasty ? `The ${champ.name} won a third straight ${lg.name} title` : champ.titles === 1 ? `The ${champ.name} won their first ${lg.name} title` : `The ${champ.name} won the ${lg.name}`,
    civs: [civ.id], settlements: [s.id], x: s.x, y: s.y, importance: 2,
  });
}

function atWar(sim: Sim, a: number, b: number): boolean {
  for (const wr of sim.w.wars.values()) if (!wr.end && ((wr.attackers.includes(a) && wr.defenders.includes(b)) || (wr.attackers.includes(b) && wr.defenders.includes(a)))) return true;
  return false;
}

/** International cups: national champions of a sport from nations in contact and at peace. */
function cups(sim: Sim): void {
  const st = sportsState(sim);
  const bySport = new Map<SportKey, League[]>();
  for (const lg of sim.w.leagues.values()) if (lg.active && lg.teams.length) (bySport.get(lg.sport) ?? bySport.set(lg.sport, []).get(lg.sport)!).push(lg);
  for (const [sport, leagues] of bySport) {
    const entrants = leagues.filter((l, i) => leagues.some((o, j) => j !== i && sim.w.civs.get(l.civId)?.knownCivs.includes(o.civId) && !atWar(sim, l.civId, o.civId)));
    if (entrants.length < 2) continue;
    const best = entrants.map((l) => l.teams.reduce((a, t) => (t.rating > a.rating ? t : a), l.teams[0]));
    const k = Math.max(0, sim.rng.weighted(best.map((t) => Math.exp(t.rating * 1.6))));
    const winner = entrants[k], team = best[k];
    const civ = sim.w.civs.get(winner.civId)!;
    civ.prestige = (civ.prestige ?? 0) + 0.05;
    st.cups.push({ year: sim.year, sport, winner: civ.id });
    if (st.cups.length > 120) st.cups.shift();
    const s = sim.w.settlements.get(team.settlementId);
    logEvent(sim, {
      type: 'sports_cup', cat: 'culture', title: `The ${team.name} of ${civ.name} won the world ${SPORT_BY_KEY[sport].name.toLowerCase()} cup against ${entrants.length - 1} other nation${entrants.length > 2 ? 's' : ''}`,
      civs: entrants.map((l) => l.civId), settlements: s ? [s.id] : [], x: s?.x ?? -1, y: s?.y ?? -1, importance: 2,
    });
  }
}

function worldGames(sim: Sim, st: SportsState): void {
  st.next = sim.year + 4;
  const w = sim.w;
  const civs = [...w.civs.values()].filter((c) => c.alive && c.settlements.length && c.era >= 3);
  const modern = civs.some((c) => c.era >= 8);
  const eligible = civs.filter((c) => (modern ? c.era >= 7 : true) && c.stability > 0.3);
  if (eligible.length < 2) return;
  // host bids: wealth, stability, venues and a taste for spectacle
  const bid = (c: Civ) => Math.sqrt(Math.max(1, c.econ.gdp)) * (0.5 + c.stability) * (1 + (c.prestige ?? 0)) * (c.ethos?.key === 'artistic' ? 1.6 : 1) * (1 + citiesOf(sim, c, 0).reduce((a, s) => a + venues(s), 0) * 0.05);
  const host = eligible[Math.max(0, sim.rng.weighted(eligible.map(bid)))];
  const city = citiesOf(sim, host, 0)[0];
  if (!city) return;
  const known = modern ? civs : civs.filter((c) => c.id === host.id || host.knownCivs.includes(c.id));
  const boycotts = known.filter((c) => c.id !== host.id && atWar(sim, c.id, host.id)).map((c) => c.id);
  const teams = known.filter((c) => !boycotts.includes(c.id));
  if (teams.length < 2) return;
  if (modern && !st.worldGamesName) {
    const phon = phonOfCulture(sim, host.cultureId);
    st.worldGamesName = `${phon ? makeName(sim.rng, phon, 'word') : host.adjective} Games`;
  }
  const name = modern ? st.worldGamesName! : `Great Games of ${city.name}`;
  // medals: talent pool (population), wealth and training, a home advantage and luck
  const medals: Record<number, number> = {};
  const weight = teams.map((c) => Math.pow(Math.max(1, c.population), 0.3) * (0.4 + Math.min(3, c.econ.livingStandard)) * (c.id === host.id ? 1.3 : 1) * (c.ethos?.key === 'militarist' || c.ethos?.key === 'artistic' ? 1.2 : 1));
  for (let k = 0; k < (modern ? 40 : 12); k++) {
    const c = teams[Math.max(0, sim.rng.weighted(weight))];
    medals[c.id] = (medals[c.id] ?? 0) + 1;
  }
  st.held.push({ year: sim.year, kind: modern ? 'world' : 'great', name, hostCiv: host.id, hostCity: city.id, medals, boycotts });
  if (st.held.length > 80) st.held.shift();
  // prestige, visitors and relations
  host.prestige = (host.prestige ?? 0) + 0.15;
  host.treasury += Math.max(0, host.econ.gdp) * 0.01; // visitors' spending
  for (const c of teams) {
    if (c.id === host.id) continue;
    const r = ensureRelation(sim, c.id, host.id);
    r.opinion = Math.min(100, r.opinion + 4);
  }
  for (const id of boycotts) { const r = ensureRelation(sim, id, host.id); r.opinion = Math.max(-100, r.opinion - 6); }
  const table = Object.entries(medals).sort((a, b) => b[1] - a[1]);
  for (const [id, n] of table.slice(0, 3)) { const c = w.civs.get(Number(id)); if (c) c.prestige = (c.prestige ?? 0) + 0.02 * n / 4; }
  const top = table.slice(0, 3).map(([id, n]) => `${w.civs.get(Number(id))?.baseName ?? '?'} ${n}`).join(', ');
  logEvent(sim, {
    type: 'world_games', cat: 'culture',
    title: `${host.name} hosted the ${name} in ${city.name}: ${teams.length} nations${boycotts.length ? `, ${boycotts.length} boycotting` : ''}; medals ${top}`,
    civs: teams.map((c) => c.id).concat(boycotts), settlements: [city.id], x: city.x, y: city.y, importance: modern ? 3 : 2,
    causes: boycotts.length ? [{ label: `${boycotts.length} nation${boycotts.length > 1 ? 's' : ''} at war with the host stayed away`, weight: 1 }] : undefined,
  });
}
