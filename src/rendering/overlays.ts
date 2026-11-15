/**
 * Map overlay modes. Every color is computed from live simulation state.
 * Overlays render at 4 px per tile so political borders can be drawn as crisp
 * edges; heat-map modes use the same canvas.
 */
import { decodeTerritory } from '../history/stats';
import type { Sim } from '../sim/context';
import { hexToRgb } from './art/palette';
import { Deposit } from '../world/resources';
import { hash3 } from '../core/rng';
import { getRelation } from '../civilizations/knowledge';
import { atWarWith } from '../politics/diplomacy';
import { INFRA } from '../world/tilemap';
import { localHeat } from '../ecology/ecology';

export type OverlayMode =
  | 'terrain' | 'political' | 'population' | 'technology' | 'religion' | 'culture' | 'language' | 'resources'
  | 'economy' | 'trade' | 'military' | 'diplomacy' | 'pollution' | 'climate' | 'infrastructure' | 'history';

export const OVERLAYS: { mode: OverlayMode; label: string; icon: string; legend: string }[] = [
  { mode: 'terrain', label: 'Terrain', icon: 'ico.ov_terrain', legend: 'The land itself, without overlays.' },
  { mode: 'political', label: 'Nations', icon: 'ico.ov_political', legend: 'Territory of each civilization.' },
  { mode: 'population', label: 'Population', icon: 'ico.ov_population', legend: 'Brighter = more people in the controlling settlement.' },
  { mode: 'technology', label: 'Technology', icon: 'ico.ov_tech', legend: 'Era of the controlling civilization: violet (prehistoric) to cyan (future).' },
  { mode: 'religion', label: 'Religion', icon: 'ico.ov_religion', legend: 'Majority faith of each settlement; gray = mostly non-religious.' },
  { mode: 'culture', label: 'Culture', icon: 'ico.ov_culture', legend: 'Majority culture of each settlement.' },
  { mode: 'language', label: 'Language', icon: 'ico.ov_language', legend: 'Language families (related languages share a color).' },
  { mode: 'resources', label: 'Resources', icon: 'ico.ov_resources', legend: 'Mineral, energy and biological deposits.' },
  { mode: 'economy', label: 'Economy', icon: 'ico.ov_economy', legend: 'Output per person of the controlling civilization.' },
  { mode: 'trade', label: 'Trade', icon: 'ico.ov_trade', legend: 'Active trade routes; thicker = more value traded.' },
  { mode: 'military', label: 'Military', icon: 'ico.ov_military', legend: 'Red = at war, armies highlighted.' },
  { mode: 'diplomacy', label: 'Diplomacy', icon: 'ico.ov_diplomacy', legend: 'Attitudes toward the selected civilization: green friendly, red hostile.' },
  { mode: 'pollution', label: 'Pollution', icon: 'ico.ov_pollution', legend: 'Local pollution from industry, power and mining.' },
  { mode: 'climate', label: 'Climate', icon: 'ico.ov_climate', legend: 'Current temperature including climate change and regional anomalies.' },
  { mode: 'infrastructure', label: 'Infrastructure', icon: 'ico.ov_infrastructure', legend: 'Roads (brown), railways (dark), power grids (yellow).' },
  { mode: 'history', label: 'Past borders', icon: 'ico.ov_history', legend: 'Historical territory: nations as they stood in the chosen year (recorded every 25 years).' },
];

const DEP_COLORS: Record<number, [number, number, number]> = {
  [Deposit.COPPER]: [205, 120, 60], [Deposit.TIN]: [190, 190, 200], [Deposit.IRON]: [150, 90, 70], [Deposit.GOLD]: [250, 210, 50],
  [Deposit.GEMS]: [90, 230, 220], [Deposit.COAL]: [40, 40, 45], [Deposit.OIL]: [80, 40, 90], [Deposit.GAS]: [130, 200, 250],
  [Deposit.URANIUM]: [140, 255, 70], [Deposit.RARE]: [250, 80, 200], [Deposit.SPICES]: [250, 130, 30], [Deposit.FURS]: [130, 85, 50],
  [Deposit.FISH]: [220, 240, 255], [Deposit.EXOTIC]: [190, 130, 255],
};

