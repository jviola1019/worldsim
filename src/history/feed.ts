/**
 * The civilization feed: what people of the time read, heard or scrolled.
 *
 * Every post is DERIVED from recorded history and state; nothing here changes the simulation:
 * - the subject is a recorded HistoryEvent (title, place, measured causes);
 * - the medium is the one recorded on the event when it happened (carving ... hologram);
 * - the outlet is a real outlet of that nation that existed in that year (chronicle house,
 *   press, newspaper, broadcaster, platform, holonet), and AI summaries come from an AI system
 *   that was active then;
 * - voices (replies, letters, callers) take their stance from that nation's measured mood near
 *   the event year (war weariness, unrest, polarization, misinformation, unemployment);
 * - false claims appear only where misinformation was measured high, and are always labelled
 *   with the cause the simulation actually recorded.
 * Names and wording vary through a hash of the event id (not the simulation's random stream),
 * so the same save always shows the same feed.
 */
import type { Sim } from '../sim/context';
import type { Civ, HistoryEvent, Medium, MediaOutlet, OutletKind, Phonology, SeriesStore } from '../sim/types';
import { Rng } from '../core/rng';
import { makeName } from '../culture/language';
import { hashtag, handle } from '../culture/naming';
import { phonOfCulture } from '../population/persons';
import { generatePhonology } from '../culture/language';

export interface FeedPost {
  key: string;
  eventId: number;
  year: number;
  civId: number;
  medium: Medium;
  outlet?: string;
  author: string;
  role: string;
  handle?: string;
  headline?: string;
  text: string;
  tags: string[];
  likes?: number;
  shares?: number;
  /** 'false': a false claim (with context); 'state': state-run outlet; 'ai': written by an AI system. */
  flag?: 'false' | 'state' | 'ai';
  context?: string;
  x: number;
  y: number;
  replies: FeedPost[];
}

const OUTLET_FOR: Record<Medium, OutletKind[]> = {
  carving: [], tablet: ['chronicle'], scroll: ['chronicle'], broadsheet: ['press'], newspaper: ['newspaper'],
  broadcast: ['broadcaster'], social: ['platform'], holo: ['holonet', 'platform'],
};

/** Value of a statistics series at (or just before) a year. */
export function seriesAt(store: SeriesStore | undefined, key: string, year: number): number {
  if (!store) return 0;
  const ys = store.years;
  const vs = store.data[key];
  if (!vs || !ys.length) return 0;
  let lo = 0, hi = ys.length - 1, best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ys[mid] <= year) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return vs[best] ?? 0;
}

