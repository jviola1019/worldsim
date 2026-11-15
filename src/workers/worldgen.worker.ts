/// <reference lib="webworker" />
/** Generates the world geography off the main thread so the UI stays responsive. */
import { generateWorld, type WorldGenParams } from '../world/worldgen';
import { TileMap } from '../world/tilemap';

self.onmessage = (e: MessageEvent<WorldGenParams>) => {
  const { map, latSpan } = generateWorld(e.data);
  const arrays: Record<string, ArrayBufferView> = {};
  const transfer: ArrayBuffer[] = [];
  for (const f of TileMap.FIELDS) {
    const a = map[f] as unknown as ArrayBufferView;
    arrays[f] = a;
    transfer.push(a.buffer as ArrayBuffer);
  }
  (self as unknown as Worker).postMessage({ w: map.w, h: map.h, latSpan, arrays }, transfer);
};