function ramp(t: number): [number, number, number] {
  // perceptually ordered: deep purple -> teal -> yellow
  const stops: [number, number, number][] = [[50, 30, 90], [40, 110, 160], [60, 180, 140], [230, 220, 90]];
  const x = Math.max(0, Math.min(0.999, t)) * (stops.length - 1);
  const k = Math.floor(x);
  const f = x - k;
  return [0, 1, 2].map((c) => stops[k][c] + (stops[k + 1][c] - stops[k][c]) * f) as [number, number, number];
}

function hashColor(n: number): [number, number, number] {
  const h = hash3(n, 17, 3);
  return [60 + (h & 0x7f) + 40, 60 + ((h >> 8) & 0x7f) + 30, 60 + ((h >> 16) & 0x7f) + 30];
}

export const SCALE = 4;

export class OverlayLayer {
  canvas: HTMLCanvasElement;
  private img: ImageData;
  mode: OverlayMode = 'political';
  focusCiv = 0;
  /** Year shown by the historical-territory overlay (nearest earlier snapshot is used). */
  historyYear = 0;
  private histCache: { year: number; w: number; grid: Uint16Array } | null = null;

  /** The territory snapshot for `historyYear` (decoded once per selection). */
  historyGrid(): { year: number; w: number; grid: Uint16Array } | null {
    const list = this.sim.w.stats.territory ?? [];
    if (!list.length) return null;
    let snap = list[0];
    for (const t of list) if (t.year <= (this.historyYear || this.sim.year)) snap = t;
    if (!this.histCache || this.histCache.year !== snap.year) this.histCache = { year: snap.year, w: snap.w, grid: decodeTerritory(snap) };
    return this.histCache;
  }
  private stamp = -1;

  constructor(private sim: Sim) {
    const m = sim.w.map;
    this.canvas = document.createElement('canvas');
    this.canvas.width = m.w * SCALE;
    this.canvas.height = m.h * SCALE;
    this.img = this.canvas.getContext('2d')!.createImageData(this.canvas.width, this.canvas.height);
  }

  /** Recompute when the mode changes or the world changed since the last pass (throttled by caller). */
  update(force = false): void {
    const sim = this.sim;
    let dirty = force;
    for (let k = 0; k < sim.overlayDirty.length; k++) if (sim.overlayDirty[k]) {
      dirty = true;
      sim.overlayDirty[k] = 0;
    }
    if (!dirty && this.stamp === sim.w.tick) return;
    if (!dirty && this.mode !== 'population' && this.mode !== 'pollution' && this.mode !== 'climate' && this.mode !== 'military' && this.mode !== 'economy' && this.mode !== 'diplomacy' && this.mode !== 'technology') return;
    this.stamp = sim.w.tick;
    this.render();
  }

