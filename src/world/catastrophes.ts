/**
 * Rare natural catastrophes (yearly, world level), with base rates of the real order of magnitude so
 * that rare things stay rare (rates are per world-year, scaled by the disaster-frequency setting):
 *
 *   regional airburst (~50-100 m impactor)   1 / 800      (Tunguska-class: no crater, forest flattened and charred)
 *   major impact (~1 km)                     1 / 300,000  (impact winter)
 *   extinction-class impact (~10 km)         1 / 1e8
 *   VEI-7 eruption                           1 / 1,000    ("year without a summer")
 *   supervolcano (VEI-8)                     1 / 60,000   (volcanic winter, ash)
 *   severe geomagnetic storm                 1 / 150      (grids and electronics only)
 *   solar superflare                         1 / 20,000   (grids, ozone loss)
 *   nearby gamma-ray burst                   1 / 1e8      (radiation, ozone stripped)
 *   natural infertility pathogen             1 / 40,000
 *
 * Each catastrophe acts through the existing systems: deaths are ledger flows ('disaster') with typed
 * existential pressure, aerosols cool the climate (crop losses in production.ts), ozone loss raises UV
 * stress, and famine under strong cooling is attributed to its source. The same functions serve god
 * powers and tests.
 */
import type { Sim } from '../sim/context';
import type { Cause, Settlement } from '../sim/types';
import { clamp01 } from '../core/math';
import { Good } from './resources';
import { HAZARD } from './tilemap';
import { T } from './terrain';
import { triggerDisaster } from './environment';
import { removePeople } from '../population/demography';
import { flow } from '../population/ledger';
import { logEvent } from '../history/events';
import { addPressure, logCatastrophe, worldEndings } from '../civilizations/endings';
import { infect } from '../population/disease';
import { markTile } from '../sim/context';

export const CATASTROPHE_RATES = {
  airburst: 1 / 800,
  majorImpact: 1 / 300000,
  extinctionImpact: 1e-8,
  vei7: 1 / 1000,
  supervolcano: 1 / 60000,
  geomagnetic: 1 / 150,
  superflare: 1 / 20000,
  gammaRayBurst: 1e-8,
  infertility: 1 / 40000,
} as const;

/**
 * Task 8 part C: an airburst flattens forest over about 2,150 km² (Tunguska, 1908); at ~100 km² a tile that is 21 tiles,
 * a radius of 2.6. It explodes 5-10 km up, so it leaves no crater (research-notes.md §3).
 */
export const AIRBURST_RADIUS = 2.6;

export function catastrophesYearly(sim: Sim): void {
  const w = sim.w;
  if (!w.laws.disasters) return;
  const f = w.meta.settings.disasterFrequency;
  if (f <= 0) return;
  const rng = sim.rng;
  const R = CATASTROPHE_RATES;
  const m = w.map;
  const randomLand = (): [number, number] => {
    for (let k = 0; k < 40; k++) {
      const i = rng.int(0, m.n - 1);
      if (m.isLand(i)) return [m.xOf(i), m.yOf(i)];
    }
    return [m.w >> 1, m.h >> 1];
  };
  if (rng.chance(R.airburst * f)) { const [x, y] = randomLand(); asteroidImpact(sim, x, y, 'airburst'); }
  if (rng.chance(R.majorImpact * f)) { const [x, y] = randomLand(); asteroidImpact(sim, x, y, 'major'); }
  if (rng.chance(R.extinctionImpact * f)) { const [x, y] = randomLand(); asteroidImpact(sim, x, y, 'extinction'); }
  if (rng.chance(R.vei7 * f)) eruption(sim, 7);
  if (rng.chance(R.supervolcano * f)) eruption(sim, 8);
  if (rng.chance(R.geomagnetic * f)) solarStorm(sim, false);
  if (rng.chance(R.superflare * f)) solarStorm(sim, true);
  if (rng.chance(R.gammaRayBurst * f)) gammaRayBurst(sim);
  if (w.laws.diseases && rng.chance(R.infertility * f)) {
    const towns = [...w.settlements.values()].filter((s) => s.pop > 1000);
    if (towns.length) naturalInfertility(sim, rng.pick(towns));
  }
}

