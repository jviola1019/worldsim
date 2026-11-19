/** Fire, smoke, explosions, weather, divine/disaster effects (fx.*) */
import { S, type SpriteSheet } from './types';

// ---------------------------------------------------------------- author-time raster helpers
// Small generators used to build the geometric effects (fireballs, clouds, rings). They run once
// at module load and produce ordinary palette-key rows.
type Canvas = string[][];
type Blob = [cx: number, cy: number, r: number];
/** Cel-shading tones for cloud(): outline, shadow, main, light. */
interface Tones {
  o?: string;
  s: string;
  m: string;
  l: string;
}

const canvas = (w: number, h: number): Canvas => Array.from({ length: h }, () => Array<string>(w).fill('.'));
const rowsOf = (c: Canvas): string[] => c.map((r) => r.join(''));

function plot(c: Canvas, x: number, y: number, ch: string): void {
  if (y >= 0 && y < c.length && x >= 0 && x < c[0].length) c[y][x] = ch;
}
function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  if (rx <= 0 || ry <= 0) return false;
  const dx = (x + 0.5 - cx) / rx;
  const dy = (y + 0.5 - cy) / ry;
  return dx * dx + dy * dy <= 1;
}
function fillEllipse(c: Canvas, cx: number, cy: number, rx: number, ry: number, ch: string): void {
  for (let y = 0; y < c.length; y++)
    for (let x = 0; x < c[0].length; x++) if (inEllipse(x, y, cx, cy, rx, ry)) c[y][x] = ch;
}
/** 1px ellipse outline; `ch` may pick a color per pixel (null = skip). */
function strokeEllipse(
  c: Canvas,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  ch: string | ((x: number, y: number) => string | null),
): void {
  const inside = (x: number, y: number) => inEllipse(x, y, cx, cy, rx, ry);
  for (let y = 0; y < c.length; y++)
    for (let x = 0; x < c[0].length; x++) {
      if (!inside(x, y)) continue;
      if (inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1)) continue;
      const v = typeof ch === 'string' ? ch : ch(x, y);
      if (v) c[y][x] = v;
    }
}
/** Cartoon cloud / fireball: union of round blobs, lit from the top-left. */
function cloud(c: Canvas, blobs: Blob[], t: Tones): void {
  if (t.o) for (const [x, y, r] of blobs) fillEllipse(c, x, y, r + 1, r + 1, t.o);
  for (const [x, y, r] of blobs) fillEllipse(c, x, y, r, r, t.s);
  for (const [x, y, r] of blobs) fillEllipse(c, x - 0.6, y - 0.8, r - 0.8, r - 0.8, t.m);
  for (const [x, y, r] of blobs) fillEllipse(c, x - 1.2, y - 1.5, r * 0.45, r * 0.45, t.l);
}

const FIRE: Tones = { o: 'n', s: 'f', m: 'F', l: 'O' };
const BURN: Tones = { o: 'm', s: 'f', m: 'F', l: 'O' };
const EMBER: Tones = { o: 'r', s: 'm', m: 'n', l: 'f' };
const SMOKE: Tones = { o: '2', s: '3', m: '4', l: '5' };
const DUST: Tones = { o: '3', s: '4', m: '5', l: '6' };
const HAZE: Tones = { s: '3', m: '4', l: '5' };

const E: SpriteSheet = {};

// ---------------------------------------------------------------- fire & smoke
E['fx.fire'] = S(
  [
    ['..n...', '.nf...', '.nfn..', 'nfFfn.', 'nfFOfn', 'nFOOFn', 'mfOOfm', '.mnnm.'],
    ['...n..', '...fn.', '..nfn.', '.nfFfn', 'nfFOfn', 'nFOOFn', 'mfOOfm', '.mnnm.'],
    ['..n...', '......', '..fn..', '.nFfn.', 'nfOFfn', 'nFOOFn', 'mfOOfm', '.mnnm.'],
    ['......', '.n..n.', '.fnnf.', 'nfFFfn', 'nFOOFn', 'nFOOFn', 'mfOOfm', '.mnnm.'],
  ],
  { fps: 8 },
);

