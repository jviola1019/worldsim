/**
 * God powers. Every power mutates simulation state (terrain, climate, people,
 * institutions, technology, relations...) — never just a label — and is
 * recorded in WorldState.interventions so a timeline can be reproduced.
 * Brush powers apply to a radius around the touched tile; tap powers act on
 * the settlement/civilization under the finger.
 */
import { powerAllowed, powerSetOf } from './powerSet';
import { removeBuilding } from '../civilizations/urban';
import { record, residents } from '../population/ledger';
import type { Sim } from '../sim/context';
import type { Civ, Settlement, SpeciesKey } from '../sim/types';
import { markTile, markOverlay } from '../sim/context';
import { withPowerFx } from '../sim/conceptFx';
import { T, TERRAIN, isWaterTerrain, type TerrainKey } from '../world/terrain';
import { Deposit, DEPOSITS, type DepositKey } from '../world/resources';
import { biomeFor, computeHydrology, vegCapacity } from '../world/worldgen';
import { clamp, clamp01 } from '../core/math';
import { spawnHerd, spawnMonster } from '../ecology/ecology';
import { MONSTERS, SPECIES_BY_KEY } from '../ecology/species';
import { spawnBand } from '../population/bands';
import { triggerDisaster, ignite, extinguish } from '../world/environment';
import { godFoundReligion, godSpreadReligion } from '../culture/religion';
import { grantTech, forgetTech, techAvailable, effCost, techState } from '../technology/research';
import { TECHS } from '../technology/techData';
import { declareWar, makePeace, makeTreaty, atWarWith } from '../politics/diplomacy';
import { ensureRelation, makeContact } from '../civilizations/knowledge';
import { secede } from '../politics/government';
import { createLeader, crown } from '../politics/succession';
import { createCiv } from '../civilizations/civ';
import { foundSettlement, destroySettlement, transferSettlement } from '../civilizations/settlement';
import { addPeople } from '../population/demography';
import { logEvent } from '../history/events';
import { nuclearStrike } from '../military/war';
import { forceExchange } from '../military/nuclear';
import { asteroidImpact, eruption, solarStorm, gammaRayBurst } from '../world/catastrophes';
import { releasePathogen, forceAITakeover, startGoo } from '../future/risks';
import { unleashHorror, horrorsAllowed } from './horrors';
import type { HorrorKind } from '../sim/types';
import { infect } from '../population/disease';
import { HAZARD } from '../world/tilemap';
import { Good } from '../world/resources';
import { UndoStack, afterTerrainEdit } from './undo';

export type PowerCategory = 'terrain' | 'nature' | 'civ' | 'religion' | 'tech' | 'diplomacy' | 'war' | 'disaster' | 'future' | 'laws';

export interface PowerCtx {
  /** Civ currently selected in the inspector (some powers target it). */
  selectedCiv: number;
}

export interface PowerDef {
  id: string;
  cat: PowerCategory;
  label: string;
  icon: string;
  kind: 'brush' | 'tap';
  desc: string;
  destructive?: boolean;
  /** Apply at tile (x, y) with radius r. Returns a short feedback string (or null). */
  apply: (sim: Sim, x: number, y: number, r: number, ctx: PowerCtx) => string | null;
  /** Repeat while dragging (brush) — ticks between applications. */
  continuous?: boolean;
  /** Round 10: allowed in Realistic (grounded) worlds. Addendum (owner): only placing real people and real animals. */
  grounded?: boolean;
}

export const CATEGORIES: { id: PowerCategory; label: string; icon: string }[] = [
  { id: 'terrain', label: 'Terrain', icon: 'ico.cat_terrain' },
  { id: 'nature', label: 'Nature', icon: 'ico.cat_nature' },
  { id: 'civ', label: 'Peoples', icon: 'ico.cat_civ' },
  { id: 'religion', label: 'Faith & culture', icon: 'ico.cat_religion' },
  { id: 'tech', label: 'Technology', icon: 'ico.cat_tech' },
  { id: 'diplomacy', label: 'Politics', icon: 'ico.cat_diplomacy' },
  { id: 'war', label: 'Warfare', icon: 'ico.cat_war' },
  { id: 'disaster', label: 'Disasters', icon: 'ico.cat_disaster' },
  { id: 'future', label: 'Modern & future', icon: 'ico.cat_future' },
  { id: 'laws', label: 'World laws', icon: 'ico.cat_laws' },
];

export const undo = new UndoStack();

function each(sim: Sim, x: number, y: number, r: number, fn: (i: number, falloff: number) => void): void {
  const m = sim.w.map;
  m.forRadius(x, y, Math.max(0.5, r), (i, _x, _y, d2) => {
    undo.record(sim, i);
    fn(i, 1 - Math.sqrt(d2) / (r + 1));
    markTile(sim, i);
    markOverlay(sim, i);
  });
}

function reclassify(sim: Sim, i: number): void {
  const m = sim.w.map;
  const e = m.elev[i];
  if (e <= 0) {
    if (m.bld[i]) removeBuilding(sim, i, false); // keeps the town's district counts consistent
    m.terrain[i] = e < -0.42 ? T.DEEP : e < -0.1 ? T.OCEAN : T.SHALLOW;
    m.veg[i] = 0;
    return;
  }
  // temperature follows the new elevation (lapse rate)
  const lat = Math.abs(m.latitude(m.yOf(i), sim.w.meta.latSpan));
  m.temp[i] = clamp(Math.round(28 - 48 * Math.pow(lat / 90, 1.6) + sim.w.meta.gen.temperature * 9 - 30 * e), -60, 50);
  if (isWaterTerrain(m.terrain[i]) || m.terrain[i] === T.MOUNTAIN || m.terrain[i] === T.HILLS || e > 0.42) m.terrain[i] = biomeFor(e, m.temp[i], m.moist[i], sim.w.meta.settings.alien);
}

