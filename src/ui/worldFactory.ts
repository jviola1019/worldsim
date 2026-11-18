/** Create a simulation, generating geography in a Web Worker when available. */
import type { WorldConfig } from '../config/laws';
import { TileMap } from '../world/tilemap';
import { generateWorld, type WorldGenResult } from '../world/worldgen';
import { createSimulation } from '../sim/bootstrap';
import type { Simulation } from '../sim/simulation';

function genInWorker(cfg: WorldConfig): Promise<WorldGenResult> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('../workers/worldgen.worker.ts', import.meta.url), { type: 'module' });
    } catch (e) {
      reject(e);
      return;
    }
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('worker timeout'));
    }, 30000);
    worker.onmessage = (e) => {
      clearTimeout(timer);
      worker.terminate();
      try {
        const { w, h, latSpan, arrays } = e.data;
        const map = new TileMap(w, h);
        for (const f of TileMap.FIELDS) (map as any)[f] = arrays[f];
        resolve({ map, latSpan });
      } catch (err) {
        reject(err); // never leave world creation hanging (the caller falls back to the main thread)
      }
    };
    worker.onmessageerror = () => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error('worker message could not be read'));
    };
    worker.onerror = (err) => {
      clearTimeout(timer);
      worker.terminate();
      reject(err);
    };
    worker.postMessage(cfg.gen);
  });
}

export async function createWorldAsync(cfg: WorldConfig): Promise<Simulation> {
  let gen: WorldGenResult;
  try {
    gen = await genInWorker(cfg);
  } catch {
    gen = generateWorld(cfg.gen); // fallback: main thread
  }
  return createSimulation(cfg, gen);
}
