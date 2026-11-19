/**
 * Frame renderer. Draws (back to front): cached world chunks (or the far-zoom
 * overview), the overlay, animated tiles (volcanoes, fires, smoke, windmills),
 * living things and agents, traffic derived from real infrastructure and
 * trade, effects, labels, selection and brush preview.
 *
 * Level of detail: individual sprites only at close zoom; at distance the
 * overview texture and settlement markers summarize the world. Ambient
 * walkers and vehicles are VISUAL representations derived from real state
 * (population, roads, rails, trade routes, airports) — they are not
 * simulated individuals and are documented as such.
 */
import { vehicleSprite, housingStyleForEthos, characterSprite, soldierSprite } from './art/select';
import { flagCanvas } from './flag';
import type { Sim } from '../sim/context';
import { CHUNK } from '../sim/context';
import { Atlas } from './atlas';
import { Camera, TILE } from './camera';
import { TerrainLayer, PAD } from './terrainLayer';
import { CityLayer, DCHUNK, DETAIL, DPAD, detailAlpha } from './cityLayer';
import { blockContext, blockSignature, composeBlock, streetPoint, type BlockPlan } from './cityBlocks';
import { OverlayLayer, SCALE as OV_SCALE } from './overlays';
import { HAZARD } from '../world/tilemap';
import { B, eraToTier } from '../civilizations/buildingTypes';
import { SPECIES_BY_KEY, MONSTERS } from '../ecology/species';
import { hash3 } from '../core/rng';

export interface Brush {
  x: number;
  y: number;
  r: number;
  color: string;
  visible: boolean;
}

const SOLDIER_MAX = 12;

export class Renderer {
  atlas: Atlas;
  cam = new Camera();
  layer: TerrainLayer;
  /** The map without close-up city buildings (drawn under the city layer at close zoom). */
  base: TerrainLayer;
  city: CityLayer;
  private cityYear = -1;
  /** Close-up chunks drawn in the last frame (0 when the close-up is off); read by the e2e test. */
  cityChunksDrawn = 0;
  overlay: OverlayLayer;
  ctx: CanvasRenderingContext2D;
  dpr = 1;
  time = 0;
  selection: { kind: string; id: number } | null = null;
  brush: Brush = { x: 0, y: 0, r: 1, color: '#5fd0c4', visible: false };
  highlight: { x: number; y: number; t: number } | null = null;
  showLabels = true;
  frameMs = 0;
  private vents: number[] = [];
  private overlayTimer = 0;

  constructor(public canvas: HTMLCanvasElement, public sim: Sim, atlas?: Atlas) {
    this.atlas = atlas ?? new Atlas();
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.layer = new TerrainLayer(sim, this.atlas);
    this.base = new TerrainLayer(sim, this.atlas, { skipDetail: true, maxCached: 48 });
    this.city = new CityLayer(sim, this.atlas, (i) => this.layer.spriteIdFor(i));
    this.overlay = new OverlayLayer(sim);
    const m = sim.w.map;
    for (let i = 0; i < m.n; i++) if (m.hazard[i] & HAZARD.VENT) this.vents.push(i);
  }

  setSim(sim: Sim): void {
    this.sim = sim;
    this.layer = new TerrainLayer(sim, this.atlas);
    this.base = new TerrainLayer(sim, this.atlas, { skipDetail: true, maxCached: 48 });
    this.city = new CityLayer(sim, this.atlas, (i) => this.layer.spriteIdFor(i));
    this.cityYear = -1;
    const mode = this.overlay.mode;
    this.overlay = new OverlayLayer(sim);
    this.overlay.mode = mode;
    this.vents = [];
    const m = sim.w.map;
    for (let i = 0; i < m.n; i++) if (m.hazard[i] & HAZARD.VENT) this.vents.push(i);
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.cam.resize(cssW, cssH);
  }

