/**
 * Canvas line chart for simulation time series.
 * Data-viz rules applied: one y-axis, recessive grid, 2px lines, legend for
 * >= 2 series, direct end labels (identity never color-alone; series also get
 * dash patterns as secondary encoding), crosshair + tooltip on hover/touch,
 * event markers drawn from real history events. Values come from stored
 * simulation samples only.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatNumber } from '../../core/math';

export interface Series {
  label: string;
  color: string;
  years: number[];
  values: number[];
}

export interface Marker {
  year: number;
  label: string;
}

const DASHES = [[], [6, 3], [2, 3], [8, 3, 2, 3], [4, 4], [1, 2]];

export function LineChart({ series, markers = [], unit = '', height = 170, format = (v: number) => formatNumber(v) }: { series: Series[]; markers?: Marker[]; unit?: string; height?: number; format?: (v: number) => string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const layout = useRef({ x0: 0, x1: 0, y0: 0, y1: 0, ymin: 0, ymax: 1, ylo: 0, yhi: 1 });

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = c.clientWidth || 300;
    const H = height;
    c.width = W * dpr;
    c.height = H * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const all = series.filter((s) => s.years.length > 0);
    if (!all.length) {
      ctx.fillStyle = '#a9b2c6';
      ctx.font = '13px "Pixelify Sans", sans-serif';
      ctx.fillText('No data recorded yet — let time run.', 12, H / 2);
      return;
    }
    let ylo = Infinity, yhi = -Infinity, vmin = Infinity, vmax = -Infinity;
    for (const s of all) {
      ylo = Math.min(ylo, s.years[0]);
      yhi = Math.max(yhi, s.years[s.years.length - 1]);
      for (const v of s.values) {
        vmin = Math.min(vmin, v);
        vmax = Math.max(vmax, v);
      }
    }
    if (vmin > 0) vmin = 0;
    if (vmax === vmin) vmax = vmin + 1;
    if (yhi === ylo) yhi = ylo + 1;
    const x0 = 44, x1 = W - 54, y0 = 10, y1 = H - 22;
    layout.current = { x0, x1, y0, y1, ymin: vmin, ymax: vmax, ylo, yhi };
    const X = (yr: number) => x0 + ((yr - ylo) / (yhi - ylo)) * (x1 - x0);
    const Y = (v: number) => y1 - ((v - vmin) / (vmax - vmin)) * (y1 - y0);
    // grid & axes (recessive)
    ctx.strokeStyle = 'rgba(169,178,198,0.15)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#a9b2c6';
    ctx.font = '11px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'right';
    for (let k = 0; k <= 3; k++) {
      const v = vmin + ((vmax - vmin) * k) / 3;
      const y = Math.round(Y(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      ctx.fillText(format(v) + unit, x0 - 4, y + 4);
    }
    ctx.textAlign = 'center';
    for (let k = 0; k <= 3; k++) {
      const yr = Math.round(ylo + ((yhi - ylo) * k) / 3);
      ctx.fillText(String(yr), X(yr), H - 6);
    }
    // event markers
    ctx.strokeStyle = 'rgba(216,165,72,0.35)';
    for (const m of markers) {
      if (m.year < ylo || m.year > yhi) continue;
      const x = Math.round(X(m.year)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
      ctx.stroke();
    }
    // series
    all.forEach((s, k) => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.setLineDash(DASHES[k % DASHES.length]);
      ctx.beginPath();
      s.years.forEach((yr, i) => (i ? ctx.lineTo(X(yr), Y(s.values[i])) : ctx.moveTo(X(yr), Y(s.values[i]))));
      ctx.stroke();
      ctx.setLineDash([]);
      // direct end label (text in ink, swatch carries color)
      if (all.length <= 4) {
        const lx = X(s.years[s.years.length - 1]);
        const ly = Y(s.values[s.values.length - 1]);
        ctx.fillStyle = s.color;
        ctx.fillRect(lx + 3, ly - 3, 6, 6);
        ctx.fillStyle = '#ece2c8';
        ctx.textAlign = 'left';
        ctx.fillText(s.label.slice(0, 7), lx + 11, ly + 4);
      }
    });
    // crosshair + tooltip
    if (hover !== null) {
      const x = Math.max(x0, Math.min(x1, hover));
      const yr = ylo + ((x - x0) / (x1 - x0)) * (yhi - ylo);
      ctx.strokeStyle = 'rgba(236,226,200,0.6)';
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, y0);
      ctx.lineTo(Math.round(x) + 0.5, y1);
      ctx.stroke();
      const lines: [string, string][] = [];
      for (const s of all) {
        let best = 0;
        for (let i = 0; i < s.years.length; i++) if (Math.abs(s.years[i] - yr) < Math.abs(s.years[best] - yr)) best = i;
        lines.push([s.color, `${s.label}: ${format(s.values[best])}${unit}`]);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(X(s.years[best]), Y(s.values[best]), 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#141c30';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      const ev = markers.filter((m) => Math.abs(m.year - yr) < (yhi - ylo) / 60).slice(0, 2);
      const text = [`Year ${Math.round(yr)}`, ...lines.map((l) => l[1]), ...ev.map((e) => `• ${e.label}`)];
      ctx.font = '12px "Pixelify Sans", sans-serif';
      const tw = Math.min(W - 8, Math.max(...text.map((t) => ctx.measureText(t).width)) + 16);
      const th = text.length * 15 + 8;
      const tx = x + tw + 12 > W ? x - tw - 8 : x + 8;
      ctx.fillStyle = 'rgba(20,28,48,0.96)';
      ctx.fillRect(tx, y0, tw, th);
      ctx.strokeStyle = '#3a4c72';
      ctx.strokeRect(tx + 0.5, y0 + 0.5, tw, th);
      ctx.textAlign = 'left';
      text.forEach((t, i) => {
        ctx.fillStyle = i === 0 ? '#d8a548' : '#ece2c8';
        ctx.fillText(t.slice(0, 48), tx + 8, y0 + 16 + i * 15);
      });
    }
  }, [series, markers, hover, height]);

  const move = (e: PointerEvent) => {
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    setHover(e.clientX - r.left);
  };
  return (
    <div>
      <canvas ref={ref} class="chart" style={{ height: height + 'px', touchAction: 'pan-y' }} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)} role="img" aria-label={`Chart of ${series.map((s) => s.label).join(', ')}`} />
      {series.length >= 2 && (
        <div class="legend">
          {series.map((s, k) => (
            <span key={s.label + k} class="chip">
              <i class="swatch" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
