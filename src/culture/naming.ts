/**
 * Procedural names for everything a civilization creates beyond its places and people: chronicles,
 * printing houses, newspapers, broadcasters, social platforms, holographic networks, AI systems and
 * the labs that build them. Every name is built from the civilization's own generated language
 * (language.ts) plus generic period vocabulary, so names are unbounded in number, differ between
 * cultures, and are never real brands: a blocklist rejects real platforms, companies, media outlets
 * and famous fictional AIs, and uniqueName() guarantees no two entities in a world share a name.
 */
import type { Rng } from '../core/rng';
import type { Sim } from '../sim/context';
import type { Phonology } from '../sim/types';
import { makeName, adjectiveOf } from './language';

/** Real platforms, companies, outlets and famous fictional AIs (lower case). Matched as whole words. */
const BLOCKED = new Set([
  'facebook', 'twitter', 'x', 'instagram', 'tiktok', 'youtube', 'snapchat', 'reddit', 'linkedin', 'pinterest', 'tumblr',
  'whatsapp', 'telegram', 'signal', 'wechat', 'weibo', 'discord', 'twitch', 'myspace', 'friendster', 'orkut', 'vine',
  'threads', 'bluesky', 'mastodon', 'quora', 'digg', 'kik', 'line', 'viber', 'skype', 'zoom', 'slack', 'clubhouse',
  'google', 'apple', 'amazon', 'microsoft', 'meta', 'openai', 'anthropic', 'claude', 'chatgpt', 'gpt', 'gemini', 'bard',
  'siri', 'alexa', 'cortana', 'copilot', 'watson', 'deepmind', 'grok', 'llama', 'mistral', 'samsung', 'baidu', 'tencent',
  'alibaba', 'bytedance', 'nvidia', 'intel', 'ibm', 'oracle', 'tesla', 'spacex', 'netflix', 'hulu', 'spotify', 'yahoo',
  'bing', 'aol', 'msn', 'sony', 'nintendo', 'hal', 'skynet', 'jarvis', 'ultron', 'samaritan', 'wintermute', 'glados',
  'shodan', 'cnn', 'bbc', 'fox', 'reuters', 'nbc', 'cbs', 'abc', 'pbs', 'npr', 'msnbc', 'pravda', 'tass', 'xinhua',
  'aljazeera', 'bloomberg', 'forbes', 'vice', 'buzzfeed', 'tmz',
]);

export function isBlocked(name: string): boolean {
  const words = name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  for (const w of words) if (BLOCKED.has(w)) return true;
  const joined = words.join('');
  // compounds like 'Facebookly': only long brand names are matched inside words ('intel' is in 'intelligence')
  for (const b of BLOCKED) if (b.length >= 6 && joined.includes(b)) return true;
  return false;
}

/** Names already used by persistent entities (scanned from state, so a restored save sees the same set). */
export function namesInUse(sim: Sim): Set<string> {
  const w = sim.w;
  const out = new Set<string>();
  const add = (s?: string) => { if (s) out.add(s.toLowerCase()); };
  for (const c of w.civs.values()) { add(c.baseName); add(c.name); }
  for (const r of w.religions.values()) add(r.name);
  for (const o of w.outlets?.values() ?? []) add(o.name);
  for (const a of w.ais?.values() ?? []) { add(a.name); add(a.lab); }
  for (const l of w.leagues?.values() ?? []) add(l.name);
  for (const c of w.colonies.values()) add(c.name);
  return out;
}

const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

/**
 * A name from `gen` that no entity in the world already uses and that is not a real brand. After
 * 40 tries (a tiny language can run short of fresh roots) an ordinal makes it unique; beyond that a
 * number does, so the result is always unique.
 */
