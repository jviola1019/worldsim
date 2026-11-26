/**
 * Round 10 second addendum (Task 7): realistic disaster and disease effects, on the master palette and the
 * 8-art-pixels-per-tile scale. Each one reads by its silhouette at a glance:
 *   squall      a flat dark cloud with slanted rain, and a lightning flicker once a second
 *   hurricane   a turning two-armed spiral with a clear eye (large coastal storms)
 *   eruption    an ash column rising from a glowing vent, ash falling from its spreading top, then dark smoke
 *   airburst    a fireball high in the sky inside a white shock ring, then a smoke ball (no ground blast)
 *   pall        a see-through pale yellow-green haze over a town (natural disease: never a skull)
 *   sick        a figure in a sickbed: the symbol on a town while more than 1% of it is sick (and on a pall elsewhere)
 *   aurora      cyan-green curtains of light with a purple top, glowing across the top of the view
 *   heat        a drought: cracked dry ground under a heat shimmer
 *   blizzard    a grey snow cloud with wind-driven snow
 *   flood       muddy floodwater spreading with ripples
 *   wave        a tsunami crest that rises, curls and breaks into foam
 *   quake       a ground fissure that opens and throws up dust
 * Still frames for Reduce motion are chosen in rendering/fxMotion.ts (STILL_FRAME).
 */
import { S, type SpriteSheet } from './types';
import { canvas, rowsOf, plot, fillEllipse, strokeEllipse, cloud, inEllipse, SMOKE, FIRE, BURN, EMBER, HAZE, type Canvas, type Tones } from './pixelDraw';

const D: SpriteSheet = {};
const STORM: Tones = { o: '1', s: '2', m: '3', l: '4' };
const ASH: Tones = { o: '1', s: '2', m: '3', l: '4' };
const SNOWCLOUD: Tones = { o: '3', s: '4', m: '5', l: '6' };

/** Paint a little pattern (rows of keys, '.' = skip) with its top-left at (x, y). */
function stamp(c: Canvas, x: number, y: number, rows: string[]): void {
  rows.forEach((r, j) => [...r].forEach((ch, i) => ch !== '.' && plot(c, x + i, y + j, ch)));
}

// ---------------------------------------------------------------- squall
/** Frames 0-4: rain falling (dashes move down 2 px a frame); frame 5: the cloud lights up and a bolt strikes. */
function squallFrame(f: number): string[] {
  const c = canvas(16, 18);
  // rain under the cloud: slanted dashes (wind from the right), 3 px long, moving down
  for (let y = 7; y < 18; y++)
    for (let x = 0; x < 16; x++) {
      const d = x + Math.floor(y / 2);
      if (d % 4 !== 0 || x < 1 || x > 14) continue;
      const k = (y - f * 2 + x * 5) % 6;
      if (k === 0) plot(c, x, y, 'q');
      else if (k === 1 || k === 2) plot(c, x, y, 'z');
    }
  cloud(c, [[4, 4.5, 3], [8, 3.6, 3.4], [12, 4.6, 2.8], [8, 5.6, 3]], STORM);
  if (f === 5) {
    // the cloud's underside lights up and a short bolt reaches the ground
    for (const [x, y] of [[6, 7], [7, 7], [8, 8], [9, 7], [5, 6]]) plot(c, x, y, 'O');
    const bolt = [8, 8, 7, 7, 8, 9, 9, 8, 8, 7];
    bolt.forEach((x, k) => { plot(c, x, 8 + k, '7'); plot(c, x + 1, 8 + k, 'H'); });
  }
  return rowsOf(c);
}
D['fx.squall'] = S([0, 1, 2, 3, 4, 5].map(squallFrame), { fps: 6 });