  frame(dt: number): void {
    const t0 = performance.now();
    this.time += dt;
    const { ctx, cam } = this;
    const m = this.sim.w.map;
    cam.clamp(m.w, m.h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0d1424';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const z = cam.zoom * this.dpr;
    // world transform: world px -> device px
    ctx.setTransform(z, 0, 0, z, -cam.x * z + (cam.viewW * this.dpr) / 2, -cam.y * z + (cam.viewH * this.dpr) / 2);
    this.layer.syncDirty((k) => {
      this.base.markDirty(k);
      this.city.markMapChunk(k);
    });
    const tilePx = cam.zoom * TILE;
    const far = tilePx < 2.6;
    const close = far ? 0 : detailAlpha(tilePx);
    if (far) {
      this.layer.updateOverview();
      ctx.drawImage(this.layer.overview, 0, 0, m.w * TILE, m.h * TILE);
    } else this.drawChunks(close >= 1 ? this.base : this.layer);
    if (close > 0) this.drawCity(close);
    else this.cityChunksDrawn = 0;
    this.canvas.dataset.cityChunks = String(this.cityChunksDrawn);
    // overlay
    this.overlayTimer -= dt;
    if (this.overlay.mode !== 'terrain' && this.overlayTimer <= 0) {
      this.overlay.update();
      this.overlayTimer = 0.4;
    }
    if (this.overlay.mode !== 'terrain') ctx.drawImage(this.overlay.canvas, 0, 0, m.w * TILE, m.h * TILE);
    if (this.overlay.mode === 'trade') this.drawTradeRoutes();
    const vis = cam.visibleTiles(m.w, m.h);
    if (!far) {
      this.drawAnimatedTiles(vis);
      if (tilePx >= 4.5) {
        this.drawAmbient(vis, tilePx);
        this.drawHerds(vis);
        this.drawBands(vis);
      }
      this.drawTraffic(vis, tilePx);
      this.drawAgents(vis);
      this.drawArmies(vis, tilePx);
      this.drawMonsters(vis);
      this.drawWeather(vis, tilePx);
    } else {
      this.drawArmies(vis, tilePx);
    }
    this.drawFx(dt);
    this.drawSelection();
    this.drawBrush();
    // labels in screen space
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.showLabels) this.drawLabels(tilePx);
    this.frameMs = performance.now() - t0;
  }

  /** Close-up city blocks over the map, faded in between 20 and 26 px per tile. */
  private drawCity(alpha: number): void {
    const { ctx, cam } = this;
    const m = this.sim.w.map;
    if (this.sim.year !== this.cityYear) {
      if (this.cityYear >= 0) this.city.yearlyCheck();
      this.cityYear = this.sim.year;
    }
    const [tx0, ty0, tx1, ty1] = cam.visibleTiles(m.w, m.h, 1);
    const wanted: number[] = [];
    for (let cy = Math.floor(ty0 / DCHUNK); cy <= Math.min(this.city.cy - 1, Math.floor((ty1 + 2) / DCHUNK)); cy++)
      for (let cx = Math.floor(tx0 / DCHUNK); cx <= Math.min(this.city.cx - 1, Math.floor(tx1 / DCHUNK)); cx++) wanted.push(cy * this.city.cx + cx);
    const ccx = cam.x / (DCHUNK * TILE), ccy = cam.y / (DCHUNK * TILE);
    const d2 = (k: number) => ((k % this.city.cx) - ccx) ** 2 + (Math.floor(k / this.city.cx) - ccy) ** 2;
    this.city.refresh([...wanted].sort((a, b) => d2(a) - d2(b)), 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    const pad = DPAD / DETAIL;
    let drawn = 0;
    for (const k of wanted) {
      const c = this.city.get(k);
      if (!c) continue; // not drawn yet: the normal map shows through
      drawn++;
      const x = (k % this.city.cx) * DCHUNK * TILE;
      const y = Math.floor(k / this.city.cx) * DCHUNK * TILE;
      ctx.drawImage(c, x, y - pad, DCHUNK * TILE, DCHUNK * TILE + pad);
    }
    ctx.restore();
    this.cityChunksDrawn = drawn;
  }

  private drawChunks(layer: TerrainLayer = this.layer): void {
    const { ctx, cam } = this;
    const m = this.sim.w.map;
    const [tx0, ty0, tx1, ty1] = cam.visibleTiles(m.w, m.h, 1);
    const cx0 = Math.floor(tx0 / CHUNK);
    const cy0 = Math.floor(ty0 / CHUNK);
    const cx1 = Math.floor(tx1 / CHUNK);
    const cy1 = Math.min(Math.floor((ty1 + 3) / CHUNK), Math.ceil(m.h / CHUNK) - 1);
    const cxN = Math.ceil(m.w / CHUNK);
    const wanted: number[] = [];
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) wanted.push(cy * cxN + cx);
    // nearest to center first
    const ccx = cam.x / (CHUNK * TILE);
    const ccy = cam.y / (CHUNK * TILE);
    const sorted = [...wanted].sort((a, b) => ((a % cxN) - ccx) ** 2 + (Math.floor(a / cxN) - ccy) ** 2 - (((b % cxN) - ccx) ** 2 + (Math.floor(b / cxN) - ccy) ** 2));
    layer.refresh(sorted, 4);
    for (const k of wanted) {
      const c = layer.get(k);
      const x = (k % cxN) * CHUNK * TILE;
      const y = Math.floor(k / cxN) * CHUNK * TILE;
      if (c) {
        ctx.drawImage(c, x, y - PAD);
        layer.touch(k);
      } else {
        // not yet drawn: show the overview patch
        this.layer.updateOverview();
        ctx.drawImage(this.layer.overview, k % cxN * CHUNK, Math.floor(k / cxN) * CHUNK, CHUNK, CHUNK, x, y, CHUNK * TILE, CHUNK * TILE);
      }
    }
  }

