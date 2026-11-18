/**
 * Environment & climate.
 *
 * REGIONAL WEATHER: each climate cell carries a precipitation anomaly and a
 * heat anomaly following an AR(1) process (persistence + noise), so droughts
 * and wet spells are spatially coherent and last seasons to years. Their
 * variance grows with global warming. Drought lowers farm yields (economy) →
 * famine/migration/unrest (demography, politics) — a causal chain, not an
 * animation.
 *
 * GLOBAL CLIMATE: emissions from burning coal/oil/gas raise CO2; radiative
 * forcing ~ 5.35 ln(C/C0) W/m^2 (Myhre et al. 1998) times a sensitivity of
 * ~0.8 K per W/m^2 (~3 K per doubling, IPCC AR6 central estimate) sets an
 * equilibrium anomaly that the actual anomaly approaches with a lag. Volcanic,
 * impact or nuclear aerosols cool temporarily. Warming raises sea level slowly
 * (flooding the lowest coasts), shifts yields and stresses ecosystems.
 *
 * HAZARDS: wildfires (dry, vegetated land), earthquakes, volcanic eruptions
 * (at vents), floods (wet anomalies near rivers), storms (warm coasts),
 * each with real damage to people, buildings, vegetation and soils.
 */
import { flow } from '../population/ledger';
import type { Sim } from '../sim/context';
import { addFx, markTile } from '../sim/context';
import { BALANCE } from '../config/balance';
import { clamp, clamp01, DX4, DY4 } from '../core/math';
import { T, isWaterTerrain } from './terrain';
import { HAZARD } from './tilemap';
import { B } from '../civilizations/buildingTypes';
import { removeBuilding } from '../civilizations/urban';
import { removePeople } from '../population/demography';
import { logEvent } from '../history/events';
import type { Cause, EndingType, Settlement } from '../sim/types';
import { addPressure } from '../civilizations/endings';

export function initClimate(w: { map: { w: number; h: number } }) {
  const cellSize = 16;
  const cellsX = Math.ceil(w.map.w / cellSize);
  const cellsY = Math.ceil(w.map.h / cellSize);
  return {
    co2: 280,
    baseCo2: 280,
    anomaly: 0,
    seaLevel: 0,
    cellSize,
    cellsX,
    cellsY,
    rain: new Array(cellsX * cellsY).fill(0),
    heat: new Array(cellsX * cellsY).fill(0),
    aerosol: 0,
    cumulativeEmissions: 0,
  };
}

function fires(sim: Sim): Set<number> {
  let f = sim.cache.fires as Set<number> | undefined;
  if (!f) {
    f = new Set();
    const m = sim.w.map;
    for (let i = 0; i < m.n; i++) if (m.fire[i]) f.add(i);
    sim.cache.fires = f;
  }
  return f;
}

export function ignite(sim: Sim, i: number, intensity = 160): void {
  const m = sim.w.map;
  if (isWaterTerrain(m.terrain[i])) return;
  m.fire[i] = Math.max(m.fire[i], intensity);
  fires(sim).add(i);
  markTile(sim, i);
}

/** Per-tick: fire spread and burnout. */
export function environmentTick(sim: Sim): void {
  const w = sim.w;
  const m = w.map;
  const rng = sim.rng;
  const set = fires(sim);
  if (!set.size) return;
  const cur = [...set].sort((a, b) => a - b); // index order: identical after a save/load rebuild
  for (const i of cur) {
    const x = i % m.w;
    const y = (i / m.w) | 0;
    // burn fuel
    m.veg[i] = Math.max(0, m.veg[i] - 6);
    m.fire[i] = Math.max(0, m.fire[i] - (m.veg[i] > 20 ? 2 : 12));
    if (m.bld[i] && m.bld[i] !== B.RUINS && m.bld[i] !== B.CRATER && rng.chance(0.02)) {
      removeBuilding(sim, i, true);
    }
    if (m.fire[i] === 0) {
      set.delete(i);
      markTile(sim, i);
      continue;
    }
    // spread to neighbours with fuel; dryness raises spread
    const c = w.climate;
    const cell = ((y / c.cellSize) | 0) * c.cellsX + ((x / c.cellSize) | 0);
    const dry = clamp01(0.6 - m.moist[i] / 400 - (c.rain[cell] ?? 0) * 0.5);
    for (let d = 0; d < 4; d++) {
      const nx = x + DX4[d];
      const ny = y + DY4[d];
      if (!m.inBounds(nx, ny)) continue;
      const j = ny * m.w + nx;
      if (m.fire[j] || isWaterTerrain(m.terrain[j]) || m.veg[j] < 30) continue;
      if (rng.float() < BALANCE.fireSpread * dry * (m.veg[j] / 255) * 0.25) ignite(sim, j, 140);
    }
  }
}

