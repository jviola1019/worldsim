import { flagUrl, type FlagSpec } from '../rendering/flag';
import { Atlas } from '../rendering/atlas';
import { formatNumber } from '../core/math';

let atlas: Atlas | null = null;
export function getAtlas(): Atlas {
  if (!atlas) atlas = new Atlas();
  return atlas;
}

export function Icon({ id, size = 32, alt = '' }: { id: string; size?: number; alt?: string }) {
  const a = getAtlas();
  const url = a.iconUrl(a.has(id) ? id : 'ico.info', 4);
  return <img class="px" src={url} width={size} height={size} alt={alt} draggable={false} />;
}

export function Sprite({ id, scale = 3, color }: { id: string; scale?: number; color?: string }) {
  const a = getAtlas();
  const s = a.get(id, color);
  if (!s) return null;
  const c = document.createElement('canvas');
  c.width = s.w * scale;
  c.height = s.h * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s.canvas, 0, 0, s.w, s.h, 0, 0, c.width, c.height);
  return <img class="px" src={c.toDataURL()} width={c.width} height={c.height} alt="" />;
}

export const fmt = (n: number, d = 1) => formatNumber(n, d);
export const pct = (x: number) => `${Math.round(x * 100)}%`;

export function Kv({ rows }: { rows: [string, string | number | preact.JSX.Element][] }) {
  return (
    <dl class="kv">
      {rows.map(([k, v]) => [<dt key={k + 'k'}>{k}</dt>, <dd key={k + 'v'}>{v}</dd>])}
    </dl>
  );
}

export function Bar({ value, color }: { value: number; color?: string }) {
  return (
    <div class="bar" role="meter" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

/** Pixel flag of a civilization (generated from its emblem). */
export function Flag({ civ, size = 24 }: { civ: FlagSpec | undefined; size?: number }) {
  if (!civ) return null;
  return <img class="flag" src={flagUrl(civ)} width={size * 1.5} height={size} alt="" style={{ imageRendering: 'pixelated' }} />;
}
