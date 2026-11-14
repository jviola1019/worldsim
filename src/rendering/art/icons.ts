/**
 * 16x16 UI icons (ico.*).
 *
 * Authoring model: every icon is composed from one or more layers of "fill"
 * art (16 rows of palette keys, see palette.ts). Each layer automatically gets
 * a 1px dark outline (4-connected, so square corners come out slightly
 * rounded). A later layer's outline is painted over earlier layers, which
 * separates overlapping objects. Glows, sparkles and motion streaks are added
 * as un-outlined layers (fx()).
 *
 * Special keys inside layer art:
 *   '.'  transparent, not part of the layer
 *   '_'  part of the layer's mask but painted transparent (cuts a hole and
 *        suppresses the outline there)
 *
 * Light comes from the top-left: highlights on upper/left edges, shadows on
 * lower/right edges. Icons keep ~1px of padding inside the 16x16 cell.
 */
import { S, type SpriteDef, type SpriteSheet } from './types';

const SZ = 16;
type Art = readonly string[];

interface Layer {
  art: Art;
  x?: number;
  y?: number;
  /** Outline key, or false for none. Default '0'. */
  ol?: string | false;
  /** 8-connected outline (square corners). */
  sq?: boolean;
  /** Only outline onto transparent pixels (never over earlier layers). */
  under?: boolean;
}
type LayerLike = Layer | Art;

const N4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const N8: ReadonlyArray<readonly [number, number]> = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

function paint(g: string[][], ll: LayerLike): void {
  const layer: Layer = 'art' in ll ? ll : { art: ll };
  const { art, x: ox = 0, y: oy = 0, ol = '0', sq = false, under = false } = layer;
  const mask = new Uint8Array(SZ * SZ);
  const cells: number[] = [];
  const keys: string[] = [];
  art.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const ch = row[rx];
      if (ch === '.') continue;
      const X = ox + rx;
      const Y = oy + ry;
      if (X < 0 || Y < 0 || X >= SZ || Y >= SZ) continue;
      mask[Y * SZ + X] = 1;
      cells.push(Y * SZ + X);
      keys.push(ch);
    }
  });
  if (ol) {
    const nb = sq ? N8 : N4;
    cells.forEach((p, i) => {
      if (keys[i] === '_') return;
      const x = p % SZ;
      const y = (p / SZ) | 0;
      for (const [dx, dy] of nb) {
        const X = x + dx;
        const Y = y + dy;
        if (X < 0 || Y < 0 || X >= SZ || Y >= SZ || mask[Y * SZ + X]) continue;
        if (under && g[Y][X] !== '.') continue;
        g[Y][X] = ol;
      }
    });
  }
  cells.forEach((p, i) => {
    g[(p / SZ) | 0][p % SZ] = keys[i] === '_' ? '.' : keys[i];
  });
}

/** Compose layers (bottom first) into a 16x16 sprite. */
function C(...layers: (LayerLike | false | null | undefined)[]): SpriteDef {
  const g = Array.from({ length: SZ }, () => Array<string>(SZ).fill('.'));
  for (const l of layers) if (l) paint(g, l);
  return S(g.map((r) => r.join('')));
}
/** Positioned, outlined layer. */
const at = (art: Art, x: number, y: number, ol: string | false = '0'): Layer => ({ art, x, y, ol });
/** Un-outlined effect layer (glow, sparkle, streaks). */
const fx = (art: Art, x = 0, y = 0): Layer => ({ art, x, y, ol: false });

function mirror(art: Art): string[] {
  const w = Math.max(...art.map((r) => r.length));
  return art.map((r) => r.padEnd(w, '.').split('').reverse().join(''));
}
function recolor(art: Art, map: Readonly<Record<string, string>>): string[] {
  return art.map((r) => r.replace(/./g, (c) => map[c] ?? c));
}

// ---------------------------------------------------------------------------
// shared parts
// ---------------------------------------------------------------------------

/** 12px eight-tooth cog, steel ramp 6/L/N/M. */
const COG: Art = [
  '................',
  '................',
  '......6LLN......',
  '...6L.6LLN.LN...',
  '...6LNNNNNNNM...',
  '....LNNMMNNM....',
  '..6LNNM..LNNNM..',
  '..LNNM....LNNM..',
  '..LNNM....LNMM..',
  '..NNNNN..LNNMM..',
  '....NNNLLNMM....',
  '...NNNNNNNMMM...',
  '...NM.NNMM.MM...',
  '......MMMM......',
  '................',
  '................',
];