// ---------------------------------------------------------------- hurricane
/** A two-armed spiral seen from above, turned 45 degrees a frame (4 frames make a seamless half turn). */
function hurricaneFrame(f: number): string[] {
  const N = 24;
  const c = canvas(N, N);
  const cx = N / 2, cy = N / 2;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      if (r > 11.6) continue;
      if (r < 1.5) continue; // the clear eye
      const th = Math.atan2(dy, dx);
      // northern hemisphere: the storm turns counter-clockwise (on screen, y down), so its bands trail clockwise
      // outward; a quarter of their period per frame
      const arm = Math.cos(2 * th - 3.4 * Math.log(r) + (f * Math.PI) / 2);
      const v = arm * (0.25 + r / 20) + (1 - r / 11.6) * 1.15 - 0.12;
      let ch = '';
      if (r < 2.6) ch = '7'; // the bright eyewall
      else if (v > 0.85) ch = '7';
      else if (v > 0.6) ch = '6';
      else if (v > 0.38) ch = '5';
      else if (v > 0.18) ch = '4';
      else if (v > 0.05 && (x + y) % 2 === 0) ch = '4'; // thin outer bands, dithered
      if (ch) plot(c, x, y, ch);
    }
  // shadow on the lower-right rim gives the cloud body some depth
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (c[y][x] === '.' || c[y][x] === '4') continue;
      const below = y + 1 < N ? c[y + 1][x] : '.';
      const right = x + 1 < N ? c[y][x + 1] : '.';
      if (below === '.' || right === '.') c[y][x] = '4';
    }
  return rowsOf(c);
}
D['fx.hurricane'] = S([0, 1, 2, 3].map(hurricaneFrame), { fps: 5, ax: 12, ay: 12 });

// ---------------------------------------------------------------- eruption
/** Lava glow at the vent (bottom rows). `big` adds a fountain of spatter. */
function vent(c: Canvas, big: boolean): void {
  stamp(c, 4, 21, ['..nffn..', '.nfFOFn.', 'mnfOOfnm']);
  if (big) for (const [x, y, ch] of [[5, 19, 'f'], [10, 18, 'F'], [3, 20, 'n'], [12, 20, 'n'], [7, 17, 'O'], [9, 19, 'f']] as const) plot(c, x, y, ch);
}
/** A rising ash column from the vent up to `top`, `w` wide at its top, lit orange from below. */
function column(c: Canvas, top: number, w: number): void {
  for (let y = top; y <= 20; y++) {
    const t = (y - top) / Math.max(1, 20 - top);
    const half = Math.max(1.2, w * (1 - t) + 1.2 * t);
    for (let x = 0; x < 16; x++) {
      const u = (x + 0.5 - 8) / half;
      if (Math.abs(u) > 1) continue;
      const lit = y >= 18 ? (Math.abs(u) < 0.5 ? 'f' : 'm') : null; // the vent's glow on the column's foot
      const tone = lit ?? (u < -0.4 ? '4' : u > 0.4 ? '2' : (x + y) % 3 === 0 ? '2' : '3');
      plot(c, x, y, tone);
    }
  }
}
/** Ash falling from the spreading top (dark specks drift down and out). */
function ashfall(c: Canvas, step: number, from: number): void {
  for (let k = 0; k < 10; k++) {
    const x = [1, 3, 13, 14, 2, 12, 0, 15, 4, 11][k];
    const y = from + ((k * 3 + step * 2) % 9);
    plot(c, x, y, k % 3 === 0 ? '1' : '2');
  }
}
function eruptionFrame(step: number): string[] {
  const c = canvas(16, 24);
  switch (step) {
    case 0: // the vent glows, a first puff
      cloud(c, [[8, 17.5, 2]], ASH);
      vent(c, false);
      break;
    case 1: // the column rises
      column(c, 9, 2.6);
      cloud(c, [[8, 9, 2.6], [6.5, 11, 1.8], [9.6, 11, 1.8]], ASH);
      vent(c, true);
      break;
    case 2: // full column, its top spreading (umbrella), ash falling, lava fountaining
      column(c, 5, 3);
      cloud(c, [[8, 4.5, 3.4], [4, 6, 2.6], [12, 6, 2.6], [8, 7.5, 2.6]], ASH);
      ashfall(c, 0, 9);
      vent(c, true);
      break;
    case 3: // the umbrella broadens and drifts, ash falls wider
      column(c, 6, 2.6);
      cloud(c, [[8, 4, 3.4], [3.2, 5.4, 2.8], [12.8, 5.4, 2.8], [5.6, 7.4, 2.2], [10.4, 7.4, 2.2]], ASH);
      ashfall(c, 1, 9);
      vent(c, false);
      break;
    case 4: // the column breaks; a dark cloud hangs over the cooling vent
      for (let y = 10; y <= 19; y++) if (y % 3 !== 0) { plot(c, 7, y, '2'); plot(c, 8, y, '3'); }
      cloud(c, [[8, 5, 3.2], [3.5, 6.2, 2.6], [12.5, 6.2, 2.6]], ASH);
      ashfall(c, 2, 10);
      stamp(c, 5, 22, ['.mffm.', 'rmnnmr']);
      break;
    default: // dark smoke drifts apart
      cloud(c, [[4, 6, 2.4], [10, 4.6, 2.8], [13, 8, 1.8], [7, 9, 1.8]], { s: '1', m: '2', l: '3' });
      stamp(c, 6, 22, ['.mm.', 'rmmr']);
  }
  return rowsOf(c);
}
D['fx.eruption'] = S([0, 1, 2, 3, 4, 5].map(eruptionFrame), { fps: 2 });