E['fx.fire_big'] = S(
  [
    [
      '...n....',
      '...fn...',
      '..nfn.n.',
      '..fFn.f.',
      '.nfFfnfn',
      '.fFOFfFn',
      'nfFOOFfn',
      'nFOOOOFn',
      'nFOO7OFn',
      'mfFOOFfm',
      'mffFFffm',
      '.mmffmm.',
    ],
    [
      '....n...',
      '....fn..',
      '.n.nfn..',
      '.f.fFn..',
      'nfnfFfn.',
      'nFfFOFfn',
      'nfFOOFfn',
      'nFOOOOFn',
      'nFO7OOFn',
      'mfFOOFfm',
      'mffFFffm',
      '.mmffmm.',
    ],
    [
      '..n.....',
      '........',
      '...nn...',
      '..nffn..',
      '.nfFFfn.',
      'nfFOOFfn',
      'nFOOOOFn',
      'nFOOOOFn',
      'nFOO7OFn',
      'mfFOOFfm',
      'mffFFffm',
      '.mmffmm.',
    ],
    [
      '......n.',
      '.n....f.',
      '.fn..nf.',
      'nfn.nfFn',
      'nfFnfFfn',
      'nFFfFOFn',
      'nFOOOOFn',
      'nFOOOOFn',
      'nFO7OOFn',
      'mfFOOFfm',
      'mffFFffm',
      '.mmffmm.',
    ],
  ],
  { fps: 8 },
);

/** 5x5 puff that grows then breaks into wisps; tones = [light, main, shadow]. */
function puff(l: string, m: string, s: string): string[][] {
  return [
    ['.....', '.....', `..${l}..`, `.${l}${m}${m}.`, `..${m}..`],
    ['.....', `..${l}${l}.`, `.${l}${m}${m}${s}`, `.${m}${m}${m}${s}`, `..${s}${s}.`],
    [`..${l}${l}.`, `.${l}${l}${m}${m}`, `${l}${m}${m}${m}${s}`, `${m}${m}${m}${s}${s}`, `.${s}${s}${s}.`],
    [`.${l}..${l}`, `${l}${m}..${m}`, `.${m}.${l}.`, `..${l}${m}${s}`, `.${s}..${s}`],
  ];
}
E['fx.smoke'] = S(puff('5', '4', '3'), { fps: 4 });
E['fx.smoke_dark'] = S(puff('3', '2', '1'), { fps: 4 });
E['fx.steam'] = S(
  [
    ['.....', '.....', '..7..', '.766.', '..6..'],
    ['.....', '..77.', '.7665', '.6665', '..55.'],
    ['.7.7.', '7.6.6', '.6..5', '7.6.5', '.5.5.'],
  ],
  { fps: 4 },
);

// ---------------------------------------------------------------- blasts
function explosionFrame(step: number): string[] {
  const c = canvas(12, 12);
  if (step === 0) {
    fillEllipse(c, 6, 7, 3, 3, 'O');
    fillEllipse(c, 6, 7, 1.9, 1.9, '7');
    for (const [x, y] of [
      [2, 3],
      [9, 3],
      [2, 10],
      [9, 10],
      [5, 1],
      [6, 1],
      [0, 6],
      [11, 7],
    ])
      plot(c, x, y, 'O');
  } else if (step === 1) {
    cloud(c, [[6, 7, 3.6]], FIRE);
    fillEllipse(c, 5.4, 6.3, 1.4, 1.4, '7');
  } else if (step === 2) {
    cloud(
      c,
      [
        [6, 6.5, 3.6],
        [3.4, 8.6, 2.2],
        [8.6, 8.6, 2.2],
        [6, 4, 2.5],
      ],
      FIRE,
    );
  } else if (step === 3) {
    cloud(
      c,
      [
        [6, 6, 3.8],
        [2.9, 8.4, 2.3],
        [9.1, 8.4, 2.3],
        [6, 3.4, 2.6],
      ],
      SMOKE,
    );
    cloud(
      c,
      [
        [6, 7.2, 2.2],
        [4.3, 8.8, 1.3],
        [7.7, 8.8, 1.3],
      ],
      EMBER,
    );
  } else {
    cloud(
      c,
      [
        [3, 5, 1.9],
        [8.6, 4, 2.1],
        [6, 8.6, 1.9],
        [1.8, 9.4, 1.3],
        [10.2, 8.8, 1.3],
      ],
      HAZE,
    );
    plot(c, 5, 5, 'n');
    plot(c, 8, 9, 'm');
  }
  return rowsOf(c);
}
E['fx.explosion'] = S([0, 1, 2, 3, 4].map(explosionFrame), { fps: 10 });

