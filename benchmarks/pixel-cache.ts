/**
 * Round 7: what WorldBox-style zone caching saves. Measures, in Node (CPU time of the pixel work only,
 * not browser frame time), a full overview and overlay rebuild against repainting only the chunks a
 * real simulated month dirtied (one refresh pass).
 *
 *   npx tsx benchmarks/pixel-cache.ts [size=256] [years=20]
 */
import { defaultConfig } from '../src/config/laws';
import { TICKS_PER_MONTH } from '../src/core/time';
import { createSimulation } from '../src/sim/bootstrap';
import { paintOverview, paintOverlay, chunkRect, OVERVIEW_GROW, OVERLAY_GROW, OVERLAY_SCALE } from '../src/rendering/pixelCache';

const size = Number(process.argv[2] ?? 256);
const years = Number(process.argv[3] ?? 20);
const cfg = defaultConfig();
cfg.gen.seed = 'pixel-bench';
cfg.gen.width = size;
cfg.gen.height = size;
cfg.settings.startEra = 6;
const sim = createSimulation(cfg);
sim.runYears(3);
const m = sim.w.map;
const ov = new Uint8ClampedArray(m.n * 4);
const ol = new Uint8ClampedArray(m.n * OVERLAY_SCALE * OVERLAY_SCALE * 4);
const color = (i: number) => (m.owner[i] ? ([(m.owner[i] * 47) % 255, 90, 140, 85] as const) : null);
const all = { x0: 0, y0: 0, x1: m.w, y1: m.h };

const time = (f: () => void, reps = 5) => {
  f();
  const t0 = performance.now();
  for (let k = 0; k < reps; k++) f();
  return (performance.now() - t0) / reps;
};

const fullOv = time(() => paintOverview(m, ov, all));
const fullOl = time(() => paintOverlay(m, ol, all, color, true));
// one refresh pass per simulated month (the overlay refreshes every 0.4 s; at normal speed that is about a month)
let dirtyTiles = 0, dirtyOverlay = 0, incOv = 0, incOl = 0;
const passes = years * 12;
for (let y = 0; y < passes; y++) {
  sim.chunkDirty.fill(0);
  sim.overlayDirty.fill(0);
  sim.runTicks(TICKS_PER_MONTH);
  const tk: number[] = [], ok: number[] = [];
  for (let k = 0; k < sim.chunkDirty.length; k++) {
    if (sim.chunkDirty[k]) tk.push(k);
    if (sim.overlayDirty[k] || sim.chunkDirty[k]) ok.push(k);
  }
  dirtyTiles += tk.length;
  dirtyOverlay += ok.length;
  incOv += time(() => { for (const k of tk) paintOverview(m, ov, chunkRect(m, k, OVERVIEW_GROW)); }, 3);
  incOl += time(() => { for (const k of ok) paintOverlay(m, ol, chunkRect(m, k, OVERLAY_GROW), color, true); }, 3);
}
const chunks = sim.chunkDirty.length;
console.log(`map ${size}² (${chunks} chunks), ${years} simulated years from the Renaissance, Node ${process.version}`);
console.log(`dirty chunks per month: map ${(dirtyTiles / passes).toFixed(1)} (${((dirtyTiles / passes / chunks) * 100).toFixed(1)}%), overlay ${(dirtyOverlay / passes).toFixed(1)}`);
console.log(`overview: full rebuild ${fullOv.toFixed(2)} ms per pass; dirty chunks only ${(incOv / passes).toFixed(3)} ms per pass`);
console.log(`overlay:  full rebuild ${fullOl.toFixed(2)} ms per pass; dirty chunks only ${(incOl / passes).toFixed(3)} ms per pass`);
