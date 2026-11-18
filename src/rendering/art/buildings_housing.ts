/**
 * Housing variety (bld.<KEY>.<tier><variant>) and ethos style sets
 * (bld.<KEY>.atomic.<n>, bld.<KEY>.eco.<n>).
 *
 * Variants: letters b, c, d after the tier are alternative looks for the same
 * residential district and tier. Atlas.buildingId picks one deterministically
 * from the tile hash, so neighbouring blocks differ but a tile always shows
 * the same house.
 *
 * Style sets: 'atomic' is a retro-futurist look (boomerang roofs, domes,
 * fins, starbursts, pastel walls) and 'eco' an ecological look (green roofs,
 * planted terraces, timber, solar glazing). Atlas.buildingId takes an
 * optional style; see ./select.ts housingStyleForEthos for the mapping a
 * civilization's ethos can use. Same 8 px per tile scale and team-colour
 * roofs as the base housing sprites in ./buildings.ts.
 */
import { S, type SpriteSheet } from './types';

/** Author a frame as a multi-line block; whitespace is ignored, '.' is transparent. */
const px = (block: string): string[] =>
  block
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

export const HOUSING_VARIANT_SPRITES: SpriteSheet = {
  // hide tent on poles
  'bld.HUT.0b': S(
    px(`
      ...00...
      ..0dc0..
      ..0dc0..
      .0edcc0.
      .0eTUc0.
      0edddcc0
      0ed00dc0
      00000000
    `),
  ),
  // low hide dome with painted band
  'bld.HUT.0c': S(
    px(`
      ........
      ..0000..
      .0eddc0.
      0eTddUc0
      0ddddcc0
      0dc00cc0
      00000000
    `),
  ),
  // round mud hut with conical thatch
  'bld.HUT.1c': S(
    px(`
      ...00...
      ..0YY0..
      .0YXYX0.
      0YYXYXX0
      00000000
      .0BBBC0.
      .0BaaC0.
      .0BaaC0.
      .000000.
    `),
  ),
  // flat roof with a rooftop awning
  'bld.HOUSE.1b': S(
    px(`
      ..0000..
      .0TTTU0.
      .0U00U0.
      00000000
      0AAAAAB0
      0A0AA0B0
      0AAAAAB0
      0AAaaAB0
      0BBaaBC0
      00000000
    `),
  ),
  // stepped two-level mudbrick house
  'bld.HOUSE.1c': S(
    px(`
      ....0000
      ....0AB0
      00000AB0
      0AAAA0B0
      0BBBBBB0
      0B0B0BC0
      0BBBBBC0
      0BTaaBC0
      0BUaaBC0
      00000000
    `),
  ),
  // villa with a columned porch
  'bld.HOUSE.2c': S(
    px(`
      ...00...
      ..0nf0..
      .0nfnf0.
      0nfnfnm0
      0rrrrrr0
      06u6u6u0
      06u6u6u0
      0TTTTTU0
    `),
  ),
  // tall half-timbered gable house
  'bld.HOUSE.3c': S(
    px(`
      ...00...
      ..0VT0..
      .0VTTU0.
      0VTTTUU0
      0UUUUUU0
      06b6b6b0
      0b6b6b60
      06bbb6b0
      06baab60
      00000000
    `),
  ),
  // stepped-gable stone merchant house
  'bld.HOUSE.4b': S(
    px(`
      ...00...
      ..0uu0..
      .00uu00.
      .0uxxu0.
      00uuuu00
      0uuuuuu0
      0uxuuxu0
      0uuuuuu0
      0uxaaxu0
      0TuaauU0
      00000000
    `),
  ),
  // hipped roof house with a dormer
  'bld.HOUSE.4c': S(
    px(`
      .000000.
      0VTTTTU0
      0TT00TU0
      0TT06TU0
      0UUUUUU0
      0AAAAAB0
      0AxAAxB0
      0AAAAAB0
      0AxaaxB0
      0AAaaAB0
      00000000
    `),
  ),
  // pair of jettied gables
  'bld.TOWNHOUSE.3b': S(
    px(`
      .00..00.
      0VT00VT0
      0TU00TU0
      0UUUUUU0
      06b6b6b0
      0b6b06b0
      00000000
      0e6b6e60
      0b6b0b60
      00000000
      06b06b60
      0baab6b0
      00000000
    `),
  ),
  // stone guild house with a team-colour banner course
  'bld.TOWNHOUSE.3c': S(
    px(`
      .000000.
      0ssssst0
      0uutuut0
      0VTTTTU0
      0uuuuuu0
      0uxuuxu0
      0uuuuuu0
      0uxuuxu0
      0tttttt0
      0u0uu0u0
      0uaauut0
      00000000
    `),
  ),
  // red brick terrace with sash windows
  'bld.TOWNHOUSE.4b': S(
    px(`
      .000000.
      0mmmmmr0
      0rrrrrr0
      0uuuuuu0
      0mxmmxr0
      0mmmmmr0
      0mxmmxr0
      0mmmmmr0
      0mxmmxr0
      0uuuuuu0
      0mxaaxr0
      0mmaamr0
      00000000
    `),
  ),
  // pale stucco townhouse with pediment
  'bld.TOWNHOUSE.4c': S(
    px(`
      ...00...
      ..0uu0..
      .0uuuu0.
      0VVVTTU0
      0uuuuuu0
      06x66x50
      06666650
      06x66x50
      0uuuuuu0
      06x66x50
      06aa6650
      00000000
    `),
  ),
  // yellow brick tenement with iron fire escapes
  'bld.TENEMENT.5b': S(
    px(`
      .10...10
      .dr...dr
      0dr000dr
      03333320
      0dddddc0
      0d1dd1c0
      02222220
      0d1dd1c0
      02222220
      0d1dd1c0
      02222220
      0d1dd1c0
      0caa1cc0
      00000000
    `),
  ),
  // corner tenement with a shop awning
  'bld.TENEMENT.5c': S(
    px(`
      ..10....
      ..mr....
      00mr0000
      03333320
      0mmmmmr0
      0m1mmOr0
      0mmmmmr0
      0mOmm1r0
      0mmmmmr0
      0mOmm1r0
      0VTVTVU0
      0T6TT6U0
      0r1aazr0
      00000000
    `),
  ),
  // white slab block with ribbon windows
  'bld.APARTMENT.6b': S(
    px(`
      ........
      .000000.
      0666666u
      0zLzLzLu
      0444444t
      0zLzLzLu
      0444444t
      0zLzLzLu
      0TTTTTTu
      0zLzLzLu
      0444444t
      0zLzLzLu
      0444444t
      0zLzLzLu
      065aa56u
      00000000
    `),
  ),
  // brick mid-rise with team-colour balconies
  'bld.APARTMENT.6c': S(
    px(`
      ...00...
      ...010..
      00000000
      0dddddc0
      0zLdzLc0
      0dddddc0
      0zLdzLc0
      0TUdTUc0
      0zLdzLc0
      0dddddc0
      0zLdzLc0
      0TUdTUc0
      0dddddc0
      0zLdzLc0
      0daaddc0
      00000000
    `),
  ),
  // glass curtain-wall block
  'bld.APARTMENT.6d': S(
    px(`
      .000000.
      0TTTTTU0
      0qzqzqy0
      0zyzyzy0
      0MMMMMM0
      0qzqzqy0
      0zyzyzy0
      0MMMMMM0
      0qzqzqy0
      0zyzyzy0
      0MMMMMM0
      0qzqzqy0
      0zyzyzy0
      0MMMMMM0
      0L4aa4L0
      00000000
    `),
  ),
  // gabled family house with lawn and drive
  'bld.SUBURB.6b': S(
    px(`
      ........
      ..00000.
      .0VVTTU0
      0VTTTTU0
      0UUUUUU0
      06z66z50
      065aa550
      jjjjj44j
      jhjjj45j
      jjjjj455
    `),
  ),
  // split-level house with a garden pool
  'bld.SUBURB.6c': S(
    px(`
      ...0000.
      ..0TTTU0
      .0TTTTU0
      00000000
      0566z650
      05z6aa50
      0566aa50
      jjjjjj4j
      jjzzzj4j
      kjjjjj4j
    `),
  ),
  // long ranch house with a parked car
  'bld.SUBURB.6d': S(
    px(`
      ........
      .0000000
      0VTTTTTU
      0UUUUUUU
      0e6zz6ed
      0e6aa6ed
      0n0jjjj4
      jjjjjj44
      jhjjjj45
      jjjjjj45
    `),
  ),
  // slim glass slab tower with a crown
  'bld.TOWER.6b': S(
    px(`
      ...00...
      ...00...
      ..0440..
      ..0TU0..
      .000000.
      .0LLzz0.
      .0zzyy0.
      .0LLzz0.
      .0zzyy0.
      .0LLzz0.
      .0zzyy0.
      .0LLzz0.
      .0zzyy0.
      .0LLzz0.
      .0zzyy0.
      .0LLzz0.
      .0zzyy0.
      .0LLzz0.
      .0zzyy0.
      .0LLzz0.
      .0zzyy0.
      .0LLzz0.
      .0L00z0.
      .000000.
    `),
  ),
  // stepped concrete tower with setbacks
  'bld.TOWER.6c': S(
    px(`
      ....0...
      ....0...
      ...000..
      ..05550.
      ..05z50.
      ..05550.
      .0055500
      .0zz5zz0
      .0555550
      .0zz5zz0
      .0555550
      .0zz5zz0
      .0TTTTU0
      .0zz5zz0
      .0555550
      .0zz5zz0
      .0555550
      .0zz5zz0
      .0555550
      .0zz5zz0
      .0555550
      .0zz5zz0
      .0z5005z
      .0000000
    `),
  ),
  // tapering spire with glow bands
  'bld.TOWER.7b': S(
    px(`
      ....0...
      ...0H...
      ...0G...
      ...070..
      ..0760..
      ..0GG0..
      ..0760..
      ..0760..
      .07L650.
      .07L650.
      .0GGGG0.
      .07L650.
      .07L650.
      .0TTTU0.
      .07L650.
      .07L650.
      0GGGGGG0
      07LLLL50
      07LLLL50
      07LLLL50
      0TTTTTU0
      07LLLL50
      07LLLL50
      0GGGGGG0
      07L00L50
      00000000
    `),
  ),
  // sky-garden tower with a landing disc
  'bld.TOWER.7c': S(
    px(`
      ..0000..
      .0GHHG0.
      .077760.
      ..0760..
      ..0760..
      .0jkkj0.
      .07LL50.
      .07LL50.
      .0jkkj0.
      .07LL50.
      .07LL50.
      .0TTTU0.
      .07LL50.
      .07LL50.
      .0jkkj0.
      .07LL50.
      .07LL50.
      .0GGGG0.
      .07LL50.
      .07LL50.
      .0jkkj0.
      .07LL50.
      .07LL50.
      0GGGGGG0
      075005L0
      00000000
    `),
  ),
  // stepped garden pyramid arcology
  'bld.ARCOLOGY.7b': S(
    px(`
      ................
      .......00.......
      ......0HH0......
      ......0GG0......
      .....07LL50.....
      .....0jkkj0.....
      .....07LL50.....
      ....07LLLL50....
      ....0jkkkkj0....
      ....07LLLL50....
      ....0TTTTTU0....
      ...07LLLLLL50...
      ...0jkkjjkkj0...
      ...07LLLLLL50...
      ...0GGGGGGGG0...
      ..07LLLLLLLL50..
      ..0jkkjjkkjjk0..
      ..07LLLLLLLL50..
      ..0TTTTTTTTTU0..
      .07LLLLLLLLLL50.
      .0jkkjjkkjjkkj0.
      .07LLLLLLLLLL50.
      .0GGGGGGGGGGGG0.
      07LLLLLLLLLLLL50
      0jkkjjkkjjkkjjk0
      07LLLLLLLLLLLL50
      07LLLLL00LLLLL50
      0TTTTTT00TTTTTU0
      07LLLL0aa0LLLL50
      07LLLL0aa0LLLL50
      0766666666666550
      05G555T55T555G50
    `),
    { fw: 2, fh: 2 },
  ),
  // butterfly-roof bungalow with a starburst column
  'bld.HOUSE.atomic.0': S(
    px(`
      0......0
      q0....0V
      qq0000VV
      0qqqVVV0
      06O66zz0
      06Ozz660
      06O6aa60
      05O5aa50
      00000000
    `),
  ),
  // saucer-domed house with porthole window
  'bld.HOUSE.atomic.1': S(
    px(`
      ..0000..
      .0qLLq0.
      0qLLLLq0
      0000000o
      0O6zz6O0
      0O6zz6Oo
      0O66aaO0
      05O5aa50
      00000000
    `),
  ),
  // boomerang-roof duplex with pastel panels
  'bld.TOWNHOUSE.atomic.0': S(
    px(`
      o......o
      0o....o0
      00TTTU00
      0T0000U0
      0zzzzzz0
      06O66O60
      0zzzzzz0
      06O66O60
      0VTVTVU0
      06Oaa660
      00000000
    `),
  ),
  // ranch house with a swooping roof and a finned car
  'bld.SUBURB.atomic.0': S(
    px(`
      .......0
      0.....0q
      q00000qq
      0qqqqqq0
      0O6zzz60
      0O6aaz60
      0n000jj4
      jjjjjj44
      jjooojj4
      jjjjjj45
    `),
  ),
  // dome house with carport, pool and starburst
  'bld.SUBURB.atomic.1': S(
    px(`
      ...00...
      ..0qL0..
      .0qLLq0.
      .00000o0
      0VT60zz0
      0T66aaz0
      jjjjjj44
      jjjjjj44
      jnnnnj45
      jjjjjj45
    `),
  ),
  // pastel slab with atomic finial
  'bld.APARTMENT.atomic.0': S(
    px(`
      ...00...
      ..0oo0..
      ...00...
      00000000
      0qqqqqq0
      0zO6zO60
      0qqqqqq0
      0zO6zO60
      0VVVVVV0
      0zO6zO60
      0qqqqqq0
      0zO6zO60
      0VVVVVV0
      0zO6zO60
      0O6aa6O0
      00000000
    `),
  ),
  // winged-roof apartments with striped balconies
  'bld.APARTMENT.atomic.1': S(
    px(`
      0......0
      q0....0q
      qq0000qq
      0qqqqqq0
      06zz6zz0
      0VVVVVV0
      06zz6zz0
      0qqqqqq0
      06zz6zz0
      0VVVVVV0
      06zz6zz0
      0qqqqqq0
      06zz6zz0
      0VVVVVV0
      06Oaa6O0
      00000000
    `),
  ),
  // needle tower with a flying-saucer crown
  'bld.TOWER.atomic.0': S(
    px(`
      ...00...
      ...oo...
      ...00...
      ..0qq0..
      .0qLLq0.
      0qLzzLq0
      0qqqqqq0
      .00TU00.
      ...66...
      ...65...
      ...65...
      ...65...
      ...65...
      ..0650..
      ..0zz0..
      ..0650..
      ..0zz0..
      ..0650..
      ..0zz0..
      ..0650..
      .06z650.
      .0z6z50.
      0O6aa6O0
      00000000
    `),
  ),
  // rocket-finned tower with porthole bands
  'bld.TOWER.atomic.1': S(
    px(`
      ...0....
      ...o....
      ..000...
      ..0O0...
      .0qqq0..
      .0z6z0..
      .0qqq0..
      0qqqqq0.
      0z6z6z00
      0qqqqqq0
      0z6z6z60
      0VVVVVV0
      0z6z6z60
      0qqqqqq0
      0z6z6z60
      0VVVVVV0
      0z6z6z60
      0qqqqqq0
      0z6z6z60
      0VVVVVV0
      0z6z6z60
      0q6aa6q0
      00000000
    `),
  ),
  // glass dome city with a central rocket spire
  'bld.ARCOLOGY.atomic.0': S(
    px(`
      .......00.......
      .......oo.......
      .......00.......
      ......0660......
      ......0650......
      .....006500.....
      .....0z6z50.....
      .....006500.....
      ......0650......
      ....00000000....
      ...0qqqLLqqq0...
      ..0qqLLLLLLqq0..
      ..0qLL6666LLq0..
      .0qL66zzzz66Lq0.
      .0qL6zzzzzz6Lq0.
      0qL6zzz66zzz6Lq0
      0qL6zz6OO6zz6Lq0
      0qL6zzz66zzz6Lq0
      0qLL66zzzz66LLq0
      0qqLLL6666LLLqq0
      0VVVVVVVVVVVVVV0
      0TTTTTTTTTTTTTU0
      06O66O6006O66O60
      06O66O6aa6O66O60
      0555555aa5555550
      0000000000000000
    `),
    { fw: 2, fh: 2 },
  ),
  // timber house with a planted roof
  'bld.HOUSE.eco.0': S(
    px(`
      .000000.
      0jkjkjj0
      0iiiiih0
      0dddddc0
      0dzzddc0
      0dzzdac0
      0ddddac0
      00000000
    `),
  ),
  // solar-roof cottage with a living wall
  'bld.HOUSE.eco.1': S(
    px(`
      ..0000..
      .0LzLz0.
      0LzLzLz0
      0MMMMMM0
      0eddkjd0
      0ezzdad0
      0eddiad0
      00000000
    `),
  ),
  // terraced timber townhouse with planter balconies
  'bld.TOWNHOUSE.eco.0': S(
    px(`
      .000000.
      0jkjkjj0
      0iihihi0
      0eeeeed0
      0ezzezd0
      0jkjjkj0
      0eeeeed0
      0ezzezd0
      0jkjjkj0
      0eeeeed0
      0ezaaed0
      00000000
    `),
  ),
  // turf-roof house with an orchard plot
  'bld.SUBURB.eco.0': S(
    px(`
      ........
      .000000.
      0jkjkjj0
      0iiiiih0
      0ezzeed0
      0eezaad0
      0ii0jjj4
      jjkjjj44
      jijjkj45
      jjjjjj45
    `),
  ),
  // solar house with a vegetable garden
  'bld.SUBURB.eco.1': S(
    px(`
      ..0000..
      .0LzLz0.
      0LzLzLz0
      0MMMMMM0
      0dzdkjd0
      0dzdaad0
      jjjkjj4j
      jikjjj4j
      jjjjkj4j
      jjjjjj4j
    `),
  ),
  // mid-rise with planted balconies and a roof garden
  'bld.APARTMENT.eco.0': S(
    px(`
      .00000..
      0jkkjj0.
      0iiiih00
      0uuuuuu0
      0zLjzLk0
      0kjkjkj0
      0uuuuuu0
      0zLkzLj0
      0jkjkjk0
      0uuuuuu0
      0zLjzLk0
      0kjkjkj0
      0uuuuuu0
      0zLkzLj0
      0uaauuj0
      00000000
    `),
  ),
  // stepped timber terraces with hanging gardens
  'bld.APARTMENT.eco.1': S(
    px(`
      ....000.
      ...0jkj0
      ..0jiii0
      ..0eeed0
      .0jkjzd0
      .0eeeed0
      0jkjkzd0
      0eeeeed0
      0zdjkjd0
      0eeeeed0
      0jkjzLd0
      0eeeeed0
      0zLjkjd0
      0eeeeed0
      0eaaeed0
      00000000
    `),
  ),
  // vertical-forest tower
  'bld.TOWER.eco.0': S(
    px(`
      ...00...
      ..0kj0..
      ..0ij0..
      .0jkkj0.
      .0zLzz0.
      .0zzLz0.
      .0jkji0.
      .0zLzz0.
      .0zzLz0.
      .0ikjk0.
      .0zLzz0.
      .0zzLz0.
      .0jkji0.
      .0zLzz0.
      .0zzLz0.
      .0ikjk0.
      .0zLzz0.
      .0zzLz0.
      .0jkji0.
      .0zLzz0.
      .0zzLz0.
      .0ikjk0.
      .0zaaz0.
      .000000.
    `),
  ),
  // mass-timber tower with garden floors and a wind turbine
  'bld.TOWER.eco.1': S(
    px(`
      ....0...
      ....0...
      ...0G0..
      ..0LzL0.
      ..0jkj0.
      .0LzLzL0
      .0jkjkj0
      .0eeeed0
      .0zLzLd0
      .0jkjkj0
      .0eeeed0
      .0zLzLd0
      .0jkjkj0
      .0eeeed0
      .0zLzLd0
      .0jkjkj0
      .0eeeed0
      .0zLzLd0
      .0jkjkj0
      .0eeeed0
      .0zLzLd0
      .0jkjkj0
      .0eaaed0
      .000000.
    `),
  ),
  // terraced hill-city covered in gardens
  'bld.ARCOLOGY.eco.0': S(
    px(`
      ................
      .......00.......
      ......0jk0......
      .....0jkji0.....
      .....0zzLd0.....
      .....0eeed0.....
      ....0jkjijk0....
      ....0zzLzzd0....
      ....0eeeeed0....
      ...0jkjijkji0...
      ...0zzLzzLzd0...
      ...0eeeeeeed0...
      ..0jkjijkjijk0..
      ..0zzLzzLzzLd0..
      ..0eeeeeeeeed0..
      .0jkjijkjijkji0.
      .0zzLzzLzzLzzd0.
      .0eeeeeeeeeeed0.
      0jkjijkjijkjijk0
      0zzLzzLzzLzzLzd0
      0eeeeeeeeeeeeed0
      0zzLzz0aa0zzLzd0
      0iiiii0aa0iiiih0
      0000000000000000
    `),
    { fw: 2, fh: 2 },
  ),
};
