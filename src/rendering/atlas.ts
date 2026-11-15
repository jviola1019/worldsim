/**
 * Sprite atlas: rasterizes every palette-keyed sprite into canvases once at
 * startup, with lazily created team-colored variants (T/U/V keys replaced by
 * a civilization's colors). Rendering then uses nearest-neighbor drawImage.
 */
import { ALL_SPRITES } from './art/index';
import type { SpriteDef } from './art/types';
import { PALETTE, hexToRgb, teamShades } from './art/palette';

export interface SpriteImg {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  frames: number;
  ax: number;
  ay: number;
  fps: number;
  fw: number;
  fh: number;
  team: boolean;
}

const rgbCache = new Map<string, [number, number, number]>();
function rgbOf(key: string, team?: Record<string, string>): [number, number, number] {
  if (team && (key === 'T' || key === 'U' || key === 'V')) return hexToRgb(team[key]);
  let c = rgbCache.get(key);
  if (!c) rgbCache.set(key, (c = hexToRgb(PALETTE[key] ?? '#ff00ff')));
  return c;
}

function rasterize(def: SpriteDef, team?: Record<string, string>): HTMLCanvasElement {
  const n = def.frames.length;
  const c = document.createElement('canvas');
  c.width = def.w * n;
  c.height = def.h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(c.width, c.height);
  for (let f = 0; f < n; f++) {
    const rows = def.frames[f];
    for (let y = 0; y < def.h; y++) {
      const row = rows[y] ?? '';
      for (let x = 0; x < def.w; x++) {
        const ch = row[x];
        if (!ch || ch === '.') continue;
        const [r, g, b] = rgbOf(ch, team);
        const o = (y * c.width + f * def.w + x) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export class Atlas {
  private base = new Map<string, SpriteImg>();
  private tinted = new Map<string, SpriteImg>();
  /** For building keys: available tiers (sorted) and variant suffixes. */
  private bldTiers = new Map<string, number[]>();

  constructor() {
    for (const [id, def] of Object.entries(ALL_SPRITES)) {
      const team = def.frames.some((fr) => fr.some((r) => /[TUV]/.test(r)));
      this.base.set(id, {
        canvas: rasterize(def),
        w: def.w,
        h: def.h,
        frames: def.frames.length,
        ax: def.ax ?? Math.floor(def.w / 2),
        ay: def.ay ?? def.h - 1,
        fps: def.fps ?? 4,
        fw: def.fw ?? 1,
        fh: def.fh ?? 1,
        team,
      });
      const m = /^bld\.([A-Z_]+)\.(\d)$/.exec(id);
      if (m) {
        const arr = this.bldTiers.get(m[1]) ?? [];
        arr.push(Number(m[2]));
        arr.sort((a, b) => a - b);
        this.bldTiers.set(m[1], arr);
      }
    }
  }

  has(id: string): boolean {
    return this.base.has(id);
  }

  get(id: string, teamColor?: string): SpriteImg | undefined {
    const b = this.base.get(id);
    if (!b || !teamColor || !b.team) return b;
    const key = id + '|' + teamColor;
    let t = this.tinted.get(key);
    if (!t) {
      t = { ...b, canvas: rasterize(ALL_SPRITES[id], teamShades(teamColor)) };
      this.tinted.set(key, t);
    }
    return t;
  }

  /** Building sprite id for a key and tier, falling back to the nearest available tier. */
  buildingId(key: string, tier: number, variantHash = 0): string | undefined {
    const tiers = this.bldTiers.get(key);
    if (!tiers || !tiers.length) return undefined;
    let best = tiers[0];
    for (const t of tiers) if (t <= tier) best = t;
    if (best > tier) best = tiers[0];
    const variant = `bld.${key}.${best}b`;
    if (variantHash % 2 === 1 && this.base.has(variant)) return variant;
    return `bld.${key}.${best}`;
  }

  /** Draw a sprite frame with its anchor at (x, y) in the current transform. */
  draw(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, frame = 0, teamColor?: string, flip = false): void {
    const s = this.get(id, teamColor);
    if (!s) return;
    const f = frame % s.frames;
    if (flip) {
      ctx.save();
      ctx.translate(Math.round(x), 0);
      ctx.scale(-1, 1);
      ctx.drawImage(s.canvas, f * s.w, 0, s.w, s.h, -s.ax, Math.round(y) - s.ay, s.w, s.h);
      ctx.restore();
      return;
    }
    ctx.drawImage(s.canvas, f * s.w, 0, s.w, s.h, Math.round(x) - s.ax, Math.round(y) - s.ay, s.w, s.h);
  }

  /** Data URL of an icon (for HTML UI), rendered at an integer scale. */
  iconUrl(id: string, scale = 3): string {
    const key = `url:${id}:${scale}`;
    const cached = this.urls.get(key);
    if (cached) return cached;
    const s = this.base.get(id);
    if (!s) return '';
    const c = document.createElement('canvas');
    c.width = s.w * scale;
    c.height = s.h * scale;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(s.canvas, 0, 0, s.w, s.h, 0, 0, c.width, c.height);
    const url = c.toDataURL();
    this.urls.set(key, url);
    return url;
  }
  private urls = new Map<string, string>();
}
