/**
 * Wild/domestic animals and fantasy monsters (ani.*, mon.*)
 *
 * Side view facing RIGHT (the renderer mirrors for leftward motion); flying
 * creatures likewise. Sprites are authored as colored silhouettes and get a
 * 1 px dark outline added by `ol()`, so leave a transparent margin wherever
 * an outline should appear (feet sit on the last row and are not outlined
 * underneath). Frame 2 usually swaps only the leg rows (`walk()`).
 */
import { S, type SpriteDef, type SpriteSheet } from './types';

const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Add a 1 px outline (key `oc`) around every pixel except keys listed in `skip`. */
function ol(rows: string[], skip = '', oc = '0'): string[] {
  const w = Math.max(...rows.map((r) => r.length));
  const g = rows.map((r) => r.padEnd(w, '.'));
  return g.map((row, y) =>
    [...row]
      .map((ch, x) => {
        if (ch !== '.') return ch;
        for (const [dx, dy] of N4) {
          const n = g[y + dy]?.[x + dx];
          if (n && n !== '.' && n !== oc && n !== '0' && !skip.includes(n)) return oc;
        }
        return '.';
      })
      .join(''),
  );
}

/** Two-frame walker: frame 2 replaces the last rows with `legsB`. */
function walk(rows: string[], legsB: string[], fps = 4, skip = ''): SpriteDef {
  const b = rows.slice(0, rows.length - legsB.length).concat(legsB);
  return S([ol(rows, skip), ol(b, skip)], { fps });
}

/** Two explicit frames, both outlined. */
function two(a: string[], b: string[], fps = 4, skip = '', oc = '0'): SpriteDef {
  return S([ol(a, skip, oc), ol(b, skip, oc)], { fps });
}