// ---------------------------------------------------------------- airburst
/** A fireball in the sky above the ground point (the anchor), a shock ring around it, then smoke. */
function airburstFrame(step: number): string[] {
  const c = canvas(24, 26);
  const cx = 12, cy = 8;
  switch (step) {
    case 0: // the flash
      fillEllipse(c, cx, cy, 4, 4, 'O');
      fillEllipse(c, cx, cy, 2.6, 2.6, '7');
      for (const [x, y] of [[cx, 1], [cx, 15], [5, cy], [19, cy], [7, 3], [17, 3], [7, 13], [17, 13]]) plot(c, x, y, 'O');
      break;
    case 1: // fireball inside the shock ring
      strokeEllipse(c, cx, cy, 8, 7, (x, y) => ((x + y) % 2 === 0 ? '7' : '6'));
      cloud(c, [[cx, cy, 3.6]], FIRE);
      fillEllipse(c, cx - 0.8, cy - 0.8, 1.5, 1.5, '7');
      break;
    case 2: // the ring spreads and thins, the fireball cools
      strokeEllipse(c, cx, cy, 11, 9.5, (x, y) => (Math.floor(((Math.atan2(y + 0.5 - cy, x + 0.5 - cx) + Math.PI) / (2 * Math.PI)) * 16) % 2 ? '6' : null));
      cloud(c, [[cx, cy, 3.4], [cx - 1.5, cy + 1.6, 2]], BURN);
      break;
    case 3: // a smoke ball with an ember core, the last of the ring
      strokeEllipse(c, cx, cy, 11.8, 10.4, (x, y) => ((x + 2 * y) % 4 === 0 ? '5' : null));
      cloud(c, [[cx, cy - 0.5, 3.6], [cx - 3, cy + 1.5, 2.2], [cx + 3, cy + 1.5, 2.2]], SMOKE);
      cloud(c, [[cx, cy + 0.6, 1.8]], EMBER);
      break;
    default: // smoke drifts apart
      cloud(c, [[cx - 3, cy - 1, 2.2], [cx + 2.5, cy - 2, 2.4], [cx, cy + 2, 2]], HAZE);
  }
  return rowsOf(c);
}
D['fx.airburst'] = S([0, 1, 2, 3, 4].map(airburstFrame), { fps: 3, ax: 12, ay: 19 }); // the burst about 1.4 tiles up: below a town's name label

// ---------------------------------------------------------------- sickness
/**
 * The sickness symbol: a figure in a sickbed (face on a white pillow, a pale blue blanket, a brown bed), with a
 * dark outline so it reads on any town. Not a cross: a red cross reads as aid or healing and is a protected emblem.
 */
const SICKBED = [
  '0000.......',
  '0c600......',
  '0c6SS000000',
  '0c6SSLLLLL0',
  '0cNLLLLLLL0',
  '0cdddddddc0',
  '0c0000000c0',
  '000.....000',
];
/**
 * A low veil of pale yellow-green haze over the town, solid and soft-edged: the renderer draws it see-through, so
 * the town shows through a sickly tint. It drifts a pixel a frame. It carries no symbol itself: the renderer adds the
 * sickbed only where the town does not already carry the sick-town marker (pallShowsSymbol).
 */
