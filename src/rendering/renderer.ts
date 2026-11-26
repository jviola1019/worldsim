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
import { trafficOf, roadBonusOf } from '../economy/traffic';
import { readableScale, personSprite, personSize, workSprite, peopleOf, crowdSize, herdShown, notablesBySettlement } from './closeup';
import { vehicleSprite, housingStyleForEthos, characterSprite, soldierSprite } from './art/select';
import { flagCanvas } from './flag';
import type { Sim, VisualFx, FxSpec } from '../sim/context';
import { CHUNK } from '../sim/context';
import { Atlas } from './atlas';
import { Camera, TILE } from './camera';
import { TerrainLayer, PAD } from './terrainLayer';
import { CityLayer, DCHUNK, DETAIL, DPAD, detailAlpha, selectDetailChunks, motionTime, drawOrder } from './cityLayer';
import { blockContext, blockSignature, composeBlock, streetPoint, isDetailTile, type BlockPlan } from './cityBlocks';
import { BUILDINGS } from '../civilizations/buildings';
import { OverlayLayer, SCALE as OV_SCALE } from './overlays';
import { HAZARD } from '../world/tilemap';
import { B, eraToTier } from '../civilizations/buildingTypes';
import { SPECIES_BY_KEY, MONSTERS } from '../ecology/species';
import { hash3 } from '../core/rng';
import { fxFrame, sickMarker, auroraAlpha, stillKind, pallShowsSymbol, LOOP_FPS } from './fxMotion';
import { fxLayout, fxShadow, fillsRing, labelFade, sickMarkerY, spreadOffset, TALL_FX, type Rect } from './fxLayout';

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
  /** Reduce motion (player setting or OS): no walkers or street traffic; weather, ships, trains and sprites step at most once a second. */
  reduceMotion = false;
  private flashT = 0;
  private dataShown: Record<string, string> = {};
  /** Test hooks on the canvas, written only when they change (no DOM churn each frame). */
  private setData(key: string, value: string): void {
    if (this.dataShown[key] === value) return;
    this.dataShown[key] = value;
    this.canvas.dataset[key] = value;
  }
  private flashColor = '';
  private lastFlash = -99;
  /** Units, settlers, herds and monsters shrink in the close-up so they do not dwarf city blocks. */
  private unitScale = 1;
  /** Round 9: past 20 px per tile actors keep a readable size and real people are drawn. */
  private closeUp = false;
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
      this.overlay.markZone(k);
    });
    const tilePx = cam.zoom * TILE;
    const far = tilePx < 2.6;
    const close = far ? 0 : detailAlpha(tilePx);
    this.closeUp = tilePx >= 20;
    this.unitScale = this.closeUp ? readableScale(cam.zoom) : 1; // round 9: readable, WorldBox-style actors up close
    this.peopleHits = []; // only what this frame draws can be tapped
    if (far) {
      this.layer.updateOverview();
      ctx.drawImage(this.layer.overview, 0, 0, m.w * TILE, m.h * TILE);
    } else this.drawChunks(close >= 1 ? (k) => (this.city.readyForMapChunk(k) ? this.base : this.layer) : () => this.layer);
    if (close > 0) this.drawCity(close);
    else this.cityChunksDrawn = 0;
    this.setData('cityChunks', String(this.cityChunksDrawn));
    this.setData('overviewRepaints', String(this.layer.overviewRepaints));
    this.setData('overlayRepaints', String(this.overlay.repaints));
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
      if (tilePx >= 20) this.drawCityDetails(vis);
      if (tilePx >= 4.5) {
        // up close people are always drawn (standing still under Reduce motion); farther out, walkers stop under Reduce motion
        if (!this.reduceMotion || tilePx >= 20) this.drawAmbient(vis, tilePx);
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
    this.drawSickTowns();
    this.drawSelection();
    this.drawBrush();
    this.drawHoverHand();
    // labels in screen space
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawAurora();
    if (this.showLabels) this.drawLabels(tilePx);
    if (this.flashT > 0) {
      // full-screen tint (0.25 opacity, fading over 400 ms)
      const rgb = FLASH_RGB[this.flashColor] ?? FLASH_RGB.white;
      ctx.fillStyle = `rgba(${rgb},${(0.25 * this.flashT) / 0.4})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.flashT = Math.max(0, this.flashT - dt);
    }
    this.setData('flash', this.flashT > 0 ? this.flashColor : '');
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
    // only the nearest chunks that hold city blocks and fit the cache: no thrash, bounded canvases
    const shown = selectDetailChunks([...wanted].sort((a, b) => d2(a) - d2(b)), (k) => this.city.isEmpty(k), CityLayer.CAP);
    this.city.refresh(shown, 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    const pad = DPAD / DETAIL;
    let drawn = 0, pending = 0;
    // top to bottom: a lower chunk's overhang (tall landmarks) must land on top of the chunk above it
    for (const k of drawOrder(shown)) {
      const c = this.city.get(k);
      if (!c) { pending++; continue; } // not drawn yet: the map with its buildings shows (drawChunks)
      drawn++;
      const x = (k % this.city.cx) * DCHUNK * TILE;
      const y = Math.floor(k / this.city.cx) * DCHUNK * TILE;
      ctx.drawImage(c, x, y - pad, DCHUNK * TILE, DCHUNK * TILE + pad);
    }
    ctx.restore();
    this.cityChunksDrawn = drawn;
    this.setData('cityPending', String(pending));
    this.setData('cityRedraws', String(this.city.redraws));
  }

  /** `layerFor(k)`: which map layer draws map chunk k (the base without city buildings only where the close-up is ready). */
  private drawChunks(layerFor: (k: number) => TerrainLayer = () => this.layer): void {
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
    const onBase = sorted.filter((k) => layerFor(k) === this.base), onLayer = sorted.filter((k) => layerFor(k) !== this.base);
    if (onLayer.length) this.layer.refresh(onLayer, 4);
    if (onBase.length) this.base.refresh(onBase, 4);
    for (const k of wanted) {
      const layer = layerFor(k);
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
    // reduced motion: animated sprites change at most once a second
    return Math.floor(this.time * (this.reduceMotion ? Math.min(1, fps) : fps) + seed);
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
          if (this.closeUp && isDetailTile(m, i)) continue; // up close, city blocks have their own chimney wisps (drawCityDetails)
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
  /** Below the close-up, townsfolk at half size; in the close-up, real people and crowds at a readable size (drawPeople). */
  private drawAmbient(vis: [number, number, number, number], tilePx: number): void {
    if (tilePx < 9) return;
    if (tilePx >= 20) { this.drawPeople(vis); return; }
    if (this.reduceMotion) return;
    const { atlas } = this;
    const w = this.sim.w;
    const [x0, y0, x1, y1] = vis;
    for (const s of w.settlements.values()) {
      if (s.x < x0 - 3 || s.x > x1 + 3 || s.y < y0 - 3 || s.y > y1 + 3) continue;
      const civ = w.civs.get(s.civId);
      const tier = civ ? eraToTier(civ.era) : 0;
      const n = Math.min(10, Math.round(Math.log2(s.pop + 2)));
      for (let k = 0; k < n; k++) {
        const h = hash3(s.id, k, 9);
        const ang = (h % 628) / 100 + this.time * 0.15 * ((h >> 10) % 2 ? 1 : -1);
        const rad = 0.6 + ((h >> 4) % 100) / 100 * Math.max(1, s.radius * 0.6);
        const wx = (s.x + 0.5 + Math.cos(ang) * rad) * TILE;
        const wy = (s.y + 0.5 + Math.sin(ang) * rad * 0.8) * TILE;
        const job = workSprite(s.employment, tier, civ?.caps.landTier ?? 0, h);
        this.drawScaled(atlas.has(job) ? job : 'unit.citizen.0', wx, wy, this.frameIdx(4, k), civ?.color, Math.sin(ang) > 0, 0.5);
      }
    }
  }

  /**
   * Round 9, the close zoom: chimney smoke over industry and power districts, flags in the nation's colours over
   * palaces, temples and civic districts. Animated; a still frame under Reduce motion.
   */
  private drawCityDetails(vis: [number, number, number, number]): void {
    const { atlas } = this;
    const m = this.sim.w.map;
    const [x0, y0, x1, y1] = vis;
    const k = this.unitScale;
    let n = 0;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * m.w + x;
        if (!isDetailTile(m, i)) continue;
        const def = BUILDINGS[m.bld[i]];
        const h = hash3(x, y, 71);
        const bx = x * TILE + 2 + (h % 4), by = y * TILE + 2;
        if (def.category === 'industry' || def.category === 'energy') {
          if (def.id === B.SOLAR || def.id === B.WIND || (h & 1)) continue; // every other chimney, light wisps
          this.ctx.globalAlpha = 0.55;
          atlas.draw(this.ctx, 'fx.smoke', bx, by, this.reduceMotion ? 0 : this.frameIdx(2, h % 7), undefined, false, false, k * 0.4);
          this.ctx.globalAlpha = 1;
          n++;
        } else if (def.id === B.PALACE || def.id === B.TEMPLE || def.id === B.UNIVERSITY || def.category === 'civic' && (h & 3) === 0) {
          const own = m.owner[i] ? this.sim.w.civs.get(m.owner[i])?.color : undefined;
          atlas.draw(this.ctx, 'fx.flag', bx + 3, by + 2, this.reduceMotion ? 0 : this.frameIdx(3, h % 5), own, false, false, k);
          n++;
        }
      }
    this.setData('cityDetails', String(n));
  }

  /** Notable residents per settlement, rebuilt once a simulated year. */
  private notables: { year: number; map: Map<number, number[]> } = { year: -1, map: new Map() };
  /** Where each real person was drawn this frame (world px), for tapping. */
  private peopleHits: { x: number; y: number; id: number }[] = [];

  /**
   * Round 9, the close zoom: every living member of a small town (the simulation's real individuals) and the
   * notable residents of a big city walk its streets, with representative townsfolk sampled from the city's real
   * employment around them, all at a readable size. Reduce motion: they stand still.
   */
  private drawPeople(vis: [number, number, number, number]): void {
    const { atlas } = this;
    const w = this.sim.w;
    const m = w.map;
    if (this.notables.year !== this.sim.year) this.notables = { year: this.sim.year, map: notablesBySettlement(w.persons) };
    const [x0, y0, x1, y1] = vis;
    const k = this.unitScale;
    const t = this.reduceMotion ? 0 : this.time;
    let drawn = 0;
    for (const s of w.settlements.values()) {
      if (s.x < x0 - 3 || s.x > x1 + 3 || s.y < y0 - 3 || s.y > y1 + 3) continue;
      const civ = w.civs.get(s.civId);
      const tier = civ ? eraToTier(civ.era) : 0;
      const land = civ?.caps.landTier ?? 0;
      const real = peopleOf(s, w.persons, this.notables.map.get(s.id) ?? []);
      const crowd = s.mode === 'individual' ? 0 : crowdSize(s.pop);
      const total = real.length + crowd;
      for (let n = 0; n < total; n++) {
        const p = n < real.length ? real[n] : undefined;
        const h = p ? hash3(p.id, 7, 13) : hash3(s.id, n, 9);
        const pos = this.streetSpot(s, h, t);
        if (!pos) continue;
        const id = p ? personSprite(p, this.sim.year, tier, land, (hh) => workSprite(s.employment, tier, land, hh)) : workSprite(s.employment, tier, land, h);
        const size = p ? personSize(p, this.sim.year) : 1;
        this.drawScaled(atlas.has(id) ? id : 'unit.citizen.0', pos.x, pos.y, this.reduceMotion ? 0 : this.frameIdx(4, n), civ?.color, pos.flip, k * size);
        if (p) {
          this.peopleHits.push({ x: pos.x, y: pos.y, id: p.id });
          if (p.role !== 'commoner') atlas.draw(this.ctx, 'fx.star', pos.x, pos.y - 13 * k, 0, undefined, false, false, k * 0.8); // a notable person
        }
        drawn++;
      }
    }
    void m;
    this.setData('people', String(drawn));
    // test hook: where on screen (CSS px) one real person stands, clear of the top bar and the dock
    const onScreen = this.peopleHits.map((p) => this.cam.worldToScreen(p.x, p.y - 4 * k)).find(([sx, sy]) => sx > 40 && sx < this.cam.viewW - 40 && sy > 140 && sy < this.cam.viewH - 180);
    this.setData('personAt', onScreen ? `${Math.round(onScreen[0])},${Math.round(onScreen[1])}` : '');
  }

  /** A walking spot on the streets of a settlement for hash h (world px), or null. */
  private streetSpot(s: { x: number; y: number; radius: number }, h: number, t: number): { x: number; y: number; flip: boolean } | null {
    const m = this.sim.w.map;
    const r = Math.max(1, Math.round(s.radius * 0.7));
    const tx = s.x + ((h >>> 4) % (2 * r + 1)) - r, ty = s.y + ((h >>> 9) % (2 * r + 1)) - r;
    if (!m.inBounds(tx, ty)) return null;
    const plan = this.planAt(m.idx(tx, ty));
    if (plan) {
      const p = streetPoint(plan, h, t * 0.03 * (1 + (h % 3)) + (h % 97) / 97, false);
      if (p) return { x: tx * TILE + p.x / DETAIL, y: ty * TILE + (p.y + 1) / DETAIL, flip: p.horiz ? ((h >> 2) & 1) === 1 : false };
    }
    // villages without close-up blocks: wander around the centre, on land only (pulled in toward the centre over water)
    const ang = (h % 628) / 100 + t * 0.12 * ((h >> 10) % 2 ? 1 : -1);
    let rad = 0.4 + (((h >> 4) % 100) / 100) * Math.max(0.8, s.radius * 0.5);
    for (let k = 0; k < 4; k++) {
      const wx = s.x + 0.5 + Math.cos(ang) * rad, wy = s.y + 0.5 + Math.sin(ang) * rad * 0.8;
      if (m.inBounds(Math.floor(wx), Math.floor(wy)) && m.isLand(m.idx(Math.floor(wx), Math.floor(wy)))) return { x: wx * TILE, y: wy * TILE, flip: Math.sin(ang) > 0 };
      rad *= 0.5;
    }
    return null;
  }

  /** The real person drawn under a screen point (CSS px), if any: tapping a person opens them. */
  personAt(sx: number, sy: number): number | null {
    const [wx, wy] = this.cam.screenToWorld(sx, sy);
    const reach = Math.max(4, 9 * this.unitScale);
    let best: number | null = null, bestD = reach * reach;
    for (const p of this.peopleHits) {
      const d = (p.x - wx) ** 2 + (p.y - 4 * this.unitScale - wy) ** 2;
      if (d < bestD) { bestD = d; best = p.id; }
    }
    return best;
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
      // round 9: up close, up to 6 animals grazing over a wider patch
      const close = this.closeUp;
      const shown = herdShown(h.count, close);
      const spread = close ? 2.2 : 1;
      for (let k = 0; k < shown; k++) {
        const ox = ((hash3(h.id, k, 1) % 7) - 3) * 1.5 * spread;
        const oy = ((hash3(h.id, k, 2) % 5) - 2) * 1.2 * spread;
        atlas.draw(ctx, sp.sprite, h.x * TILE + ox, h.y * TILE + oy, this.frameIdx(4, k + h.id), undefined, h.tx < h.x, false, this.unitScale);
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
      // round 9: up close, the band's real members (up to 12), each drawn by role and age
      if (this.closeUp && b.species === 'human') {
        const members = b.members.slice(0, 12).map((id) => w.persons.get(id)).filter((p): p is NonNullable<typeof p> => !!p && p.died === undefined);
        members.forEach((p, k) => {
          const ox = ((hash3(p.id, 1, 1) % 11) - 5) * 1.6, oy = ((hash3(p.id, 2, 2) % 9) - 4) * 1.3;
          const id = personSprite(p, this.sim.year, 0, 0, () => 'unit.farmer');
          const x = b.x * TILE + ox, y = b.y * TILE + oy;
          this.drawScaled(atlas.has(id) ? id : sprite, x, y, this.frameIdx(4, k), civ?.color, b.tx < b.x, this.unitScale * personSize(p, this.sim.year));
          this.peopleHits.push({ x, y, id: p.id });
        });
        continue;
      }
      const n = Math.min(6, Math.ceil(b.members.length / 6));
      for (let k = 0; k < n; k++) {
        const ox = ((hash3(b.id, k, 1) % 9) - 4) * 1.6;
        const oy = ((hash3(b.id, k, 2) % 7) - 3) * 1.2;
        atlas.draw(ctx, sprite, b.x * TILE + ox, b.y * TILE + oy, this.frameIdx(4, k), civ?.color, b.tx < b.x, false, this.unitScale);
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
      atlas.draw(ctx, atlas.has(id) ? id : 'unit.settler', a.x * TILE, a.y * TILE, this.frameIdx(5, a.id), civ?.color, flip, false, this.unitScale);
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
        atlas.draw(ctx, ship, a.x * TILE, a.y * TILE, this.frameIdx(3), civ?.color, flip, false, this.unitScale);
        continue;
      }
      const tier = Math.min(12, a.tier);
      const unit = tier >= 9 && a.comp[3] > 0 ? 'veh.tank' : `unit.soldier.${tier}`;
      const n = Math.min(SOLDIER_MAX, Math.max(1, Math.round(Math.log10(a.manpower + 1) * 2)));
      for (let k = 0; k < n; k++) {
        const col = k % 4;
        const row = Math.floor(k / 4);
        const u = this.unitScale;
        atlas.draw(ctx, unit, a.x * TILE + ((col - 1.5) * 4 + (row % 2)) * u, a.y * TILE + (row * 3 - 3) * u, this.frameIdx(a.state === 'battle' ? 8 : 5, k), civ?.color, flip, false, u);
      }
      if (civ) {
        // banner pole + the nation's own flag (6×4 art px at world scale)
        const u = this.unitScale;
        const bx = a.x * TILE - 9 * u, by = a.y * TILE - 10 * u;
        ctx.fillStyle = '#3b2a1a';
        ctx.fillRect(bx, by, Math.max(0.3, u), 9 * u);
        const wave = this.frameIdx(3) === 1 ? 1 : 0;
        ctx.drawImage(flagCanvas(civ), bx + u, by + wave * 0.5 * u, 6 * u, 4 * u);
      } else atlas.draw(ctx, 'fx.flag', a.x * TILE - 7 * this.unitScale, a.y * TILE - 4 * this.unitScale, this.frameIdx(3), undefined, false, false, this.unitScale);
      if (a.state === 'sieging') atlas.draw(ctx, 'fx.smoke', a.x * TILE + 6 * this.unitScale, a.y * TILE - 6 * this.unitScale, this.frameIdx(3), undefined, false, false, this.unitScale);
    }
  }

  private drawMonsters(vis: [number, number, number, number]): void {
    const { ctx, atlas } = this;
    const [x0, y0, x1, y1] = vis;
    for (const mo of this.sim.w.monsters.values()) {
      if (mo.x < x0 || mo.x > x1 || mo.y < y0 || mo.y > y1) continue;
      const def = MONSTERS.find((d) => d.kind === mo.kind);
      if (def) atlas.draw(ctx, def.sprite, mo.x * TILE, mo.y * TILE, this.frameIdx(4, mo.id), undefined, mo.tx < mo.x, false, this.unitScale);
    }
  }

  /** Vehicles drawn from real infrastructure: trains on built railways, cars on highways, ships on sea routes, aircraft between airports. */
  private drawTraffic(vis: [number, number, number, number], tilePx: number): void {
    if (tilePx < 4) return;
    const time = motionTime(this.time, this.reduceMotion); // under reduce motion: steps once a second
    const { ctx, atlas } = this;
    const w = this.sim.w;
    const m = w.map;
    // ships along active sea trade routes
    for (const r of w.routes.values()) {
      if (!r.active || r.mode !== 'sea' || r.volume <= 0 || r.path.length < 2) continue;
      const civ = w.civs.get(r.civA);
      const ships = Math.min(3, 1 + Math.floor(Math.log10(r.volume + 1) / 2));
      for (let k = 0; k < ships; k++) {
        const t = ((time * 0.6 + k * 17 + r.id * 3) % r.path.length + r.path.length) % r.path.length;
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
        const t = time * 0.8 + s.id;
        const dx = Math.cos(t * 0.3) * s.radius;
        const ri = m.idx(Math.max(0, Math.min(m.w - 1, Math.round(s.x + dx))), s.y);
        if (m.railTier(ri)) atlas.draw(ctx, train, (s.x + dx) * TILE, s.y * TILE + 5, this.frameIdx(4), civ.color, Math.sin(t * 0.3) > 0);
      }
      // street traffic of the era: porters and carts, horses and buggies, trams, cars and buses, hovercars
      if (civ.caps.roadTier >= 1 && s.pop > 2000 && !this.reduceMotion) {
        // round 7: as many vehicles as the city's traffic load implies (demand over street capacity, traffic.ts)
        const load = Math.min(1.5, trafficOf(s, civ, roadBonusOf(m, s)).load);
        const cars = Math.min(8, Math.max(1, Math.round(Math.log10(s.pop) * (0.4 + load))));
        const perBlock = 1 + Math.round(2 * load);
        const tier = eraToTier(civ.era);
        const style = housingStyleForEthos(civ.ethos?.key);
        for (let k = 0; k < cars; k++) {
          const t = time * 0.5 + k * 1.7 + s.id;
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
          for (let q = 0; q < perBlock; q++) {
            const hh = hash3(s.id, k * 3 + q, 31);
            const plan = this.planAt(i);
            const p = plan && streetPoint(plan, hh, time * 0.05 * (1 + (hh % 2)) + (hh % 89) / 89, true);
            if (!p) continue;
            const tx = m.xOf(i), ty = m.yOf(i);
            this.drawScaled(veh, tx * TILE + p.x / DETAIL, ty * TILE + (p.y + 1) / DETAIL, this.frameIdx(4, k), civ.color, p.horiz ? (hh & 1) === 1 : false, this.unitScale * 0.9);
          }
        }
      }
      if (civ.caps.airTier >= 2 && s.bld[B.AIRPORT]) {
        const t = (time * 0.05 + s.id * 0.37) % 1;
        const x = s.x + (t - 0.5) * 40;
        const y = s.y - 6 + Math.sin(t * 6) * 2;
        atlas.draw(ctx, vehicleSprite('air', civ.caps, eraToTier(civ.era), s.id) ?? 'veh.biplane', x * TILE, y * TILE, this.frameIdx(6), civ.color);
      }
      if (civ.caps.spaceTier >= 1 && s.bld[B.SPACEPORT]) {
        const cycle = (time * 0.1 + s.id) % 6;
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
      const fall = ((motionTime(this.time, this.reduceMotion) * 30 + hash3(k, 3, 7)) % 24) - 12;
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
    const kinds = new Set<string>();
    let motion = ''; // what each effect looks like this frame (ring size, sprite frame): a test hook for movement
    const reduce = this.reduceMotion;
    this.aurora = null;
    this.covers = [];
    const drawn = new Map<string, number[]>(); // anchors already drawn this frame, per kind (duplicates spread apart)
    for (let k = fx.length - 1; k >= 0; k--) {
      const f = fx[k];
      if (reduce && f.then) collapseSequence(f); // Reduce motion: the sequence shows one still (its characteristic step)
      const fresh = f.t >= f.dur;
      f.t -= dt;
      if (f.t <= 0) {
        fx.splice(k, 1);
        if (f.then) fx.push(followUp(f, f.then)); // meteor, then explosion, then smoke
        continue;
      }
      // a brief screen tint for the biggest concepts: never under Reduce motion, at most every 2 s
      if (f.flash && fresh && !reduce && this.time - this.lastFlash >= 2) {
        this.lastFlash = this.time;
        this.flashT = 0.4;
        this.flashColor = f.flash;
      }
      const progress = 1 - f.t / f.dur;
      if (f.kind === 'fx.aurora') {
        // drawn across the top of the view after the map (drawAurora); one band however many storms
        if (!this.aurora || progress < this.aurora.p) this.aurora = { p: progress };
        kinds.add(f.kind);
        continue;
      }
      if (f.x < 0) continue; // placeless: flash only
      const spr = atlas.get(f.kind);
      if (f.kind === 'fx.hand') {
        motion += this.drawHand(f.x, f.y, progress, f.sprite) + ';';
        kinds.add(f.kind);
        continue;
      }
      if (f.ring) {
        // area ring: grows to the concept's radius and fades; a still ring under Reduce motion
        const grow = reduce ? 1 : 0.35 + 0.65 * progress;
        const rgb = f.kind === 'fx.nuke' ? '255,255,255' : f.kind === 'fx.pall' ? '196,208,150' : '248,232,137'; // sickness: a pale green-grey ring, not gold
        const faint = fillsRing(f.kind) ? 0.4 : 1; // the body fills the area: the ring only marks its edge
        ctx.strokeStyle = `rgba(${rgb},${faint * (reduce ? 0.6 : (f.kind === 'fx.nuke' ? 0.85 : 0.8) * (1 - progress))})`;
        ctx.lineWidth = 2 / this.cam.zoom;
        ctx.beginPath();
        ctx.arc(f.x * TILE + 4, f.y * TILE + 4, f.ring * TILE * grow, 0, Math.PI * 2);
        ctx.stroke();
        motion += `r${Math.round(f.ring * TILE * grow * 4)}`;
      }
      // weather and sickness loop, blasts play once; one still frame under Reduce motion (fxMotion.ts)
      const frame = spr ? fxFrame(f.kind, spr.frames, progress, this.time, reduce) : 0;
      // several of one effect in one place spread apart instead of stacking into a blob
      const seen = drawn.get(f.kind) ?? [];
      let n = 0;
      for (let j = 0; j < seen.length; j += 2) if ((seen[j] - f.x) ** 2 + (seen[j + 1] - f.y) ** 2 <= 2.25) n++;
      seen.push(f.x, f.y);
      drawn.set(f.kind, seen);
      const [ox, oy] = spreadOffset(n);
      this.drawBody(f, frame, ox, oy);
      kinds.add(f.kind);
      motion += `f${frame};`;
    }
    this.setData('fx', [...kinds].sort().join(' '));
    this.setData('fxMotion', motion);
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

  /** Bodies of tall effects drawn this frame (world px): the name labels they cover fade (drawLabels). */
  private covers: Rect[] = [];

  /**
   * Fix round 1 (owner: full size, depth): an effect's body. It fills its ring with a whole-number scale or tiled
   * copies (fxLayout); things in the air first cast a soft shadow down-right on the ground (fxShadow). The sickness
   * pall is a see-through haze, topped by the sickbed only where the town does not already carry the sick-town
   * marker. Copies of a looping effect are out of step; under Reduce motion every copy shows the still frame.
   */
  private drawBody(f: VisualFx, frame: number, ox: number, oy: number): void {
    const { ctx, atlas } = this;
    const spr = atlas.get(f.kind);
    if (!spr) return;
    const places = fxLayout(f.kind, fillsRing(f.kind) ? f.ring ?? f.data ?? 0 : 0, spr.w, spr.h);
    const x0 = f.x * TILE + 4 + ox, y0 = f.y * TILE + 6 + oy;
    for (const p of places) {
      const sh = fxShadow(f.kind, p.scale, spr.w, spr.h);
      if (!sh) break;
      ctx.save();
      ctx.globalAlpha = sh.alpha;
      ctx.fillStyle = '#120d17';
      ctx.beginPath();
      ctx.ellipse(x0 + p.dx + sh.dx, y0 + p.dy + sh.dy, sh.rx, sh.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const offset = !this.reduceMotion && !!LOOP_FPS[f.kind];
    const pall = f.kind === 'fx.pall';
    ctx.save();
    if (pall) ctx.globalAlpha = 0.55;
    for (const p of places) {
      const x = x0 + p.dx, y = y0 + p.dy, k = p.scale;
      atlas.draw(ctx, f.kind, x, y, frame + (offset ? p.frame : 0), undefined, !!p.flip, false, k);
      if (TALL_FX.has(f.kind)) this.covers.push({ x0: x - spr.ax * k, y0: y - spr.ay * k, x1: x + (spr.w - spr.ax) * k, y1: y + (spr.h - spr.ay) * k });
    }
    ctx.restore();
    if (pall && pallShowsSymbol(this.sim.w.settlements.values(), f.x, f.y)) atlas.draw(ctx, 'fx.sick', f.x * TILE + 4, f.y * TILE - 1, 0);
  }

  /** CSS px of the view hidden under the top HUD (set by the game); the aurora hangs just below it. */
  topInset = 0;
  /** The aurora playing this frame (its progress), set by drawFx. */
  private aurora: { p: number } | null = null;

  /**
   * Round 10 second addendum: a geomagnetic storm's aurora, a band of light across the top of the view for the
   * storm's duration, over a dark night-sky wash so it reads on any land. Screen space, 4 px per art pixel. Fades in and
   * out; one still frame at a fixed opacity under Reduce motion.
   */
  private drawAurora(): void {
    const a = this.aurora;
    if (!a) { this.setData('aurora', ''); return; }
    const { ctx, atlas } = this;
    const spr = atlas.get('fx.aurora');
    if (!spr) return;
    const alpha = auroraAlpha(a.p, this.reduceMotion);
    const k = 4;
    const h = spr.h * k;
    const top = Math.min(this.topInset, this.cam.viewH / 3);
    ctx.save();
    // the sky darkens from the top of the view down past the curtains (under the HUD too: it hangs from above)
    const bottom = top + h + 24;
    const sky = ctx.createLinearGradient(0, 0, 0, bottom);
    sky.addColorStop(0, `rgba(8,12,26,${0.95 * alpha})`);
    sky.addColorStop((top + h * 0.8) / bottom, `rgba(8,12,26,${0.9 * alpha})`);
    sky.addColorStop(1, 'rgba(8,12,26,0)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.cam.viewW, bottom);
    // light adds to the night sky: the curtains glow instead of painting over it
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    const frame = fxFrame('fx.aurora', spr.frames, a.p, this.time, this.reduceMotion);
    for (let x = 0; x < this.cam.viewW; x += spr.w * k) atlas.draw(ctx, 'fx.aurora', x, top + 2, frame, undefined, false, false, k);
    ctx.restore();
    this.setData('aurora', `${frame}:${alpha.toFixed(2)}`);
  }

  /**
   * Round 10 second addendum: while more than 1% of a town is infected, a small red plague cross stands just right
   * of its centre, pulsing slowly (still under Reduce motion). It keeps a readable size (about 11 px) at any zoom.
   */
  private drawSickTowns(): void {
    const { ctx, atlas, cam } = this;
    const m = this.sim.w.map;
    const [x0, y0, x1, y1] = cam.visibleTiles(m.w, m.h, 2);
    const k = Math.max(this.unitScale, 11 / (7 * cam.zoom)); // about 11 screen px tall
    let n = 0;
    let pulse = '';
    for (const s of this.sim.w.settlements.values()) {
      if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
      const mark = sickMarker(s, this.time, this.reduceMotion);
      if (!mark) continue;
      ctx.save();
      ctx.globalAlpha = mark.alpha;
      atlas.draw(ctx, 'fx.sick', (s.x + 0.5) * TILE + 6 * k, sickMarkerY(s.y, k, cam.zoom), 0, undefined, false, false, k); // right of the centre, below the label
      ctx.restore();
      if (!n) pulse = mark.alpha.toFixed(2);
      n++;
    }
    this.setData('sick', String(n));
    this.setData('sickPulse', pulse);
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

  /**
   * Round 10 addendum: the placing hand. Feedback only: the people or animals already exist on the tap. Timeline
   * (progress p): the closed hand descends with an ease-out (0-0.35); it opens and three copies of the placed sprite
   * fall with an ease-in (0.35-0.6) and land in a puff of dust (0.6-0.85); the hand lifts and fades (0.65-1). Under
   * Reduce motion: one still, the open hand above the landed sprites. Returns a motion signature for tests.
   */
  private drawHand(tx: number, ty: number, p: number, sprite?: string): string {
    const { ctx, atlas } = this;
    const k = this.unitScale;
    const gx = tx * TILE + 4;
    const gy = ty * TILE + 6;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
    const id = sprite && atlas.has(sprite) ? sprite : undefined;
    const copies = (dy: number, alpha: number) => {
      if (!id || alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      for (const dx of [-4, 0, 4]) atlas.draw(ctx, id, gx + dx * k, gy + dy * k + (dx === 0 ? 1 : 0) * k, 0, undefined, dx < 0, false, k);
      ctx.restore();
    };
    if (this.reduceMotion) {
      copies(0, 1);
      atlas.draw(ctx, 'fx.hand', gx, gy - 10 * k, 1, undefined, false, false, k);
      return 'hand-still';
    }
    const handY = p < 0.35 ? lerp(-28, -10, 1 - (1 - p / 0.35) ** 2) : p < 0.65 ? -10 : lerp(-10, -30, ((p - 0.65) / 0.35) ** 2);
    const frame = p < 0.35 ? 0 : p < 0.65 ? 1 : 2;
    if (p >= 0.35) copies(lerp(-9, 0, ((p - 0.35) / 0.25) ** 2), p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1);
    if (p >= 0.6 && p < 0.85) {
      const dust = atlas.get('fx.dust');
      const df = dust ? Math.min(dust.frames - 1, Math.floor(((p - 0.6) / 0.25) * dust.frames)) : 0;
      atlas.draw(ctx, 'fx.dust', gx, gy + 1, df, undefined, false, false, k);
    }
    ctx.save();
    ctx.globalAlpha = p > 0.65 ? Math.max(0, 1 - (p - 0.65) / 0.35) : 1;
    atlas.draw(ctx, 'fx.hand', gx, gy + handY * k, frame, undefined, false, false, k);
    ctx.restore();
    return `hand${frame}y${Math.round(handY)}`;
  }

  /** Round 10 addendum: with a placing tool on desktop, an open hand hovers over the tile under the pointer. */
  hand = { x: 0, y: 0, visible: false };

  private drawHoverHand(): void {
    const h = this.hand;
    // while a drop plays near the pointer, only the dropping hand is drawn (two hands at once read as clutter)
    const dropping = this.sim.fx.some((f) => f.kind === 'fx.hand' && Math.abs(f.x - h.x) <= 2 && Math.abs(f.y - h.y) <= 2);
    this.setData('hand', h.visible ? 'on' : 'off');
    if (!h.visible || dropping) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.8;
    this.atlas.draw(ctx, 'fx.hand', h.x * TILE + 4, h.y * TILE - 4 * this.unitScale, 1, undefined, false, false, this.unitScale);
    ctx.restore();
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
    // fix round 1: a label under a tall effect (an ash column, a fireball, a storm) fades so the effect shows
    const covers = this.covers.map((c) => {
      const [x0, y0] = cam.worldToScreen(c.x0, c.y0);
      const [x1, y1] = cam.worldToScreen(c.x1, c.y1);
      return { x0, y0, x1, y1 };
    });
    let faded = 0;
    const fade = (x0: number, y0: number, x1: number, y1: number) => {
      const a = covers.length ? labelFade({ x0, y0, x1, y1 }, covers) : 1;
      if (a < 1) faded++;
      ctx.globalAlpha = a;
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
        fade(sx - tw / 2 - (s.capital ? 20 : 4), sy - 15, sx + tw / 2 + 4, sy);
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
        fade(sx - tw / 2 - 22, sy - 16, sx + tw / 2 + 4, sy);
        ctx.fillRect(sx - tw / 2 - 22, sy - 16, tw + 26, 15);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(flagCanvas(civ), Math.round(sx - tw / 2 - 19), Math.round(sy - 14), 15, 10);
        ctx.fillStyle = civ.color;
        ctx.fillRect(sx - tw / 2 - 22, sy - 2, tw + 26, 2);
        ctx.fillStyle = '#ece2c8';
        ctx.fillText(civ.name, sx + 2, sy - 3);
      }
    }
    ctx.globalAlpha = 1;
    this.setData('labelsFaded', String(faded));
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

/** Full-screen tints for the biggest concepts ('sick': the pale green-grey of the sickness pall). */
const FLASH_RGB: Record<string, string> = { white: '255,255,255', red: '230,60,40', green: '90,220,120', sick: '170,186,128' };

/**
 * A walker drawn from the town's real employment mix: farmers, miners, smiths, merchants and scholars,
 * soldiers of the nation's land-warfare tier, builders, and the unemployed out walking.
 */
/** The follow-up effect of a sequence, at the same place. */
function followUp(f: VisualFx, spec: FxSpec): VisualFx {
  const ring = spec.area ? Math.max(1, spec.radius ?? f.data ?? f.ring ?? 0) : undefined;
  return { kind: spec.kind, x: f.x, y: f.y, t: spec.dur, dur: spec.dur, data: f.data, ring, then: spec.then, flash: spec.flash };
}

/**
 * Reduce motion: a sequence becomes one still, shown for the whole sequence's duration: its characteristic step
 * (the eruption, the airburst) when it names one, else its last effect (stillKind).
 */
function collapseSequence(f: VisualFx): void {
  const kind = stillKind(f);
  let spec = f.then!;
  let total = f.t;
  let ring = f.ring ?? 0;
  for (;;) {
    total += spec.dur;
    if (spec.area) ring = Math.max(ring, spec.radius ?? f.data ?? 1);
    if (!spec.then) break;
    spec = spec.then;
  }
  f.kind = kind;
  f.t = f.dur = total;
  f.ring = ring || undefined;
  f.then = undefined;
}