  private frameIdx(fps = 4, seed = 0): number {
    return Math.floor(this.time * fps + seed);
  }

  private drawAnimatedTiles(vis: [number, number, number, number]): void {
    const { ctx, atlas } = this;
    const m = this.sim.w.map;
    const [x0, y0, x1, y1] = vis;
    for (const i of this.vents) {
      const x = i % m.w;
      const y = (i / m.w) | 0;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      atlas.draw(ctx, 'mtn.volcano', x * TILE + 4, y * TILE + 7, this.frameIdx(3, i));
    }
    const fires = this.sim.cache.fires as Set<number> | undefined;
    if (fires) for (const i of fires) {
      const x = i % m.w;
      const y = (i / m.w) | 0;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      atlas.draw(ctx, m.fire[i] > 150 ? 'fx.fire_big' : 'fx.fire', x * TILE + 4, y * TILE + 7, this.frameIdx(8, i));
    }
    // animated & smoking buildings
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * m.w + x;
        const b = m.bld[i];
        if (!b) continue;
        if (b === B.FACTORY || b === B.POWER_FOSSIL || b === B.STEEL_MILL || b === B.REFINERY || b === B.SMITHY) {
          const f = this.frameIdx(3, hash3(x, y, 5) % 4);
          atlas.draw(ctx, b === B.SMITHY ? 'fx.smoke' : 'fx.smoke_dark', x * TILE + 5, y * TILE - 4 - (f % 4), f);
        } else if (b === B.MILL || b === B.WIND || b === B.OIL_WELL || b === B.CAMP || b === B.CONSTRUCTION || b === B.DATA_CENTER) {
          const tier = m.bldFlags[i] & 7;
          const key = { [B.MILL]: 'MILL', [B.WIND]: 'WIND', [B.OIL_WELL]: 'OIL_WELL', [B.CAMP]: 'CAMP', [B.CONSTRUCTION]: 'CONSTRUCTION', [B.DATA_CENTER]: 'DATA_CENTER' }[b]!;
          const id = atlas.buildingId(key, tier);
          const spr = id ? atlas.get(id) : undefined;
          if (id && spr && spr.frames > 1) {
            const own = m.owner[i] ? this.sim.w.civs.get(m.owner[i])?.color : undefined;
            atlas.draw(ctx, id, x * TILE + 4, y * TILE + 7, this.frameIdx(spr.fps, x + y), own);
          }
        }
      }
  }

  /** Ambient citizens near settlements: visual representation of population (not simulated individuals). */
  /** Below the close-up, people are drawn at half size; in the close-up, at street scale on sidewalks. */
  private drawAmbient(vis: [number, number, number, number], tilePx: number): void {
    if (tilePx < 9) return;
    const { atlas } = this;
    const w = this.sim.w;
    const m = w.map;
    const close = tilePx >= 20;
    const [x0, y0, x1, y1] = vis;
    for (const s of w.settlements.values()) {
      if (s.x < x0 - 3 || s.x > x1 + 3 || s.y < y0 - 3 || s.y > y1 + 3) continue;
      const civ = w.civs.get(s.civId);
      const tier = civ ? eraToTier(civ.era) : 0;
      const n = Math.min(10, Math.round(Math.log2(s.pop + 2))) * (close ? 4 : 1);
      for (let k = 0; k < n; k++) {
        const h = hash3(s.id, k, 9);
        const ang = (h % 628) / 100 + this.time * 0.15 * ((h >> 10) % 2 ? 1 : -1);
        const rad = 0.6 + ((h >> 4) % 100) / 100 * Math.max(1, s.radius * 0.6);
        const wx = (s.x + 0.5 + Math.cos(ang) * rad) * TILE;
        const wy = (s.y + 0.5 + Math.sin(ang) * rad * 0.8) * TILE;
        const flip = Math.sin(ang) > 0;
        const job = townsperson(s.employment, tier, civ?.caps.landTier ?? 0, h);
        const id = atlas.has(job) ? job : 'unit.citizen.0';
        if (!close) {
          this.drawScaled(id, wx, wy, this.frameIdx(4, k), civ?.color, flip, 0.5);
          continue;
        }
        const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
        if (!m.inBounds(tx, ty)) continue;
        const plan = this.planAt(m.idx(tx, ty));
        const p = plan && streetPoint(plan, h, this.time * 0.03 * (1 + (h % 3)) + (h % 97) / 97, false);
        if (!p) continue;
        this.drawScaled(id, tx * TILE + p.x / DETAIL, ty * TILE + (p.y + 1) / DETAIL, this.frameIdx(4, k), civ?.color, flip, 1 / 8);
      }
    }
  }

  private plans = new Map<number, { sig: number; plan: BlockPlan }>();
  /** The composed block on tile i (cached by signature), or null when it is not a city block. */
  private planAt(i: number): BlockPlan | null {
    const c = blockContext(this.sim, i);
    if (!c) return null;
    const sig = blockSignature(c);
    const hit = this.plans.get(i);
    if (hit && hit.sig === sig) return hit.plan;
    if (this.plans.size > 4000) this.plans.clear();
    const plan = composeBlock(c);
    this.plans.set(i, { sig, plan });
    return plan;
  }

  /** Draw a sprite scaled about its anchor point. */
  private drawScaled(id: string, x: number, y: number, frame: number, color: string | undefined, flip: boolean, k: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    this.atlas.draw(ctx, id, 0, 0, frame, color, flip);
    ctx.restore();
  }


  private drawHerds(vis: [number, number, number, number]): void {
    const { ctx, atlas } = this;
    const [x0, y0, x1, y1] = vis;
    for (const h of this.sim.w.herds.values()) {
      if (h.x < x0 || h.x > x1 + 1 || h.y < y0 || h.y > y1 + 1) continue;
      const sp = SPECIES_BY_KEY[h.species];
      if (!sp) continue;
      const shown = Math.min(3, Math.max(1, Math.round(Math.log10(h.count + 1) * 1.5)));
      for (let k = 0; k < shown; k++) {
        const ox = ((hash3(h.id, k, 1) % 7) - 3) * 1.5;
        const oy = ((hash3(h.id, k, 2) % 5) - 2) * 1.2;
        atlas.draw(ctx, sp.sprite, h.x * TILE + ox, h.y * TILE + oy, this.frameIdx(4, k + h.id), undefined, h.tx < h.x);
      }
    }
  }

  private drawBands(vis: [number, number, number, number]): void {
    const { ctx, atlas } = this;
    const w = this.sim.w;
    const [x0, y0, x1, y1] = vis;
    for (const b of w.bands.values()) {
      if (b.x < x0 || b.x > x1 || b.y < y0 || b.y > y1) continue;
      const civ = w.civs.get(b.civId);
      const sprite = b.species === 'human' ? 'unit.citizen.0' : `unit.${b.species}`;
      const n = Math.min(6, Math.ceil(b.members.length / 6));
      for (let k = 0; k < n; k++) {
        const ox = ((hash3(b.id, k, 1) % 9) - 4) * 1.6;
        const oy = ((hash3(b.id, k, 2) % 7) - 3) * 1.2;
        atlas.draw(ctx, sprite, b.x * TILE + ox, b.y * TILE + oy, this.frameIdx(4, k), civ?.color, b.tx < b.x);
      }
    }
  }

  private drawAgents(vis: [number, number, number, number]): void {
    const { ctx, atlas } = this;
    const w = this.sim.w;
    const [x0, y0, x1, y1] = vis;
    for (const a of w.agents.values()) {
      if (a.x < x0 || a.x > x1 || a.y < y0 || a.y > y1) continue;
      const civ = w.civs.get(a.civId);
      const onWater = w.map.isWater(w.map.idx(Math.floor(a.x), Math.floor(a.y)));
      const id = onWater ? (civ && civ.caps.navalTier >= 5 ? 'veh.steamship' : 'veh.caravel') : a.kind === 'refugee' || a.kind === 'migrant' ? 'unit.refugee' : a.kind === 'colonist' ? 'unit.settler' : `unit.${a.kind}`;
      const next = a.path[Math.min(a.path.length - 1, a.pathPos + 1)];
      const flip = next !== undefined && w.map.xOf(next) + 0.5 < a.x;
      atlas.draw(ctx, atlas.has(id) ? id : 'unit.settler', a.x * TILE, a.y * TILE, this.frameIdx(5, a.id), civ?.color, flip);
    }
  }

  private drawArmies(vis: [number, number, number, number], tilePx: number): void {
    const { ctx, atlas } = this;
    const w = this.sim.w;
    const [x0, y0, x1, y1] = vis;
    for (const a of w.armies.values()) {
      if (a.x < x0 || a.x > x1 || a.y < y0 || a.y > y1) continue;
      const civ = w.civs.get(a.civId);
      if (tilePx < 3) {
        ctx.fillStyle = civ?.color ?? '#fff';
        ctx.fillRect(a.x * TILE - 3, a.y * TILE - 3, 6, 6);
        continue;
      }
      const onWater = w.map.isWater(w.map.idx(Math.floor(a.x), Math.floor(a.y)));
      const flip = a.path.length > a.pathPos + 1 && w.map.xOf(a.path[a.pathPos + 1]) + 0.5 < a.x;
      if (onWater) {
        const naval = civ?.caps.navalTier ?? 2;
        const ship = naval >= 7 ? 'veh.droneship' : naval >= 6 ? 'veh.battleship' : naval >= 5 ? 'veh.ironclad' : naval >= 4 ? 'veh.galleon' : naval >= 3 ? 'veh.caravel' : 'veh.galley';
        atlas.draw(ctx, ship, a.x * TILE, a.y * TILE, this.frameIdx(3), civ?.color, flip);
        continue;
      }
      const tier = Math.min(12, a.tier);
      const unit = tier >= 9 && a.comp[3] > 0 ? 'veh.tank' : `unit.soldier.${tier}`;
      const n = Math.min(SOLDIER_MAX, Math.max(1, Math.round(Math.log10(a.manpower + 1) * 2)));
      for (let k = 0; k < n; k++) {
        const col = k % 4;
        const row = Math.floor(k / 4);
        atlas.draw(ctx, unit, a.x * TILE + (col - 1.5) * 4 + (row % 2), a.y * TILE + row * 3 - 3, this.frameIdx(a.state === 'battle' ? 8 : 5, k), civ?.color, flip);
      }
      if (civ) {
        // banner pole + the nation's own flag (6×4 art px at world scale)
        const bx = Math.round(a.x * TILE - 9), by = Math.round(a.y * TILE - 10);
        ctx.fillStyle = '#3b2a1a';
        ctx.fillRect(bx, by, 1, 9);
        const wave = this.frameIdx(3) === 1 ? 1 : 0;
        ctx.drawImage(flagCanvas(civ), bx + 1, by + wave * 0.5, 6, 4);
      } else atlas.draw(ctx, 'fx.flag', a.x * TILE - 7, a.y * TILE - 4, this.frameIdx(3));
      if (a.state === 'sieging') atlas.draw(ctx, 'fx.smoke', a.x * TILE + 6, a.y * TILE - 6, this.frameIdx(3));
    }
  }

  private drawMonsters(vis: [number, number, number, number]): void {
    const { ctx, atlas } = this;
    const [x0, y0, x1, y1] = vis;
    for (const mo of this.sim.w.monsters.values()) {
      if (mo.x < x0 || mo.x > x1 || mo.y < y0 || mo.y > y1) continue;
      const def = MONSTERS.find((d) => d.kind === mo.kind);
      if (def) atlas.draw(ctx, def.sprite, mo.x * TILE, mo.y * TILE, this.frameIdx(4, mo.id), undefined, mo.tx < mo.x);
    }
  }

  /** Vehicles drawn from real infrastructure: trains on built railways, cars on highways, ships on sea routes, aircraft between airports. */
  private drawTraffic(vis: [number, number, number, number], tilePx: number): void {
    if (tilePx < 4) return;
    const { ctx, atlas } = this;
    const w = this.sim.w;
    const m = w.map;
    // ships along active sea trade routes
    for (const r of w.routes.values()) {
      if (!r.active || r.mode !== 'sea' || r.volume <= 0 || r.path.length < 2) continue;
      const civ = w.civs.get(r.civA);
      const ships = Math.min(3, 1 + Math.floor(Math.log10(r.volume + 1) / 2));
      for (let k = 0; k < ships; k++) {
        const t = ((this.time * 0.6 + k * 17 + r.id * 3) % r.path.length + r.path.length) % r.path.length;
        const i = r.path[Math.floor(t)];
        const x = m.xOf(i);
        const y = m.yOf(i);
        if (x < vis[0] || x > vis[2] || y < vis[1] || y > vis[3] || !m.isWater(i)) continue;
        const naval = civ?.caps.navalTier ?? 3;
        const id = naval >= 6 ? 'veh.cargo' : naval >= 5 ? 'veh.steamship' : naval >= 4 ? 'veh.galleon' : 'veh.cog';
        atlas.draw(ctx, id, x * TILE + 4, y * TILE + 6, this.frameIdx(3), civ?.color);
      }
    }
    if (tilePx < 7) return;
    // trains and cars near settlements with railways/highways
    for (const s of w.settlements.values()) {
      if (s.x < vis[0] - 8 || s.x > vis[2] + 8 || s.y < vis[1] - 8 || s.y > vis[3] + 8) continue;
      const civ = w.civs.get(s.civId);
      if (!civ) continue;
      if (civ.caps.railTier >= 1 && s.bld[B.STATION]) {
        const train = vehicleSprite('rail', civ.caps, eraToTier(civ.era), s.id) ?? 'veh.train_steam';
        const t = this.time * 0.8 + s.id;
        const dx = Math.cos(t * 0.3) * s.radius;
        const ri = m.idx(Math.max(0, Math.min(m.w - 1, Math.round(s.x + dx))), s.y);
        if (m.railTier(ri)) atlas.draw(ctx, train, (s.x + dx) * TILE, s.y * TILE + 5, this.frameIdx(4), civ.color, Math.sin(t * 0.3) > 0);
      }
      // street traffic of the era: porters and carts, horses and buggies, trams, cars and buses, hovercars
      if (civ.caps.roadTier >= 1 && s.pop > 2000) {
        const cars = Math.min(6, Math.floor(Math.log10(s.pop)));
        const tier = eraToTier(civ.era);
        const style = housingStyleForEthos(civ.ethos?.key);
        for (let k = 0; k < cars; k++) {
          const t = this.time * 0.5 + k * 1.7 + s.id;
          const x = s.x + Math.cos(t) * (1 + (k % 3));
          const y = s.y + Math.sin(t * 0.7) * (1 + (k % 2));
          const i = m.idx(Math.max(0, Math.min(m.w - 1, Math.round(x))), Math.max(0, Math.min(m.h - 1, Math.round(y))));
          const veh = vehicleSprite('road', civ.caps, tier, s.id * 7 + k, style);
          if (!veh || !(m.roadTier(i) || m.bld[i])) continue;
          if (tilePx < 20) {
            this.drawScaled(veh, x * TILE, y * TILE, this.frameIdx(4, k), civ.color, Math.sin(t) > 0, 0.5);
            continue;
          }
          // close-up: in the lanes of the city's streets, at street scale
          for (let q = 0; q < 3; q++) {
            const hh = hash3(s.id, k * 3 + q, 31);
            const plan = this.planAt(i);
            const p = plan && streetPoint(plan, hh, this.time * 0.05 * (1 + (hh % 2)) + (hh % 89) / 89, true);
            if (!p) continue;
            const tx = m.xOf(i), ty = m.yOf(i);
            this.drawScaled(veh, tx * TILE + p.x / DETAIL, ty * TILE + (p.y + 1) / DETAIL, this.frameIdx(4, k), civ.color, p.horiz ? (hh & 1) === 1 : false, 1 / 8);
          }
        }
      }
      if (civ.caps.airTier >= 2 && s.bld[B.AIRPORT]) {
        const t = (this.time * 0.05 + s.id * 0.37) % 1;
        const x = s.x + (t - 0.5) * 40;
        const y = s.y - 6 + Math.sin(t * 6) * 2;
        atlas.draw(ctx, vehicleSprite('air', civ.caps, eraToTier(civ.era), s.id) ?? 'veh.biplane', x * TILE, y * TILE, this.frameIdx(6), civ.color);
      }
      if (civ.caps.spaceTier >= 1 && s.bld[B.SPACEPORT]) {
        const cycle = (this.time * 0.1 + s.id) % 6;
        if (cycle < 1.5) atlas.draw(ctx, 'veh.rocket', (s.x + 1) * TILE, s.y * TILE - cycle * 60, this.frameIdx(8), civ.color);
      }
    }
  }

  /** Rain/snow where regional anomalies are strongly wet (real climate state). */
  private drawWeather(vis: [number, number, number, number], tilePx: number): void {
    if (tilePx < 6) return;
    const { ctx, atlas } = this;
    const c = this.sim.w.climate;
    const m = this.sim.w.map;
    const [x0, y0, x1, y1] = vis;
    for (let k = 0; k < 60; k++) {
      const x = x0 + (hash3(k, 1, 7) % Math.max(1, x1 - x0 + 1));
      const yBase = y0 + (hash3(k, 2, 7) % Math.max(1, y1 - y0 + 1));
      const cell = ((yBase / c.cellSize) | 0) * c.cellsX + ((x / c.cellSize) | 0);
      if ((c.rain[cell] ?? 0) < 0.45) continue;
      const fall = ((this.time * 30 + hash3(k, 3, 7)) % 24) - 12;
      const i = m.idx(Math.min(m.w - 1, x), Math.min(m.h - 1, yBase));
      atlas.draw(ctx, m.temp[i] < 0 ? 'fx.snow' : 'fx.rain', x * TILE + (k % 8), yBase * TILE + fall);
    }
  }

  private drawTradeRoutes(): void {
    const ctx = this.ctx;
    const m = this.sim.w.map;
    ctx.lineCap = 'round';
    for (const r of this.sim.w.routes.values()) {
      if (!r.active || r.path.length < 2) continue;
      ctx.strokeStyle = r.volume > 0 ? 'rgba(240,200,90,0.9)' : 'rgba(150,150,150,0.5)';
      ctx.lineWidth = Math.min(4, 1 + Math.log10(r.volume + 1) * 0.6);
      ctx.beginPath();
      for (let k = 0; k < r.path.length; k++) {
        const i = r.path[k];
        const x = m.xOf(i) * TILE + 4;
        const y = m.yOf(i) * TILE + 4;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  private drawFx(dt: number): void {
    const { ctx, atlas } = this;
    const fx = this.sim.fx;
    for (let k = fx.length - 1; k >= 0; k--) {
      const f = fx[k];
      f.t -= dt;
      if (f.t <= 0) {
        fx.splice(k, 1);
        continue;
      }
      const spr = atlas.get(f.kind);
      const progress = 1 - f.t / f.dur;
      const frame = spr ? Math.min(spr.frames - 1, Math.floor(progress * spr.frames)) : 0;
      atlas.draw(ctx, f.kind, f.x * TILE + 4, f.y * TILE + 6, spr && spr.frames > 1 ? (f.kind === 'fx.fire' || f.kind === 'fx.clash' ? this.frameIdx(8) : frame) : 0);
    }
    if (this.highlight) {
      this.highlight.t -= dt;
      if (this.highlight.t <= 0) this.highlight = null;
      else {
        ctx.strokeStyle = `rgba(216,165,72,${Math.min(1, this.highlight.t)})`;
        ctx.lineWidth = 2 / this.cam.zoom;
        const r = 10 + (1 - (this.highlight.t % 1)) * 14;
        ctx.beginPath();
        ctx.arc(this.highlight.x * TILE + 4, this.highlight.y * TILE + 4, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private drawSelection(): void {
    const sel = this.selection;
    if (!sel) return;
    const w = this.sim.w;
    let x = -1;
    let y = -1;
    let r = 1.5;
    if (sel.kind === 'settlement') {
      const s = w.settlements.get(sel.id);
      if (s) [x, y, r] = [s.x + 0.5, s.y + 0.5, Math.max(1.5, s.radius)];
    } else if (sel.kind === 'army') {
      const a = w.armies.get(sel.id);
      if (a) [x, y] = [a.x, a.y];
    } else if (sel.kind === 'herd') {
      const h = w.herds.get(sel.id);
      if (h) [x, y] = [h.x, h.y];
    } else if (sel.kind === 'band') {
      const b = w.bands.get(sel.id);
      if (b) [x, y] = [b.x, b.y];
    }
    if (x < 0) return;
    const ctx = this.ctx;
    ctx.strokeStyle = '#5fd0c4';
    ctx.setLineDash([3 / this.cam.zoom * 2, 2 / this.cam.zoom * 2]);
    ctx.lineWidth = 1.5 / this.cam.zoom;
    ctx.beginPath();
    ctx.ellipse(x * TILE, y * TILE, r * TILE, r * TILE * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawBrush(): void {
    const b = this.brush;
    if (!b.visible) return;
    const ctx = this.ctx;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 1.5 / this.cam.zoom;
    ctx.fillStyle = b.color + '22';
    ctx.beginPath();
    ctx.arc((b.x + 0.5) * TILE, (b.y + 0.5) * TILE, Math.max(0.5, b.r) * TILE, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  private drawLabels(tilePx: number): void {
    const ctx = this.ctx;
    const w = this.sim.w;
    const cam = this.cam;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    // labels are placed largest-first; one that would overlap an already placed label is skipped
    const placed: number[][] = [];
    const free = (x0: number, y0: number, x1: number, y1: number) => {
      for (const r of placed) if (x0 < r[2] && x1 > r[0] && y0 < r[3] && y1 > r[1]) return false;
      placed.push([x0, y0, x1, y1]);
      return true;
    };
    if (tilePx >= 5) {
      ctx.font = `${tilePx >= 12 ? 13 : 11}px "Pixelify Sans", ui-monospace, monospace`;
      for (const s of [...w.settlements.values()].sort((a, b) => Number(b.capital) - Number(a.capital) || b.pop - a.pop)) {
        if (s.pop < (tilePx >= 10 ? 0 : 500)) continue;
        const [sx, sy] = cam.worldToScreen((s.x + 0.5) * TILE, s.y * TILE - 10);
        if (sx < -60 || sx > cam.viewW + 60 || sy < -20 || sy > cam.viewH + 20) continue;
        const civ = w.civs.get(s.civId);
        const text = s.capital ? `★ ${s.name}` : s.name;
        ctx.fillStyle = 'rgba(13,20,36,0.75)';
        const tw = ctx.measureText(text).width;
        if (!free(sx - tw / 2 - (s.capital ? 20 : 4), sy - 15, sx + tw / 2 + 4, sy)) continue;
        ctx.fillRect(sx - tw / 2 - 4, sy - 15, tw + 8, 15);
        if (s.capital && civ) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(flagCanvas(civ), Math.round(sx - tw / 2 - 19), sy - 14, 15, 10);
        }
        ctx.fillStyle = civ?.color ?? '#ece2c8';
        ctx.fillRect(sx - tw / 2 - 4, sy - 2, tw + 8, 2);
        ctx.fillStyle = '#ece2c8';
        ctx.fillText(text, sx, sy - 2);
      }
    } else {
      ctx.font = '12px "Pixelify Sans", ui-monospace, monospace';
      for (const civ of [...w.civs.values()].filter((c) => c.alive).sort((a, b) => b.population - a.population)) {
        const cap = w.settlements.get(civ.capital);
        if (!cap) continue;
        const [sx, sy] = cam.worldToScreen(cap.x * TILE, cap.y * TILE);
        ctx.fillStyle = 'rgba(13,20,36,0.7)';
        const tw = ctx.measureText(civ.name).width;
        if (!free(sx - tw / 2 - 22, sy - 16, sx + tw / 2 + 4, sy)) continue;
        ctx.fillRect(sx - tw / 2 - 22, sy - 16, tw + 26, 15);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(flagCanvas(civ), Math.round(sx - tw / 2 - 19), Math.round(sy - 14), 15, 10);
        ctx.fillStyle = civ.color;
        ctx.fillRect(sx - tw / 2 - 22, sy - 2, tw + 26, 2);
        ctx.fillStyle = '#ece2c8';
        ctx.fillText(civ.name, sx + 2, sy - 3);
      }
    }
  }

  /** Thumbnail data URL of the world overview (for save slots). */
  thumbnail(size = 96): string {
    this.layer.updateOverview();
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.layer.overview, 0, 0, size, size);
    this.overlay.update(true);
    ctx.globalAlpha = 0.6;
    ctx.drawImage(this.overlay.canvas, 0, 0, size, size);
    return c.toDataURL('image/png');
  }
}

export { OV_SCALE };

/**
 * A walker drawn from the town's real employment mix: farmers, miners, smiths, merchants and scholars,
 * soldiers of the nation's land-warfare tier, builders, and the unemployed out walking.
 */
function townsperson(emp: number[], tier: number, landTier: number, h: number): string {
  let total = 0;
  for (const v of emp) total += Math.max(0, v);
  if (total <= 0 || h % 4 === 0) return `unit.citizen.${Math.min(7, tier)}`; // plain townsfolk too
  let r = ((h >>> 3) % 1000) / 1000 * total;
  let sector = 0;
  for (; sector < emp.length - 1; sector++) { r -= Math.max(0, emp[sector]); if (r <= 0) break; }
  switch (sector) {
    case 0: return characterSprite('farmer', tier, h);
    case 1: return characterSprite('miner', tier, h);
    case 2: return characterSprite('smith', tier, h);
    case 3: return `unit.citizen.${Math.min(7, tier)}`;
    case 4: return characterSprite(h % 3 === 0 ? 'scholar' : h % 5 === 0 ? 'priest' : 'merchant', tier, h);
    case 5: return soldierSprite(landTier);
    default: return characterSprite('walker', tier, h);
  }
}