function pallFrame(f: number): string[] {
  const c = canvas(24, 12);
  const dx = [0, 1, 0][f];
  cloud(c, [[5.5 + dx, 6.5, 3.8], [12 - dx, 5.2, 4.6], [18.5 + dx, 6.8, 3.8], [8.5 - dx, 8.6, 3.2], [15.5 + dx, 8.6, 3.2]], { s: 'Y', m: 'k', l: 'l' });
  // a ragged, drifting edge: a few wisps off the veil's rim
  for (const [x, y] of [[1 + dx, 7], [22 - dx, 6], [4 - dx, 3], [20 + dx, 3]]) plot(c, x, y, 'Y');
  return rowsOf(c);
}
D['fx.pall'] = S([0, 1, 2].map(pallFrame), { fps: 3, ax: 12, ay: 8 });
/** The sickness symbol (a one-frame badge: the renderer pulses its opacity on sick towns, and tops a pall with it). */
D['fx.sick'] = S(SICKBED, { ax: 5, ay: 7 });

// ---------------------------------------------------------------- aurora
/**
 * Curtains of light, 64 px wide and tileable (every wave has a whole number of periods across the width). Cyan-green
 * light, off the grass greens on purpose: a soft, broken lower edge (bright only where the curtain is strong) and
 * streaks rising from it on every other column, fading from cyan through pale blue into a sparse purple top. The
 * renderer adds it to a night-sky wash ('lighter'), so it glows rather than paints. The folds ripple sideways.
 */
function auroraFrame(f: number): string[] {
  const W = 64, H = 20;
  const c = canvas(W, H);
  const ph = (f * Math.PI) / 2;
  for (let x = 0; x < W; x++) {
    const a = (2 * Math.PI * x) / W;
    const glow = 0.55 + 0.3 * Math.sin(3 * a - ph) + 0.15 * Math.sin(7 * a + ph);
    if (glow < 0.2) continue; // a thin place in the curtain
    const base = Math.round(15 + 2.4 * Math.sin(a + ph / 2) + 1.2 * Math.sin(3 * a - ph));
    // the lower edge: bright glow only where the curtain is strong, every other pixel elsewhere
    if (glow > 0.7) plot(c, x, base, 'H');
    else if ((x + base) % 2 === 0) plot(c, x, base, 'G');
    const tall = x % 2 === 0;
    const len = tall ? Math.round(6 + glow * 8 + ((x * 7) % 3)) : glow > 0.5 ? 4 : 2;
    for (let k = 1; k < len; k++) {
      const y = base - k;
      if (y < 0) break;
      const t = k / len;
      // dithered by column pairs so the fading streaks do not line up in rows
      const d = (y + (x >> 1)) % 2 === 0;
      const ch = t < 0.3 ? 'G' : t < 0.55 ? (d ? 'G' : 'z') : t < 0.75 ? (d ? 'q' : '.') : (y + (x >> 1)) % 3 === 0 ? (glow > 0.7 ? 'Q' : 'P') : '.';
      if (ch !== '.') plot(c, x, y, ch);
    }
  }
  return rowsOf(c);
}
D['fx.aurora'] = S([0, 1, 2, 3].map(auroraFrame), { fps: 3, ax: 0, ay: 0 });

// ---------------------------------------------------------------- drought, blizzard
/** Cracked dry ground under a heat shimmer that wavers upward. */
function heatFrame(f: number): string[] {
  const c = canvas(16, 12);
  fillEllipse(c, 8, 9.5, 8, 2.6, 'B');
  for (const [x, y] of [[2, 9], [3, 10], [4, 9], [5, 9], [6, 10], [7, 11], [8, 9], [9, 8], [10, 9], [11, 10], [12, 9], [13, 9], [14, 10], [6, 8], [11, 8]]) plot(c, x, y, 'c');
  for (const [x, y] of [[1, 10], [8, 10], [13, 11]]) plot(c, x, y, 'C');
  for (let k = 0; k < 4; k++) {
    const x0 = 2 + k * 3.6;
    if (k % 2 === f % 2 && k > 0 && k < 3) continue; // the middle lines come and go
    for (let y = 1; y < 7; y++) {
      const x = Math.round(x0 + Math.sin((y + f) * (Math.PI / 2)) * 1);
      plot(c, x, y, y < 3 ? 'A' : 'O');
    }
  }
  return rowsOf(c);
}
D['fx.heat'] = S([0, 1, 2, 3].map(heatFrame), { fps: 4 });