/** Stylized cartoon mushroom cloud, 24x24, standing on the ground (bottom rows). */
function nukeFrame(step: number): string[] {
  const c = canvas(24, 24);
  const stem = (top: number, bottom: number, cols: string) => {
    for (let y = top; y <= bottom; y++) for (let i = 0; i < 4; i++) plot(c, 10 + i, y, cols[i]);
    plot(c, 9, bottom, cols[0]);
    plot(c, 14, bottom, cols[3]);
  };
  const collar = (y: number, rx: number, top: string, bottom: string) => {
    fillEllipse(c, 12, y, rx, 1.6, bottom);
    fillEllipse(c, 12, y - 0.5, rx - 0.6, 1.0, top);
  };
  switch (step) {
    case 0: // flash
      fillEllipse(c, 12, 24, 7.5, 5.5, 'O');
      fillEllipse(c, 12, 24, 5, 3.6, '7');
      for (let y = 12; y <= 16; y++) {
        plot(c, 11, y, 'O');
        plot(c, 12, y, 'O');
      }
      for (const [x, y] of [
        [5, 16],
        [6, 17],
        [18, 16],
        [17, 17],
        [1, 21],
        [2, 21],
        [22, 21],
        [21, 21],
      ])
        plot(c, x, y, 'O');
      break;
    case 1: // fireball lifts off
      cloud(
        c,
        [
          [5.5, 22.5, 2],
          [9, 22, 2.6],
          [15, 22, 2.6],
          [18.5, 22.5, 2],
        ],
        DUST,
      );
      stem(15, 21, 'fOFf');
      cloud(c, [[12, 11.5, 4.6]], BURN);
      fillEllipse(c, 10.6, 9.8, 1.3, 1.3, '7');
      break;
    case 2: // cap forms
      cloud(
        c,
        [
          [3.5, 22.5, 2.5],
          [8, 21.5, 3],
          [12, 21, 3],
          [16, 21.5, 3],
          [20.5, 22.5, 2.5],
        ],
        DUST,
      );
      stem(12, 20, 'FOFf');
      collar(15.5, 4.5, '6', '5');
      cloud(
        c,
        [
          [12, 8.5, 4.5],
          [7.8, 10.2, 3],
          [16.2, 10.2, 3],
        ],
        BURN,
      );
      break;
    case 3: // full mushroom
      cloud(
        c,
        [
          [3, 21.5, 2.5],
          [7, 20.6, 3.4],
          [12, 20, 3.8],
          [17, 20.6, 3.4],
          [21, 21.5, 2.5],
        ],
        DUST,
      );
      stem(9, 18, 'FOFf');
      collar(13.5, 5.2, '6', '5');
      cloud(
        c,
        [
          [12, 5.5, 4.5],
          [6.8, 7.4, 3.5],
          [17.2, 7.4, 3.5],
          [9.5, 4, 3],
          [14.5, 4, 3],
          [12, 8.5, 3.4],
        ],
        BURN,
      );
      break;
    case 4: // cooling, smoke creeping in
      cloud(
        c,
        [
          [3, 21.5, 2.5],
          [7, 21, 3],
          [12, 20.5, 3.4],
          [17, 21, 3],
          [21, 21.5, 2.5],
        ],
        SMOKE,
      );
      stem(9, 19, 'nfnm');
      collar(13.5, 5, '5', '4');
      cloud(
        c,
        [
          [12, 5.3, 4.8],
          [6.4, 7.4, 3.8],
          [17.6, 7.4, 3.8],
          [9.2, 3.8, 3],
          [14.8, 3.8, 3],
          [12, 8.8, 3.4],
        ],
        EMBER,
      );
      cloud(
        c,
        [
          [3.4, 6.6, 2],
          [20.6, 6.6, 2],
          [12, 2.4, 1.8],
          [7.5, 10.3, 1.6],
          [16.5, 10.3, 1.6],
        ],
        SMOKE,
      );
      break;
    default: // drifting apart
      cloud(
        c,
        [
          [3, 21.8, 2],
          [8, 21.2, 2.4],
          [13, 21, 2.6],
          [18, 21.4, 2.2],
        ],
        HAZE,
      );
      for (let y = 10; y <= 19; y++) {
        if (y % 3 === 0) continue;
        plot(c, 11, y, '4');
        plot(c, 12, y, '3');
      }
      cloud(
        c,
        [
          [5, 6.5, 3],
          [11.5, 4.5, 3.6],
          [18, 5.5, 3],
          [8.5, 9.5, 2.4],
          [15.5, 9.5, 2.4],
        ],
        SMOKE,
      );
  }
  return rowsOf(c);
}
E['fx.nuke'] = S([0, 1, 2, 3, 4, 5].map(nukeFrame), { fps: 4 });

