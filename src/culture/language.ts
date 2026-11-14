/**
 * Procedural languages and name generation.
 *
 * Each language has a small phonology (syllable onsets, vowels, codas and
 * suffix sets). Names are assembled from syllables with simple
 * phonotactic filters so they stay pronounceable and readable. Daughter
 * languages copy their parent's phonology and apply a few systematic sound
 * shifts, so related cultures produce visibly related names (Veyra / Veyrith /
 * Vaira) — a stylized nod to historical linguistics, not a linguistic model.
 */
import type { Rng } from '../core/rng';
import type { Phonology } from '../sim/types';

const ONSETS = [
  'b', 'c', 'd', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'z', 'y',
  'br', 'dr', 'gr', 'kr', 'tr', 'th', 'sh', 'st', 'sk', 'vr', 'zh', 'ch', 'ph', 'gl', 'fl', 'kh', 'sv', 'tl', 'qu', 'j',
];
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'a', 'e', 'o', 'ae', 'ai', 'au', 'ei', 'ia', 'io', 'ou', 'y', 'ea', 'oa', 'ui'];
const CODAS = ['', '', '', 'n', 'r', 'l', 's', 'th', 'm', 'k', 'nd', 'rn', 'rd', 'st', 'x', 'sh', 'ng', 'll', 'rk', 'lt', 'ss', 'z', 'q'];
const PLACE_SUFFIX = ['', '', 'ar', 'or', 'ia', 'en', 'dal', 'mar', 'ith', 'os', 'um', 'heim', 'vik', 'grad', 'ton', 'burg', 'polis', 'ara', 'esh', 'mor', 'wyn', 'ford', 'kesh', 'tal', 'dun', 'ir', 'ane', 'oth'];
const CIV_SUFFIX = ['', 'ia', 'an', 'or', 'eth', 'ar', 'is', 'ora', 'en', 'um', 'ai'];
const PERSON_END = ['', '', '', 'a', 'o', 'is', 'us', 'en', 'el', 'ia', 'ar', 'eth', 'ion', 'ra', 'iel', 'ok', 'an'];

/** Sound shifts used when a daughter language diverges. */
const SHIFTS: [RegExp, string][] = [
  [/^k/, 'kh'], [/^k/, 'ch'], [/^t/, 'th'], [/^p/, 'f'], [/^s$/, 'sh'], [/^b/, 'v'], [/^d/, 'dh'],
  [/^g/, 'gh'], [/^c/, 'k'], [/^v/, 'w'], [/^w/, 'v'], [/^th/, 't'], [/^sh/, 's'],
  [/^a$/, 'ae'], [/^e$/, 'ei'], [/^o$/, 'ou'], [/^i$/, 'y'], [/^u$/, 'o'], [/^ai$/, 'e'], [/^au$/, 'o'],
];

function pickN<T>(rng: Rng, arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  rng.shuffle(copy);
  return copy.slice(0, n);
}

export function generatePhonology(rng: Rng): Phonology {
  const onsets = pickN(rng, ONSETS, rng.int(8, 13));
  if (rng.chance(0.4)) onsets.push(''); // vowel-initial syllables allowed
  const vowels = Array.from(new Set(pickN(rng, VOWELS, rng.int(4, 7)).concat(['a', 'e'].slice(0, rng.int(0, 2)))));
  const codas = Array.from(new Set(['', ...pickN(rng, CODAS, rng.int(3, 7))]));
  const syll = rng.chance(0.5) ? [1, 6, 3, 0.6] : [2, 6, 2, 0.3];
  return {
    onsets,
    vowels,
    codas,
    syll,
    placeSuffix: pickN(rng, PLACE_SUFFIX, rng.int(4, 7)),
    civSuffix: pickN(rng, CIV_SUFFIX, rng.int(2, 4)),
    personEnd: pickN(rng, PERSON_END, rng.int(4, 7)),
  };
}

/** Derive a daughter language phonology with a few sound shifts. */
export function mutatePhonology(rng: Rng, parent: Phonology): Phonology {
  const shift = (s: string): string => {
    if (rng.chance(0.7)) return s;
    const candidates = SHIFTS.filter(([re]) => re.test(s));
    if (!candidates.length) return s;
    const [re, rep] = rng.pick(candidates);
    return s.replace(re, rep);
  };
  const p: Phonology = {
    onsets: Array.from(new Set(parent.onsets.map(shift))),
    vowels: Array.from(new Set(parent.vowels.map(shift))),
    codas: Array.from(new Set(parent.codas.map((c) => (rng.chance(0.15) ? rng.pick(CODAS) : c)))),
    syll: [...parent.syll],
    placeSuffix: [...parent.placeSuffix],
    civSuffix: [...parent.civSuffix],
    personEnd: [...parent.personEnd],
  };
  if (rng.chance(0.5)) p.onsets.push(rng.pick(ONSETS));
  if (rng.chance(0.3) && p.onsets.length > 6) p.onsets.splice(rng.int(0, p.onsets.length - 1), 1);
  if (rng.chance(0.5)) p.placeSuffix[rng.int(0, p.placeSuffix.length - 1)] = rng.pick(PLACE_SUFFIX);
  if (rng.chance(0.4)) p.personEnd[rng.int(0, p.personEnd.length - 1)] = rng.pick(PERSON_END);
  return p;
}