function globalShock(sim: Sim, share: number, type: 'asteroid' | 'supervolcano' | 'cosmic', label: string, filter?: (s: Settlement) => boolean): number {
  let dead = 0;
  for (const s of sim.w.settlements.values()) {
    if (filter && !filter(s)) continue;
    const d = removePeople(sim, s, s.pop * share, label);
    flow(sim, s, 'disaster', d);
    addPressure(sim, s.civId, type, d, label);
    s.unrest = clamp01(s.unrest + share * 3);
    dead += d;
  }
  return dead;
}

/** An asteroid impact: local devastation, and for large impactors global firestorms and impact winter. */
export function asteroidImpact(sim: Sim, x: number, y: number, size: 'airburst' | 'major' | 'extinction', causes?: Cause[]): void {
  const w = sim.w;
  const e = worldEndings(sim);
  const c: Cause[] = causes ?? [{ label: size === 'airburst' ? 'A stony meteoroid exploded in the atmosphere' : `An impactor about ${size === 'major' ? '1 km' : '10 km'} across`, weight: 1 }];
  if (size === 'airburst') {
    triggerDisaster(sim, 'airburst', x, y, AIRBURST_RADIUS, true, 'asteroid', 1, c);
    logCatastrophe(sim, 'airburst', x, y);
    return;
  }
  const r = size === 'major' ? 7 : 14;
  triggerDisaster(sim, 'meteor', x, y, r, true, 'asteroid', size === 'major' ? 3 : 8, c);
  const dead = globalShock(sim, size === 'major' ? 0.02 : 0.3, 'asteroid', 'impact firestorms and ejecta');
  w.climate.aerosol += size === 'major' ? 4 : 14;
  e.coolingSource = 'asteroid';
  logCatastrophe(sim, size === 'major' ? 'major_impact' : 'extinction_impact', x, y);
  logEvent(sim, {
    type: 'impact', cat: 'disaster', title: size === 'major' ? 'A great asteroid struck the world: firestorms and an impact winter followed' : 'A planet-killing asteroid struck the world',
    text: `About ${Math.round(dead).toLocaleString('en-US')} died far from the impact in the first year.`,
    x, y, importance: 5, causes: [...c, { label: 'Dust and soot in the stratosphere', weight: 0.5 }],
  });
}

/** VEI-7 or VEI-8 eruption at a volcanic vent (or the given point). */
export function eruption(sim: Sim, vei: 7 | 8, at?: [number, number]): void {
  const w = sim.w;
  const m = w.map;
  const e = worldEndings(sim);
  let x = at?.[0] ?? -1;
  let y = at?.[1] ?? -1;
  if (x < 0) {
    const vents: number[] = [];
    for (let i = 0; i < m.n; i++) if (m.hazard[i] & HAZARD.VENT) vents.push(i);
    const i = vents.length ? sim.rng.pick(vents) : sim.rng.int(0, m.n - 1);
    x = m.xOf(i);
    y = m.yOf(i);
  }
  const causes: Cause[] = [{ label: vei === 8 ? 'A supervolcanic magma chamber emptied' : 'A massive explosive eruption', weight: 1 }];
  triggerDisaster(sim, 'volcano', x, y, vei === 8 ? 10 : 5, true, 'supervolcano', vei === 8 ? 4 : 2, causes);
  if (vei === 8) {
    // ash buries farmland far around
    m.forRadius(x, y, 14, (i, _x, _y, d2) => {
      if (!m.isLand(i)) return;
      m.veg[i] = Math.round(m.veg[i] * 0.2);
      if (d2 < 36 && m.terrain[i] !== T.MOUNTAIN) m.terrain[i] = T.ASH;
      markTile(sim, i);
    });
    globalShock(sim, 0.01, 'supervolcano', 'ashfall and acid rain');
  }
  w.climate.aerosol += vei === 8 ? 7 : 1;
  e.coolingSource = 'supervolcano';
  logCatastrophe(sim, vei === 8 ? 'supervolcano' : 'vei7', x, y);
  logEvent(sim, {
    type: vei === 8 ? 'supervolcano' : 'great_eruption', cat: 'disaster',
    title: vei === 8 ? 'A supervolcano erupted: ash buried the land and a volcanic winter began' : 'A colossal eruption darkened the skies: a year without a summer followed',
    x, y, importance: vei === 8 ? 5 : 4, causes: [...causes, { label: 'Sulfate aerosols in the stratosphere', weight: 0.5 }],
  });
}