  private colorFor(i: number): [number, number, number, number] | null {
    const w = this.sim.w;
    const m = w.map;
    const owner = m.owner[i];
    const civ = owner ? w.civs.get(owner) : undefined;
    const s = m.settle[i] ? w.settlements.get(m.settle[i]) : undefined;
    switch (this.mode) {
      case 'political':
        if (!civ) return null;
        return [...hexToRgb(civ.color), 85] as [number, number, number, number];
      case 'population':
        if (!s) return null;
        return [...ramp(Math.log10(s.pop + 1) / 7), 150] as any;
      case 'technology':
        if (!civ) return null;
        return [...ramp((civ.era - 1) / 14), 150] as any;
      case 'religion': {
        if (!s) return null;
        const r = s.religions[0];
        if (!r || !r.id) return [120, 120, 130, 110];
        const rel = w.religions.get(r.id);
        return rel ? ([...hexToRgb(rel.color), 140] as any) : null;
      }
      case 'culture': {
        const c = s?.cultures[0] ? w.cultures.get(s.cultures[0].id) : undefined;
        return c ? ([...hexToRgb(c.color), 140] as any) : null;
      }
      case 'language': {
        const c = s?.cultures[0] ? w.cultures.get(s.cultures[0].id) : undefined;
        const l = c ? w.languages.get(c.languageId) : undefined;
        return l ? ([...hashColor(l.rootId), 140] as any) : null;
      }
      case 'resources': {
        const d = m.dep[i];
        if (!d) return [0, 0, 0, 90];
        return [...(DEP_COLORS[d] ?? [255, 0, 255]), 230] as any;
      }
      case 'economy':
        if (!civ) return null;
        return [...ramp(Math.log10(civ.econ.gdpPerCapita + 1) / 2), 150] as any;
      case 'military': {
        if (!civ) return null;
        const war = [...w.wars.values()].some((x) => !x.end && (x.attackers.includes(civ.id) || x.defenders.includes(civ.id)));
        if (s?.occupiedBy) return [230, 60, 40, 180];
        return war ? [200, 70, 60, 120] : [90, 110, 130, 70];
      }
      case 'diplomacy': {
        if (!civ || !this.focusCiv) return civ ? [...hexToRgb(civ.color), 60] as any : null;
        if (civ.id === this.focusCiv) return [230, 190, 70, 150];
        if (atWarWith(this.sim, civ.id, this.focusCiv)) return [220, 50, 40, 170];
        const rel = getRelation(this.sim, civ.id, this.focusCiv);
        if (!rel) return [90, 90, 90, 90];
        const t = (rel.opinion + 100) / 200;
        return [Math.round(220 * (1 - t)), Math.round(200 * t), 70, 140];
      }
      case 'pollution':
        if (!m.pollution[i]) return null;
        return [120, 90, 60, Math.min(220, m.pollution[i] * 2)];
      case 'climate': {
        const temp = m.temp[i] + localHeat(this.sim, i);
        const t = (temp + 25) / 60;
        return [Math.round(255 * t), 80, Math.round(255 * (1 - t)), 120];
      }
      case 'infrastructure': {
        const v = m.infra[i];
        if (m.railTier(i)) return [40, 35, 50, 230];
        if (v & 7) return [170, 120, 60, 210];
        if (v & INFRA.GRID) return [240, 210, 60, 120];
        return [0, 0, 0, 70];
      }
      case 'history': {
        const h = this.historyGrid();
        if (!h) return null;
        const o = h.grid[(((i / w.map.w) | 0) >> 1) * h.w + ((i % w.map.w) >> 1)];
        const civ = o ? w.civs.get(o) : undefined;
        if (!civ) return null;
        const [r, g, b] = hexRgb(civ.color);
        return [r, g, b, civ.alive ? 150 : 110];
      }
      default:
        return null;
    }
  }

  private render(): void {
    const m = this.sim.w.map;
    const d = this.img.data;
    d.fill(0);
    if (this.mode === 'terrain' || this.mode === 'trade') {
      this.canvas.getContext('2d')!.putImageData(this.img, 0, 0);
      return;
    }
    const W = m.w * SCALE;
    const border = this.mode === 'political' || this.mode === 'diplomacy' || this.mode === 'military';
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++) {
        const i = y * m.w + x;
        const c = this.colorFor(i);
        if (!c) continue;
        const o = m.owner[i];
        for (let sy = 0; sy < SCALE; sy++)
          for (let sx = 0; sx < SCALE; sx++) {
            let a = c[3];
            if (border && o) {
              const edgeX = sx === 0 ? x - 1 : sx === SCALE - 1 ? x + 1 : -1;
              const edgeY = sy === 0 ? y - 1 : sy === SCALE - 1 ? y + 1 : -1;
              if ((edgeX >= 0 && edgeX < m.w && m.owner[y * m.w + edgeX] !== o) || (edgeY >= 0 && edgeY < m.h && m.owner[edgeY * m.w + x] !== o) || edgeX === m.w || edgeY === m.h) a = 235;
            }
            const p = ((y * SCALE + sy) * W + x * SCALE + sx) * 4;
            d[p] = c[0];
            d[p + 1] = c[1];
            d[p + 2] = c[2];
            d[p + 3] = a;
          }
      }
    this.canvas.getContext('2d')!.putImageData(this.img, 0, 0);
  }
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