/** Expanding cyan shock ring. */
function empFrame(step: number): string[] {
  const c = canvas(12, 12);
  if (step === 0) {
    fillEllipse(c, 6, 6, 1.5, 1.5, '7');
    strokeEllipse(c, 6, 6, 2.8, 2.8, 'H');
  } else if (step === 1) {
    // single round ring, brighter on the upper-left arc
    strokeEllipse(c, 6, 6, 4.5, 4.5, (x, y) => (x + y < 10 ? 'H' : 'G'));
  } else {
    strokeEllipse(c, 6, 6, 6, 6, (x, y) => ((x + y) % 2 === 0 ? 'G' : null));
    strokeEllipse(c, 6, 6, 5, 5, (x, y) => ((x + y) % 3 === 0 ? 'H' : null));
  }
  return rowsOf(c);
}
E['fx.emp'] = S([0, 1, 2].map(empFrame), { fps: 8 });

// ---------------------------------------------------------------- sky & weather
/** Jagged bolt: core x per row (top to bottom), optional fork as [x, y] pixels. */
function bolt(path: number[], fork: [number, number][], glow: string): string[] {
  const c = canvas(7, 24);
  path.forEach((x, y) => {
    plot(c, x, y, '7');
    const prev = y > 0 ? path[y - 1] : x;
    if (prev !== x) plot(c, prev, y, '7'); // keep the bolt 8-connected and chunky at turns
    if (c[y][x + 1] === '.') plot(c, x + 1, y, glow);
  });
  for (const [x, y] of fork) plot(c, x, y, glow);
  // impact flash
  plot(c, 2, 23, glow);
  plot(c, 4, 23, glow);
  plot(c, 3, 22, '7');
  return rowsOf(c);
}
E['fx.lightning'] = S(
  [
    bolt(
      [3, 3, 3, 2, 2, 1, 2, 3, 4, 4, 4, 3, 3, 2, 3, 4, 5, 5, 4, 3, 3, 3, 3, 3],
      [
        [1, 13],
        [0, 14],
        [0, 15],
      ],
      'H',
    ),
    bolt(
      [4, 4, 3, 3, 4, 5, 5, 4, 3, 2, 2, 3, 3, 4, 4, 3, 2, 2, 3, 4, 4, 3, 3, 3],
      [
        [6, 6],
        [6, 7],
        [1, 18],
        [0, 19],
      ],
      'q',
    ),
  ],
  { fps: 8 },
);

