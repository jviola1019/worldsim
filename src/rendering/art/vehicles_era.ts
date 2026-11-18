/**
 * Era transport (veh.*): riders, carriages, bicycles, trams, cars, buses,
 * lorries, aircraft, personal flyers and ships, each with 2-4 animation
 * frames (wheels, legs, rotors, paddles, wakes, thrusters).
 *
 * Conventions match ./vehicles.ts: side views face RIGHT (the renderer
 * mirrors for leftward motion), aircraft are drawn top-down nose-right,
 * bodies and liveries use team-colour keys T/U/V. See ./select.ts
 * (vehicleSprite) for which era uses which key on roads, rails, water and air.
 */
import { S, type SpriteSheet } from './types';

/** Author a frame as a multi-line block; whitespace is ignored, '.' is transparent. */
const px = (block: string): string[] =>
  block
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

export const ERA_VEHICLE_SPRITES: SpriteSheet = {
  // any era with horses: a mounted traveller, 4-frame gallop
  'veh.horse_rider': S(
    [
      px(`
        ......0......
        .....0bS..0..
        .....0TTS0d0.
        ..0000TT0ddd0
        .0cddddUdddE0
        0c0ddddUddd0.
        .00ddddddd0..
        ..0d0d00d0d0.
        ..0101001010.
        ...0.0..0.0..
      `),
      px(`
        ......0......
        .....0bS..0..
        .....0TTS0d0.
        ..0000TT0ddd0
        .0cddddUdddE0
        0c0ddddUddd0.
        .00ddddddd00.
        .0d000dd000d0
        010...010.010
        .0.....0...0.
      `),
      px(`
        ......0......
        .....0bS..0..
        .....0TTS0d0.
        ..0000TT0ddd0
        .0cddddUdddE0
        0c0ddddUddd0.
        .00ddddddd0..
        ...0dd000dd0.
        ...0110.0110.
        ....00...00..
      `),
      px(`
        ......0......
        .....0bS..0..
        .....0TTS0d0.
        ..0000TT0ddd0
        .0cddddUdddE0
        0c0ddddUddd0.
        .00ddddddd00.
        ..0d0d00d00d0
        .010.01010010
        ..0...0.0..0.
      `),
    ],
    { fps: 8 },
  ),
  // pre-industrial to early industrial: one-horse hooded buggy
  'veh.buggy': S(
    [
      px(`
        ..00000..........
        .0TTTTT0.....0...
        0TVVVVVT0...0d00.
        0T0bS00T00000ddd0
        0T0TTS0T0ddddddE0
        0UUUUUUUcddddd00.
        .01000c00ddddd00.
        01410.0.0d0d0d0d0
        .010....010101010
        ..0......0.0.0.0.
      `),
      px(`
        ..00000..........
        .0TTTTT0.....0...
        0TVVVVVT0...0d00.
        0T0bS00T00000ddd0
        0T0TTS0T0ddddddE0
        0UUUUUUUcddddd00.
        .01000c00ddddd00.
        .444..0.0dd000dd0
        .010...010010010.
        ..0.....0..0..0..
      `),
    ],
    { fps: 6 },
  ),
  // renaissance to industrial: horse-drawn passenger coach with luggage rack
  'veh.carriage': S(
    [
      px(`
        ...0000..............
        ..0111100............
        .0TTTTTTT0......0....
        .0TqqTqqT00....0d00..
        .0TqqTqqTbS00000ddd0.
        .0TTTTTTTTT0dddddddE0
        .0UUUUUUUUcddddddd00.
        .01100000110ddddd00..
        014410.01441d0d0d0d0.
        .0110...011010101010.
        ..00.....00.0.0.0.0..
      `),
      px(`
        ...0000..............
        ..0111100............
        .0TTTTTTT0......0....
        .0TqqTqqT00....0d00..
        .0TqqTqqTbS00000ddd0.
        .0TTTTTTTTT0dddddddE0
        .0UUUUUUUUcddddddd00.
        .01100000110ddddd00..
        011110.01111dd000dd0.
        .0110...01110010.010.
        ..00.....000..0...0..
      `),
    ],
    { fps: 6 },
  ),
  // industrial onward: cyclist on a safety bicycle
  'veh.bicycle': S(
    [
      px(`
        ...00...
        ..0bS0..
        ..0TTS0.
        ..0TT0..
        .0UU10..
        010U010.
        .414410.
        010.010.
        .0...0..
      `),
      px(`
        ...00...
        ..0bS0..
        ..0TTS0.
        ..0TT0..
        .0UU10..
        01U0010.
        014414..
        010.010.
        .0...0..
      `),
    ],
    { fps: 8 },
  ),
  // industrial to modern: street tram with pantograph (spark on frame 2)
  'veh.tram': S(
    [
      px(`
        .................
        ........4........
        .......4.4.......
        ..0000004000000..
        .0TTTTTTTTTTTTT0.
        0TqqTqqTqqTqqTqq0
        0TqqTqqTqqTqqTqq0
        0VVVVVVVVVVVVVVV0
        0UUUUUUUUUUUUUUU0
        .014100000001410.
        ..0.0.......0.0..
      `),
      px(`
        .................
        .......O4O.......
        .......4.4.......
        ..0000004000000..
        .0TTTTTTTTTTTTT0.
        0TqqTqqTqqTqqTqq0
        0TqqTqqTqqTqqTqq0
        0VVVVVVVVVVVVVVV0
        0UUUUUUUUUUUUUUU0
        .041400000004140.
        ...0.........0...
      `),
    ],
    { fps: 6 },
  ),
  // modern: diesel locomotive with twin cabs
  'veh.train_diesel': S(
    [
      px(`
        ..0000000000000000...
        .0TTTTTTTTTTTTTTTT0..
        0TTqqTTTTTTTTTTTqqT0.
        0TTqqT55555555TTqqT0.
        0VVVVVVVVVVVVVVVVVV0.
        0UUUUUUUUUUUUUUUUUU0.
        011111111111111111110
        .01410141000014101410
        ..000.000....000.000.
      `),
      px(`
        ..0000000000000000...
        .0TTTTTTTTTTTTTTTT0..
        0TTqqTTTTTTTTTTTqqT0.
        0TTqqT55555555TTqqT0.
        0VVVVVVVVVVVVVVVVVV0.
        0UUUUUUUUUUUUUUUUUU0.
        011111111111111111110
        .04140414000041404140
        ..000.000....000.000.
      `),
    ],
    { fps: 6 },
  ),
  // early industrial motor car, spoked wheels
  'veh.car_early': S(
    [
      px(`
        ...0000.....
        ..011110....
        ..0T00T00...
        .0TTqqTTT00.
        .0TTqqTTTTo0
        0UUUUUUUUUU0
        .01410001410
        ..0.0...0.0.
      `),
      px(`
        ...0000.....
        ..011110....
        ..0T00T00...
        .0TTqqTTT00.
        .0TTqqTTTTo0
        0UUUUUUUUUU0
        .0414000414.
        ...0.....0..
      `),
    ],
    { fps: 6 },
  ),
  // early industrial lorry with a crated load
  'veh.lorry': S(
    [
      px(`
        .....0000.....
        .0000dcdc0....
        0TTT0dcdc0....
        0TqT0cccc000..
        0TTTUUUUUUUU0.
        0UUUUUUUUUUU0.
        .014100001410.
        ..0.0....0.0..
      `),
      px(`
        .....0000.....
        .0000dcdc0....
        0TTT0dcdc0....
        0TqT0cccc000..
        0TTTUUUUUUUU0.
        0UUUUUUUUUUU0.
        .04140000414..
        ...0......0...
      `),
    ],
    { fps: 6 },
  ),
  // atomic-age finned cruiser with bubble windscreen
  'veh.car_atomic': S(
    [
      px(`
        ....0000......
        ...0qqqT0000..
        .00qqqqTTTTV0.
        0TTTTTTTTTTTT0
        0VUUUUUUUUUUO0
        .014100001410.
        ..0.0....0.0..
      `),
      px(`
        ....0000......
        ...0qqqT0000..
        .00qqqqTTTTV0.
        0TTTTTTTTTTTT0
        0VUUUUUUUUUUO0
        .041400004140.
        ...0......0...
      `),
    ],
    { fps: 6 },
  ),
  // modern hatchback
  'veh.car_modern': S(
    [
      px(`
        ....0000....
        ...0TTTT0...
        ..0TqqTqT00.
        .0TTTTTTTTT0
        0OUUUUUUUUn0
        .0141001410.
        ..0.0..0.0..
      `),
      px(`
        ....0000....
        ...0TTTT0...
        ..0TqqTqT00.
        .0TTTTTTTTT0
        0OUUUUUUUUn0
        .0414004140.
        ...0....0...
      `),
    ],
    { fps: 6 },
  ),
  // modern low-floor city bus with panoramic windows
  'veh.bus_modern': S(
    [
      px(`
        ..00000000000000..
        .0TTTTTTTTTTTTTT0.
        0TqqqqTqqqqTqqqqq0
        0TqqqqTqqqqTqqqqq0
        0VVVVVVVVVVVVVVVV0
        0UUUUUUUUUUUUUUUn0
        .0141000000001410.
        ..0.0........0.0..
      `),
      px(`
        ..00000000000000..
        .0TTTTTTTTTTTTTT0.
        0TqqqqTqqqqTqqqqq0
        0TqqqqTqqqqTqqqqq0
        0VVVVVVVVVVVVVVVV0
        0UUUUUUUUUUUUUUUn0
        .0414000000004140.
        ...0..........0...
      `),
    ],
    { fps: 6 },
  ),
  // modern articulated lorry with team-liveried cab
  'veh.semi_truck': S(
    [
      px(`
        .00000000000..00..
        05555555555500TT0.
        0555555555550TqqT0
        05TT555555550TqqT0
        055555555555TTTTT0
        022222222222222220
        .0141014100001414.
        ..0.0.0.0....0.0..
      `),
      px(`
        .00000000000..00..
        05555555555500TT0.
        0555555555550TqqT0
        05TT555555550TqqT0
        055555555555TTTTT0
        022222222222222220
        .04140414000041410
        ...0...0......0.0.
      `),
    ],
    { fps: 6 },
  ),
  // mid-century twin-prop airliner (props spin)
  'veh.prop_airliner': S(
    [
      px(`
        ......0........
        .....0T0.......
        .....0TT0......
        .....0TT0.04...
        ..0..0TT001T4..
        .0U000TT000400.
        0UU666666666660
        .0U000TT000400.
        ..0..0TT001T4..
        .....0TT0.04...
        .....0TT0......
        .....0T0.......
        ......0........
      `),
      px(`
        ......0........
        .....0T0.......
        .....0TT0......
        .....0TT0.00...
        ..0..0TT001T0..
        .0U000TT004440.
        0UU666666666660
        .0U000TT004440.
        ..0..0TT001T0..
        .....0TT0.00...
        .....0TT0......
        .....0T0.......
        ......0........
      `),
    ],
    { fps: 10 },
  ),
  // modern four-engine wide-body jetliner with blinking wingtip lights
  'veh.jumbo': S(
    [
      px(`
        ......0..............
        .....0T0.............
        .....0TT0............
        ......0TT0...........
        ......01TT0..........
        ..0....01TT0.........
        .0T000000TTT00000000.
        .0TT66666666666666660
        0TT666666666666666670
        .0TT66666666666666660
        .0T000000TTT00000000.
        ..0....01TT0.........
        ......01TT0..........
        ......0TT0...........
        .....0TT0............
        .....0T0.............
        ......0..............
      `),
      px(`
        ......0..............
        .....0n0.............
        .....0TT0............
        ......0TT0...........
        ......01TT0..........
        ..0....01TT0.........
        .0T000000TTT00000000.
        .0TT66666666666666660
        0TT666666666666666670
        .0TT66666666666666660
        .0T000000TTT00000000.
        ..0....01TT0.........
        ......01TT0..........
        ......0TT0...........
        .....0TT0............
        .....0i0.............
        ......0..............
      `),
    ],
    { fps: 3 },
  ),
  // near future: four-rotor electric air taxi (top-down)
  'veh.air_taxi': S(
    [
      px(`
        ...........
        .4.4...4.4.
        ..4.....4..
        .4.4.0.4.4.
        ..010T010..
        ...0TqT0...
        ..0TTqqT0..
        ...0TqT0...
        ..010T010..
        .4.4.0.4.4.
        ..4.....4..
        .4.4...4.4.
        ...........
      `),
      px(`
        ...........
        ..4.....4..
        .444...444.
        ..40.0.04..
        ..010T010..
        ...0TqT0...
        ..0TTqqT0..
        ...0TqT0...
        ..010T010..
        ..40.0.04..
        .444...444.
        ..4.....4..
        ...........
      `),
    ],
    { fps: 10 },
  ),
  // future: delta-wing spaceplane (top-down) with engine glow
  'veh.spaceplane': S(
    [
      px(`
        ....00..........
        ...0TT0.........
        ...06660........
        ..066666000000..
        .GH6666666666L0.
        .GH66666666666q0
        .GH6666666666L0.
        ..066666000000..
        ...06660........
        ...0TT0.........
        ....00..........
      `),
      px(`
        ....00..........
        ...0TT0.........
        ...06660........
        ..066666000000..
        .HG6666666666L0.
        .HG66666666666q0
        .HG6666666666L0.
        ..066666000000..
        ...06660........
        ...0TT0.........
        ....00..........
      `),
    ],
    { fps: 8 },
  ),
  // future: bubble-canopy flying car with downward thrusters
  'veh.flying_car': S(
    [
      px(`
        .....000.....
        ....0qqq00...
        ..00qqqqqT00.
        .0TTTTTTTTTV0
        0UUUUUUUUUUU0
        .00G00000G00.
        .............
        .............
      `),
      px(`
        .....000.....
        ....0qqq00...
        ..00qqqqqT00.
        .0TTTTTTTTTV0
        0UUUUUUUUUUU0
        .00H00000H00.
        ...G.....G...
        .............
      `),
    ],
    { fps: 8 },
  ),
  // future: hoverboard rider
  'veh.hoverboard': S(
    [
      px(`
        ...00..
        ..0bS0.
        ..0TTS0
        ..0TT0.
        ..0UU0.
        .0U00U0
        0TTTTT0
        .0G0G0.
        .......
      `),
      px(`
        ...00..
        ..0bS0.
        ..0TTS0
        ..0TT0.
        ..0UU0.
        .00UU0.
        0TTTTT0
        .0H0H0.
        .......
      `),
    ],
    { fps: 8 },
  ),
  // industrial age sail: fast three-masted clipper
  'veh.clipper': S(
    [
      px(`
        .....................
        ....0a0...0a0...0a0..
        ...06a60.06a60.06a60.
        ..0666a60666a60666a..
        ..0666a60666a60666a..
        ...066a0.066a0.066a..
        ..0666a60666a60666a..
        .066666a6666a6666660.
        .0000a0.000a.0000a0..
        0T000a00000a00000a0..
        0dddddddddddddddddd0.
        0dTTTTTTTTTTTTTTTd0..
        .0cccccccccccccccc0..
        ..0z0q000z000q00z0...
        .....................
      `),
      px(`
        .....................
        ....0a0...0a0...0a0..
        ...06a60.06a60.06a60.
        ..0666a60666a60666a..
        ..0666a60666a60666a..
        ...066a0.066a0.066a..
        ..0666a60666a60666a..
        .066666a6666a6666660.
        .0000a0.000a.0000a0..
        0T000a00000a00000a0..
        0dddddddddddddddddd0.
        0dTTTTTTTTTTTTTTTd0..
        .0cccccccccccccccc0..
        ..q000z00q0z0000q0...
        .....................
      `),
    ],
    { fps: 3 },
  ),
  // early industrial: side-wheel paddle steamer
  'veh.paddle_steamer': S(
    [
      px(`
        ..................
        ........45........
        .......010........
        ...0000010000a....
        ..06666666666a....
        .006qq6qq6qq66000.
        066666666666666660
        0TTTTT0c0TTTTTTT0.
        .0ccc0ccc0ccccc0..
        ..000.0c0.00000...
        .......0..........
      `),
      px(`
        ..................
        .......54.........
        .......010........
        ...0000010000a....
        ..06666666666a....
        .006qq6qq6qq66000.
        066666666666666660
        0TTTT0ccc0TTTTTT0.
        .0ccc00c00cccc00..
        ..0000ccc00000....
        ......000.........
      `),
    ],
    { fps: 4 },
  ),
  // modern: container ship, stacked boxes and a stern bridge
  'veh.container_ship': S(
    [
      px(`
        ....................00....
        ...................0660...
        ..000.000.000.000.006q....
        .0noy0yno0Tyo0noi0y6660...
        .0mxC0xmr0UxC0mrh0x666000.
        02222222222222222222222220
        0TTTTTTTTTTTTTTTTTTTTTTT0.
        .0UUUUUUUUUUUUUUUUUUUUU0..
        .q0z000q0000z000q000z00...
        ..........................
      `),
      px(`
        ....................00....
        ...................0660...
        ..000.000.000.000.006q....
        .0noy0yno0Tyo0noi0y6660...
        .0mxC0xmr0UxC0mrh0x666000.
        02222222222222222222222220
        0TTTTTTTTTTTTTTTTTTTTTTT0.
        .0UUUUUUUUUUUUUUUUUUUUU0..
        ..q000z00q0000q00z000q0...
        ..........................
      `),
    ],
    { fps: 3 },
  ),
  // future: hover-ferry riding an air cushion with spray
  'veh.hover_ferry': S(
    [
      px(`
        ...................
        ....0qqqqqq00......
        ..00TqqqqqqTT000...
        .0TTTTTTTTTTTTTT0..
        0TVVVVVVVVVVVVVVVq.
        022222222222222220.
        011111111111111110.
        .q0z0q0z0q0z0q0z0..
        ...................
      `),
      px(`
        ...................
        ....0qqqqqq00......
        ..00TqqqqqqTT000...
        .0TTTTTTTTTTTTTT0..
        0TVVVVVVVVVVVVVVVq.
        022222222222222220.
        011111111111111110.
        .0z0q0z0q0z0q0z0q..
        ...................
      `),
    ],
    { fps: 6 },
  ),
};
