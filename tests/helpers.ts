import { defaultConfig } from '../src/config/laws';
import { createSimulation } from '../src/sim/bootstrap';

export function makeSim(seed = 'test', size = 64, mutate?: (c: ReturnType<typeof defaultConfig>) => void) {
  const cfg = defaultConfig();
  cfg.name = 'Test';
  cfg.gen.seed = seed;
  cfg.gen.width = size;
  cfg.gen.height = size;
  mutate?.(cfg);
  return createSimulation(cfg);
}