E['fx.meteor'] = S(
  [
    ['......m.', '.....nfm', '....fFn.', '...FOFn.', '..OOFf..', '.tsOF...', 'ts21n...', '.21.....'],
    ['.....m.m', '....nf..', '...nFfn.', '..fOFn..', '..OOf...', '.tsOF...', 'ts21f...', '.21.....'],
  ],
  { fps: 8 },
);

E['fx.rain'] = S(['z', 'q', 'q']);
E['fx.snow'] = S(['76', '65']);

function tornadoFrame(f: number): string[] {
  const W = 8;
  const H = 16;
  const c = canvas(W, H);
  for (let y = 0; y < H - 2; y++) {
    const t = y / (H - 3);
    const half = 4 - t * 3.1;
    const cx = 4 + Math.sin(t * Math.PI * 1.4 + (f * Math.PI) / 2) * 1.2 * t;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - cx) / half;
      if (Math.abs(u) > 1) continue;
      const tones = ['5', '4', '3', '2'];
      let k = u < -0.45 ? 0 : u > 0.45 ? 2 : 1;
      if ((y + Math.floor((u + 1) * 2) + f) % 3 === 0) k += 1; // twisting bands drift down
      plot(c, x, y, tones[Math.min(k, 3)]);
    }
  }
  // dust skirt where the funnel touches down
  const bx = Math.round(4 + Math.sin(Math.PI * 1.4 + (f * Math.PI) / 2) * 1.2);
  const skirt = f % 2 === 0 ? ['.4t4.', 't4.4t'] : ['4t.t4', '.t4t.'];
  skirt.forEach((r, i) => [...r].forEach((ch, j) => ch !== '.' && plot(c, bx - 2 + j, H - 2 + i, ch)));
  // debris orbiting the funnel
  const debris: [number, number][][] = [
    [
      [0, 3],
      [7, 7],
    ],
    [
      [7, 2],
      [0, 8],
    ],
    [
      [6, 5],
      [1, 10],
    ],
    [
      [1, 5],
      [6, 10],
    ],
  ];
  debris[f].forEach(([x, y], i) => plot(c, x, y, i ? 'b' : 'c'));
  return rowsOf(c);
}
E['fx.tornado'] = S([0, 1, 2, 3].map(tornadoFrame), { fps: 8 });

// ---------------------------------------------------------------- water
E['fx.splash'] = S(
  [
    ['......', '......', '..7q..', '.qzzq.'],
    ['.7..7.', '.q77q.', 'q7..7q', '.zqqz.'],
    ['q....q', '......', '.q..q.', 'z.qq.z'],
  ],
  { fps: 8 },
);
E['fx.wave'] = S(
  [
    ['..q..', '.q.q.'],
    ['.q7q.', 'q...q'],
    ['.....', 'q.q.q'],
  ],
  { fps: 3 },
);
E['fx.foam'] = S(
  [
    ['77q..q7q', 'q.qqq.qq'],
    ['q77q..q7', 'qq.qqq.q'],
    ['7q77q..q', 'qqq.qqq.'],
  ],
  { fps: 3 },
);
E['fx.flood'] = S(
  [
    ['..qqq...', '.qzzzq..', '....qqq.', '...qzzzq'],
    ['...qqq..', '..qzzzq.', '.qqq....', 'qzzzq...'],
  ],
  { fps: 3 },
);

