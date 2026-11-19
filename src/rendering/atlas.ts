/**
 * Sprite atlas: rasterizes every palette-keyed sprite into canvases once at
 * startup, with lazily created team-colored variants (T/U/V keys replaced by
 * a civilization's colors). Rendering then uses nearest-neighbor drawImage.
 */
import { ALL_SPRITES } from './art/index';
import type { SpriteDef } from './art/types';
import { teamShades, mutedTeamShades } from './art/palette';
import { rasterizeSprite } from './art/raster';
import { BuildingSpriteIndex, type HousingStyle } from './art/select';

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

function rasterize(def: SpriteDef, team?: Record<string, string>): HTMLCanvasElement {
  const img = rasterizeSprite(def, team);
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  const data = ctx.createImageData(img.width, img.height);
  data.data.set(img.data);
  ctx.putImageData(data, 0, 0);
  return c;
}

export class Atlas {
  private base = new Map<string, SpriteImg>();
  private tinted = new Map<string, SpriteImg>();
  /** District sprites by key, tier, variant letter and ethos style. */
  readonly buildings = new BuildingSpriteIndex(Object.keys(ALL_SPRITES));

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
    }
  }

  has(id: string): boolean {
    return this.base.has(id);
  }

  /** A sprite, tinted with a nation's colour; `muted` blends that colour into a neutral material (buildings). */
  get(id: string, teamColor?: string, muted = false): SpriteImg | undefined {
    const b = this.base.get(id);
    if (!b || !teamColor || !b.team) return b;
    const key = id + '|' + teamColor + (muted ? '|m' : '');
    let t = this.tinted.get(key);
    if (!t) {
      t = { ...b, canvas: rasterize(ALL_SPRITES[id], muted ? mutedTeamShades(teamColor) : teamShades(teamColor)) };
      this.tinted.set(key, t);
    }
    return t;
  }

  /**
   * Building sprite id for a key and tier, falling back to the nearest available tier. `variantHash`
   * (the tile hash) picks among the tier's looks (bld.KEY.N, bld.KEY.Nb, .Nc, ...); `style` swaps in an
   * ethos style set (bld.KEY.atomic.n / bld.KEY.eco.n) from the modern tier on. See art/select.ts.
   */
  buildingId(key: string, tier: number, variantHash = 0, style?: HousingStyle): string | undefined {
    return this.buildings.resolve(key, tier, variantHash, style);
  }

  /** Draw a sprite frame with its anchor at (x, y) in the current transform. */
  draw(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, frame = 0, teamColor?: string, flip = false, muted = false, scale = 1): void {
    if (scale !== 1) {
      // scaled about the anchor point (units at street scale in the close-up)
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      this.draw(ctx, id, 0, 0, frame, teamColor, flip, muted);
      ctx.restore();
      return;
    }
    const s = this.get(id, teamColor, muted);
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
