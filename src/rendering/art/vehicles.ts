/**
 * Boats, ships, carts, trains, cars, aircraft, rockets (veh.*)
 *
 * Water and land vehicles: side view facing RIGHT (the renderer mirrors for
 * leftward motion). Aircraft: top-down facing RIGHT (the balloon is a side
 * view). Space craft: rockets/shuttle stand upright, station is top-down.
 * Team keys T/U/V mark sails, hulls and bodies so ownership reads at a glance.
 *
 * Sprites are authored as colored silhouettes; `ol()` adds the 1 px dark
 * outline. Keys passed in `skip` (masts, ropes, rotor blades, smoke, flames,
 * glow, foam) stay thin and un-outlined.
 */
import { S, type SpriteDef, type SpriteSheet } from './types';

const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Add a 1 px dark outline around every pixel except keys listed in `skip`. */
function ol(rows: string[], skip = ''): string[] {
  const w = Math.max(...rows.map((r) => r.length));
  const g = rows.map((r) => r.padEnd(w, '.'));
  return g.map((row, y) =>
    [...row]
      .map((ch, x) => {
        if (ch !== '.') return ch;
        for (const [dx, dy] of N4) {
          const n = g[y + dy]?.[x + dx];
          if (n && n !== '.' && n !== '0' && !skip.includes(n)) return '0';
        }
        return '.';
      })
      .join(''),
  );
}

/** Single-frame vehicle. */
function one(rows: string[], skip = '', opts: Partial<SpriteDef> = {}): SpriteDef {
  return S(ol(rows, skip), opts);
}

/** Two-frame vehicle: frame 2 is frame 1 with the given rows replaced. */
function anim(rows: string[], changes: Record<number, string>, fps = 6, skip = '', opts: Partial<SpriteDef> = {}): SpriteDef {
  const b = rows.map((r, i) => changes[i] ?? r);
  return S([ol(rows, skip), ol(b, skip)], { fps, ...opts });
}