const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const clean = (s: string) => s.replace(/[.!]+$/, '');
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with']);
const titleCase = (s: string) => s.split(' ').map((w, k) => (k > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

function phonFor(sim: Sim, civ: Civ | undefined): Phonology {
  return (civ && phonOfCulture(sim, civ.cultureId)) || generatePhonology(new Rng([civ?.id ?? 0, 3, 5, 7]));
}

function person(rng: Rng, p: Phonology): string {
  return `${makeName(rng, p, 'person')} ${makeName(rng, p, 'family')}`;
}

function outletAt(sim: Sim, civ: Civ, medium: Medium, year: number, rng: Rng): MediaOutlet | undefined {
  const kinds = OUTLET_FOR[medium];
  const list: MediaOutlet[] = [];
  for (const o of sim.w.outlets.values()) {
    if (o.civId !== civ.id || !kinds.includes(o.kind) || o.founded > year || (o.closed !== undefined && o.closed < year)) continue;
    list.push(o);
  }
  return list.length ? list[rng.int(0, list.length - 1)] : undefined;
}

function aiAt(sim: Sim, civ: Civ, year: number) {
  for (const a of sim.w.ais.values()) {
    if (a.civId !== civ.id || (a.role !== 'assistant' && a.role !== 'general') || a.founded > year) continue;
    if (a.retired !== undefined && a.retired < year) continue;
    return a;
  }
  return undefined;
}

const BROADSHEET_CRY: Record<string, string> = {
  war: 'DREADFUL NEWS OF WAR!', disaster: 'A MOST TERRIBLE CALAMITY!', technology: 'A WONDROUS NEW INVENTION!',
  religion: 'TIDINGS OF THE FAITH!', politics: 'GREAT CHANGES IN THE REALM!', economy: 'NEWS OF TRADE AND COIN!',
  diplomacy: 'TREATIES AND EMBASSIES!', founding: 'A NEW FOUNDATION!', space: 'MARVELS IN THE HEAVENS!', demography: 'NEWS OF THE PEOPLE!',
};

/** The main post for an event. */
function mainPost(sim: Sim, ev: HistoryEvent, civ: Civ | undefined, rng: Rng): FeedPost {
  const medium: Medium = ev.medium ?? 'carving';
  const p = phonFor(sim, civ);
  const title = clean(ev.title);
  const cause = ev.causes?.length ? ev.causes.slice().sort((a, b) => b.weight - a.weight)[0].label : '';
  const place = ev.settlements.length ? sim.w.settlements.get(ev.settlements[0])?.name : civ ? sim.w.settlements.get(civ.capital)?.name : undefined;
  const o = civ ? outletAt(sim, civ, medium, ev.year, rng) : undefined;
  const base: FeedPost = { key: `${ev.id}`, eventId: ev.id, year: ev.year, civId: civ?.id ?? 0, medium, outlet: o?.name, author: '', role: '', text: '', tags: [], x: ev.x, y: ev.y, replies: [] };
  if (o?.stateRun) base.flag = 'state';
  switch (medium) {
    case 'carving':
      base.author = `Stone-cutters of ${place ?? 'the people'}`;
      base.role = 'carved in stone';
      base.text = `${title.toUpperCase()} · YEAR ${ev.year}`;
      break;
    case 'tablet':
      base.author = person(rng, p);
      base.role = o ? `scribe of ${o.name}` : 'scribe';
      base.text = `In the year ${ev.year}: ${title}.`;
      break;
    case 'scroll':
      base.author = person(rng, p);
      base.role = o ? `chronicler, ${o.name}` : 'chronicler';
      base.text = `Let it be recorded that in the year ${ev.year}: ${title}.${cause ? ` It came to pass through ${lcFirst(cause)}.` : ''}`;
      break;
    case 'broadsheet':
      base.author = o?.name ?? `Printers of ${place ?? 'the city'}`;
      base.role = 'printed broadsheet';
      base.headline = BROADSHEET_CRY[ev.cat] ?? 'TRUE AND STRANGE TIDINGS!';
      base.text = `${title}!${cause ? ` Learned men say it came of ${lcFirst(cause)}.` : ''}`;
      break;
    case 'newspaper':
      base.author = person(rng, p);
      base.role = o ? `correspondent, ${o.name}` : 'correspondent';
      base.headline = titleCase(title);
      base.text = `${place ? place.toUpperCase() + ', ' : ''}Year ${ev.year}. ${cause ? `Observers point to ${lcFirst(cause)}.` : 'Full report inside.'}`;
      break;
    case 'broadcast':
      base.author = person(rng, p);
      base.role = o ? `on ${o.name}` : 'on the air';
      base.text = `This is ${o?.name ?? 'the national broadcast'}. ${title}.${cause ? ` Officials cite ${lcFirst(cause)}.` : ''} More as it comes in.`;
      break;
    case 'social':
    case 'holo': {
      const name = person(rng, p);
      base.author = name;
      base.handle = handle(name, ev.id);
      base.role = o ? `on ${o.name}` : 'online';
      base.tags = [hashtag(rng, p, civ?.baseName ?? 'News')];
      base.text = medium === 'holo' ? `◈ ${title} ◈${cause ? ` driver: ${lcFirst(cause)}` : ''}` : `${title}.${cause ? ` Why? ${cause}.` : ''}`;
      const reach = (o?.reach ?? 0.1) * Math.sqrt(Math.max(1, civ?.population ?? 1000));
      base.likes = Math.round(reach * ev.importance * (2 + rng.float() * 6));
      base.shares = Math.round(base.likes * (0.05 + rng.float() * 0.2));
      break;
    }
  }
  return base;
}

interface Mood { war: number; unrest: number; pol: number; mis: number; unemp: number }

function moodAt(sim: Sim, civ: Civ | undefined, year: number): Mood {
  const st = civ ? sim.w.stats.civs[civ.id] : undefined;
  return {
    war: seriesAt(st, 'warExhaustion', year), unrest: seriesAt(st, 'unrest', year), pol: seriesAt(st, 'polarization', year),
    mis: seriesAt(st, 'misinformation', year), unemp: seriesAt(st, 'unemployment', year),
  };
}

/** Voices answering a post, in the form the medium allows (replies, letters, callers). */
function voices(sim: Sim, ev: HistoryEvent, civ: Civ | undefined, post: FeedPost, rng: Rng): FeedPost[] {
  const medium = post.medium;
  if (!civ || medium === 'carving' || medium === 'tablet' || medium === 'scroll' || medium === 'broadsheet') return [];
  if (ev.importance < (medium === 'social' || medium === 'holo' ? 2 : 3)) return [];
  const p = phonFor(sim, civ);
  const mood = moodAt(sim, civ, ev.year);
  const place = ev.settlements.length ? sim.w.settlements.get(ev.settlements[0])?.name ?? civ.baseName : civ.baseName;
  const lines: { text: string; flag?: FeedPost['flag']; context?: string }[] = [];
  const t = ev.type, c = ev.cat;
  if (t === 'war_declared' || c === 'war') {
    lines.push(mood.war < 0.25 ? { text: `Our soldiers will bring victory home. ${civ.adjective} pride!` } : { text: 'How many more must die? Bring them home.' });
    if (mood.pol > 0.35) lines.push({ text: 'This war is a distraction from problems at home.' });
  } else if (t === 'peace') {
    lines.push({ text: 'At last. Let the families mourn and rebuild.' });
  } else if (c === 'disaster' || t === 'epidemic') {
    lines.push({ text: `Thinking of everyone in ${place}. Stay safe.` });
    if (mood.mis > 0.3) {
      const rivals = [...sim.w.civs.values()].filter((o) => o.alive && o.id !== civ.id && civ.knownCivs.includes(o.id));
      const scapegoat = rivals.length ? rivals[rng.int(0, rivals.length - 1)].name : 'outsiders';
      const real = ev.causes?.length ? ev.causes.map((x) => x.label).join('; ') : t === 'epidemic' ? 'contagion between people' : 'natural forces';
      lines.push({ text: `They are hiding the truth: ${scapegoat} did this on purpose!`, flag: 'false', context: `False claim. The recorded cause: ${real}.` });
    }
  } else if (t === 'ai_launched' || c === 'technology') {
    lines.push(mood.unemp > 0.12 ? { text: 'Great. Will this take my job too?' } : { text: 'The future is here. Incredible.' });
  } else if (t === 'online_protest' || c === 'politics') {
    lines.push({ text: mood.pol > 0.35 ? 'Finally someone stands up to them!' : 'We need calm, not chaos.' });
    if (mood.pol > 0.35) lines.push({ text: 'Paid agitators, all of them.' });
  } else if (c === 'economy') {
    lines.push({ text: mood.unemp > 0.12 ? 'Prices up, jobs gone. Who is this economy for?' : 'Business is good in our town.' });
  } else if (c === 'space') {
    lines.push({ text: 'Look up tonight. We did that.' });
  } else if (c === 'religion') {
    lines.push({ text: rng.chance(0.5) ? 'Blessed be.' : 'Faith is a private matter.' });
  } else if (t === 'outlet_founded') {
    lines.push({ text: 'Just joined. Who else is here?' });
  } else {
    lines.push({ text: `Proud to be ${civ.adjective}.` });
  }
  const out: FeedPost[] = lines.slice(0, medium === 'social' || medium === 'holo' ? 3 : 1).map((l, k) => {
    const name = person(rng, p);
    const role = medium === 'newspaper' ? `letter from ${place}` : medium === 'broadcast' ? 'caller' : 'citizen';
    return {
      key: `${ev.id}:${k}`, eventId: ev.id, year: ev.year, civId: civ.id, medium, author: name, role,
      handle: medium === 'social' || medium === 'holo' ? handle(name, ev.id + k) : undefined,
      text: l.text, tags: [], flag: l.flag, context: l.context, x: ev.x, y: ev.y, replies: [],
      likes: medium === 'social' || medium === 'holo' ? Math.round((post.likes ?? 10) * (0.02 + rng.float() * 0.2)) : undefined,
    };
  });
  // an AI assistant's summary, where one existed at the time
  const ai = (medium === 'social' || medium === 'holo') && ev.importance >= 3 ? aiAt(sim, civ, ev.year) : undefined;
  if (ai) {
    const cause = ev.causes?.length ? ` Main factor: ${lcFirst(ev.causes[0].label)}.` : '';
    out.push({ key: `${ev.id}:ai`, eventId: ev.id, year: ev.year, civId: civ.id, medium, author: ai.version > 1 ? `${ai.name} ${ai.version}` : ai.name, role: `AI assistant by ${ai.lab}`, text: `Summary: ${clean(ev.title)}.${cause}`, tags: [], flag: 'ai', x: ev.x, y: ev.y, replies: [] });
  }
  return out;
}

/** Event types too frequent to post individually unless important. */
const NOISY = new Set(['battle', 'siege', 'deposit_exhausted', 'construction', 'domestication']);

export function isPostable(ev: HistoryEvent, civId: number): boolean {
  if (civId) return ev.civs.includes(civId) && ev.importance >= (NOISY.has(ev.type) ? 3 : 2);
  return ev.civs.length > 0 && ev.importance >= 3;
}

/**
 * The newest `limit` posts (newest first) for one nation, or for the whole world when civId is 0.
 */
export function buildFeed(sim: Sim, civId: number, limit = 30): FeedPost[] {
  const out: FeedPost[] = [];
  const evs = sim.w.events;
  for (let k = evs.length - 1; k >= 0 && out.length < limit; k--) {
    const ev = evs[k];
    if (!isPostable(ev, civId)) continue;
    out.push(postFor(sim, ev, civId));
  }
  return out;
}

/** The post (with its voices) for one event, as told by `civId` (or the event's own teller). */
export function postFor(sim: Sim, ev: HistoryEvent, civId = 0): FeedPost {
  const rng = new Rng([ev.id >>> 0, 0x9e3779b9, civId >>> 0, 0x85ebca6b]);
  const tellerId = civId && ev.civs.includes(civId) ? civId : ev.civs[0];
  const civ = sim.w.civs.get(tellerId);
  const post = mainPost(sim, ev, civ, rng);
  post.replies = voices(sim, ev, civ, post, rng);
  return post;
}
