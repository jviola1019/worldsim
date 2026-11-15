/**
 * Headless simulation throughput: ms per simulated year at checkpoints.
 *   npx tsx benchmarks/sim-bench.ts [size=128] [years=800]
 */
import { defaultConfig } from '../src/config/laws';
import { createSimulation } from '../src/sim/bootstrap';

const SIZE = Number(process.argv[2] ?? 128);
const YEARS = Number(process.argv[3] ?? 800);
const cfg = defaultConfig();
cfg.gen.seed = 'bench';
cfg.gen.width = SIZE;
cfg.gen.height = SIZE;
const g0 = performance.now();
const sim = createSimulation(cfg);
console.log(`map ${SIZE}x${SIZE}: worldgen+bootstrap ${(performance.now() - g0).toFixed(0)} ms`);
const STEP = 100;
for (let y = 0; y < YEARS; y += STEP) {
  const t0 = performance.now();
  sim.runYears(STEP);
  const ms = (performance.now() - t0) / STEP;
  let pop = 0;
  for (const s of sim.w.settlements.values()) pop += s.pop;
  const era = Math.max(0, ...[...sim.w.civs.values()].filter((c) => c.alive).map((c) => c.era));
  const mem = process.memoryUsage().heapUsed / 1e6;
  console.log(`years ${String(y).padStart(4)}-${y + STEP}: ${ms.toFixed(1)} ms/year (${(ms / 120).toFixed(2)} ms/tick) · pop ${Math.round(pop)} · era ${era} · settlements ${sim.w.settlements.size} · heap ${mem.toFixed(0)} MB`);
}