export const ANIMAL_SPRITES: SpriteSheet = {
  // ------------------------------------------------------------- wild & farm
  'ani.deer': walk(
    [
      '.....u.u..',
      '......u...',
      '......ed..',
      '.....cddd.',
      '.....cd...',
      '.6eddddd..',
      '.ddd55dc..',
      '..d...d...',
      '..c...c...',
    ],
    ['.d...d.d..', '.c.....c..'],
    5,
    'u',
  ),
  'ani.elk': walk(
    [
      '...u.u.u.u.',
      '....uuuuu..',
      '.......u...',
      '.......bc..',
      '......bccc.',
      '......bc...',
      '.eecccccc..',
      '.ecccccbb..',
      '..c....c...',
      '..a....a...',
    ],
    ['.c.c..c.c..', '.a.a..a.a..'],
    4,
    'u',
  ),
  'ani.bison': walk(
    [
      '...........',
      '.....ab....',
      '....abbb.5.',
      '.cccbbbbaa.',
      '.ccccbbbaa.',
      '.cccccbbaa.',
      '..c...b.a..',
      '..a...a....',
    ],
    ['.c.c.b.ba..', '.a.a.a.a...'],
    3,
  ),
  'ani.horse': walk(
    [
      '..........',
      '......bd..',
      '.....bddd.',
      '.....bd...',
      '.beddddd..',
      '.bddddcc..',
      '..d...d...',
      '..b...b...',
    ],
    ['.d...d.d..', '.b.....b..'],
    5,
  ),
  'ani.goat': walk(
    [
      '.........',
      '....33...',
      '.....665.',
      '.....64..',
      '.666666..',
      '.555555..',
      '..4...4..',
    ],
    ['.4..4.4..'],
    5,
  ),
  'ani.boar': walk(
    [
      '..........',
      '..1111....',
      '.2bbbbb...',
      '.2bbbbbbD.',
      '.2bbbbb6..',
      '..b..b....',
    ],
    ['.b..b.b...'],
    5,
  ),
  'ani.rabbit': two(
    ['.......', '...tt..', '....tt.', '.6ttt..', '..ss...'],
    ['...tt..', '....tt.', '.6ttt..', '.s..s..', '.......'],
    5,
  ),
  'ani.wolf': walk(
    [
      '............',
      '.......2.2..',
      '.......333..',
      '.......3344.',
      '.23333333...',
      '.2344443....',
      '...3...3....',
    ],
    ['..3.3.3.3...'],
    6,
  ),
  'ani.bear': walk(
    [
      '............',
      '........c...',
      '...dddddc...',
      '..dcccccccD.',
      '..ccccccbc..',
      '..cbbccbb...',
      '..bb...bb...',
    ],
    ['...bb..bb...'],
    3,
  ),
  'ani.bigcat': walk(
    [
      '............',
      '.......cd...',
      '......cdBB..',
      '.c....cBBA..',
      '.CBBBBBcc...',
      '..BBBBBBB...',
      '..C....C....',
    ],
    ['.C.C..C.C...'],
    5,
  ),
  'ani.mammoth': walk(
    [
      '............',
      '......bbb...',
      '....bcbbbb..',
      '..bbcbbbcbb.',
      '.bcbbcbbbcb.',
      '.bbcbbcbbbc.',
      '.cbbbbbbb6c.',
      '..bb..bb.6c.',
      '..aa..aa..b.',
    ],
    ['.bb...bb.6c.', '.aa...aa..b.'],
    3,
  ),
  'ani.camel': walk(
    [
      '..........',
      '.......BB.',
      '...B..BC..',
      '..BBB.B...',
      '.BBBBBB...',
      '.CBBBBC...',
      '..C...C...',
      '..C...C...',
      '..b...b...',
    ],
    ['.C.C.C.C..', '.C.C.C.C..', '.b.b.b.b..'],
    4,
  ),
  // round 10 addendum: elephant (big ear, trunk, tusk; grey, unlike the brown mammoth)
  'ani.elephant': walk(
    [
      '.............',
      '......333....',
      '..3333432333.',
      '.34333432333.',
      '.33333332336.',
      '.333333322.3.',
      '..33..33...3.',
      '..33..33...3.',
      '..22..22..33.',
    ],
    ['.33...33...3.', '.22...22..33.'],
    3,
  ),
  // water buffalo: low, dark and wide, with swept-back crescent horns
  'ani.buffalo': walk(
    [
      '..........5..',
      '.......55.5..',
      '........1155.',
      '.21111111112.',
      '.2111111112..',
      '..2111112....',
      '..1.....1....',
      '..1.....1....',
    ],
    ['.1.1...1.1...', '.1.1...1.1...'],
    3,
  ),
  // llama: tall upright neck with ears, cream with tan legs, no hump (unlike the camel)
  'ani.llama': walk(
    [
      '......A.A',
      '......AAA',
      '......AAB',
      '.......A.',
      '.......A.',
      '.AAAAAAA.',
      '.BAAAAAB.',
      '..C...C..',
      '..C...C..',
    ],
    ['.C.C.C.C.', '.C.C.C.C.'],
    4,
  ),
  // seal: slate teardrop body, pale belly, flipper; frame 2 humps the body forward
  'ani.seal': two(
    ['...........', '........MM.', '..MMMMMMNM.', '.MNNNNNNMM.', 'MLLLLLLLM..', '.M..M......'],
    ['...........', '....MM..MM.', '..MMNNMMNM.', '.MNNNNNNMM.', 'MLLLLLLLM..', '..M..M.....'],
    3,
  ),
  'ani.sheep': walk(
    ['.........', '..6.6....', '.6666622.', '.6666621.', '.55555...', '..1..1...'],
    ['.1.1.1...'],
    4,
  ),
  'ani.cow': walk(
    [
      '...........',
      '.......5.5.',
      '.......611.',
      '.6116666SS.',
      '.6666116...',
      '.6166666...',
      '..1....1...',
    ],
    ['.1.1..1.1..'],
    3,
  ),
  'ani.chicken': walk(
    ['........', '....n...', '.6..66F.', '.66666..', '..6655..', '...F.F..'],
    ['..F..F..'],
    6,
  ),
  'ani.crocodile': walk(
    [
      '..............',
      '.....g.g.g.h..',
      '...hhhhhhhhhh.',
      '.hhhiiiiiiikk.',
      '....h...h.....',
    ],
    ['...h.....h....'],
    3,
  ),
  'ani.penguin': walk(
    ['......', '..11..', '..16F.', '.1166.', '.1166.', '..166.', '..F.F.'],
    ['.F..F.'],
    4,
  ),
  // small school of fish under the water surface (no outline: seen through water)
  'ani.fish': S([
    ['..NLq..', 'NLq....', '...NLq.'],
    ['...NLq.', '.NLq...', '..NLq..'],
  ], { fps: 3 }),
  'ani.whale': two(
    [
      '...............',
      '...............',
      '.......MMMMM...',
      '.M...MMMNNNNM..',
      '..MMMNNNNNN0NM.',
      '.M..MLLLLLLLM..',
      '......LLLLL....',
    ],
    [
      '..........q.q..',
      '...........q...',
      '.......MMMMM...',
      '.....MMMNNNNM..',
      '.MMMMNNNNNN0NM.',
      '..M.MLLLLLLLM..',
      '......LLLLL....',
    ],
    2,
    'q',
  ),
  // flying bird silhouette, wings up / wings down
  'ani.bird': S([
    ['2...2', '.212.', '..1..'],
    ['.....', '.212.', '2.1.2'],
  ], { fps: 6 }),
  'ani.alienbeast': walk(
    [
      '............',
      '.........G..',
      '...QQQQ..P..',
      '..QGQQGQPPP.',
      '.QQQQQQQPGP.',
      '.PPPPPPPPPP.',
      '..p.p.p.p...',
    ],
    ['.p.p.p.p.p..'],
    5,
  ),
  'ani.alienflyer': two(
    ['...........', '.Q.......Q.', '.QQ.....QQ.', '..QQPGPQQ..', '....PPP....', '.....G.....'],
    ['...........', '...........', '....PGP....', '.QQQPPPQQQ.', '.Q..PPP..Q.', '.....G.....'],
    5,
  ),

  // ------------------------------------------------------------- monsters
  'mon.dragon': two(
    [
      '..................',
      '....n.............',
      '....rn............',
      '....rrn......5....',
      '....rrrn....nmmm..',
      '.....rrrn...mmomm.',
      '......rrnn.mmrrr..',
      '.m...mmmmmmmm.....',
      '..mmmmmmmmmmm.....',
      '.....FFFFFFF......',
      '......r...r.......',
      '..................',
      '..................',
    ],
    [
      '..................',
      '..................',
      '..................',
      '.............5....',
      '............nmmm..',
      '............mmomm.',
      '...........mmrrr..',
      '.m...mmmmmmmm.....',
      '..mmmmmmmmmmm.....',
      '.....FrrrrnFF.....',
      '.....rrrrn.r......',
      '....rrrn..........',
      '....rn............',
    ],
    4,
  ),
  'mon.giant': walk(
    [
      '............',
      '...bbb...cc.',
      '..bbDDD.ccd.',
      '..bDD0D.ccc.',
      '...DEEb..c..',
      '..DDDDDD.c..',
      '.DDDDDDDDc..',
      '.DDcddcDEc..',
      '.D.DDDD.....',
      '.D.cddc.....',
      '.E.cddc.....',
      '...D..D.....',
      '...D..D.....',
      '..EE..EE....',
    ],
    ['..D....D....', '..D....D....', '.EE....EE...'],
    3,
  ),
  'mon.wyrm': two(
    [
      '..............',
      '.....CCCC.....',
      '....CBAABC....',
      '...CBAcABBC...',
      '...CBc..cBBC..',
      '..CBA....CB6r.',
      '..CBc....6rrr.',
      '..CBA.....rr..',
      '.BCBcB........',
      'BCBCBCB.......',
    ],
    [
      '..............',
      '.....CCCC.....',
      '....CBAABC....',
      '...CBAcABBC...',
      '...CBc..cBBC..',
      '..CBA....CBB6.',
      '..CBc....Crr6.',
      '..CBA....6rrr.',
      'B.CBcB....66..',
      'BCBCBCB.B.....',
    ],
    3,
  ),
  'mon.kraken': two(
    [
      '.................',
      '..P...........P..',
      '.PQ...........QP.',
      '.P......P......P.',
      '.PP...PPPPP...PP.',
      '..P..PQQQQQP..P..',
      '..PP.PoQQQoP.PP..',
      '...PPQQQQQQQPP...',
      '...qPPQQQQQPPq...',
      '.qq.qq.qqq.qq.qq.',
    ],
    [
      '.................',
      '.P.............P.',
      '.QP...........PQ.',
      '..P...........P..',
      '.PP...PPPPP...PP.',
      '.P...PQQQQQP...P.',
      '.PP..PoQQQoP..PP.',
      '..PPPQQQQQQQPPP..',
      '..qqPPQQQQQPPqq..',
      'q.qq.qqq.qqq.qq.q',
    ],
    3,
    'q',
  ),
  'mon.treant': two(
    [
      '...jjjjj...',
      '..jjiiijj..',
      '.jiiihiiij.',
      '.iihhihhhi.',
      '..hhghhhh..',
      '....cdc....',
      '...cOcOc...',
      '.d.cdddc.d.',
      '.dccdddccd.',
      '...cdddc...',
      '...cddcc...',
      '...cc.cc...',
      '..cc...cc..',
      '.bb.....bb.',
    ],
    [
      '...jjjjj...',
      '..jjiiijj..',
      '.jiiihiiij.',
      '.iihhihhhi.',
      '..hhghhhh..',
      '....cdc....',
      '...cOcOc...',
      'd..cdddc..d',
      '.dccdddccd.',
      '...cdddc...',
      '...cddcc...',
      '...cc.cc...',
      '...cc..cc..',
      '...bb...bb.',
    ],
    3,
  ),
  'mon.spirit': two(
    [
      '.........',
      '....qqq..',
      '...qHHHq.',
      '...qH1H1.',
      '...qHHHH.',
      '...qHHHq.',
      '..qHHHq..',
      '..qHq....',
      '.qq......',
      '.........',
    ],
    [
      '.........',
      '.........',
      '....qqq..',
      '...qHHHq.',
      '...qH1H1.',
      '...qHHHH.',
      '...qHHHq.',
      '...HHHq..',
      '...qHq...',
      '....qq...',
    ],
    3,
    '',
    'p',
  ),
  'mon.slime': two(
    ['..........', '....jjj...', '...jlkjj..', '..jjj0j0j.', '..jjjjjjj.', '..iiiiiii.'],
    ['..........', '..........', '...jjjjj..', '.jjlkj0j0.', '.jjjjjjjj.', '.iiiiiiii.'],
    3,
  ),
};