export function uniqueName(sim: Sim, gen: () => string, taken: Set<string> = namesInUse(sim)): string {
  let last = '';
  for (let k = 0; k < 40; k++) {
    const n = gen();
    last = n;
    if (!isBlocked(n) && !taken.has(n.toLowerCase())) { taken.add(n.toLowerCase()); return n; }
  }
  const base = isBlocked(last) ? 'Nova' : last;
  for (let k = 2; ; k++) {
    const n = base + (k < ROMAN.length ? ROMAN[k] : ` ${k}`);
    if (!taken.has(n.toLowerCase())) { taken.add(n.toLowerCase()); return n; }
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const root = (rng: Rng, p: Phonology) => makeName(rng, p, 'word');

// ------------------------------------------------------------------ outlets by era

export function chronicleName(rng: Rng, p: Phonology, city: string): string {
  const w = root(rng, p);
  return rng.pick([`Annals of ${city}`, `The ${w} Codex`, `Scribes of ${city}`, `The ${city} Stelae`, `Chronicle of ${w}`, `House of ${w} Records`]);
}

export function pressName(rng: Rng, p: Phonology, city: string): string {
  const w = root(rng, p);
  return rng.pick([`${w} Press of ${city}`, `The ${city} Broadsheet`, `${w} & Sons, Printers`, `Printing House of ${w}`, `The ${w} Pamphleteer`]);
}

const PAPER_WORDS = ['Herald', 'Courier', 'Gazette', 'Ledger', 'Sentinel', 'Tribune', 'Observer', 'Clarion', 'Dispatch', 'Bulletin', 'Register', 'Messenger', 'Examiner', 'Beacon', 'Inquirer'];
export function newspaperName(rng: Rng, p: Phonology, city: string): string {
  const adj = adjectiveOf(root(rng, p));
  return rng.pick([`The ${city} ${rng.pick(PAPER_WORDS)}`, `The ${adj} ${rng.pick(PAPER_WORDS)}`, `${city} Daily ${rng.pick(PAPER_WORDS)}`, `The Evening ${rng.pick(PAPER_WORDS)} of ${city}`]);
}

export function broadcasterName(rng: Rng, p: Phonology, nation: string, city: string): string {
  const w = root(rng, p);
  const initials = (w.slice(0, 1) + nation.slice(0, 1) + 'B').toUpperCase();
  return rng.pick([`${adjectiveOf(nation)} Broadcasting`, `Radio ${city}`, `${w} Network`, `${initials} Television`, `${cap(w)}Vision`, `Channel ${w}`]);
}

const PLATFORM_SUFFIX = ['ly', 'io', 'r', 'sy', 'oo', 'ia', 'ix', 'a'];
const PLATFORM_WORD = ['loop', 'verse', 'spark', 'wave', 'link', 'cast', 'feed', 'buzz', 'chat', 'pulse', 'nest', 'mesh', 'pod', 'drop', 'zone', 'post', 'lens', 'hive', 'flock', 'swirl', 'echo', 'ping', 'tide', 'bloom'];
export function platformName(rng: Rng, p: Phonology): string {
  const w = root(rng, p);
  const short = w.length > 6 ? w.slice(0, 5) : w;
  switch (rng.int(0, 4)) {
    case 0: return cap(short.toLowerCase()) + rng.pick(PLATFORM_SUFFIX);
    case 1: return cap(short.toLowerCase()) + rng.pick(PLATFORM_WORD);
    case 2: return cap(rng.pick(PLATFORM_WORD)) + cap(short.toLowerCase());
    case 3: return `${cap(short.toLowerCase())} ${cap(rng.pick(PLATFORM_WORD))}`;
    default: return cap(short.toLowerCase());
  }
}

export function holonetName(rng: Rng, p: Phonology): string {
  const w = cap(root(rng, p).toLowerCase());
  return rng.pick([`${w}sphere`, `${w} Holo`, `Neural ${w}`, `${w}Mind`, `The ${w} Lattice`, `${w}Weave`]);
}

// ------------------------------------------------------------------ AI systems and labs

const AI_END = ['ion', 'ex', 'ix', 'ara', 'os', 'is', 'eon', 'yn'];
export function aiName(rng: Rng, p: Phonology): string {
  const w = root(rng, p);
  switch (rng.int(0, 3)) {
    case 0: return cap(w.toLowerCase().replace(/[aeiouy]+$/, '')) + rng.pick(AI_END);
    case 1: return (w.slice(0, 3) + makeName(rng, p, 'word').slice(0, 1)).toUpperCase(); // acronym-like
    case 2: return makeName(rng, p, 'deity'); // a mythic name from the culture's own pantheon sounds
    default: return `${cap(w.toLowerCase())} ${rng.pick(['Core', 'Prime', 'Mind', 'Sage', 'Lumen', 'Atlas'])}`; // no digits: versions are numbered separately
  }
}

export function labName(rng: Rng, p: Phonology, nation: string, stateRun: boolean): string {
  const w = cap(root(rng, p).toLowerCase());
  if (stateRun) return rng.pick([`${adjectiveOf(nation)} Academy of Machine Thought`, `State Computing Bureau of ${nation}`, `${adjectiveOf(nation)} Institute of Cognition`]);
  return rng.pick([`${w} Labs`, `${w} Systems`, `${w} Dynamics`, `${w} Institute`, `${w} Collective`, `${w} Intelligence`]);
}

export function hashtag(rng: Rng, p: Phonology, topic: string): string {
  const w = cap(root(rng, p).toLowerCase());
  const t = topic.replace(/[^A-Za-z0-9]/g, '');
  return '#' + rng.pick([t, `${t}${w}`, `${w}${t}`, `Stand${w}`, `${t}Now`]);
}

export function handle(name: string, n: number): string {
  return '@' + name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 10) + (n % 1000);
}
