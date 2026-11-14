/** Small numeric helpers shared by all systems. */

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number): number => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** Logistic sigmoid. */
export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));
/** Saturating response: 0 at 0, approaches 1, half at `half`. */
export const saturate = (x: number, half: number): number => (x <= 0 ? 0 : x / (x + half));
export const dist2 = (ax: number, ay: number, bx: number, by: number): number => (ax - bx) ** 2 + (ay - by) ** 2;
export const dist = (ax: number, ay: number, bx: number, by: number): number => Math.sqrt(dist2(ax, ay, bx, by));
/** Chebyshev distance (king moves). */
export const cheb = (ax: number, ay: number, bx: number, by: number): number => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
/** Move `v` toward `target` by at most `step`. */
export const approach = (v: number, target: number, step: number): number =>
  v < target ? Math.min(target, v + step) : Math.max(target, v - step);
/** Exponential smoothing toward a target with rate in (0,1]. */
export const relax = (v: number, target: number, rate: number): number => v + (target - v) * rate;
export const sum = (a: ArrayLike<number>): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s;
};
export const mean = (a: ArrayLike<number>): number => (a.length ? sum(a) / a.length : 0);
export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function gini(values: number[]): number {
  const v = values.filter((x) => x >= 0).sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) return 0;
  const total = sum(v);
  if (total <= 0) return 0;
  let cum = 0;
  for (let i = 0; i < n; i++) cum += (i + 1) * v[i];
  return (2 * cum) / (n * total) - (n + 1) / n;
}

/** D8 neighbor offsets (E, SE, S, SW, W, NW, N, NE). */
export const DX8 = [1, 1, 0, -1, -1, -1, 0, 1] as const;
export const DY8 = [0, 1, 1, 1, 0, -1, -1, -1] as const;
export const DIST8 = [1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2] as const;
export const DX4 = [1, 0, -1, 0] as const;
export const DY4 = [0, 1, 0, -1] as const;

export function formatNumber(n: number, digits = 1): string {
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(digits) + 'T';
  if (a >= 1e9) return (n / 1e9).toFixed(digits) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(digits) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(digits === 1 ? 0 : digits) + 'k';
  if (a >= 1000) return (n / 1e3).toFixed(digits) + 'k';
  if (a >= 100 || Number.isInteger(n)) return Math.round(n).toString();
  return n.toFixed(digits);
}

export function formatPct(x: number, digits = 0): string {
  return (x * 100).toFixed(digits) + '%';
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function romanNumeral(n: number): string {
  if (n <= 0 || n >= 4000) return String(n);
  const map: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [v, s] of map) while (n >= v) {
    out += s;
    n -= v;
  }
  return out;
}