// ---------------------------------------------------------------- divine / combat / markers
E['fx.sparkle'] = S(
  [
    ['.....', '.....', '..O..', '.....', '.....'],
    ['.....', '..O..', '.O7O.', '..O..', '.....'],
    ['..7..', '..O..', '7O7O7', '..O..', '..7..'],
    ['O...O', '.....', '..O..', '.....', 'O...O'],
  ],
  { fps: 8 },
);
E['fx.clash'] = S(
  [
    ['.......', '...o...', '..O7O..', '.o777o.', '..O7O..', '...o...', '.......'],
    ['o..O..o', '.O.7.O.', '..O7O..', 'O77777O', '..O7O..', '.O.7.O.', 'o..O..o'],
    ['F..o..F', '.......', '.o...o.', 'o..7..o', '.o...o.', '.......', 'F..o..F'],
  ],
  { fps: 8 },
);
E['fx.skull'] = S(['.766.', '77665', '70605', '.656.', '.5.5.']);
E['fx.heal'] = S(
  [
    ['.....', '..k..', '.klk.', '..k..', '.....'],
    ['..k..', '..l..', 'kl7lk', '..l..', '..k..'],
    ['l...l', '..k..', '.kjk.', '..k..', 'l...l'],
  ],
  { fps: 6 },
);
E['fx.star'] = S(
  [
    ['.O.', 'O7O', '.O.'],
    ['...', '.O.', '...'],
  ],
  { fps: 2 },
);
E['fx.coin'] = S(
  [
    ['.o.', 'oOo', '.o.'],
    ['.7.', '7Oo', '.o.'],
  ],
  { fps: 4 },
);
E['fx.book'] = S(['66.66', '74547', '64546', 'dcbcd']);

/** Selection ellipse with marching white/gold dashes; anchored on its center (unit feet). */
function selectionRing(f: number): string[] {
  const c = canvas(12, 6);
  strokeEllipse(c, 6, 3, 6, 3, (x, y) => {
    const a = Math.atan2((y + 0.5 - 3) * 2, x + 0.5 - 6);
    const seg = Math.floor(((a + Math.PI) / (2 * Math.PI)) * 12);
    return (seg + f) % 2 === 0 ? '7' : 'o';
  });
  return rowsOf(c);
}
E['fx.ring'] = S([0, 1].map(selectionRing), { fps: 2, ax: 6, ay: 3 });

// team flags: the pole base is the anchor so the flag can be planted on a tile
E['fx.flag'] = S(
  [
    ['o....', 'cVT..', 'cTTVT', 'cUTTT', 'c..UU', 'c....', 'b....'],
    ['o....', 'cV..V', 'cTVTT', 'cUTTU', 'c.UU.', 'c....', 'b....'],
  ],
  { fps: 3, ax: 0 },
);
E['fx.banner'] = S(
  [
    [
      'o.....',
      'cddddd',
      'cVTTTU',
      'cVTTTU',
      'cVToTU',
      'cVoOoU',
      'cVToTU',
      'cVTTTU',
      'cVTTTU',
      'cVU.TU',
      'c.....',
      'b.....',
    ],
    [
      'o.....',
      'cddddd',
      'cVTTTU',
      'cVTTTU',
      'cVToTU',
      'cVoOoU',
      'cVToTU',
      'cVTTTU',
      'c.VTTU',
      'c.VU.U',
      'c.....',
      'b.....',
    ],
  ],
  { fps: 3, ax: 0 },
);

// ---------------------------------------------------------------- disasters & strange things
E['fx.quake'] = S(
  [
    ['........', '.....1..', '....10..', '...01...', '..10....', '.10..1..', '10...01.', '.......0'],
    ['......t.', '....t01.', '...1001.', '..001.1t', 't100..10', '.00..t.0', '10...001', 't....t.0'],
  ],
  { fps: 6 },
);
E['fx.plague'] = S(
  [
    ['......', '..kl..', '.kYkl.', 'kY.Ykk', '.kYXk.', '..kk..'],
    ['..lk..', '.kYkl.', 'kX.Yk.', '.kY.kl', '..kYk.', '...k..'],
    ['.l..k.', 'k.kl..', '.kY.kl', 'lX..Yk', '.k.kY.', '..k...'],
  ],
  { fps: 4 },
);
E['fx.radiation'] = S(
  [
    ['......', '..kk..', '.klOk.', '.kOlk.', '..kk..', '......'],
    ['..kk..', '.kllk.', 'klOOlk', 'klOOlk', '.kllk.', '..kk..'],
  ],
  { fps: 2 },
);
E['fx.dust'] = S(
  [
    ['......', '......', '.u..u.', 'utt.ts'],
    ['......', '.uu.u.', 'uttuts', 'tsstts'],
    ['.u..u.', 'u.t..u', '.t..t.', 's....s'],
  ],
  { fps: 6 },
);