// ---------------------------------------------------------------------------
// icons
// ---------------------------------------------------------------------------

export const ICON_SPRITES: SpriteSheet = {
  // ----- UI controls -------------------------------------------------------
  'ico.pause': C([
    '................',
    '................',
    '....776..776....',
    '....765..765....',
    '....765..765....',
    '....765..765....',
    '....765..765....',
    '....765..765....',
    '....765..765....',
    '....765..765....',
    '....765..765....',
    '....765..765....',
    '....765..765....',
    '....655..655....',
    '................',
    '................',
  ]),
  'ico.play': C([
    '................',
    '................',
    '.....77.........',
    '.....776........',
    '.....76666......',
    '.....766666.....',
    '.....76666666...',
    '.....766666666..',
    '.....766666665..',
    '.....76666655...',
    '.....766655.....',
    '.....76655......',
    '.....655........',
    '.....55.........',
    '................',
    '................',
  ]),
  'ico.speed1': C([
    '................',
    '................',
    '....77..........',
    '....776.........',
    '.....776........',
    '......776.......',
    '.......776......',
    '........766.....',
    '........655.....',
    '.......655......',
    '......655.......',
    '.....655........',
    '....655.........',
    '....55..........',
    '................',
    '................',
  ]),
  'ico.speed2': C([
    '................',
    '................',
    '................',
    '..77...77.......',
    '...76...76......',
    '....76...76.....',
    '.....76...76....',
    '......76...76...',
    '......65...65...',
    '.....65...65....',
    '....65...65.....',
    '...65...65......',
    '..55...55.......',
    '................',
    '................',
    '................',
  ]),
  'ico.speed3': C([
    '................',
    '................',
    '................',
    '................',
    '.77..77..77.....',
    '..76..76..76....',
    '...76..76..76...',
    '....76..76..76..',
    '....65..65..65..',
    '...65..65..65...',
    '..65..65..65....',
    '.55..55..55.....',
    '................',
    '................',
    '................',
    '................',
  ]),
  'ico.close': C([
    '................',
    '................',
    '..77........76..',
    '..766......766..',
    '...766....766...',
    '....766..766....',
    '.....766666.....',
    '......6666......',
    '......6665......',
    '.....665665.....',
    '....665..665....',
    '...665....665...',
    '..665......665..',
    '..55........55..',
    '................',
    '................',
  ]),
  'ico.check': C([
    '................',
    '................',
    '................',
    '.............l..',
    '............lk..',
    '...........lkj..',
    '..........lkj...',
    '.........lkj....',
    '..l.....lkj.....',
    '..kl...lkj......',
    '..jkl.lkj.......',
    '...jklkj........',
    '....jkj.........',
    '.....j..........',
    '................',
    '................',
  ]),
  'ico.back': C([
    '................',
    '................',
    '.......7........',
    '......77........',
    '.....776........',
    '....7766........',
    '...77666777777..',
    '..766666666666..',
    '..666666666665..',
    '...66666555555..',
    '....5666........',
    '.....566........',
    '......56........',
    '.......5........',
    '................',
    '................',
  ]),
  'ico.menu': C([
    '................',
    '................',
    '................',
    '..777777777776..',
    '..666666666665..',
    '................',
    '................',
    '..777777777776..',
    '..666666666665..',
    '................',
    '................',
    '..777777777776..',
    '..666666666665..',
    '................',
    '................',
    '................',
  ]),
  'ico.info': C([
    '................',
    '................',
    '......zzzz......',
    '....zzzzzyyy....',
    '...zzzz77yyyy...',
    '...zzyy76yyyy...',
    '..zyyyyyyyyyyx..',
    '..zyyy777yyyyx..',
    '..zyyyy76yyyyx..',
    '..yyyyy76yyyxx..',
    '...yyyy76yyyx...',
    '...yyy7766yxx...',
    '....yyyyyxxx....',
    '......xxxx......',
    '................',
    '................',
  ]),
  'ico.star': C([
    '................',
    '................',
    '.......Oo.......',
    '......OOoo......',
    '......OOoF......',
    '..OOOOOOoooooF..',
    '...oOOOooooFF...',
    '....oOOooooF....',
    '.....OOoooF.....',
    '.....OooooF.....',
    '....OoooooFF....',
    '....Ooo..oFF....',
    '...Ooo....FFf...',
    '...oF......Ff...',
    '................',
    '................',
  ]),
  'ico.settings': C(COG),

  // ----- stat glyphs -------------------------------------------------------
  'ico.gear': C(recolor(COG, { '6': 'A', L: 'B', N: 'C', M: 'c' })),
  'ico.coin': C([
    '................',
    '................',
    '......OOOO......',
    '....OOOOOOoo....',
    '...OOFFFFFFoo...',
    '...OFoooooooo...',
    '..OOFooOOooooF..',
    '..OOFoOOoFooFF..',
    '..OoFoOoFFooFf..',
    '..ooFooFFoooFf..',
    '...oFoooooooF...',
    '...oFooooooFf...',
    '....FFFFFFff....',
    '......ffff......',
    '................',
    '................',
  ]),
  'ico.heart': C([
    '................',
    '................',
    '................',
    '...nnnn..nnnm...',
    '..n76nnnnnnnnm..',
    '..n6nnnnnnnnmm..',
    '..nnnnnnnnnnmm..',
    '..nnnnnnnnnmmm..',
    '...nnnnnnnmmm...',
    '....nnnnnmmm....',
    '.....nnmmmm.....',
    '......mmmr......',
    '.......mr.......',
    '................',
    '................',
    '................',
  ]),
  'ico.skull': C([
    '................',
    '................',
    '.....766665.....',
    '...7766666665...',
    '..776666666665..',
    '..766666666655..',
    '..761116611165..',
    '..661116611155..',
    '..666116611655..',
    '...6666116655...',
    '....56666665....',
    '....61616165....',
    '....55555554....',
    '................',
    '................',
    '................',
  ]),

  // ----- categories --------------------------------------------------------
  'ico.cat_terrain': C([
    '................',
    '................',
    '......7.........',
    '.....765........',
    '.....776........',
    '....u7765..7....',
    '....uu7tss765...',
    '...uut6tssu6s...',
    '...uututsssuss..',
    '..uututtssssus..',
    '..utttutssssss..',
    '..kkkjkkkkjkkk..',
    '..jjjjijjjjjij..',
    '...hiiiiiiiih...',
    '................',
    '................',
  ]),

  // ----- biomes ------------------------------------------------------------
  'ico.biome_forest': C([
    '................',
    '................',
    '.......kkkj.....',
    '......kkjjji....',
    '...jiikjjjji....',
    '..jiikjjjjjii...',
    '..iiihjjjjii....',
    '..hiihjjiiih....',
    '...hhh.iiih.....',
    '....c...dc......',
    '...jkjjjkjjkj...',
    '..jiiijiiiijii..',
    '..dccccccccccb..',
    '...bbbbbbbbbb...',
    '................',
    '................',
  ]),

  // ----- animals -----------------------------------------------------------
  'ico.animal_deer': C([
    '................',
    '..u..u..........',
    '..uu.uu.........',
    '...uuu..........',
    '...ddde.........',
    '..ed0dd.........',
    '..1dddddd.......',
    '.....ddd........',
    '.....deeeeeeA...',
    '.....dddddddAA..',
    '.....ddddddddd..',
    '......cccccccc..',
    '......d.d..d.d..',
    '......c.c..c.c..',
    '................',
    '................',
  ]),

  // ----- resources ---------------------------------------------------------
  'ico.res_gold': C([
    '................',
    '................',
    '................',
    '......OOo.......',
    '.....OOooF......',
    '....uOooFfs.....',
    '...uuttttttss...',
    '..uutttttttsss..',
    '..utttttttOoss..',
    '..utOottttoFss..',
    '..ttoFttttttss..',
    '..tttttOFttsss..',
    '...ttttssssss...',
    '....ssssssss....',
    '................',
    '................',
  ]),

  // ----- overlays ----------------------------------------------------------
  'ico.ov_terrain': C([
    '................',
    '................',
    '....zzyy....zz..',
    '..zzzzyyyyzzzz..',
    '..zzjjiiyyzjzz..',
    '..zjjkjiiiyjjz..',
    '..zjkjjiiiijjz..',
    '..zjjjjiihijzz..',
    '..zzjjjiiiijzz..',
    '..zzzjjiyiijjz..',
    '..zzzzjyyyjjzz..',
    '..zzzzyyyyzzzz..',
    '..zzzzyyyyzzzz..',
    '..zz....yyzz....',
    '................',
    '................',
  ]),
};