export const VEHICLE_SPRITES: SpriteSheet = {
  // =================================================================== water
  'veh.raft': one(
    ['.........', '....a....', '....aTV..', '....aTT..', '....a....', '.deeeeed.', '.ccccccc.'],
    'a',
  ),
  'veh.canoe': one(['...........', '.....S.....', '.....T.....', '.d..cTTce.d', '..ddddddd..'], ''),
  'veh.galley': anim(
    [
      '.......a.......',
      '....TTTTTTT....',
      '....VVVVVVV....',
      '....UUUUUUU....',
      '.d.....a.......',
      '.ddddddddddddd.',
      '.dcdcdcdcdcdcd.',
      '..ccccccccccco.',
      '..e.e.e.e.e....',
    ],
    { 8: '...e.e.e.e.e...' },
    3,
    'ae',
  ),
  'veh.longship': one(
    [
      '.......a.......',
      '....TVTVTVT....',
      '....TVTVTVT....',
      '.d..TVTVTVT..d.',
      '.d.....a.....d.',
      '..dTVTVTVTVTd..',
      '..ddddddddddd..',
      '...ccccccccc...',
    ],
    'a',
  ),
  'veh.cog': one(
    [
      '......a.....',
      '...TTTTTTT..',
      '...VVVVVVV..',
      '...TTTTTTT..',
      '...UUUUUUU..',
      '.eee..a.....',
      '.ddd..a...d.',
      '.dddddddddd.',
      '.ddcdcdcddd.',
      '..cccccccc..',
    ],
    'a',
  ),
  'veh.caravel': one(
    [
      '.......a.......',
      '......Ta.......',
      '.....TTa....a..',
      '....TTVa...Ta..',
      '...TTTVa..TVa..',
      '..TTTTVa.TTVa..',
      '.ee....a....a..',
      '.ddddddddddddd.',
      '..ccccccccccc..',
    ],
    'a',
  ),
  'veh.galleon': one(
    [
      '....a...a........',
      '...TTT.TTT...a...',
      '...VVV.VVV..TTT..',
      '..TTTTTTTTT.VVV..',
      '..VVVVVVVVV.TTT..',
      '..UUUUUUUUU..a...',
      '.ee.a...a....a...',
      '.ddd.........dd..',
      '.ddddddddddddddd.',
      '.do1o1o1o1o1o1dd.',
      '.dddddddddddddd..',
      '..cccccccccccc...',
    ],
    'a',
  ),
  'veh.steamship': one(
    [
      '.....45..........',
      '......54.........',
      '......11.........',
      '......TT....a....',
      '......TT....a....',
      '..66666666666....',
      '.111111111111111.',
      '.1q1q1q1q1q1q11..',
      '..TTTTTTTTTTTT...',
    ],
    '45a',
  ),
  'veh.ironclad': one(
    [
      '...........45...',
      '...........54...',
      '...........11...',
      '...NNNN....TT...',
      '...NLLN111.TT...',
      '.MMMMMMMMMMMMMM.',
      '..MNMNMNMNMNMM..',
    ],
    '45',
  ),
  'veh.battleship': one(
    [
      '.........3...........',
      '........LNN..........',
      '........L1N.TT.......',
      '.......LNNNNTT..NN11.',
      '.11NN..NNNNNNN.NN111.',
      '.NNNNNNNNNNNNNNNNNN..',
      '.MMMMMMMMMMMMMMMMM...',
      '..UUUUUUUUUUUUUU.....',
    ],
    '3',
  ),
  'veh.cargo': one(
    [
      '.66.................',
      '.616................',
      '.666nnyyooTTiiffnn..',
      '.666yyTTffnnooyyTT..',
      '.666ooiinnyyTTnnoo2.',
      '.222222222222222222.',
      '..UUUUUUUUUUUUUUU...',
    ],
  ),
  'veh.tanker': one(
    [
      '.66.................',
      '.616................',
      '.666..f...f...f.....',
      '.66622222222222222..',
      '.TTTTTTTTTTTTTTTTT2.',
      '..UUUUUUUUUUUUUUU...',
    ],
  ),
  'veh.submarine': one(
    ['.......3.........', '......222........', '......2T2........', '..22222222222222.', '.q2MMMMMMMMMMMM2q'],
    '3q',
  ),
  'veh.carrier': one(
    [
      '..............3......',
      '.............NNN.....',
      '.............N1N.....',
      '..5.5........NTN.....',
      '.MMMMMMMMMMMMMMMMMMM.',
      '..NNNNNNNNNNNNNNNNN..',
      '...UUUUUUUUUUUUUUU...',
    ],
    '3',
  ),
  'veh.droneship': one(
    [
      '.................',
      '........LL.......',
      '......NNNNNG.....',
      '..TTTTTTTTTTTTT..',
      '.UGGGGGGGGGGGGGT.',
      '..MMMMMMMMMMMM...',
    ],
  ),

  // ==================================================================== land
  'veh.cart': one(
    [
      '.................',
      '..VTTT.......5.5.',
      '.dTTTTd......ccc.',
      '.dddddd..ccccc66.',
      '.dbbbbdccccccc...',
      '..beeb...ccccc...',
      '..beeb....c..c...',
      '...bb.....c..c...',
    ],
  ),
  'veh.wagon': anim(
    [
      '.................',
      '..5665...........',
      '.566665......bd..',
      '.5666665....bddd.',
      '.5666665....bd...',
      '.TTTTTTTceddddd..',
      '.UUUUUUU.ddddcc..',
      '.beb.beb.d...d...',
      '..b...b..b...b...',
    ],
    { 7: '.beb.beb.d.d.d...', 8: '..b...b..b.....b.' },
    5,
  ),
  'veh.caravan': anim(
    [
      '..................',
      '.......BB......BB.',
      '...T..BC...T..BC..',
      '..TVT.B...TVT.B...',
      '.BTTTBB..BTTTBB...',
      '.CBBBBC..CBBBBC...',
      '..C...C...C...C...',
      '..C...C...C...C...',
      '..b...b...b...b...',
    ],
    { 6: '.C.C.C.C.C.C.C.C..', 7: '.C.C.C.C.C.C.C.C..', 8: '.b.b.b.b.b.b.b.b..' },
    4,
  ),
  'veh.catapult': one(
    [
      '............',
      '.........4e.',
      '........dee.',
      '...d...d....',
      '...dd.d.....',
      '..dTTdd.....',
      '.cccccccccc.',
      '..bb....bb..',
    ],
  ),
  'veh.cannon': one(['..........', '..2222222.', '..1111111.', '.TTdddT...', '.U.dbd....', '...ddd....']),
  'veh.artillery': one(
    [
      '.............',
      '.....2222222.',
      '...TTT111111.',
      '..TTVTT......',
      '.UUTTT1......',
      'U...1M1......',
      '.....1.......',
    ],
  ),
  'veh.train_steam': anim(
    [
      '..........56.....',
      '...........5.....',
      '.TTTT......11....',
      '.TqqT...o..11....',
      '.TTTT1111111111..',
      '.UUUUTTTTTTTTT1..',
      '.111111111111111.',
      '..MLM.MLM.MLM.M..',
      '...M...M...M.....',
    ],
    { 0: '.........5665....', 1: '..........56.....', 7: '..LML.LML.LML.M..' },
    5,
    '56',
  ),
  'veh.train_car': one(
    ['...............', '.2222222222222.', '.TqqTqqTqqTqqT.', '.TTTTTTTTTTTTT.', '.1111111111111.', '..MM.......MM..'],
  ),
  'veh.train_electric': one(
    [
      '......3.3.......',
      '.......3........',
      '.22222222222222.',
      '.TTTTTTTTTTTTqq.',
      '.TVVVVVVVVVVVTq.',
      '.TTTTTTTTTTTTTT.',
      '.11111111111111.',
      '..MM.MM...MM.MM.',
    ],
    '3',
  ),
  'veh.train_hsr': one(
    [
      '...................',
      '.6666666666666.....',
      '.6qq6qq6qq6qq6qq66.',
      '.TTTTTTTTTTTTTTTTT.',
      '.555555555555555...',
      '..1.1......1.1.....',
    ],
  ),
  'veh.maglev': anim(
    [
      '...................',
      '..LLLLLLLLLLLL.....',
      '.LqqqqqqqqqqqqLL...',
      '.TTTTTTTTTTTTTTTTL.',
      '..NNNNNNNNNNNNNNN..',
      '...GGGGGGGGGGGGG...',
    ],
    { 5: '...HGHGHGHGHGHGH...' },
    6,
    'GH',
  ),
  'veh.car': one(['........', '..TTT...', '.TqqTTT.', '.UTTTTU.', '..1..1..']),
  'veh.truck': one(
    ['............', '.uuuuuuu....', '.uuuuuuuTq..', '.tttttttTTT.', '.1111111111.', '..11...11...'],
  ),
  'veh.bus': one(
    ['..............', '.TTTTTTTTTTTT.', '.qqTqqTqqTqqq.', '.TTTTTTTTTTTT.', '.UUUUUUUUUUUU.', '..11......11..'],
  ),
  'veh.tank': anim(
    [
      '.............',
      '....VTTT2222.',
      '...TTTTT.....',
      '.VTTTTTTTTTT.',
      '.UUUUUUUUUUU.',
      '.13131313131.',
      '..111111111..',
    ],
    { 5: '.31313131313.' },
    6,
  ),
  'veh.apc': one(['............', '....TT22....', '..VTTTTTTT..', '.TTTTTTTTTT.', '.UUUUUUUUUU.', '..1.1..1.1..']),
  'veh.hovercar': anim(
    ['..........', '...qqT....', '..VTTTTTT.', '.UTTTTTTU.', '..GHGHGG..', '...G..G...'],
    { 4: '..HGHGHH..', 5: '..G....G..' },
    6,
    'GH',
  ),

  // ===================================================================== air
  'veh.balloon': one(
    [
      '.........',
      '...TVT...',
      '..TTVTT..',
      '.UTTVTTU.',
      '.UTTVTTU.',
      '.UTTVTTU.',
      '..UTVTU..',
      '...UVU...',
      '...3.3...',
      '...3.3...',
      '...ccc...',
      '...ddd...',
    ],
    '3',
  ),
  'veh.biplane': anim(
    [
      '............',
      '.....VTTU...',
      '.....TTTU...',
      '.d...TTTU..4',
      '.ddddTTTUde4',
      '.d...TTTU..4',
      '.....TTTU...',
      '.....UUUU...',
      '............',
    ],
    { 2: '.....TTTU..3', 3: '.d...TTTU...', 4: '.ddddTTTUde4', 5: '.d...TTTU...', 6: '.....TTTU..3' },
    10,
    '34',
  ),
  'veh.airliner': one(
    [
      '.....5.........',
      '.....55........',
      '......5M.......',
      '.5.....55......',
      '.566666666666..',
      '.5TTTTTTTTTTTq.',
      '.566666666666..',
      '.5.....55......',
      '......5M.......',
      '.....55........',
      '.....5.........',
    ],
  ),
  'veh.jet': one(
    ['..........', '..U.......', '..TT......', '.UTTT.....', 'FTTTTTTqV.', '.UTTT.....', '..TT......', '..U.......', '..........'],
    'F',
  ),
  'veh.bomber': one(
    [
      '.....UU........',
      '.....TTM.......',
      '.U...TTM.......',
      '.TTTTTTTTTTTT..',
      '.VVVVVVVVVVVVq.',
      '.TTTTTTTTTTTT..',
      '.U...TTM.......',
      '.....TTM.......',
      '.....UU........',
    ],
  ),
  'veh.helicopter': anim(
    [
      '.4.........4.',
      '..4.......4..',
      '...4.....4...',
      '....4TTT4....',
      '..4.VT4TTq...',
      '.UUUTTT4Tqq..',
      '..4.TT4TTq...',
      '....4UUU4....',
      '...4.....4...',
      '..4.......4..',
      '.4.........4.',
    ],
    {
      0: '.......4.....',
      1: '.......4.....',
      2: '.......4.....',
      3: '.....TT4T....',
      4: '..4.VTT4Tq...',
      5: '.UU444444444.',
      6: '..4.TTT4Tq...',
      7: '.....UU4U....',
      8: '.......4.....',
      9: '.......4.....',
      10: '.......4.....',
    },
    10,
    '4',
  ),
  'veh.drone': anim(
    ['44...44', '.2...2.', '..TTT..', '..TGT..', '..TTT..', '.2...2.', '44...44'],
    { 0: '4.....4', 1: '42...24', 3: '..THT..', 5: '42...24', 6: '4.....4' },
    8,
    '24',
  ),
  'veh.airship': one(
    [
      '.U......M........',
      '.UU.VVVVVVVVV....',
      '..TTTTTTTTTTTTT..',
      '.UTTTTTTTTTTTTTT.',
      '..TTTTTTTTTTTTT..',
      '.UU.UUUUUUUUU....',
      '.U......M........',
    ],
  ),

  // =================================================================== space
  'veh.rocket': anim(
    [
      '.......',
      '...6...',
      '..656..',
      '..TTT..',
      '..6q6..',
      '..666..',
      '..666..',
      '..TTT..',
      '..666..',
      '.T665T.',
      '.TMMMT.',
      '...o...',
      '..FoF..',
      '...F...',
      '...f...',
    ],
    { 11: '..oOo..', 12: '.FoOoF.', 13: '..FoF..', 14: '..f.f..' },
    8,
    'fFoO',
  ),
  'veh.missile': anim(
    ['.....', '..n..', '..5..', '..5..', '..T..', '..5..', '..5..', '.T5T.', '..F..', '..f..'],
    { 8: '..o..', 9: '..F..' },
    8,
    'fFo',
  ),
  'veh.satellite': one(['...........', '.....5.....', '.yxy.o.yxy.', '.xyxoToxyx.', '.yxy.o.yxy.', '...........']),
  'veh.shuttle': one(
    [
      '.........',
      '....1....',
      '...616...',
      '...6q6...',
      '...666...',
      '...6T6...',
      '...666...',
      '...666...',
      '..66666..',
      '.6666666.',
      '.66T6T66.',
      '.1166611.',
      '...MMM...',
      '...1.1...',
    ],
  ),
  'veh.station': one(
    [
      '.................',
      '........G........',
      '.......LLL.......',
      '.yx....LGL....xy.',
      '.xy....TTT....yx.',
      '.yx....LLL....xy.',
      '.xyNNNNLHLNNNNyx.',
      '.yx....LLL....xy.',
      '.xy....TTT....yx.',
      '.yx....LGL....xy.',
      '.......LLL.......',
      '........G........',
      '.................',
    ],
  ),
  'veh.colony_ship': anim(
    [
      '..................',
      '.......LLLLL......',
      '......LNTTTNL.....',
      '..MM..LNLLLNL.LL..',
      'HGMMMMMMMMMMMMMLq.',
      'HGMMNNNNNNNNNNNLL.',
      '..MM..LNLLLNL.LL..',
      '......LNTTTNL.....',
      '.......LLLLL......',
      '..................',
    ],
    { 4: 'GHMMMMMMMMMMMMMLq.', 5: 'GHMMNNNNNNNNNNNLL.' },
    6,
    'GH',
  ),
  'veh.space_elevator_car': one(['...3...', '...3...', '.LLLLL.', '.LGTGL.', '.LGTGL.', '.NNNNN.', '...3...', '...3...'], '3'),
};