function settlementAt(sim: Sim, x: number, y: number, r = 3): Settlement | undefined {
  const w = sim.w;
  const m = w.map;
  const sid = m.inBounds(x, y) ? m.settle[m.idx(x, y)] : 0;
  if (sid && w.settlements.has(sid)) return w.settlements.get(sid);
  let best: Settlement | undefined;
  let bd = r * r;
  for (const s of w.settlements.values()) {
    const d = (s.x - x) ** 2 + (s.y - y) ** 2;
    if (d <= bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

function civAt(sim: Sim, x: number, y: number): Civ | undefined {
  const s = settlementAt(sim, x, y, 4);
  return s ? sim.w.civs.get(s.civId) : sim.w.civs.get(sim.w.map.owner[sim.w.map.idx(x, y)]);
}

const biome = (key: TerrainKey, label: string): PowerDef => ({
  id: 'biome_' + key.toLowerCase(),
  cat: 'terrain',
  label,
  icon: 'ico.biome_' + (key === 'ALIEN_GRASS' ? 'alien' : key === 'TAIGA' ? 'forest' : key === 'HILLS' ? 'steppe' : key === 'ASH' ? 'volcanic' : key.toLowerCase()),
  kind: 'brush',
  desc: `Paint ${label.toLowerCase()}. Changes fertility, vegetation, wildlife habitat and what can be built.`,
  apply: (sim, x, y, r) => {
    const m = sim.w.map;
    const def = TERRAIN[T[key]];
    each(sim, x, y, r, (i) => {
      if (isWaterTerrain(m.terrain[i])) {
        m.elev[i] = 0.02;
      }
      m.terrain[i] = T[key];
      m.fert[i] = clamp(Math.round(def.fertility * (0.6 + m.moist[i] / 400)), 0, 255);
      m.veg[i] = Math.round(vegCapacity(m, i) * 0.7);
    });
    return null;
  },
});

const deposit = (key: DepositKey, label: string): PowerDef => ({
  id: 'res_' + key.toLowerCase(),
  cat: 'terrain',
  label,
  icon: 'ico.res_' + key.toLowerCase(),
  kind: 'brush',
  desc: `Create ${label.toLowerCase()} deposits that civilizations can discover and extract.`,
  apply: (sim, x, y, r) => {
    const m = sim.w.map;
    const def = DEPOSITS[Deposit[key]];
    each(sim, x, y, Math.max(0.5, r * 0.6), (i) => {
      if (def.water ? !m.isWater(i) : m.isWater(i)) return;
      m.dep[i] = Deposit[key];
      m.depAmt[i] = def.amount[1];
    });
    return null;
  },
});

const animal = (key: string, label: string, icon: string): PowerDef => ({
  id: 'animal_' + key,
  grounded: true,
  cat: 'nature',
  label,
  icon,
  kind: 'tap',
  desc: `Release ${label.toLowerCase()}. Outside their habitat they may decline — or become invasive.`,
  apply: (sim, x, y) => {
    // round 10 addendum: sea animals go in water, land animals on land (birds anywhere)
    const sp = SPECIES_BY_KEY[key];
    const m = sim.w.map;
    if (sp && m.inBounds(x, y)) {
      const water = m.isWater(m.idx(x, y));
      if (sp.aquatic && !water) return `${label} need water`;
      if (!sp.aquatic && !sp.flying && water) return `${label} need dry land`;
    }
    return spawnHerd(sim, key, x, y) ? null : 'Cannot place here';
  },
});

const people = (species: SpeciesKey, label: string): PowerDef => ({
  id: 'spawn_' + species,
  cat: 'civ',
  grounded: species === 'human',
  label,
  icon: species === 'human' ? 'ico.spawn_human' : `ico.spawn_${species}`,
  kind: 'tap',
  desc: 'Place a band of hunter-gatherers. They forage, grow, wander and may settle and found a civilization.',
  apply: (sim, x, y) => {
    const b = spawnBand(sim, x, y, species, sim.rng.int(18, 28));
    if (!b) return 'They need dry land';
    record(sim, b.civId, 'divine', b.members.length);
    logEvent(sim, { type: 'god_people', cat: 'god', title: `Divine hands placed a band of ${species === 'human' ? 'people' : species} on the land`, civs: [b.civId], x, y, importance: 2 });
    return null;
  },
});

const disaster = (kind: string, label: string, icon: string, r: number): PowerDef => ({
  id: 'dis_' + kind,
  cat: 'disaster',
  label,
  icon,
  kind: 'tap',
  destructive: true,
  desc: `Unleash ${label.toLowerCase()} here.`,
  apply: (sim, x, y, br) => {
    if (kind === 'plague') {
      const s = settlementAt(sim, x, y);
      if (!s) return 'Tap a settlement';
      const d = { id: ++sim.w.ids.disease, name: 'Divine Plague', r0: 3.5, lethality: 0.12, duration: 1.2, immunity: 600, origin: s.id, emerged: sim.year, zoonotic: false, totalDeaths: 0 };
      sim.w.diseases.set(d.id, d);
      infect(sim, s, d, 0.02);
      logEvent(sim, { type: 'god_plague', cat: 'god', title: `A divine plague descended on ${s.name}`, settlements: [s.id], civs: [s.civId], x: s.x, y: s.y, importance: 3 });
      return null;
    }
    triggerDisaster(sim, kind, x, y, Math.max(r, br));
    return null;
  },
});

const horror = (kind: HorrorKind, label: string, icon: string, desc: string): PowerDef => ({
  id: 'horror_' + kind,
  cat: 'disaster',
  label,
  icon,
  kind: 'tap',
  destructive: true,
  desc: `${desc} God mode only.`,
  apply: (sim, x, y) => {
    if (!horrorsAllowed(sim)) return 'Not available in observer worlds';
    const s = settlementAt(sim, x, y);
    if (!s) return 'Tap a settlement';
    unleashHorror(sim, s, kind);
    logEvent(sim, { type: 'god_horror', cat: 'god', title: kind === 'zombie' ? `The dead rose in ${s.name}` : kind === 'ghoul' ? `Ghouls crept out of the dark around ${s.name}` : `A creeping blight appeared in the fields of ${s.name}`, civs: [s.civId], settlements: [s.id], x: s.x, y: s.y, importance: 4, causes: [{ label: 'Divine intervention', weight: 1 }] });
    return null;
  },
});

function nearestOtherCiv(sim: Sim, civ: Civ): Civ | undefined {
  const cap = sim.w.settlements.get(civ.capital);
  let best: Civ | undefined;
  let bd = Infinity;
  for (const o of sim.w.civs.values()) {
    if (!o.alive || o.id === civ.id) continue;
    const oc = sim.w.settlements.get(o.capital);
    if (!cap || !oc) continue;
    const d = Math.hypot(cap.x - oc.x, cap.y - oc.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

function targetCiv(sim: Sim, civ: Civ, ctx: PowerCtx): Civ | undefined {
  const sel = sim.w.civs.get(ctx.selectedCiv);
  if (sel && sel.alive && sel.id !== civ.id) return sel;
  return nearestOtherCiv(sim, civ);
}

export const POWERS: PowerDef[] = [
  // ------------------------------------------------------------ terrain
  {
    id: 'raise', cat: 'terrain', label: 'Raise land', icon: 'ico.raise', kind: 'brush', continuous: true, desc: 'Lift the ground; seas become land, hills become mountains.',
    apply: (sim, x, y, r) => {
      const m = sim.w.map;
      each(sim, x, y, r, (i, f) => {
        m.elev[i] = Math.min(1, m.elev[i] + 0.04 * f + (m.elev[i] <= 0 ? 0.03 : 0));
        reclassify(sim, i);
      });
      return null;
    },
  },
  {
    id: 'lower', cat: 'terrain', label: 'Lower land', icon: 'ico.lower', kind: 'brush', continuous: true, desc: 'Sink the ground; low land floods into lakes and seas.',
    apply: (sim, x, y, r) => {
      const m = sim.w.map;
      each(sim, x, y, r, (i, f) => {
        m.elev[i] = Math.max(-1, m.elev[i] - 0.04 * f);
        reclassify(sim, i);
      });
      return null;
    },
  },
  {
    id: 'mountain', cat: 'terrain', label: 'Mountains', icon: 'ico.mountain', kind: 'brush', desc: 'Raise a mountain range — a barrier for armies and a source of ores.',
    apply: (sim, x, y, r) => {
      const m = sim.w.map;
      each(sim, x, y, r, (i, f) => {
        m.elev[i] = Math.max(m.elev[i], 0.64 + 0.3 * f);
        m.terrain[i] = T.MOUNTAIN;
        reclassify(sim, i);
        if (m.bld[i]) removeBuilding(sim, i, false); // keeps the town's district counts consistent
      });
      return null;
    },
  },
  {
    id: 'ocean', cat: 'terrain', label: 'Ocean', icon: 'ico.ocean', kind: 'brush', destructive: true, desc: 'Drown the land under the sea.',
    apply: (sim, x, y, r) => {
      const m = sim.w.map;
      each(sim, x, y, r, (i, f) => {
        m.elev[i] = Math.min(m.elev[i], -0.15 - 0.3 * f);
        reclassify(sim, i);
      });
      return null;
    },
  },
  {
    id: 'shallow', cat: 'terrain', label: 'Shallow sea', icon: 'ico.shallow', kind: 'brush', desc: 'Create shallow coastal water, rich in fish.',
    apply: (sim, x, y, r) => {
      const m = sim.w.map;
      each(sim, x, y, r, (i) => {
        m.elev[i] = -0.03;
        reclassify(sim, i);
      });
      return null;
    },
  },
  {
    id: 'river', cat: 'terrain', label: 'River', icon: 'ico.river', kind: 'brush', desc: 'Carve a channel; water then finds its way downhill to the sea when you lift your finger.',
    apply: (sim, x, y) => {
      const m = sim.w.map;
      each(sim, x, y, 0.6, (i) => {
        if (m.isLand(i)) {
          m.elev[i] = Math.max(0.005, m.elev[i] - 0.05);
          m.moist[i] = Math.min(255, m.moist[i] + 60);
        }
      });
      return null;
    },
  },
  {
    id: 'fertility_up', cat: 'terrain', label: 'Enrich soil', icon: 'ico.fertility_up', kind: 'brush', desc: 'Make soil more fertile for farming.',
    apply: (sim, x, y, r) => {
      const m = sim.w.map;
      each(sim, x, y, r, (i) => (m.fert[i] = Math.min(255, m.fert[i] + 40)));
      return null;
    },
  },
  {
    id: 'fertility_down', cat: 'terrain', label: 'Exhaust soil', icon: 'ico.fertility_down', kind: 'brush', desc: 'Strip soil fertility.',
    apply: (sim, x, y, r) => {
      const m = sim.w.map;
      each(sim, x, y, r, (i) => (m.fert[i] = Math.max(0, m.fert[i] - 40)));
      return null;
    },
  },
  biome('GRASS', 'Grassland'), biome('FOREST', 'Forest'), biome('JUNGLE', 'Jungle'), biome('DESERT', 'Desert'), biome('STEPPE', 'Steppe'),
  biome('SAVANNA', 'Savanna'), biome('SNOW', 'Snow'), biome('TUNDRA', 'Tundra'), biome('SWAMP', 'Wetland'), biome('VOLCANIC', 'Volcanic land'),
  biome('BEACH', 'Beach'), biome('ALIEN_GRASS', 'Alien meadow'), biome('CORRUPT', 'Blight'), biome('CRYSTAL', 'Crystal fields'),
  deposit('COPPER', 'Copper'), deposit('TIN', 'Tin'), deposit('IRON', 'Iron'), deposit('GOLD', 'Gold'), deposit('GEMS', 'Gems'), deposit('COAL', 'Coal'),
  deposit('OIL', 'Oil'), deposit('GAS', 'Natural gas'), deposit('URANIUM', 'Uranium'), deposit('RARE', 'Rare metals'), deposit('SPICES', 'Spices'),
  deposit('FURS', 'Furs'), deposit('FISH', 'Fishing grounds'), deposit('EXOTIC', 'Exotic matter'),
  {
    id: 'res_remove', cat: 'terrain', label: 'Remove deposits', icon: 'ico.res_remove', kind: 'brush', desc: 'Erase natural resource deposits.',
    apply: (sim, x, y, r) => {
      const m = sim.w.map;
      each(sim, x, y, r, (i) => {
        m.dep[i] = 0;
        m.depAmt[i] = 0;
      });
      return null;
    },
  },
  // ------------------------------------------------------------ nature
  {
    id: 'trees', cat: 'nature', label: 'Grow forest', icon: 'ico.trees', kind: 'brush', continuous: true, desc: 'Plant trees: timber, game and wildlife habitat.',
    apply: (sim, x, y, r) => {
      const m = sim.w.map;
      each(sim, x, y, r, (i) => {
        if (m.isLand(i) && !m.bld[i]) m.veg[i] = Math.min(255, m.veg[i] + 50);
      });
      return null;
    },
  },
  {
    id: 'clear', cat: 'nature', label: 'Clear land', icon: 'ico.clear', kind: 'brush', desc: 'Cut down vegetation.',
    apply: (sim, x, y, r) => {
      const m = sim.w.map;
      each(sim, x, y, r, (i) => (m.veg[i] = Math.max(0, m.veg[i] - 120)));
      return null;
    },
  },
  {
    id: 'rain', cat: 'nature', label: 'Bring rain', icon: 'ico.rain', kind: 'tap', desc: 'End a drought: a wet spell over the region raises harvests.',
    apply: (sim, x, y) => {
      const c = sim.w.climate;
      const cell = ((y / c.cellSize) | 0) * c.cellsX + ((x / c.cellSize) | 0);
      for (const k of [cell, cell - 1, cell + 1, cell - c.cellsX, cell + c.cellsX]) if (k >= 0 && k < c.rain.length) c.rain[k] = 0.6;
      sim.w.map.forRadius(x, y, 8, (i) => extinguish(sim, i));
      logEvent(sim, { type: 'god_rain', cat: 'god', title: 'Rains came at a divine command', x, y, importance: 1 });
      return null;
    },
  },
  animal('deer', 'Deer', 'ico.animal_deer'), animal('wolf', 'Wolves', 'ico.animal_wolf'), animal('bison', 'Bison', 'ico.animal_bison'),
  animal('horse', 'Wild horses', 'ico.animal_horse'), animal('sheep', 'Wild sheep', 'ico.animal_sheep'), animal('bear', 'Bears', 'ico.animal_bear'),
  animal('mammoth', 'Mammoths', 'ico.animal_mammoth'), animal('fish', 'Fish', 'ico.animal_fish'), animal('rabbit', 'Hares', 'ico.spawn_animal'),
  // round 10 addendum: every real species can be dropped by hand (the species sprite is the tool icon)
  ...([
    ['elk', 'Elk'], ['goat', 'Wild goats'], ['cow', 'Aurochs'], ['boar', 'Boars'], ['chicken', 'Junglefowl'], ['camel', 'Camels'],
    ['elephant', 'Elephants'], ['buffalo', 'Water buffalo'], ['llama', 'Llamas'], ['crocodile', 'Crocodiles'], ['bigcat', 'Great cats'],
    ['penguin', 'Penguins'], ['seal', 'Seals'], ['whale', 'Whales'], ['bird', 'Birds'],
  ] as const).map(([key, label]) => animal(key, label, 'ani.' + key)),
  {
    id: 'monster', cat: 'nature', label: 'Monster', icon: 'ico.monster', kind: 'tap', destructive: true, desc: 'Summon a fantastical creature (needs the fantasy creatures law).',
    apply: (sim, x, y) => {
      if (!sim.w.laws.fantasyCreatures) return 'Enable "Fantasy creatures" in World laws';
      const def = sim.rng.pick(MONSTERS);
      spawnMonster(sim, def.kind, x, y);
      return null;
    },
  },
  // ------------------------------------------------------------ peoples
  people('human', 'Humans'), people('sylvan', 'Sylvans'), people('delver', 'Delvers'), people('grakk', 'Grakk'),
  {
    id: 'found_city', cat: 'civ', label: 'Found village', icon: 'ico.found_city', kind: 'tap', desc: 'Found a village. Inside a nation it joins that nation; elsewhere a new people arises.',
    apply: (sim, x, y) => {
      const m = sim.w.map;
      const i = m.idx(x, y);
      if (m.isWater(i) || !TERRAIN[m.terrain[i]].buildable) return 'Pick buildable land';
      if (m.settle[i] && m.settle[i] && sim.w.settlements.get(m.settle[i]) && sim.w.settlements.get(m.settle[i])!.x === x && sim.w.settlements.get(m.settle[i])!.y === y) return 'A settlement is already here';
      const owner = m.owner[i] ? sim.w.civs.get(m.owner[i]) : undefined;
      const civ = owner ?? createCiv(sim, { species: 'human', x, y, cause: 'Divine founding' });
      const fs = foundSettlement(sim, civ, x, y, { pop: 40, cause: 'Divine founding' });
      record(sim, fs.civId, 'divine', residents(fs));
      return null;
    },
  },
  {
    id: 'grow', cat: 'civ', label: 'Bless with plenty', icon: 'ico.grow', kind: 'tap', desc: 'Fill granaries and attract settlers (+15% people).',
    apply: (sim, x, y) => {
      const s = settlementAt(sim, x, y);
      if (!s) return 'Tap a settlement';
      s.food += s.pop * 0.8;
      const blessed = Math.max(5, s.pop * 0.15);
      addPeople(sim, s, blessed, s.cultures[0]?.id ?? 0, s.religions[0]?.id ?? 0);
      record(sim, s.civId, 'divine', blessed);
      s.prosperity += 0.2;
      return null;
    },
  },
  {
    id: 'new_nation', cat: 'civ', label: 'Independence', icon: 'ico.new_nation', kind: 'tap', desc: 'Make a settlement declare independence as a new nation.',
    apply: (sim, x, y) => {
      const s = settlementAt(sim, x, y);
      const civ = s ? sim.w.civs.get(s.civId) : undefined;
      if (!s || !civ) return 'Tap a settlement';
      if (civ.settlements.length < 2) return 'It is already independent';
      secede(sim, civ, s, [{ label: 'Divine intervention', weight: 1 }]);
      return null;
    },
  },
  {
    id: 'transfer', cat: 'civ', label: 'Change allegiance', icon: 'ico.transfer', kind: 'tap', desc: 'Give the settlement to the nation selected in the inspector (or its nearest neighbor).',
    apply: (sim, x, y, _r, ctx) => {
      const s = settlementAt(sim, x, y);
      const civ = s ? sim.w.civs.get(s.civId) : undefined;
      if (!s || !civ) return 'Tap a settlement';
      const to = targetCiv(sim, civ, ctx);
      if (!to) return 'No other nation exists';
      transferSettlement(sim, s, to, 'Divine intervention');
      return null;
    },
  },
  {
    id: 'destroy_city', cat: 'civ', label: 'Raze settlement', icon: 'ico.destroy_city', kind: 'tap', destructive: true, desc: 'Destroy a settlement, leaving ruins.',
    apply: (sim, x, y) => {
      const s = settlementAt(sim, x, y);
      if (!s) return 'Tap a settlement';
      destroySettlement(sim, s, 'divine wrath');
      return null;
    },
  },
  // ------------------------------------------------------------ religion & culture
  {
    id: 'religion_found', cat: 'religion', label: 'Found a faith', icon: 'ico.religion_found', kind: 'tap', desc: 'Reveal a new religion in a settlement, with its own founder, myth and doctrines.',
    apply: (sim, x, y) => {
      const s = settlementAt(sim, x, y);
      if (!s) return 'Tap a settlement';
      godFoundReligion(sim, s);
      return null;
    },
  },
  {
    id: 'religion_spread', cat: 'religion', label: 'Spread faith', icon: 'ico.religion_spread', kind: 'brush', desc: 'Spread the strongest faith nearby into the settlements under the brush.',
    apply: (sim, x, y, r) => {
      const src = settlementAt(sim, x, y, r + 6);
      const rid = src?.religions.find((q) => q.id)?.id;
      if (!rid) return 'No faith nearby to spread';
      for (const s of sim.w.settlements.values()) if ((s.x - x) ** 2 + (s.y - y) ** 2 <= (r + 1) ** 2) godSpreadReligion(sim, s, rid, 0.25);
      return null;
    },
  },
  {
    id: 'sacred_site', cat: 'religion', label: 'Sacred site', icon: 'ico.sacred_site', kind: 'tap', desc: 'Consecrate a place: nearby people grow more devout.',
    apply: (sim, x, y) => {
      const m = sim.w.map;
      m.hazard[m.idx(x, y)] |= HAZARD.SACRED;
      markTile(sim, m.idx(x, y));
      const s = settlementAt(sim, x, y, 6);
      if (s) {
        const rid = s.religions.find((q) => q.id)?.id;
        if (rid) godSpreadReligion(sim, s, rid, 0.2);
        s.unrest = Math.max(0, s.unrest - 0.2);
      }
      return null;
    },
  },
  {
    id: 'culture_seed', cat: 'religion', label: 'Age of inquiry', icon: 'ico.culture_seed', kind: 'tap', desc: 'Seed a cultural movement of curiosity: the culture grows more open to new ideas.',
    apply: (sim, x, y) => {
      const civ = civAt(sim, x, y);
      const cu = civ ? sim.w.cultures.get(civ.cultureId) : undefined;
      if (!civ || !cu) return 'Tap a nation';
      cu.values.tradition = clamp(cu.values.tradition - 0.35, -1, 1);
      civ.personality.science = Math.min(1.5, civ.personality.science + 0.25);
      logEvent(sim, { type: 'god_culture', cat: 'god', title: `An age of inquiry swept the ${cu.name} people`, civs: [civ.id], importance: 2 });
      return null;
    },
  },
  {
    id: 'tolerance', cat: 'religion', label: 'Tolerance', icon: 'ico.tolerance', kind: 'tap', desc: 'Inspire a nation to tolerate all faiths.',
    apply: (sim, x, y) => {
      const civ = civAt(sim, x, y);
      if (!civ) return 'Tap a nation';
      civ.policies.tolerance = civ.stateReligion ? 'tolerant' : 'secular';
      civ.inst.liberties = clamp01(civ.inst.liberties + 0.1);
      return null;
    },
  },
  // ------------------------------------------------------------ technology
  {
    id: 'tech_grant', cat: 'tech', label: 'Grant knowledge', icon: 'ico.tech_grant', kind: 'tap', desc: 'Reveal the technology the nation is currently researching.',
    apply: (sim, x, y) => {
      const civ = civAt(sim, x, y);
      if (!civ) return 'Tap a nation';
      const target = civ.researchTarget || TECHS.filter((t) => techAvailable(sim, civ, t)).sort((a, b) => a.cost - b.cost)[0]?.id;
      if (!target) return 'Nothing left to learn';
      grantTech(sim, civ, target, 'god');
      return null;
    },
  },
  {
    id: 'tech_inspire', cat: 'tech', label: 'Inspire', icon: 'ico.tech_inspire', kind: 'tap', desc: 'Half of the current research is completed instantly.',
    apply: (sim, x, y) => {
      const civ = civAt(sim, x, y);
      const t = civ?.researchTarget ? TECHS.find((q) => q.id === civ.researchTarget) : undefined;
      if (!civ || !t) return 'Tap a nation that is researching';
      techState(civ, t.id).progress += effCost(t) * 0.5;
      return null;
    },
  },
  {
    id: 'tech_forget', cat: 'tech', label: 'Forgetting', icon: 'ico.tech_forget', kind: 'tap', destructive: true, desc: 'A nation forgets its most recent discovery.',
    apply: (sim, x, y) => {
      const civ = civAt(sim, x, y);
      if (!civ) return 'Tap a nation';
      const recent = Object.entries(civ.techs).filter(([, s]) => s.known && s.year > 0).sort((a, b) => b[1].year - a[1].year)[0];
      if (!recent) return 'Nothing to forget';
      forgetTech(sim, civ, recent[0], 'Divine intervention');
      return null;
    },
  },
  {
    id: 'tech_diffuse', cat: 'tech', label: 'Share knowledge', icon: 'ico.tech_diffuse', kind: 'tap', desc: "Spread a nation's knowledge to every people it has met.",
    apply: (sim, x, y) => {
      const civ = civAt(sim, x, y);
      if (!civ) return 'Tap a nation';
      for (const oid of civ.knownCivs) {
        const o = sim.w.civs.get(oid);
        if (!o?.alive) continue;
        for (const [id, st] of Object.entries(civ.techs)) {
          if (!st.known) continue;
          const t = TECHS.find((q) => q.id === id);
          if (t && techAvailable(sim, o, t)) techState(o, id).progress += effCost(t) * 0.5;
        }
      }
      return null;
    },
  },
  {
    id: 'anomaly', cat: 'tech', label: 'Strange artifact', icon: 'ico.anomaly', kind: 'tap', desc: 'A mysterious monolith grants a technology from beyond the nation’s time.',
    apply: (sim, x, y) => {
      const civ = civAt(sim, x, y);
      if (!civ) return 'Tap a nation';
      const opts = TECHS.filter((t) => !civ.techs[t.id]?.known && t.era <= civ.era + 2 && t.prereqs.every((p) => civ.techs[p]?.known));
      const t = sim.rng.pick(opts.length ? opts : TECHS.filter((q) => !civ.techs[q.id]?.known));
      if (!t) return 'Nothing left to learn';
      sim.w.map.hazard[sim.w.map.idx(x, y)] |= HAZARD.ANOMALY;
      markTile(sim, sim.w.map.idx(x, y));
      grantTech(sim, civ, t.id, 'god');
      return null;
    },
  },
  // ------------------------------------------------------------ politics
  {
    id: 'peace', cat: 'diplomacy', label: 'Peace', icon: 'ico.peace', kind: 'tap', desc: 'Force every war of this nation to end.',
    apply: (sim, x, y) => {
      const civ = civAt(sim, x, y);
      if (!civ) return 'Tap a nation';
      let n = 0;
      for (const wr of [...sim.w.wars.values()]) if (!wr.end && (wr.attackers.includes(civ.id) || wr.defenders.includes(civ.id))) {
        makePeace(sim, wr, 'Divine intervention');
        n++;
      }
      return n ? null : 'This nation is at peace';
    },
  },
  {
    id: 'alliance', cat: 'diplomacy', label: 'Alliance', icon: 'ico.alliance', kind: 'tap', desc: 'Bind this nation in alliance with the selected (or nearest) nation.',
    apply: (sim, x, y, _r, ctx) => {
      const civ = civAt(sim, x, y);
      if (!civ) return 'Tap a nation';
      const other = targetCiv(sim, civ, ctx);
      if (!other) return 'No partner nation';
      makeContact(sim, civ.id, other.id);
      makeTreaty(sim, civ, other, 'alliance', 50);
      ensureRelation(sim, civ.id, other.id).opinion = 60;
      return null;
    },
  },
  {
    id: 'discord', cat: 'diplomacy', label: 'Sow discord', icon: 'ico.discord', kind: 'brush', destructive: true, desc: 'Nations under the brush come to distrust everyone they know.',
    apply: (sim, x, y, r) => relationsBrush(sim, x, y, r, -25),
  },
  {
    id: 'harmony', cat: 'diplomacy', label: 'Harmony', icon: 'ico.harmony', kind: 'brush', desc: 'Nations under the brush warm to their neighbors.',
    apply: (sim, x, y, r) => relationsBrush(sim, x, y, r, 25),
  },
  {
    id: 'rebellion', cat: 'diplomacy', label: 'Incite unrest', icon: 'ico.rebellion', kind: 'brush', destructive: true, desc: 'Stir up unrest in settlements under the brush.',
    apply: (sim, x, y, r) => {
      for (const s of sim.w.settlements.values()) if ((s.x - x) ** 2 + (s.y - y) ** 2 <= (r + 1) ** 2) {
        s.unrest = Math.min(1, s.unrest + 0.35);
        s.loyalty = Math.max(0, s.loyalty - 0.3);
        const civ = sim.w.civs.get(s.civId);
        if (civ) civ.unrest = Math.min(1, civ.unrest + 0.1);
      }
      return null;
    },
  },
  {
    id: 'coup', cat: 'diplomacy', label: 'Coup', icon: 'ico.coup', kind: 'tap', destructive: true, desc: 'The military seizes power.',
    apply: (sim, x, y) => {
      const civ = civAt(sim, x, y);
      if (!civ || !civ.settlements.length) return 'Tap a nation';
      civ.inst.militaryInfluence = 0.9;
      civ.inst.participation *= 0.4;
      civ.inst.hereditary = 0.1;
      const g = createLeader(sim, civ);
      g.titles.push('General');
      crown(sim, civ, g, 'seized');
      return null;
    },
  },
  {
    id: 'bless_ruler', cat: 'diplomacy', label: 'Bless ruler', icon: 'ico.bless_ruler', kind: 'tap', desc: 'The ruler gains legitimacy and charisma.',
    apply: (sim, x, y) => {
      const civ = civAt(sim, x, y);
      if (!civ) return 'Tap a nation';
      civ.legitimacy = Math.min(1, civ.legitimacy + 0.3);
      const r = sim.w.persons.get(civ.rulerId);
      if (r && !r.traits.includes('charismatic')) r.traits.push('charismatic');
      return null;
    },
  },
  // ------------------------------------------------------------ war
  {
    id: 'war', cat: 'war', label: 'Declare war', icon: 'ico.war', kind: 'tap', destructive: true, desc: 'This nation declares war on the selected (or nearest) nation.',
    apply: (sim, x, y, _r, ctx) => {
      if (!sim.w.laws.warfare) return 'Warfare is disabled in World laws';
      const civ = civAt(sim, x, y);
      if (!civ) return 'Tap a nation';
      const other = targetCiv(sim, civ, ctx);
      if (!other) return 'No enemy available';
      if (atWarWith(sim, civ.id, other.id)) return 'Already at war';
      makeContact(sim, civ.id, other.id);
      declareWar(sim, civ, other, 'conquest', [{ label: 'Divine incitement', weight: 1 }]);
      return null;
    },
  },
  {
    id: 'spawn_army', cat: 'war', label: 'Raise army', icon: 'ico.spawn_army', kind: 'tap', desc: 'Grant the nation a well-equipped army here.',
    apply: (sim, x, y) => {
      const s = settlementAt(sim, x, y);
      const civ = s ? sim.w.civs.get(s.civId) : undefined;
      if (!s || !civ) return 'Tap a settlement';
      civ.stock[Good.ARMS] += 2000;
      s.garrison = 0;
      civ.budget.military = Math.min(0.6, civ.budget.military + 0.15);
      addPeople(sim, s, 500, s.cultures[0]?.id ?? 0, s.religions[0]?.id ?? 0);
      record(sim, s.civId, 'divine', 500);
      return null;
    },
  },
  {
    id: 'inspire_troops', cat: 'war', label: 'Inspire troops', icon: 'ico.inspire_troops', kind: 'brush', desc: 'Restore morale and supply of armies under the brush.',
    apply: (sim, x, y, r) => {
      for (const a of sim.w.armies.values()) if ((a.x - x) ** 2 + (a.y - y) ** 2 <= (r + 1) ** 2) {
        a.morale = 1;
        a.supply = 1;
      }
      return null;
    },
  },
  // ------------------------------------------------------------ disasters
  {
    id: 'dis_lightning', cat: 'disaster', label: 'Lightning', icon: 'ico.lightning', kind: 'tap', destructive: true, desc: 'Strike with lightning; dry land may catch fire.',
    apply: (sim, x, y) => {
      ignite(sim, sim.w.map.idx(x, y), 220);
      return null;
    },
  },
  {
    id: 'dis_fire', cat: 'disaster', label: 'Fire', icon: 'ico.fire', kind: 'brush', destructive: true, desc: 'Set the land ablaze.',
    apply: (sim, x, y, r) => {
      sim.w.map.forRadius(x, y, Math.max(0.5, r * 0.5), (i) => ignite(sim, i, 200));
      return null;
    },
  },
  disaster('meteor', 'Meteor', 'ico.meteor', 2), disaster('earthquake', 'Earthquake', 'ico.earthquake', 5), disaster('volcano', 'Eruption', 'ico.volcano', 4),
  disaster('flood', 'Flood', 'ico.flood', 5), disaster('storm', 'Storm', 'ico.storm', 6), disaster('drought', 'Drought', 'ico.drought', 8),
  disaster('plague', 'Plague', 'ico.plague', 1), disaster('tsunami', 'Tsunami', 'ico.tsunami', 6), disaster('blizzard', 'Blizzard', 'ico.blizzard', 6),
  // fictional horrors: god mode only (refused in observer worlds)
  horror('zombie', 'Zombie outbreak', 'ico.plague', 'The dead rise and turn the living. Hordes spread along roads; garrisons fight them and physicians race for a cure.'),
  horror('ghoul', 'Ghoul pack', 'ico.monster', 'Nocturnal scavengers crawl out of battlefields and ruins to raid the town until driven off.'),
  horror('blight', 'Creeping Blight', 'ico.fertility_down', 'A fungal rot destroys crops in the fields and in store, and spreads to linked towns.'),
  // ------------------------------------------------------------ modern & future
  {
    id: 'nuke', cat: 'future', label: 'Nuclear strike', icon: 'ico.nuke', kind: 'tap', destructive: true, desc: 'Catastrophic destruction, fallout and global outrage (needs the advanced weapons law).',
    apply: (sim, x, y) => {
      if (!sim.w.laws.advancedWeapons) return 'Enable "Advanced weapons" in World laws';
      const s = settlementAt(sim, x, y);
      if (!s) return 'Tap a settlement';
      nuclearStrike(sim, s);
      logEvent(sim, { type: 'god_nuke', cat: 'god', title: `${s.name} was destroyed by a nuclear blast`, settlements: [s.id], civs: [s.civId], x: s.x, y: s.y, importance: 5 });
      return null;
    },
  },
  {
    id: 'asteroid', cat: 'future', label: 'Asteroid impact', icon: 'ico.asteroid', kind: 'tap', destructive: true, desc: 'A great impact: firestorms, a crater and years of global cooling.',
    apply: (sim, x, y) => {
      asteroidImpact(sim, x, y, 'major', [{ label: 'Divine intervention', weight: 1 }]);
      return null;
    },
  },
  {
    id: 'supervolcano', cat: 'future', label: 'Supervolcano', icon: 'ico.volcano', kind: 'tap', destructive: true, desc: 'A supervolcano erupts here: ash buries the land and a volcanic winter cools the world for years.',
    apply: (sim, x, y) => {
      eruption(sim, 8, [x, y]);
      return null;
    },
  },
  {
    id: 'superflare', cat: 'future', label: 'Solar superflare', icon: 'ico.solar_flare', kind: 'tap', destructive: true, desc: 'A superflare burns out power grids and thins the ozone layer, damaging harvests for years.',
    apply: (sim) => {
      solarStorm(sim, true);
      return null;
    },
  },
  {
    id: 'gamma_burst', cat: 'future', label: 'Gamma-ray burst', icon: 'ico.solar_flare', kind: 'tap', destructive: true, desc: 'A dying star irradiates half the world and strips away the ozone layer.',
    apply: (sim) => {
      gammaRayBurst(sim);
      return null;
    },
  },
  {
    id: 'nuclear_war', cat: 'future', label: 'Nuclear exchange', icon: 'ico.nuke', kind: 'tap', destructive: true, desc: 'This nation launches its arsenal at the selected (or nearest) nation, which retaliates. Fallout and soot follow (needs the advanced weapons law).',
    apply: (sim, x, y, _r, ctx) => {
      if (!sim.w.laws.advancedWeapons) return 'Enable "Advanced weapons" in World laws';
      const civ = civAt(sim, x, y);
      if (!civ) return 'Tap a nation';
      const other = targetCiv(sim, civ, ctx);
      if (!other) return 'No enemy available';
      makeContact(sim, civ.id, other.id);
      forceExchange(sim, civ, other, 6);
      return null;
    },
  },
  {
    id: 'engineered_plague', cat: 'future', label: 'Lab-made plague', icon: 'ico.plague', kind: 'tap', destructive: true, desc: 'An engineered pathogen escapes from a laboratory in this nation.',
    apply: (sim, x, y) => {
      const civ = civAt(sim, x, y);
      if (!civ) return 'Tap a nation';
      releasePathogen(sim, civ, false, [{ label: 'Divine intervention', weight: 1 }]);
      return null;
    },
  },
  {
    id: 'infertility_plague', cat: 'future', label: 'Barren plague', icon: 'ico.plague', kind: 'tap', destructive: true, desc: 'A pathogen that leaves its survivors sterile spreads from this nation.',
    apply: (sim, x, y) => {
      const civ = civAt(sim, x, y);
      if (!civ) return 'Tap a nation';
      releasePathogen(sim, civ, true, [{ label: 'Divine intervention', weight: 1 }]);
      return null;
    },
  },
  {
    id: 'ai_uprising', cat: 'future', label: 'Rogue AI', icon: 'ico.ai_awaken', kind: 'tap', destructive: true, desc: 'A misaligned AI system seizes the infrastructure of a nation that has advanced AI.',
    apply: (sim, x, y) => {
      const civ = civAt(sim, x, y);
      if (!civ) return 'Tap a nation';
      if ((civ.techs['advanced_ai']?.adoption ?? 0) < 0.3) return 'This nation has no advanced AI yet';
      forceAITakeover(sim, civ);
      return null;
    },
  },
  {
    id: 'grey_goo', cat: 'future', label: 'Grey goo', icon: 'ico.anomaly', kind: 'tap', destructive: true, desc: 'Speculative: self-replicating nanomachines break loose (needs speculative technology).',
    apply: (sim, x, y) => {
      if (!sim.w.laws.speculativeTech) return 'Enable "Speculative technology" in World laws';
      const s = settlementAt(sim, x, y);
      const civ = s ? sim.w.civs.get(s.civId) : undefined;
      if (!s || !civ) return 'Tap a settlement';
      startGoo(sim, civ, s, [{ label: 'Divine intervention', weight: 1 }]);
      return null;
    },
  },
  {
    id: 'emp', cat: 'future', label: 'Solar storm', icon: 'ico.solar_flare', kind: 'tap', destructive: true, desc: 'A geomagnetic storm knocks out power grids and electronics worldwide for a while.',
    apply: (sim) => {
      let hit = 0;
      for (const c of sim.w.civs.values()) if (c.alive && c.caps.electrification > 0) {
        c.stock[Good.ENERGY] = 0;
        c.stock[Good.ELECTRONICS] *= 0.5;
        c.crisis = Math.max(c.crisis, 1);
        hit++;
      }
      logEvent(sim, { type: 'god_solar', cat: 'god', title: `A solar storm crippled power grids in ${hit} nations`, importance: 3 });
      return null;
    },
  },
  {
    id: 'alien', cat: 'future', label: 'First contact', icon: 'ico.alien', kind: 'tap', desc: 'Visitors from beyond share knowledge — and unsettle society.',
    apply: (sim, x, y) => {
      const civ = civAt(sim, x, y);
      if (!civ) return 'Tap a nation';
      for (let k = 0; k < 3; k++) {
        const opts = TECHS.filter((t) => !civ.techs[t.id]?.known && t.prereqs.every((p) => civ.techs[p]?.known) && t.realism !== 'speculative');
        if (opts.length) grantTech(sim, civ, sim.rng.pick(opts).id, 'god');
      }
      civ.stability = Math.max(0, civ.stability - 0.2);
      logEvent(sim, { type: 'god_alien', cat: 'god', title: `Visitors from the stars made contact with ${civ.name}`, civs: [civ.id], x, y, importance: 4 });
      return null;
    },
  },
  {
    id: 'climate_warm', cat: 'future', label: 'Warm the world', icon: 'ico.climate_warm', kind: 'tap', desc: 'Raise global temperature by 1°C (shifts harvests, ice and seas).',
    apply: (sim) => {
      sim.w.climate.anomaly += 1;
      sim.w.climate.co2 *= 1.25;
      return null;
    },
  },
  {
    id: 'climate_cool', cat: 'future', label: 'Cool the world', icon: 'ico.climate_cool', kind: 'tap', desc: 'Lower global temperature by 1°C.',
    apply: (sim) => {
      sim.w.climate.anomaly -= 1;
      sim.w.climate.co2 = Math.max(sim.w.climate.baseCo2, sim.w.climate.co2 * 0.8);
      return null;
    },
  },
  {
    id: 'ai_awaken', cat: 'future', label: 'Machine awakening', icon: 'ico.ai_awaken', kind: 'tap', desc: 'Speculative: a nation’s AI leaps ahead (needs speculative technology).',
    apply: (sim, x, y) => {
      if (!sim.w.laws.speculativeTech) return 'Enable "Speculative technology" in World laws';
      const civ = civAt(sim, x, y);
      if (!civ) return 'Tap a nation';
      for (const id of ['machine_learning', 'advanced_ai', 'ai_governance', 'general_ai']) grantTech(sim, civ, id, 'god');
      return null;
    },
  },
];

function relationsBrush(sim: Sim, x: number, y: number, r: number, delta: number): string | null {
  const civs = new Set<number>();
  sim.w.map.forRadius(x, y, r, (i) => {
    if (sim.w.map.owner[i]) civs.add(sim.w.map.owner[i]);
  });
  if (!civs.size) return 'No nation here';
  for (const id of civs) {
    const c = sim.w.civs.get(id);
    if (!c) continue;
    for (const o of c.knownCivs) {
      const rel = ensureRelation(sim, id, o);
      rel.opinion = clamp(rel.opinion + delta, -100, 100);
    }
  }
  return null;
}

/** Round 10: literal powers allowed in Realistic worlds (the factories above tag their own). */

export const POWER_BY_ID: Record<string, PowerDef> = Object.fromEntries(POWERS.map((p) => [p.id, p]));

/** Powers that create fictional (god-mode-only) threats. */
export const HORROR_POWERS: ReadonlySet<string> = new Set(['horror_zombie', 'horror_ghoul', 'horror_blight']);

/** Apply a power and log the intervention (for reproducible timelines). */
export function applyPower(sim: Sim, id: string, x: number, y: number, r: number, ctx: PowerCtx): string | null {
  const p = POWER_BY_ID[id];
  if (!p || !sim.w.map.inBounds(x, y)) return null;
  // round 10: Observer worlds allow no powers; Realistic worlds only the grounded ones (never fictional threats)
  if (!powerAllowed(sim.w.meta.settings, p)) {
    return powerSetOf(sim.w.meta.settings) === 'grounded'
      ? 'Not available in this world: Realistic lets you place only people and animals.'
      : 'Not available in this world: Observer allows no powers.';
  }
  // one tap, one effect: the registry draws it (sim/conceptFx.ts); events the power logs stay quiet
  const res = withPowerFx(sim, id, x, y, r, () => p.apply(sim, x, y, r, ctx), (out) => out === null);
  if (res === null) {
    sim.w.interventions.push({ tick: sim.w.tick, power: id, x, y, r, target: ctx.selectedCiv });
    if (sim.w.interventions.length > 5000) sim.w.interventions.splice(0, 1000);
  }
  return res;
}

/** Called when a terrain stroke ends: rebuild rivers/lakes for the edited land. */
export function endStroke(sim: Sim, id: string): void {
  const p = POWER_BY_ID[id];
  if (!p || p.cat !== 'terrain') return;
  // rivers/lakes follow the new land; what they change (e.g. a valley flooded behind a new ridge)
  // belongs to this stroke, so undo can give the valley back
  undo.captureDerived(sim, () => afterTerrainEdit(sim));
}
