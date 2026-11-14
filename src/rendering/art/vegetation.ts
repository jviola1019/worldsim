/** Trees, bushes, cacti and crops (veg.*) */
import { S, type SpriteSheet } from './types';

const V: SpriteSheet = {};

// ---------------------------------------------------------------- broadleaf trees
V['veg.oak.0'] = S([
  '..hhhh..',
  '.hkkjjg.',
  'hkkjjjig',
  'hkjjjiig',
  'hjjjiihg',
  'gjjiihhg',
  '.gghhgg.',
  '...cb...',
  '...cb...',
  '...cb...',
]);
V['veg.oak.1'] = S([
  '..hhh..',
  '.hkkjg.',
  'hkkjjig',
  'hkjjiig',
  'hjjiihg',
  '.giihg.',
  '..ggg..',
  '...c...',
  '...c...',
]);
V['veg.oak.2'] = S([
  '.hhh.hh.',
  'hkkjhkjg',
  'hkjjjjig',
  'hkjjjiig',
  'hjjjjiig',
  'hjjjiihg',
  'gijiihhg',
  '.ggihgg.',
  '...cb...',
  '...cb...',
  '..ccbb..',
]);
V['veg.birch.0'] = S([
  '.hkkh.',
  'hklkjh',
  'kljjji',
  'kjjjih',
  'hjjiih',
  '.jiih.',
  '..65..',
  '..61..',
  '..15..',
  '..65..',
  '..65..',
]);

// ---------------------------------------------------------------- conifers
V['veg.pine.0'] = S([
  '...h...',
  '..ihg..',
  '..ihg..',
  '.iihKg.',
  '..ihg..',
  '.iihKg.',
  'iihhKKg',
  '.iihKg.',
  'iihhKKg',
  'gghhKgg',
  '...c...',
  '...b...',
]);
V['veg.pine.1'] = S([
  '...h...',
  '..ihg..',
  '.iihKg.',
  '..ihg..',
  '.iihKg.',
  'iihhKKg',
  '.ihhKg.',
  'iihhKKg',
  'gghKKgg',
  '...c...',
  '...b...',
]);
V['veg.pine.2'] = S([
  '..h..',
  '.ihg.',
  '.ihg.',
  'iihKg',
  '.ihg.',
  'iihKg',
  'ihhKg',
  'ghKgg',
  '..c..',
  '..b..',
]);
// snow rests on the lit upper-left of each tier
V['veg.snowpine.0'] = S([
  '...7...',
  '..76g..',
  '..ihg..',
  '.6ihKg.',
  '..76g..',
  '.iihKg.',
  '6ihhKKg',
  '.76hKg.',
  'iihhKKg',
  '6ghhKgg',
  '...c...',
  '...b...',
]);
V['veg.snowpine.1'] = S([
  '..7..',
  '.76g.',
  '.ihg.',
  '6ihKg',
  '.76g.',
  'iihKg',
  '6hhKg',
  'ghKgg',
  '..c..',
  '..b..',
]);

// ---------------------------------------------------------------- tropical
V['veg.palm.0'] = S([
  '..jkj..',
  '.jjjiih',
  'jjiiihh',
  'jhibihh',
  'i..d..h',
  '...d...',
  '...c...',
  '...d...',
  '...c...',
  '...d...',
  '..cdc..',
]);
V['veg.palm.1'] = S([
  '.jkj...',
  'jjjiij.',
  'jiiihhh',
  'h.bcb.h',
  '...e...',
  '...d...',
  '...c...',
  '...d...',
  '..cdc..',
]);
// jungle giants: layered leaf clumps with dark gaps, buttress roots
V['veg.jungle.0'] = S([
  '..hiih..',
  '.hjkjih.',
  '.ijjiihg',
  'hjihhggh',
  'jkjigijh',
  'ijiihjih',
  'hiihgiig',
  'ghhgghhg',
  '.g.cb.g.',
  '...cb...',
  '..ccbb..',
  '.cc..bb.',
]);
V['veg.jungle.1'] = S([
  '.hih.hh.',
  'hjkihjih',
  'ijjihiig',
  'hiihgghg',
  'gghjkihg',
  'hjiijiih',
  'ijihhihg',
  'ghhgghgg',
  '...cb...',
  '..ccbb..',
  '.c....b.',
]);
V['veg.jungle.2'] = S([
  '...hih..',
  '..hjkih.',
  '.hjjiihg',
  'hjihhihg',
  'jkigghhh',
  'ijiihjig',
  'hiihhiig',
  'ghgghhgg',
  '..gcbg..',
  '...cb...',
  '..cc.bb.',
]);
V['veg.mangrove.0'] = S([
  '..hhhh..',
  '.hiiiKh.',
  'hijiiKKg',
  'hiiiKKgg',
  '.gKKKgg.',
  '...cb...',
  '..cbcb..',
  '.c.bc.b.',
  'c..b.c.b',
  'c.b...cb',
]);