/** Monthly regional weather anomalies (AR(1)) and random natural hazards. */
export function climateMonthly(sim: Sim): void {
  const w = sim.w;
  const c = w.climate;
  const rng = sim.rng;
  const vol = 0.18 * (1 + Math.max(0, c.anomaly) * 0.25);
  for (let k = 0; k < c.rain.length; k++) {
    // spatially correlated noise: blend own noise with a neighbour's previous state
    const nb = c.rain[(k + 1) % c.rain.length];
    c.rain[k] = clamp(c.rain[k] * 0.9 + nb * 0.03 + rng.normal() * vol * 0.45, -1, 1);
    c.heat[k] = clamp(c.heat[k] * 0.92 + rng.normal() * 0.35, -4, 4);
  }
  c.aerosol = Math.max(0, c.aerosol * 0.95 - 0.002);
  // stratospheric soot from burning cities lingers for years (e-folding ~5.5 years)
  if (c.soot) {
    c.soot *= 0.985;
    if (c.soot < 0.01) delete c.soot;
  }
  const e = w.endings;
  if (e && e.uv > 0) e.uv = Math.max(0, e.uv * 0.97 - 0.001);
  if (!w.laws.disasters) return;
  const freq = w.meta.settings.disasterFrequency;
  if (freq <= 0) return;
  const m = w.map;
  // wildfire from lightning on dry vegetated land
  for (let k = 0; k < 3; k++) {
    const i = rng.int(0, m.n - 1);
    if (isWaterTerrain(m.terrain[i]) || m.veg[i] < 120) continue;
    const x = i % m.w;
    const y = (i / m.w) | 0;
    const cell = ((y / c.cellSize) | 0) * c.cellsX + ((x / c.cellSize) | 0);
    if (c.rain[cell] < -0.3 && rng.chance(0.15 * freq)) ignite(sim, i, 200);
  }
  if (rng.chance(0.012 * freq)) {
    const kinds = ['earthquake', 'volcano', 'flood', 'storm'];
    const kind = rng.pick(kinds);
    const site = pickHazardSite(sim, kind);
    if (site >= 0) triggerDisaster(sim, kind, site % m.w, (site / m.w) | 0, kind === 'storm' ? 5 : 3, true);
  }
}

function pickHazardSite(sim: Sim, kind: string): number {
  const m = sim.w.map;
  const rng = sim.rng;
  for (let tries = 0; tries < 40; tries++) {
    const i = rng.int(0, m.n - 1);
    const t = m.terrain[i];
    if (kind === 'volcano' && m.hazard[i] & HAZARD.VENT) return i;
    if (kind === 'earthquake' && (t === T.MOUNTAIN || t === T.HILLS || t === T.VOLCANIC)) return i;
    if (kind === 'flood' && m.river[i] > 20) {
      const c = sim.w.climate;
      const cell = (((i / m.w) | 0) / c.cellSize | 0) * c.cellsX + ((i % m.w) / c.cellSize | 0);
      if (c.rain[cell] > 0.35) return i;
    }
    if (kind === 'storm' && m.isLand(i) && m.isCoastal(i) && m.temp[i] > 20) return i;
  }
  return -1;
}

function settlementsNear(sim: Sim, x: number, y: number, r: number): Settlement[] {
  const out: Settlement[] = [];
  for (const s of sim.w.settlements.values()) if ((s.x - x) ** 2 + (s.y - y) ** 2 <= (r + s.radius) ** 2) out.push(s);
  return out;
}

const DISASTER_NAMES: Record<string, string> = {
  earthquake: 'An earthquake', volcano: 'A volcanic eruption', flood: 'A great flood', storm: 'A storm', meteor: 'A meteor strike',
  tsunami: 'A tsunami', drought: 'A drought', blizzard: 'A blizzard', lightning: 'Lightning', fire: 'A fire', plague: 'A plague',
};