/** A grey snow cloud with snow driven sideways by the wind (flakes move left and down each frame). */
function blizzardFrame(f: number): string[] {
  const c = canvas(16, 16);
  for (let k = 0; k < 16; k++) {
    const x = ((k * 7 + 15 - f * 3) % 18) - 1;
    const y = 7 + ((k * 5 + f) % 9);
    plot(c, x, y, k % 3 === 0 ? '6' : '7');
    if (k % 2 === 0) plot(c, x + 1, y, '5'); // a short streak behind the flake
  }
  cloud(c, [[4, 4, 3], [8.5, 3.4, 3.4], [12.5, 4.4, 2.8], [8, 5.6, 2.8]], SNOWCLOUD);
  return rowsOf(c);
}
D['fx.blizzard'] = S([0, 1, 2, 3].map(blizzardFrame), { fps: 6 });

// ---------------------------------------------------------------- flood, tsunami, earthquake (redrawn)
/** Muddy floodwater: an irregular khaki-brown sheet that spreads, short ripple dashes, a ragged dithered edge. */
function floodFrame(f: number): string[] {
  const c = canvas(16, 8);
  const g = f * 0.8;
  const inside = (x: number, y: number, k: number) => inEllipse(x, y, 6, 4, 4 + g + k, 2.4 + g * 0.3 + k) || inEllipse(x, y, 10.5, 4.6, 3.6 + g + k, 2 + g * 0.3 + k);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 16; x++) {
      if (inside(x, y, 0)) plot(c, x, y, (x + y) % 7 === 0 ? 'B' : 'C');
      else if (inside(x, y, 0.9) && (x + y) % 2 === 0) plot(c, x, y, 'C'); // the ragged spreading edge
    }
  for (const [x, y] of [[3, 3], [7, 2], [10, 5], [5, 5], [12, 3]]) {
    const xx = x + ((f + y) % 2);
    if (c[y][xx] !== '.' && c[y][xx + 1] !== '.') { plot(c, xx, y, 'q'); plot(c, xx + 1, y, 'z'); }
  }
  return rowsOf(c);
}
D['fx.flood'] = S([0, 1, 2].map(floodFrame), { fps: 3 });

D['fx.wave'] = S(
  [
    // rising: a dark swell with a foam line
    ['................', '................', '................', '.......qq.......', '.....qzzzzq.....', '...qzyyyyyyzq...', '.qzyyxxxxxxyyzq.', 'qyxxxwwwwwwxxxyq'],
    // curling: the crest leans forward and foams
    ['................', '........q7q.....', '.......q77zq....', '......qzzy.7....', '....qzyyy...q...', '...zyyxxy....q..', '.qzyxxxxxyyzq...', 'qyxxwwwwwxxxyzq.'],
    // breaking: the crest collapses into a spray of foam
    ['..........7..q..', '.......q.7.q....', '.....q7q77q.7...', '....q77zzq77q...', '...q7zyyyz7q.7..', '..qzyyxxyyzq....', '.qzyxxxxxxyyzq7.', 'q7xxwwwwwwxxx7q7'],
  ],
  { fps: 3 },
);

D['fx.quake'] = S(
  [
    // the ground splits
    ['................', '................', '................', '................', '.......0........', '..t...01t.......', '.t001001.0t.....', '....10..001t....', '.........t010...', '..........t.0t..'],
    // the fissure gapes and throws up dust
    ['......5.........', '....454..5......', '...45.4.454.....', '..t..4..4.......', '...t..001..t....', '..t0010011t.....', '.t0010010000t...', '..t.1100.0011t..', '....t..t.t0100..', '..........t.01t.'],
    // dust settles over the scarred ground
    ['................', '.....4....4.....', '...4..5.4..4....', '....4..4..4.....', '..t..t001..t....', '..t0010011t.....', '.t0010010000t...', '..t.1100.0011t..', '....t..t.t0100..', '..........t.01t.'],
  ],
  { fps: 6 },
);

export const DISASTER_EFFECTS: SpriteSheet = D;
