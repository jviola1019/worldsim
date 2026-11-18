/**
 * Sports venues, ports and airports by era (bld.sport.*, bld.port.*, bld.air.*).
 *
 * These are sprite-only keys: they are not simulation building types. The
 * renderer selects them with the helpers in ./select.ts (sportsVenueSprite,
 * portSprite, airportSprite). Multi-tile venues use a 2x2 footprint
 * (fw/fh = 2) and anchor at the bottom-center of the footprint, exactly like
 * bld.ARENA.* and bld.AIRPORT.*. Team-colour keys T/U/V mark roofs, banners
 * and liveries that are tinted per civilization.
 *
 * All designs are original. No real venue, club, league or event marks are
 * depicted; the games complex uses a torch-and-bunting motif, not rings.
 */
import { S, type SpriteSheet } from './types';

/** Author a frame as a multi-line block; whitespace is ignored, '.' is transparent. */
const px = (block: string): string[] =>
  block
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

export const BUILDING_VENUE_SPRITES: SpriteSheet = {
  // ancient: I-shaped stone ball court, sloped walls with stone hoops, banners
  'bld.sport.ball_court': S(
    px(`
      0000000000000000
      0CBB0uuuuuu0BBC0
      0BBB0uTuuTu0BBB0
      0BBB0tttttt0BBB0
      0BBBBssosssBBBB0
      0BBBBAAAAAABBBB0
      0BCBBAAA1AABBCB0
      0BBBBAAAAAABBBB0
      0BBBBtttottBBBB0
      0BBB0uuuuuu0BBB0
      0BBB0uTuuTu0BBB0
      0CBB0ssssss0BBC0
      0000000000000000
    `),
    { fw: 2, fh: 2 },
  ),
  // classical: tiered half-bowl amphitheatre facing a columned stage
  'bld.sport.amphitheatre': S(
    px(`
      ...0T000000T0...
      ...00tttttt00...
      ..0tttssssttt0..
      ..0tsssssssst0..
      .0tssuuuuuusst0.
      0ttsuuussuuustt0
      0tssussssssusst0
      0tsussAAAAssust0
      tssusAAAAAAsusst
      tsuusAAAAAAsuust
      tBBBBBBBBBBBBBBt
      00ususUTTUsusu00
      .0ususussususu0.
      .0tttttttttttt0.
    `),
    { fw: 2, fh: 2 },
  ),
  // classical: chariot track around a central spina with turning posts and starting gates
  'bld.sport.hippodrome': S(
    px(`
      ..0T0tTttTt0T0..
      ..0ttuuuuuutt0..
      .0tuuBBBBBBBut0.
      0ssBBBBB5BBUTBt0
      tsaBB1BB54BB1BBt
      tssBB2uuuuuu2BBt
      tsaBBssssssssBBt
      tssBBBBBBBBBBBBt
      0saBTUBBBBBBBBt0
      .0tuuBBBBBBBut0.
      ..0ttuuuuuutt0..
      ...00tttttt00...
    `),
    { fw: 2, fh: 2 },
  ),
  // medieval: tournament lists with royal stand, tilt barrier and striped tents
  'bld.sport.tourney': S(
    px(`
      ...T.00000..T...
      ...00VTTTU0.....
      ...0VTTTTTU0....
      0000UUUUUUU00000
      jjj0e6e6e6e0jjjj
      jjj0ddddddd0jjjj
      jjjjjjjjjjjjjjjj
      jjjjjjjjjjjjjjjj
      jddddddddddddddj
      j0cccbccccbccc0j
      0T0jjjjjjjjjj0T0
      6T6jjjjjjjjjj6T6
      T6TjijijijijiT6T
      0a000000000000a0
    `),
    { fw: 2, fh: 2 },
  ),
  // modern: football stadium, striped pitch, roofed stands, floodlight masts
  'bld.sport.stadium_football': S(
    px(`
      OO............OO
      3..............3
      3000000000000003
      3TTTTTTTTTTTTTT3
      TTTTTTTTTTTTTTTT
      4UUUUUUUUUUUUUU4
      4555555555555554
      4477777777777744
      457ijji7jjiij754
      447ijji7jjiij744
      456ijj777jiij654
      476ijj777jiij674
      456ijj777jiij654
      447ijji7jjiij744
      457ijji7jjiij754
      4477777777777744
      43U3U3U3U3U3U334
      4333333333333334
      4444444444444444
    `),
    { fw: 2, fh: 2 },
  ),
  // modern: indoor court arena, team roof with an orange ball emblem
  'bld.sport.arena_basketball': S(
    px(`
      ...00UUUUUU00...
      ..0UTTTTTTTTU0..
      .0UTTVVVVVVTTU0.
      0UTVVVFfafVVVTU0
      0TTVVFafafaVVTT0
      UTTVVFffaffVVTTU
      UTTVVaaaaaaVVTTU
      UTTVVfffaffVVTTU
      UTTVVVafafaVVTTU
      0UTTTVVVVVVTTTU0
      0UUTTTTTTTTTTUU0
      .06666666666660.
      .05zLzzLLzzLz50.
      .05zLz1111zLz50.
      .05555555555550.
      ..000000000000..
    `),
    { fw: 2, fh: 2 },
  ),
  // modern: baseball park, fan-shaped outfield, dirt diamond, grandstand and scoreboard
  'bld.sport.ballpark': S(
    px(`
      ..000h1O11000...
      00hhhjn1O1hhh00.
      hhjiiiiiiiiijhh0
      hiijjjjjjjjjiihh
      ijjiiiiiiiiijjij
      jjijjjjjjjjjijji
      iijjiiieiiijjii0
      0jiijje7ejjiij0.
      .0ijieeieeiji0..
      ..0ieeiiieei0...
      ..007eidie700...
      .0T54eeiee45T0..
      .0T555eee555T0..
      .0T550070055T0..
      .0T555000555T0..
      .0T544505445T0..
    `),
    { fw: 2, fh: 2 },
  ),
  // modern: hockey rink, white ice with centre and blue lines, boards and stands
  'bld.sport.ice_rink': S(
    px(`
      0000000000000000
      TTTTTTTTTTTTTTTT
      TTTTTTTTTTTTTTTT
      4UUUUUUUUUUUUUU4
      4444444444444444
      4541111111111454
      44177y7nn7y77144
      4517qy7nn7yq7154
      441nqy7zz7yqn144
      4517qy7nn7yq7154
      44177y7nn7y77144
      4541111111111454
      4333333333333334
      4444444444444444
    `),
    { fw: 2, fh: 2 },
  ),
  // global games stadium: athletics track, infield, torch tower with flame, medal bunting (no rings)
  'bld.sport.games_stadium': S(
    [
      px(`
        ............ofF.
        ............oooo
        ............CCCC
        .............31.
        ....0000000.031.
        ...05TdToT50d31.
        ..0TT555555TT31.
        .0oT55nnnn55TTo0
        0T55nnmmmmnn55T0
        045nnmjjjjmnn540
        45nnmjjiijjmnn54
        45nmjiii6iijmn54
        45nmjkiiiiijmn54
        45nmjiiiiikjmn54
        45nnmjjiijjmnn54
        045nnmjjjjmnn540
        0455nnmmmmnn5540
        .04455nnnn55440.
        ..044555555440..
        ...0044444400...
      `),
      px(`
        .............Ffo
        ............oooo
        ............CCCC
        .............31.
        ....0000000.031.
        ...05TdToT50d31.
        ..0TT555555TT31.
        .0oT55nnnn55TTo0
        0T55nnmmmmnn55T0
        045nnmjjjjmnn540
        45nnmjjiijjmnn54
        45nmjiii6iijmn54
        45nmjkiiiiijmn54
        45nmjiiiiikjmn54
        45nnmjjiijjmnn54
        045nnmjjjjmnn540
        0455nnmmmmnn5540
        .04455nnnn55440.
        ..044555555440..
        ...0044444400...
      `),
    ],
    { fw: 2, fh: 2, fps: 4 },
  ),
  // future: grav-sport dome, glass shell over floating hoops and platforms, pulsing glow
  'bld.sport.grav_dome': S(
    [
      px(`
        ......0000......
        ....00LLLL00....
        ...0LLqqLqLL0...
        ..0LLqqqLqqqL0..
        .0LqLqqqLqHHLL0.
        0LLLLLULLLLLLLL0
        0LqqLGGGGGGqLqL0
        0LqqLGGGGGGqLqL0
        LLLLLLLLLLLLLLLL
        LqqqLHHqLqqTLqqL
        LqqqLqqqTqqqLqqL
        MMMMMMMMMMMMMMMM
        TTTTTTTTTTTTTTTT
        NNNNNNNNNNNNNNNN
        MGMGMGGGGGGMGMGM
        MMMMMGGGGGGMMMMM
        2222222222222222
        0000000000000000
      `),
      px(`
        ......0000......
        ....00LLLL00....
        ...0LLqqLqLL0...
        ..0LLqqqLqqqL0..
        .0LqLqqqLqGGLL0.
        0LLLLLULLLLLLLL0
        0LqqLHHHHHHqLqL0
        0LqqLHHHHHHqLqL0
        LLLLLLLLLLLLLLLL
        LqqqLGGqLqqTLqqL
        LqqqLqqqTqqqLqqL
        MMMMMMMMMMMMMMMM
        TTTTTTTTTTTTTTTT
        NNNNNNNNNNNNNNNN
        MHMHMHHHHHHMHMHM
        MMMMMHHHHHHMMMMM
        2222222222222222
        0000000000000000
      `),
    ],
    { fw: 2, fh: 2, fps: 3 },
  ),
  // prehistoric/ancient: wooden jetty on posts with a moored boat
  'bld.port.jetty': S(
    px(`
      ..000...
      ..cdd...
      .cceec..
      .bcddb..
      ..cee...
      qqcddqqq
      zace0ay0
      ybcd0dd0
      yycecTTc
      yzcddccy
      yyxyxzyy
    `),
  ),
  // medieval to renaissance: stone quay, warehouse, treadwheel crane, moored two-master
  'bld.port.sail_harbour': S(
    px(`
      ..0000....01ccc0
      .0VTTU0.000100b0
      0VTTTTU0uuu1uubu
      0UUUUUU0utudutbt
      0ed00de0uuuuuubu
      0ed00de0uedtutbt
      uuuuuuuuudduucbc
      ssssssssssssssss
      xxxTxxxTxxxxxxxx
      yyy66yy66zyyyyyy
      yy665y6655yyyyyy
      yy6655665yyyyyyy
      yyyy0yyz0yyyyyyy
      y0000000000yyyyy
      y0ddTddTdd0yzyyy
      yy0cccccc0yyyyyy
    `),
    { fw: 2, fh: 2 },
  ),
  // industrial: brick warehouse, steam crane, coal, a funnelled steamer at the quay
  'bld.port.steam': S(
    [
      px(`
        ................
        ...........00000
        .0.0.0....0MMMM1
        0m0m0m00000MN001
        mmmmmmm4444MN441
        mrrrrr54244MN441
        m1m1m1m4114MN444
        mmmmmm5411MMNM44
        3333333333333333
        xxxxxx1Txxxxxxxx
        yyyyyy1Uyyyyyyyy
        yzyy0055000yyyyy
        yy0000000000000y
        yy0n11111111n10y
        yyy0rrrrrrrrr0yy
        yyyyyyyyyyyyyzyy
        yyyyyyyyyyyyyyyy
      `),
      px(`
        ................
        ...........00000
        .0.0.0....0MMMM1
        0m0m0m00000MN001
        mmmmmmm4444MN441
        mrrrrrm4244MN441
        m1m1m554114MN444
        mmmmmm4411MMNM44
        3333333333333333
        xxxxxx1Txxxxxxxx
        yyyyyy1Uyyyyyyyy
        yzyy0055000yyyyy
        yy0000000000000y
        yy0n11111111n10y
        yyy0rrrrrrrrr0yy
        yyyyyyyyyyyyyzyy
        yyyyyyyyyyyyyyyy
      `),
    ],
    { fw: 2, fh: 2, fps: 3 },
  ),
  // modern: container terminal, gantry cranes over stacked boxes and a ship
  'bld.port.container': S(
    px(`
      ..........000000
      .........0TTTTTT
      ........06666666
      .........0T1UT1U
      0000000000T1UT1U
      4nn4ff4oo4T4UT4U
      4mm4mm4CC4T4UT4U
      4TT4nn4ff4T4UT4U
      4UU4mm4mm4T4UT4U
      4zz4TT4nn4T4UT4U
      4yy4UU4mm4T4UT4U
      33313oyni3ynoT3U
      xxx6xmxmrxxmmxxx
      0000000000000000
      0TTTTTTTTTTTTTT0
      y0UUUUUUUUUUUU0y
      yyyyyyyyyyyyzyyy
      yyyyyyyzyyyyyyyy
    `),
    { fw: 2, fh: 2 },
  ),
  // future: offshore sea-launch platform with rocket, service tower and beacon
  'bld.port.sea_launch': S(
    [
      px(`
        .....070.0Mn0...
        .....060.0nM0...
        ....067600Mn0...
        ....0666MMMM0...
        ....06T600Mn0...
        ....06U600nM0...
        ....0666MMMn0...
        ....06T600nM000.
        ....066600Mn0L50
        0000010100nM0550
        o1o1o1o1o1o1o1o1
        NNNNNNNNNNNNNNNN
        MMMMMMMMMMMMMMMM
        qqMqqqMqqMqqqMqq
        yyMyyyMyyMyyyMyy
        yzMyyyMyyMyyyMyy
        yyMyyyMyyMyyyMyy
        yyMyyyMzyMyyyMyy
        yyxyyyxyyxyyyxyy
        yyyzyyyyyyyzyyyy
      `),
      px(`
        .....070.0MO0...
        .....060.0nM0...
        ....067600Mn0...
        ....0666MMMM0...
        ....06T600Mn0...
        ....06U600nM0...
        ....0666MMMn0...
        ....06T600nM000.
        ....066600Mn0L50
        0000010100nM0550
        o1o1o1o1o1o1o1o1
        NNNNNNNNNNNNNNNN
        MMMMMMMMMMMMMMMM
        qqMqqqMqqMqqqMqq
        yyMyyyMyyMyyyMyy
        yzMyyyMyyMyyyMyy
        yyMyyyMyyMyyyMyy
        yyMyyyMzyMyyyMyy
        yyxyyyxyyxyyyxyy
        yyyzyyyyyyyzyyyy
      `),
    ],
    { fw: 2, fh: 2, fps: 2 },
  ),
  // early aviation: grass airstrip, quonset hangar, windsock, parked biplane
  'bld.air.airfield': S(
    px(`
      jjjjjjjjjj00jjjj
      jjj0000jj0VU0jjj
      jj0LLLN0j0VU0jjj
      j0LLNN0U00VU000j
      j0NNMM0UTTVUbT40
      j0N1110U00VU000j
      j3f6jjCCj0VU0jjj
      j3jjfjdjj0VU0jjj
      k3kkkkkkkk00kkkk
      k3kklkklkklkklkk
      kkkkkkkkkkkkkkkk
      iiiiiiiiiiiiiiii
      iiiiiiiiiiiiiiii
    `),
    { fw: 2, fh: 2 },
  ),
  // mid century: regional airport, low terminal, control tower, single runway, prop airliner
  'bld.air.regional': S(
    px(`
      jjjjjjjjjjjj000j
      jjjjjjjjjjj0LzL0
      jjjjjjjjjjj0zzz0
      0000000000jj040j
      0666666660jj040j
      0TTTTTTTT0jj040j
      0zLzLzL0L0jj050j
      05555a06003j050j
      j3303302603jjjjj
      j30T00066000jjjj
      330T6666666L0333
      220T000660002222
      2660260260622662
      2222220602222222
      iiiiiii0iiiiiiii
    `),
    { fw: 2, fh: 2 },
  ),
  // modern: international airport, glass terminal with wave roof, tower beacon, jetliner, marked runway
  'bld.air.international': S(
    [
      px(`
        .............0n0
        .............000
        ............0zLz
        00.000000000.0z0
        4406666666660454
        40666TTTTT666054
        0zLzLzLzLzLzLz44
        0zzzzzzzzzzzzz44
        0555555555555540
        4444540045444444
        4444540T05444444
        4444000666666044
        44440T6666666744
        3333000666666033
        7222220T02222227
        2772770072772772
        7222222222222227
        2222222222222222
        iiiiiiiiiiiiiiii
      `),
      px(`
        .............0O0
        .............000
        ............0zLz
        00.000000000.0z0
        4406666666660454
        40666TTTTT666054
        0zLzLzLzLzLzLz44
        0zzzzzzzzzzzzz44
        0555555555555540
        4444540045444444
        4444540T05444444
        4444000666666044
        44440T6666666744
        3333000666666033
        7222220T02222227
        2772770072772772
        7222222222222227
        2222222222222222
        iiiiiiiiiiiiiiii
      `),
    ],
    { fw: 2, fh: 2, fps: 2 },
  ),
  // future: vertiport tower with cantilevered landing decks and a parked flying car
  'bld.air.vertiport': S(
    [
      px(`
        .0TVVHVT0.
        00TTTTTT00
        5G555555G5
        3333333333
        000NMMM000
        ..0NGGM0..
        ..0NMMM0..
        ..0NMMM0..
        000NGGM000
        5G555555G5
        3333333333
        000NGGM000
        ..0NMMM0..
        ..0NMMM0..
        ..0NGGM0..
        ..0NMMM0..
        .0zzLzzz0.
        .0zzLzzz0.
        .0zzLzzz0.
        0222222220
      `),
      px(`
        .0TVVHVT0.
        00TTTTTT00
        5H555555H5
        3333333333
        000NMMM000
        ..0NHHM0..
        ..0NMMM0..
        ..0NMMM0..
        000NHHM000
        5H555555H5
        3333333333
        000NHHM000
        ..0NMMM0..
        ..0NMMM0..
        ..0NHHM0..
        ..0NMMM0..
        .0zzLzzz0.
        .0zzLzzz0.
        .0zzLzzz0.
        0222222220
      `),
    ],
    { fps: 2 },
  ),
  // future: spaceplane port, glowing runway guide lights, hangar dome, tanks, delta-wing spaceplane
  'bld.air.spaceplane': S(
    [
      px(`
        3333333333333333
        333333333336L333
        33666666333LL36L
        36666666633LL3LL
        TTTTTTTTTT3LL3LL
        66511115663LL3LL
        6651111566333333
        6651111566333333
        3333333333333333
        3333333033333333
        G1G1G10660G1G1G1
        1110006666600111
        1440T66666666741
        1110006666600111
        1G1G1G06601G1G1G
        2222222022222222
      `),
      px(`
        3333333333333333
        333333333336L333
        33666666333LL36L
        36666666633LL3LL
        TTTTTTTTTT3LL3LL
        66511115663LL3LL
        6651111566333333
        6651111566333333
        3333333333333333
        3333333033333333
        1G1G1G06601G1G1G
        1110006666600111
        1440T66666666741
        1110006666600111
        G1G1G10660G1G1G1
        2222222022222222
      `),
    ],
    { fw: 2, fh: 2, fps: 3 },
  ),
};