/** Apply a disaster's physical and human effects. Also used by god powers. */
export function triggerDisaster(sim: Sim, kind: string, x: number, y: number, r: number, natural = false, pressure: EndingType = 'disaster', severityMult = 1, causes?: Cause[]): void {
  const w = sim.w;
  const m = w.map;
  const rng = sim.rng;
  let deaths = 0;
  let destroyed = 0;
  const severity = (kind === 'meteor' ? 1 : kind === 'volcano' ? 0.8 : kind === 'earthquake' ? 0.6 : kind === 'tsunami' ? 0.7 : 0.4) * severityMult;
  m.forRadius(x, y, r, (i, tx, ty, d2) => {
    const close = 1 - Math.sqrt(d2) / (r + 0.01);
    switch (kind) {
      case 'earthquake':
        m.hazard[i] |= HAZARD.QUAKE;
        if (m.bld[i] && rng.chance(0.25 * close)) {
          removeBuilding(sim, i, true);
          destroyed++;
        }
        break;
      case 'volcano':
        if (d2 < 2) m.terrain[i] = T.VOLCANIC;
        if (m.isLand(i)) {
          m.veg[i] = Math.round(m.veg[i] * 0.2);
          m.fert[i] = Math.min(255, m.fert[i] + 15); // ash enriches soils later
          if (rng.chance(0.4 * close)) ignite(sim, i, 220);
          if (m.bld[i] && rng.chance(0.5 * close)) {
            removeBuilding(sim, i, true);
            destroyed++;
          }
        }
        break;
      case 'flood':
      case 'tsunami':
        if (m.isLand(i) && m.elev[i] < (kind === 'tsunami' ? 0.12 : 0.2)) {
          m.hazard[i] |= HAZARD.FLOODED;
          if (m.bld[i] && rng.chance(0.18 * close)) {
            removeBuilding(sim, i, true);
            destroyed++;
          }
        }
        break;
      case 'storm':
        if (m.isLand(i)) {
          m.veg[i] = Math.round(m.veg[i] * 0.85);
          if (m.bld[i] && rng.chance(0.08 * close)) {
            removeBuilding(sim, i, true);
            destroyed++;
          }
        }
        break;
      case 'meteor':
        if (d2 <= 1.5) {
          if (m.bld[i]) removeBuilding(sim, i, false);
          m.bld[i] = B.CRATER;
          m.bldFlags[i] = 0;
          m.veg[i] = 0;
        } else if (m.isLand(i) && rng.chance(0.5 * close)) ignite(sim, i, 230);
        break;
      case 'drought':
        break;
      case 'blizzard':
        m.veg[i] = Math.round(m.veg[i] * 0.9);
        break;
      case 'fire':
      case 'lightning':
        if (d2 <= (kind === 'lightning' ? 0.6 : r * r)) ignite(sim, i, 220);
        break;
    }
    markTile(sim, i);
  });
  if (kind === 'drought') {
    const c = w.climate;
    const cell = ((y / c.cellSize) | 0) * c.cellsX + ((x / c.cellSize) | 0);
    for (let k = 0; k < c.rain.length; k++) {
      const cx = k % c.cellsX;
      const cy = (k / c.cellsX) | 0;
      if (Math.abs(cx - (cell % c.cellsX)) <= 1 && Math.abs(cy - ((cell / c.cellsX) | 0)) <= 1) c.rain[k] = -0.9;
    }
  }
  if (kind === 'meteor' && r >= 4) w.climate.aerosol += 0.3;
  if (kind === 'volcano') w.climate.aerosol += 0.05;
  const hit = settlementsNear(sim, x, y, r);
  for (const s of hit) {
    if (kind === 'drought' || kind === 'fire' || kind === 'lightning') continue;
    const d = Math.hypot(s.x - x, s.y - y);
    const share = clamp01(1 - d / (r + s.radius + 1)) * severity * (kind === 'storm' ? 0.02 : kind === 'flood' ? 0.03 : 0.08);
    const dead = removePeople(sim, s, s.pop * Math.min(1, share), kind);
    flow(sim, s, 'disaster', dead);
    addPressure(sim, s.civId, pressure, dead, `${DISASTER_NAMES[kind] ?? 'A disaster'} near ${s.name}`);
    deaths += dead;
    s.unrest = clamp01(s.unrest + share * 2);
  }
  addFx(sim, kind === 'volcano' ? 'fx.explosion' : kind === 'earthquake' ? 'fx.quake' : kind === 'flood' || kind === 'tsunami' ? 'fx.flood' : kind === 'storm' ? 'fx.tornado' : kind === 'meteor' ? 'fx.explosion' : 'fx.fire', x, y, 3, r);
  if (deaths > 10 || destroyed > 2 || !natural || kind === 'volcano')
    logEvent(sim, {
      type: 'disaster',
      cat: 'disaster',
      title: `${DISASTER_NAMES[kind] ?? 'A disaster'} ${hit.length ? `struck ${hit.map((s) => s.name).slice(0, 2).join(' and ')}` : 'shook uninhabited land'}${deaths >= 1 ? ` (${Math.round(deaths).toLocaleString('en-US')} dead)` : ''}`,
      civs: [...new Set(hit.map((s) => s.civId))],
      settlements: hit.map((s) => s.id),
      x,
      y,
      importance: deaths > 5000 ? 4 : deaths > 100 || destroyed > 5 ? 3 : 2,
      causes: causes ?? (natural ? undefined : [{ label: 'Divine intervention', weight: 1 }]),
    });
}