const isVowel = (ch: string) => 'aeiouy'.includes(ch);

function syllable(rng: Rng, p: Phonology, first: boolean, last: boolean): string {
  const on = rng.pick(p.onsets);
  const v = rng.pick(p.vowels);
  const cd = last || rng.chance(0.3) ? rng.pick(p.codas) : '';
  return (first || on !== '' ? on : rng.pick(p.onsets.filter((o) => o !== '')) ?? 'n') + v + cd;
}

function cleanup(raw: string): string {
  let s = raw.toLowerCase();
  // collapse triple letters and awkward clusters
  s = s.replace(/(.)\1\1+/g, '$1$1');
  s = s.replace(/([^aeiouy]{3})[^aeiouy]+/g, '$1');
  s = s.replace(/([aeiouy]{2})[aeiouy]+/g, '$1');
  s = s.replace(/^([^aeiouy])\1/, '$1');
  s = s.replace(/q(?!u)/g, 'k');
  return s;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function rootWord(rng: Rng, p: Phonology, maxSyl = 3): string {
  const count = Math.min(maxSyl, 1 + rng.weighted(p.syll));
  let s = '';
  for (let k = 0; k < count; k++) s += syllable(rng, p, k === 0, k === count - 1);
  return cleanup(s);
}

function acceptable(s: string, min: number, max: number): boolean {
  if (s.length < min || s.length > max) return false;
  let vowels = 0;
  for (const ch of s) if (isVowel(ch)) vowels++;
  return vowels >= 1 && vowels <= Math.ceil(s.length * 0.7);
}

export type NameKind = 'place' | 'person' | 'civ' | 'deity' | 'word' | 'family';

/** Generate a readable name in the given language. */
export function makeName(rng: Rng, p: Phonology, kind: NameKind): string {
  for (let attempt = 0; attempt < 30; attempt++) {
    let s = rootWord(rng, p, kind === 'word' ? 2 : 3);
    if (kind === 'place') {
      const suf = rng.pick(p.placeSuffix);
      if (suf && s.length < 7) s = joinSuffix(s, suf);
    } else if (kind === 'civ') {
      const suf = rng.pick(p.civSuffix);
      if (suf && s.length < 6) s = joinSuffix(s, suf);
    } else if (kind === 'person') {
      const end = rng.pick(p.personEnd);
      if (end && s.length < 6) s = joinSuffix(s, end);
    } else if (kind === 'family') {
      if (s.length < 5) s = joinSuffix(s, rng.pick(p.placeSuffix) || 'en');
    }
    s = cleanup(s);
    if (acceptable(s, kind === 'word' ? 3 : 4, kind === 'place' ? 11 : 10)) return capitalize(s);
  }
  return capitalize(cleanup(rootWord(rng, p, 2)) || 'Avan');
}

function joinSuffix(root: string, suf: string): string {
  const endV = isVowel(root[root.length - 1]);
  const startV = isVowel(suf[0]);
  if (endV && startV) return root.slice(0, -1) + suf;
  if (!endV && !startV && suf.length > 1) return root + (root.length < 4 ? 'a' : '') + suf;
  return root + suf;
}

/** Demonym/adjective form: Veyra -> Veyran, Kalthos -> Kalthosi, Tarn -> Tarnish. */
export function adjectiveOf(name: string): string {
  const n = name;
  const last = n[n.length - 1].toLowerCase();
  if (n.endsWith('ia')) return n + 'n';
  if (last === 'a') return n + 'n';
  if (last === 'e' || last === 'i' || last === 'y') return n + 'an';
  if (last === 'o' || last === 'u') return n + 'nian';
  if (n.endsWith('s') || n.endsWith('x') || n.endsWith('z')) return n + 'i';
  if (n.endsWith('sh') || n.endsWith('th')) return n + 'ian';
  if (n.length <= 4) return n + 'ish';
  return n + 'ese';
}

const RELIGION_PATTERNS = [
  (d: string, w: string) => `The Way of ${d}`,
  (d: string, w: string) => `${d}ism`,
  (d: string, w: string) => `Covenant of ${d}`,
  (d: string, w: string) => `Path of the ${w}`,
  (d: string, w: string) => `Order of ${d}`,
  (d: string, w: string) => `Children of ${d}`,
  (d: string, w: string) => `The ${w} Faith`,
  (d: string, w: string) => `Light of ${d}`,
];

export function religionName(rng: Rng, p: Phonology, deity: string): string {
  const word = makeName(rng, p, 'word');
  const name = rng.pick(RELIGION_PATTERNS)(deity, word);
  return name.replace(/([aeiouy])ism$/i, '$1nism');
}