function beamFrame(f: number): string[] {
  const rows: string[] = [];
  for (let y = 0; y < 24; y++) {
    const k = (y + 24 - f * 3) % 8;
    if (k === 0) rows.push('GH77HG');
    else if (k === 1) rows.push('.H77H.');
    else if (y % 4 === f % 4) rows.push(y % 8 < 4 ? 'HGHHG.' : '.GHHGH'); // drifting sparkles
    else rows.push('.GHHG.');
  }
  rows[22] = 'GH77HG';
  rows[23] = 'H7777H';
  return rows;
}
E['fx.alien_beam'] = S([0, 1, 2].map(beamFrame), { fps: 8 });

E['fx.ufo'] = S(
  [
    ['....7HGG....', '...HHGGGG...', '.LLLLLLLNNN.', 'LNoNNGNNoNNM', '.MMMMMMMMMM.', '...MGGGGM...'],
    ['....7HGG....', '...HHGGGG...', '.LLLLLLLNNN.', 'LNGNNoNNGNNM', '.MMMMMMMMMM.', '...MHHHHM...'],
  ],
  { fps: 4 },
);

function monolith(runes: [number, number][], aura: [number, number, string][]): string[] {
  const c = canvas(6, 12);
  for (let y = 1; y <= 10; y++) {
    plot(c, 1, y, '2');
    plot(c, 2, y, '1');
    plot(c, 3, y, '1');
    plot(c, 4, y, '0');
  }
  plot(c, 2, 0, '2');
  plot(c, 3, 0, '1');
  for (const [x, y] of runes) plot(c, x, y, 'G');
  for (const [x, y, ch] of aura) plot(c, x, y, ch);
  for (let x = 0; x < 6; x++) plot(c, x, 11, x === 0 || x === 5 ? 'P' : 'p');
  return rowsOf(c);
}
E['fx.anomaly'] = S(
  [
    monolith(
      [
        [2, 3],
        [3, 5],
        [2, 7],
      ],
      [
        [0, 2, 'G'],
        [5, 5, 'Q'],
        [0, 8, 'Q'],
        [5, 9, 'G'],
      ],
    ),
    monolith(
      [
        [3, 2],
        [2, 4],
        [3, 6],
        [2, 8],
      ],
      [
        [0, 1, 'H'],
        [5, 3, 'G'],
        [0, 6, 'G'],
        [5, 7, 'Q'],
        [1, 0, 'G'],
      ],
    ),
    monolith(
      [
        [2, 2],
        [3, 4],
        [2, 6],
        [3, 8],
        [2, 9],
      ],
      [
        [5, 1, 'Q'],
        [0, 4, 'Q'],
        [5, 6, 'H'],
        [0, 9, 'G'],
        [4, 0, 'G'],
      ],
    ),
  ],
  { fps: 3 },
);

// round 7: fireworks for world games and championships (a rising spark, then a burst that fades)
function firework(f: number): string[] {
  const c = canvas(12, 12);
  const cx = 6, cy = 5;
  if (f === 0) {
    plot(c, 6, 10, 'O'); plot(c, 6, 9, 'o'); plot(c, 6, 11, 'f');
    return rowsOf(c);
  }
  const r = f === 1 ? 2 : f === 2 ? 4 : 5;
  const cols = ['n', 'o', 'G', 'Q'];
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(ang) * r), y = Math.round(cy + Math.sin(ang) * r);
    plot(c, x, y, f === 3 ? (a & 1 ? '.' : cols[a % 4]) : cols[a % 4]);
    if (f === 2) plot(c, Math.round(cx + Math.cos(ang) * (r - 2)), Math.round(cy + Math.sin(ang) * (r - 2)), 'O');
  }
  if (f < 3) plot(c, cx, cy, '7');
  return rowsOf(c);
}
E['fx.firework'] = S([0, 1, 2, 3].map(firework), { fps: 6, ax: 6, ay: 10 });

export const EFFECT_SPRITES: SpriteSheet = E;
