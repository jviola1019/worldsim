/**
 * Static world layer, cached per 16x16-tile chunk. Each chunk canvas holds
 * ground tiles, relief shading, rivers, roads/rails, vegetation, relief
 * sprites and buildings (with top padding for overhang). Chunks are redrawn
 * only when the simulation marks them dirty, a few per frame, nearest first.
 * At far zoom an overview image (1 px per tile) is used instead.
 */
import type { Sim } from '../sim/context';
import { CHUNK } from '../sim/context';
import { TILE } from './camera';
import type { Atlas } from './atlas';
import { TERRAIN, T, isWaterTerrain } from '../world/terrain';
import { hash3 } from '../core/rng';
import { BLDF, HAZARD } from '../world/tilemap';
import { BUILDING_KEY_BY_ID, B } from '../civilizations/buildingTypes';
import { hexToRgb } from './art/palette';
import { DX8, DY8 } from '../core/math';
import { sportsVenueSprite, eraVenueSprite, airportSprite, portSprite, housingStyleForEthos, type Sport } from './art/select';
import type { SportKey } from '../culture/sports';
import { isDetailTile } from './cityBlocks';

/** Which venue sprite each simulated sport plays in. */
const SPORT_VENUE: Record<SportKey, Sport> = {
  wrestling: 'arena', ballgame: 'ballgame', chariot: 'chariot', football: 'football', baseball: 'baseball', basketball: 'basketball',
  gridiron: 'football', hockey: 'hockey', esports: 'basketball', drone: 'athletics', gravball: 'grav',
};

export const PAD = 24; // overhang padding above each chunk (px)

const ROAD_COLORS = ['', '#a98b62', '#9b8466', '#7d7a78', '#5f5d63'];

export class TerrainLayer {
  chunks: (HTMLCanvasElement | null)[];
  dirty: Uint8Array;
  overview: HTMLCanvasElement;
  private overviewData: ImageData;
  private overviewDirty = true;
  private cx: number;
  private cy: number;
  private lru: number[] = [];
  maxCached = 220;

  /**
   * `skipDetail`: leave out the buildings of close-up city tiles (drawn by CityLayer instead), so
   * their 8-px sprites do not poke out above the 32-px blocks at close zoom.
   */
  constructor(private sim: Sim, private atlas: Atlas, private opts: { skipDetail?: boolean; maxCached?: number } = {}) {
    if (opts.maxCached) this.maxCached = opts.maxCached;
    const m = sim.w.map;
    this.cx = Math.ceil(m.w / CHUNK);
    this.cy = Math.ceil(m.h / CHUNK);
    this.chunks = new Array(this.cx * this.cy).fill(null);
    this.dirty = new Uint8Array(this.cx * this.cy).fill(1);
    this.overview = document.createElement('canvas');
    this.overview.width = m.w;
    this.overview.height = m.h;
    this.overviewData = this.overview.getContext('2d')!.createImageData(m.w, m.h);
  }

  /** Pull dirty flags from the simulation; `onDirty` lets other layers follow the same changes. */
  syncDirty(onDirty?: (k: number) => void): void {
    const sd = this.sim.chunkDirty;
    for (let k = 0; k < sd.length; k++)
      if (sd[k]) {
        this.dirty[k] = 1;
        sd[k] = 0;
        this.overviewDirty = true;
        onDirty?.(k);
      }
  }

  markDirty(k: number): void {
    this.dirty[k] = 1;
  }

  invalidateAll(): void {
    this.dirty.fill(1);
    this.overviewDirty = true;
  }

  updateOverview(): void {
    if (!this.overviewDirty) return;
    this.overviewDirty = false;
    const m = this.sim.w.map;
    const d = this.overviewData.data;
    const colors = TERRAIN.map((t) => hexToRgb(t.color));
    for (let i = 0; i < m.n; i++) {
      let [r, g, b] = colors[m.terrain[i]];
      if (!isWaterTerrain(m.terrain[i])) {
        const x = i % m.w;
        const up = i >= m.w ? m.elev[i - m.w] : m.elev[i];
        const left = x > 0 ? m.elev[i - 1] : m.elev[i];
        const shade = 1 + (m.elev[i] - (up + left) / 2) * 5;
        r *= shade;
        g *= shade;
        b *= shade;
        if (m.veg[i] > 150 && m.terrain[i] !== T.MOUNTAIN) {
          r *= 0.85;
          g *= 0.92;
          b *= 0.85;
        }
        if (m.river[i] > 0) [r, g, b] = [70, 140, 210];
        if (m.bld[i]) [r, g, b] = m.bld[i] === B.FARM ? [196, 178, 92] : [150, 120, 100];
        if (m.fire[i]) [r, g, b] = [240, 120, 40];
      }
      d[i * 4] = r;
      d[i * 4 + 1] = g;
      d[i * 4 + 2] = b;
      d[i * 4 + 3] = 255;
    }
    this.overview.getContext('2d')!.putImageData(this.overviewData, 0, 0);
  }