/** A severe geomagnetic storm (grids only) or a solar superflare (grids and ozone). */
export function solarStorm(sim: Sim, superflare: boolean): void {
  const w = sim.w;
  const e = worldEndings(sim);
  let hit = 0;
  for (const c of w.civs.values()) {
    if (!c.alive || c.caps.electrification <= 0) continue;
    c.stock[Good.ENERGY] = 0;
    c.stock[Good.ELECTRONICS] *= superflare ? 0.1 : 0.5;
    c.crisis = Math.max(c.crisis, superflare ? 3 : 1);
    hit++;
  }
  if (superflare) e.uv = Math.min(1, e.uv + 0.4);
  logCatastrophe(sim, superflare ? 'superflare' : 'geomagnetic_storm', -1, -1);
  if (hit || superflare)
    logEvent(sim, {
      type: superflare ? 'superflare' : 'geomagnetic_storm', cat: 'disaster',
      title: superflare ? `A solar superflare burned out power grids in ${hit} nations and thinned the ozone layer` : `A geomagnetic storm knocked out power grids in ${hit} nations`,
      importance: superflare ? 5 : 3, causes: [{ label: superflare ? 'A superflare on the sun' : 'A coronal mass ejection', weight: 1 }],
    });
}

/** A nearby gamma-ray burst: radiation on one hemisphere and the ozone layer stripped for years. */
export function gammaRayBurst(sim: Sim): void {
  const w = sim.w;
  const e = worldEndings(sim);
  const left = sim.rng.chance(0.5);
  const half = w.map.w / 2;
  const dead = globalShock(sim, 0.05, 'cosmic', 'gamma-ray burst radiation', (s) => (left ? s.x < half : s.x >= half));
  e.uv = 1;
  w.climate.aerosol += 2; // nitrogen oxides dim the sun
  e.coolingSource = 'cosmic';
  logCatastrophe(sim, 'gamma_ray_burst', -1, -1);
  logEvent(sim, {
    type: 'gamma_ray_burst', cat: 'disaster', title: 'A gamma-ray burst from a dying star swept the world and stripped away the ozone layer',
    text: `About ${Math.round(dead).toLocaleString('en-US')} died of radiation.`, importance: 5,
    causes: [{ label: 'A collapsing massive star within a few thousand light years', weight: 1 }],
  });
}

/** A natural pathogen that leaves the recovered sterile. */
export function naturalInfertility(sim: Sim, s: Settlement): void {
  const w = sim.w;
  const d = {
    id: ++w.ids.disease, name: `${s.name} Barrenness`, r0: sim.rng.range(3, 6), lethality: 0.002, duration: 1.5, immunity: 1200,
    origin: s.id, emerged: sim.year, zoonotic: true, totalDeaths: 0, sterilizing: true,
  };
  w.diseases.set(d.id, d);
  infect(sim, s, d, 0.01);
  logCatastrophe(sim, 'infertility_pathogen', s.x, s.y);
  logEvent(sim, { type: 'infertility_outbreak', cat: 'demography', title: `A sickness that leaves its survivors sterile emerged in ${s.name}`, civs: [s.civId], settlements: [s.id], x: s.x, y: s.y, importance: 4, causes: [{ label: 'Spillover of an unknown pathogen', weight: 1 }] });
}
