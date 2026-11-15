import { useEffect, useRef } from 'preact/hooks';
import type { Screen } from '../App';
import { generateWorld, DEFAULT_GEN } from '../../world/worldgen';
import { TERRAIN } from '../../world/terrain';
import { hexToRgb } from '../../rendering/art/palette';

/** A small spinning pixel planet built from a real generated world. */
function Globe() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const { map } = generateWorld({ ...DEFAULT_GEN, width: 96, height: 96, seed: 'title-' + new Date().getDate() });
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const S = 64;
    const img = ctx.createImageData(S, S);
    let raf = 0;
    let t = 0;
    const colors = TERRAIN.map((d) => hexToRgb(d.color));
    const draw = () => {
      t += 0.0025;
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const nx = (x - S / 2 + 0.5) / (S / 2);
          const ny = (y - S / 2 + 0.5) / (S / 2);
          const r2 = nx * nx + ny * ny;
          const o = (y * S + x) * 4;
          if (r2 > 1) {
            img.data[o + 3] = 0;
            continue;
          }
          const nz = Math.sqrt(1 - r2);
          const lon = Math.atan2(nx, nz) + t * Math.PI * 2;
          const lat = Math.asin(ny);
          const mx = Math.floor((((lon / (Math.PI * 2)) % 1) + 1) % 1 * map.w);
          const my = Math.floor((lat / Math.PI + 0.5) * (map.h - 1));
          const [cr, cg, cb] = colors[map.terrain[my * map.w + mx]];
          const light = 0.45 + 0.55 * Math.max(0, nx * -0.5 + ny * -0.4 + nz * 0.75);
          img.data[o] = cr * light;
          img.data[o + 1] = cg * light;
          img.data[o + 2] = cb * light;
          img.data[o + 3] = 255;
        }
      ctx.putImageData(img, 0, 0);
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={64} height={64} class="title-globe" aria-hidden="true" />;
}

export function TitleScreen({ go, hasSaves }: { go: (s: Screen) => void; hasSaves: boolean }) {
  return (
    <main class="screen title-screen">
      <div class="title-wrap">
        <Globe />
        <div>
          <h1 class="wordmark">EPOCH</h1>
          <p class="subtitle">Civilizations Unbound</p>
        </div>
        <nav class="menu" aria-label="Main menu">
          <button class="primary" onClick={() => go('new')}>New world</button>
          <button onClick={() => go('load')} disabled={!hasSaves}>Load world</button>
          <button onClick={() => go('scenarios')}>Scenario worlds</button>
          <button onClick={() => go('settings')}>Settings</button>
        </nav>
        <p class="footnote">Shape a planet, then watch peoples settle it, invent, trade, worship, quarrel and reach for the stars — on their own.</p>
      </div>
    </main>
  );
}