/** Yearly global climate, sea level and pollution dynamics. */
export function climateYearly(sim: Sim): void {
  const w = sim.w;
  const c = w.climate;
  const m = w.map;
  if (w.laws.climateChange) {
    let emissions = 0;
    let capture = 0;
    for (const civ of w.civs.values()) {
      if (!civ.alive) continue;
      emissions += civ.econ.emissions;
      capture += civ.caps.carbonCapture * civ.econ.emissions * 0.3;
    }
    c.cumulativeEmissions += emissions;
    // emissions -> ppm (stylized conversion), minus slow natural uptake toward baseline
    // The map is the whole planet: a larger map holds more fossil fuel but not a larger atmosphere, so
    // the conversion is normalized to the 128x128 reference world.
    const areaScale = 16384 / (m.w * m.h);
    c.co2 += (emissions - capture) * BALANCE.emissionToPpm * areaScale * 1e6 - (c.co2 - c.baseCo2) * 0.004;
    c.co2 = Math.max(c.baseCo2 * 0.9, c.co2);
    const forcing = BALANCE.co2Forcing * Math.log(c.co2 / c.baseCo2);
    const equilibrium = BALANCE.climateSensitivity * forcing;
    c.anomaly += (equilibrium - c.anomaly) * 0.03;
    // tipping point: past 3 °C, thawing permafrost, burning forests and darkening ice add CO2 on their own
    if (c.anomaly > 3) {
      const fb = (c.anomaly - 3) * 2;
      c.feedback = (c.feedback ?? 0) + fb;
      c.co2 += fb;
      if (w.milestones['climate_tipping'] === undefined) {
        w.milestones['climate_tipping'] = sim.year;
        logEvent(sim, { type: 'climate_tipping', cat: 'disaster', title: 'The climate passed a tipping point: warming now feeds itself', importance: 5, causes: [{ label: `Global warming of ${c.anomaly.toFixed(1)}°C`, weight: 0.6 }, { label: `CO2 at ${Math.round(c.co2)} ppm`, weight: 0.4 }] });
      }
    }
    // thermal expansion + ice melt (stylized, slow)
    c.seaLevel += Math.max(0, c.anomaly) * 0.004;
    if (c.seaLevel > 0.3) floodCoasts(sim, c.seaLevel);
  }
  // pollution decays and diffuses slightly
  if ((w.tick / 120) % 1 === 0) {
    for (let i = 0; i < m.n; i++) {
      if (!m.pollution[i]) continue;
      m.pollution[i] = Math.max(0, Math.floor(m.pollution[i] * 0.93));
      if (m.hazard[i] & HAZARD.RADIATION && sim.rng.chance(0.02)) m.hazard[i] &= ~HAZARD.RADIATION;
    }
  }
}

function floodCoasts(sim: Sim, seaLevel: number): void {
  const m = sim.w.map;
  const threshold = seaLevel * 0.02; // meters -> elevation units (stylized)
  let flooded = 0;
  for (let k = 0; k < 200; k++) {
    const i = sim.rng.int(0, m.n - 1);
    if (m.isLand(i) && m.elev[i] < threshold && m.isCoastal(i) && m.terrain[i] !== T.MOUNTAIN) {
      if (m.bld[i]) removeBuilding(sim, i, false);
      m.terrain[i] = T.SHALLOW;
      m.elev[i] = -0.01;
      markTile(sim, i);
      flooded++;
    }
  }
  if (flooded > 3 && sim.rng.chance(0.2))
    logEvent(sim, { type: 'sea_level', cat: 'disaster', title: `Rising seas swallowed coastal land`, importance: 2, causes: [{ label: `Global warming of ${sim.w.climate.anomaly.toFixed(1)}°C`, weight: 1 }] });
}
