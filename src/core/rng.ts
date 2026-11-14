/**
 * Deterministic, seedable pseudo-random number generation.
 *
 * Rng implements sfc32 (Small Fast Counter, Chris Doty-Humphrey / PractRand):
 * 128 bits of state, passes PractRand to large sizes, and is fast in JS
 * because it uses only 32-bit integer ops. Its full state is four uint32s,
 * which are saved with the world so that loading a save continues the exact
 * same random sequence (save/load never changes future results).
 *
 * Determinism note: integer RNG output is bit-identical on every JS engine.
 * Derived floating-point values that pass through Math.log/Math.cos (e.g.
 * normal()) may differ in the last ulp between engines; reproducibility is
 * guaranteed on the same engine, not bit-for-bit across browsers.
 */

/** cyrb128 string hash -> four 32-bit seeds. */
export function hashSeed(str: string): [number, number, number, number] {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export type RngState = [number, number, number, number];

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: string | number | RngState) {
    let s: RngState;
    if (Array.isArray(seed)) s = seed;
    else s = hashSeed(String(seed));
    this.a = s[0] >>> 0;
    this.b = s[1] >>> 0;
    this.c = s[2] >>> 0;
    this.d = s[3] >>> 0;
    if (!Array.isArray(seed)) for (let i = 0; i < 12; i++) this.u32(); // warm up
  }

  /** Next uint32. */
  u32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform float in [0, 1). */
  float(): number {
    return this.u32() / 4294967296;
  }

  /** Uniform float in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.float();
  }

  /** Uniform integer in [lo, hi] (inclusive). */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.float() * (hi - lo + 1));
  }

  chance(p: number): boolean {
    return this.float() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.float() * arr.length)];
  }

  /** Index chosen proportionally to non-negative weights; -1 if all zero. */
  weighted(weights: ArrayLike<number>): number {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += Math.max(0, weights[i]);
    if (total <= 0) return -1;
    let r = this.float() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = Math.max(0, weights[i]);
      if (r < w) return i;
      r -= w;
    }
    return weights.length - 1;
  }

  /** Standard normal via Box-Muller. */
  normal(): number {
    let u = this.float();
    if (u < 1e-12) u = 1e-12;
    const v = this.float();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Poisson-distributed integer (Knuth for small means, normal approx for large). */
  poisson(mean: number): number {
    if (mean <= 0) return 0;
    if (mean > 40) return Math.max(0, Math.round(mean + Math.sqrt(mean) * this.normal()));
    const L = Math.exp(-mean);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.float();
    } while (p > L);
    return k - 1;
  }

  /** Binomial draw: number of successes in n trials with probability p. */
  binomial(n: number, p: number): number {
    if (n <= 0 || p <= 0) return 0;
    if (p >= 1) return n;
    if (n < 30) {
      let k = 0;
      for (let i = 0; i < n; i++) if (this.float() < p) k++;
      return k;
    }
    const mean = n * p;
    const sd = Math.sqrt(n * p * (1 - p));
    return Math.max(0, Math.min(n, Math.round(mean + sd * this.normal())));
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.float() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  getState(): RngState {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }

  setState(s: RngState): void {
    this.a = s[0] >>> 0;
    this.b = s[1] >>> 0;
    this.c = s[2] >>> 0;
    this.d = s[3] >>> 0;
  }

  /** Derive an independent stream; advances this generator once. */
  fork(label: string): Rng {
    const base = hashSeed(label + ':' + this.u32());
    return new Rng(base);
  }
}

/** Stateless integer hash of (x, y, seed) -> uint32. Used for per-tile visual variation. */
export function hash3(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Stateless hash -> float in [0,1). */
export function hash01(x: number, y: number, seed: number): number {
  return hash3(x, y, seed) / 4294967296;
}

/** FNV-1a 32-bit over a string. */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Incremental FNV-1a over numbers (for deterministic state digests). */
export class Digest {
  private h = 0x811c9dc5;
  num(v: number): this {
    // quantize floats so digests are stable against benign formatting
    const q = Number.isFinite(v) ? Math.round(v * 1000) : 0x7fffffff;
    let x = q | 0;
    for (let i = 0; i < 4; i++) {
      this.h ^= x & 255;
      this.h = Math.imul(this.h, 0x01000193);
      x >>>= 8;
    }
    // high part for big numbers
    const hi = Math.floor(q / 4294967296) | 0;
    this.h ^= hi & 255;
    this.h = Math.imul(this.h, 0x01000193);
    return this;
  }
  arr(a: ArrayLike<number>): this {
    for (let i = 0; i < a.length; i++) this.num(a[i]);
    return this;
  }
  str(s: string): this {
    for (let i = 0; i < s.length; i++) {
      this.h ^= s.charCodeAt(i);
      this.h = Math.imul(this.h, 0x01000193);
    }
    return this;
  }
  value(): number {
    return this.h >>> 0;
  }
  hex(): string {
    return this.value().toString(16).padStart(8, '0');
  }
}