  /** Redraw up to `budget` dirty chunks among `wanted` (visible) ones. */
  refresh(wanted: number[], budget: number): void {
    let n = 0;
    for (const k of wanted) {
      if (n >= budget) break;
      if (this.dirty[k] || !this.chunks[k]) {
        this.drawChunk(k);
        this.dirty[k] = 0;
        n++;
      }
    }
  }

  get(k: number): HTMLCanvasElement | null {
    return this.chunks[k];
  }

  private alloc(k: number): HTMLCanvasElement {
    let c = this.chunks[k];
    if (c) return c;
    if (this.lru.length >= this.maxCached) {
      const old = this.lru.shift()!;
      c = this.chunks[old];
      this.chunks[old] = null;
      this.dirty[old] = 1;
    }
    if (!c) {
      c = document.createElement('canvas');
      c.width = CHUNK * TILE;
      c.height = CHUNK * TILE + PAD;
    }
    this.chunks[k] = c;
    this.lru.push(k);
    return c;
  }

  touch(k: number): void {
    const i = this.lru.indexOf(k);
    if (i >= 0 && i < this.lru.length - 1) {
      this.lru.splice(i, 1);
      this.lru.push(k);
    }
  }

  private drawChunk(k: number): void {
    const c = this.alloc(k);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    const m = this.sim.w.map;
    const x0 = (k % this.cx) * CHUNK;
    const y0 = Math.floor(k / this.cx) * CHUNK;
    const x1 = Math.min(m.w, x0 + CHUNK);
    const y1 = Math.min(m.h, y0 + CHUNK);
    const seed = 7;
    // pass 1: ground
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * m.w + x;
        const def = TERRAIN[m.terrain[i]];
        const px = (x - x0) * TILE;
        const py = (y - y0) * TILE + PAD;
        const v = hash3(x, y, seed) % 3;
        const spr = this.atlas.get(`ter.${def.sprite}.${v}`);
        if (spr) ctx.drawImage(spr.canvas, 0, 0, 8, 8, px, py, 8, 8);
        else {
          ctx.fillStyle = def.color;
          ctx.fillRect(px, py, 8, 8);
        }
        if (!def.water) {
          // relief shading from the north-west light
          const up = y > 0 ? m.elev[i - m.w] : m.elev[i];
          const left = x > 0 ? m.elev[i - 1] : m.elev[i];
          const s = (m.elev[i] - (up + left) / 2) * 6;
          if (Math.abs(s) > 0.03) {
            ctx.fillStyle = s > 0 ? `rgba(255,255,230,${Math.min(0.22, s)})` : `rgba(20,10,30,${Math.min(0.3, -s)})`;
            ctx.fillRect(px, py, 8, 8);
          }
          // shoreline: light rim where land meets water
          for (let d = 0; d < 8; d += 2) {
            const nx = x + DX8[d];
            const ny = y + DY8[d];
            if (!m.inBounds(nx, ny) || !m.isWater(ny * m.w + nx)) continue;
            ctx.fillStyle = 'rgba(240,230,190,0.5)';
            if (d === 0) ctx.fillRect(px + 7, py, 1, 8);
            if (d === 2) ctx.fillRect(px, py + 7, 8, 1);
            if (d === 4) ctx.fillRect(px, py, 1, 8);
            if (d === 6) ctx.fillRect(px, py, 8, 1);
          }
          if (m.pollution[i] > 40) {
            ctx.fillStyle = `rgba(70,60,50,${Math.min(0.45, m.pollution[i] / 400)})`;
            ctx.fillRect(px, py, 8, 8);
          }
          if (m.hazard[i] & HAZARD.RADIATION) {
            ctx.fillStyle = 'rgba(120,200,60,0.18)';
            ctx.fillRect(px, py, 8, 8);
          }
        } else if (def.key === 'SHALLOW' || def.key === 'LAKE') {
          // foam near shore
          for (let d = 0; d < 8; d += 2) {
            const nx = x + DX8[d];
            const ny = y + DY8[d];
            if (!m.inBounds(nx, ny) || m.isWater(ny * m.w + nx)) continue;
            ctx.fillStyle = 'rgba(200,240,250,0.55)';
            if (d === 0) ctx.fillRect(px + 7, py + 1, 1, 6);
            if (d === 2) ctx.fillRect(px + 1, py + 7, 6, 1);
            if (d === 4) ctx.fillRect(px, py + 1, 1, 6);
            if (d === 6) ctx.fillRect(px + 1, py, 6, 1);
          }
        }
      }
    // pass 2: rivers, roads, rails (line networks)
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * m.w + x;
        const cx = (x - x0) * TILE + 4;
        const cy = (y - y0) * TILE + 4 + PAD;
        if (m.river[i] > 0 && m.isLand(i)) {
          const d = m.flow[i];
          const w = m.river[i] > 60 ? 3 : m.river[i] > 20 ? 2 : 1;
          ctx.fillStyle = '#3f86c8';
          ctx.fillRect(cx - (w >> 1), cy - (w >> 1), w, w);
          if (d >= 0) line(ctx, cx, cy, cx + DX8[d] * 8, cy + DY8[d] * 8, w, '#3f86c8');
        }
        const road = m.roadTier(i);
        const rail = m.railTier(i);
        if (road || rail) {
          for (let d = 0; d < 4; d++) {
            const dir = d * 2; // E,S,W,N
            const nx = x + DX8[dir];
            const ny = y + DY8[dir];
            if (!m.inBounds(nx, ny)) continue;
            const j = ny * m.w + nx;
            if (road && (m.roadTier(j) || m.bld[j])) line(ctx, cx, cy, cx + DX8[dir] * 4, cy + DY8[dir] * 4, road >= 4 ? 3 : 2, ROAD_COLORS[road]);
            if (rail && m.railTier(j)) {
              line(ctx, cx, cy, cx + DX8[dir] * 4, cy + DY8[dir] * 4, 1, '#3b3340');
            }
          }
          if (road) {
            ctx.fillStyle = ROAD_COLORS[road];
            ctx.fillRect(cx - 1, cy - 1, 2, 2);
          }
        }
        // a street between neighbouring city blocks (east and south edges, so each is drawn once)
        if (isDetailTile(m, i)) {
          const tier = m.bldFlags[i] & BLDF.TIER_MASK;
          const col = ROAD_COLORS[Math.max(1, Math.min(4, m.roadTier(i) || (tier >= 5 ? 3 : tier >= 3 ? 2 : 1)))];
          const px = (x - x0) * TILE, py = (y - y0) * TILE + PAD;
          ctx.fillStyle = col;
          if (x + 1 < m.w && isDetailTile(m, i + 1)) ctx.fillRect(px + 7, py, 1, 8);
          if (y + 1 < m.h && isDetailTile(m, i + m.w)) ctx.fillRect(px, py + 7, 8, 1);
        }
      }
    // pass 3: standing things (trees, peaks, buildings) in row order for overlap
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * m.w + x;
        const bx = (x - x0) * TILE + 4;
        const by = (y - y0) * TILE + 7 + PAD;
        const b = m.bld[i];
        if (b) {
          if (m.bldFlags[i] & BLDF.PART) continue;
          if (this.opts.skipDetail && isDetailTile(m, i)) continue;
          const key = BUILDING_KEY_BY_ID[b];
          const tier = m.bldFlags[i] & BLDF.TIER_MASK;
          const id = this.spriteFor(i, x, y, b, key, tier);
          if (id) {
            const spr = this.atlas.get(id, this.ownerColor(i), true);
            if (spr) {
              // multi-tile buildings: anchor at the bottom-center of the footprint
              const ox = spr.fw > 1 ? bx + 4 : bx;
              const oy = spr.fh > 1 ? by + 8 : by;
              ctx.drawImage(spr.canvas, 0, 0, spr.w, spr.h, ox - spr.ax, oy - spr.ay, spr.w, spr.h);
            }
          }
          continue;
        }
        const def = TERRAIN[m.terrain[i]];
        if (def.water) continue;
        const h = hash3(x, y, 11);
        if (m.terrain[i] === T.MOUNTAIN) {
          const snow = m.temp[i] < 2;
          this.atlas.draw(ctx, `mtn.${snow ? 'snowpeak' : 'peak'}.${h % 3}`, bx, by);
          continue;
        }
        if (m.terrain[i] === T.HILLS && h % 3 === 0) {
          this.atlas.draw(ctx, `mtn.hill.${h % 2}`, bx, by);
          continue;
        }
        if (m.hazard[i] & HAZARD.VENT) continue; // animated volcano drawn per frame
        const v = m.veg[i];
        if (def.trees.length && v > 70 && !m.fire[i]) {
          const kinds = m.temp[i] < -2 && def.trees.includes('pine') ? ['snowpine'] : def.trees;
          const kind = kinds[h % kinds.length];
          const count = v > 200 ? 2 : 1;
          for (let t = 0; t < count; t++) {
            const hh = hash3(x, y, 20 + t);
            const variants = ['oak', 'pine', 'jungle', 'alien'].includes(kind) ? 3 : ['snowpine', 'palm', 'bush', 'cactus'].includes(kind) ? 2 : 1;
            const id = `veg.${kind}.${hh % variants}`;
            const dx = count === 2 ? (t === 0 ? -2 : 2) : (hh % 3) - 1;
            const dy = count === 2 ? (t === 0 ? -2 : 0) : 0;
            this.atlas.draw(ctx, id, bx + dx, by + dy);
          }
        } else if (v > 40 && h % 7 === 0 && (m.terrain[i] === T.GRASS || m.terrain[i] === T.SAVANNA)) {
          this.atlas.draw(ctx, 'veg.flowers.0', bx, by);
        }
      }
  }

  /**
   * The sprite for a building: arenas show the venue of the sport the city's team plays (or the
   * era's venue), airports and harbours follow the era (a big port spreads over open water, else a
   * jetty), homes take the owner's ethos style (atomic-age or ecological) from the modern tier on.
   */
  /** The map sprite id of the building on tile i (used by the close-up layer for 2×2 landmarks). */
  spriteIdFor(i: number): string | undefined {
    const m = this.sim.w.map;
    const b = m.bld[i];
    if (!b) return undefined;
    return this.spriteFor(i, m.xOf(i), m.yOf(i), b, BUILDING_KEY_BY_ID[b], m.bldFlags[i] & BLDF.TIER_MASK);
  }

  private spriteFor(i: number, x: number, y: number, b: number, key: string, tier: number): string | undefined {
    const m = this.sim.w.map;
    const civ = m.owner[i] ? this.sim.w.civs.get(m.owner[i]) : undefined;
    const h = hash3(x, y, 3);
    if (b === B.ARENA) {
      const sid = m.settle[i];
      for (const lg of this.sim.w.leagues.values()) if (lg.active && lg.teams.some((t) => t.settlementId === sid)) return sportsVenueSprite(SPORT_VENUE[lg.sport]);
      return eraVenueSprite(tier, h);
    }
    if (b === B.AIRPORT && civ) return airportSprite(Math.max(1, civ.caps.airTier), tier, civ.caps.spaceTier, h) ?? this.atlas.buildingId(key, tier, h);
    if (b === B.HARBOR && civ && tier >= 3) {
      const water = (xx: number, yy: number) => m.inBounds(xx, yy) && m.isWater(m.idx(xx, yy)) && !m.bld[m.idx(xx, yy)];
      return water(x + 1, y) && water(x, y + 1) && water(x + 1, y + 1) ? portSprite(tier, civ.caps.spaceTier) : 'bld.port.jetty';
    }
    return this.atlas.buildingId(key, tier, h, housingStyleForEthos(civ?.ethos?.key));
  }

  private ownerColor(i: number): string | undefined {
    const o = this.sim.w.map.owner[i];
    return o ? this.sim.w.civs.get(o)?.color : undefined;
  }
}

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, color: string): void {
  ctx.fillStyle = color;
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const half = w >> 1;
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / (steps || 1));
    const y = Math.round(y0 + ((y1 - y0) * s) / (steps || 1));
    ctx.fillRect(x - half, y - half, w, w);
  }
}