// ---------------------------------------------------------------- dry lands
V['veg.acacia.0'] = S([
  '.hjjjjh.',
  'hjjjiiih',
  'giihhhhg',
  '.gc..bg.',
  '..c.b...',
  '...cb...',
  '...c....',
  '...c....',
  '...c....',
]);
V['veg.shrub_dry.0'] = S([
  '..dC..',
  '.CYdC.',
  'dYCcYd',
  '.cCdc.',
  '..cc..',
]);
V['veg.cactus.0'] = S([
  '..kh..',
  '..jh.i',
  'k.jh.i',
  'j.jh.h',
  'j.jhih',
  'jjjh..',
  '..jh..',
  '..jh..',
  '..jh..',
]);
V['veg.cactus.1'] = S([
  '..n..',
  '.kjh.',
  'kjjih',
  'jjjih',
  'jjiih',
  '.hhh.',
]);
V['veg.deadtree.0'] = S([
  'c...b..',
  '.c.b..b',
  '.cbc.b.',
  '..cbb..',
  'b.cb...',
  '.bcb...',
  '..cb...',
  '..cb...',
  '..cb...',
  '.bcbb..',
]);

// ---------------------------------------------------------------- small plants
V['veg.bush.0'] = S([
  '.hkjh.',
  'hkjjig',
  'hjjiig',
  'gjiihg',
  '.gggg.',
]);
V['veg.bush.1'] = S([
  '.hjjh.',
  'hjnjig',
  'hjjinh',
  'gnihhg',
  '.gggg.',
]);
V['veg.reeds.0'] = S([
  '.c...',
  '.c.c.',
  '.Y.cY',
  'YX.YX',
  'XYXYX',
  'XiXiX',
  'iXiXi',
]);
V['veg.flowers.0'] = S([
  'n.7.o',
  'j.i.j',
  'ijiji',
]);
V['veg.stump.0'] = S([
  '.ded.',
  'cedec',
  'cdccb',
  '.bcb.',
]);

// ---------------------------------------------------------------- alien / fantasy flora
V['veg.alien.0'] = S([
  '.QQQQ.',
  'QHGQQP',
  'QQQGPp',
  'pPPPpp',
  '..Pp..',
  '..Qp..',
  '..Pp..',
  '.QPpp.',
  'P.Ppp.',
]);
V['veg.alien.1'] = S([
  '.HH..',
  'HGGG.',
  'GGGGp',
  '.GGp.',
  '..P..',
  'Q.P..',
  'QPP.Q',
  '.PpPp',
  '..Pp.',
  '..Pp.',
]);
V['veg.alien.2'] = S([
  'G...G..',
  'Q..QH.Q',
  'P.QP.QP',
  'PQPp.Pp',
  '.PpPQp.',
  '.PpPPp.',
  '..ppPp.',
  '..pPp..',
]);
V['veg.corrupt.0'] = S([
  'r.p..p.',
  '.pPp.p.',
  '..pPp.r',
  'p..Pp1.',
  '.p.P1..',
  '..pP1..',
  '...P1..',
  '..pP1..',
  '..P1...',
  '..P1p..',
  '.pP11p.',
]);
V['veg.crystal.0'] = S([
  '...H...',
  '..H6...',
  '.QH6.H.',
  '.QHQ.6Q',
  'H.QPQ6P',
  '6QQPQPp',
  'QQPpPPp',
  'QPPppPp',
  '.pp.pp.',
]);

export const VEGETATION_SPRITES: SpriteSheet = V;
