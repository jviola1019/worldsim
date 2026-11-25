/**
 * Round 10 addendum: resumable long runs. A cloud container can restart mid-run and kill a background
 * script (two pace calibrations stopped near year 500 this way), so long scripts save the world and their
 * own accumulators every 100 years and resume from there.
 *
 * The world goes through the game's own save format (`encodeWorld`/`decodeWorld`), so a checkpoint is
 * validated like any save and resumes the identical history: the RNG state is part of the world.
 * Checkpoints are local working files (`.superpowers/`, git-ignored), never shipped.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';

export function saveCheckpoint(path: string, sim: Simulation, extra: unknown): void {
  sim.syncRng(); // the live RNG state lives on the Simulation; copy it into the world before encoding
  // write both files first, then rename: an interrupted save never leaves a half-written checkpoint
  writeFileSync(path + '.tmp', encodeWorld(sim.w));
  writeFileSync(path + '.json.tmp', JSON.stringify(extra));
  renameSync(path + '.tmp', path);
  renameSync(path + '.json.tmp', path + '.json');
}

export function loadCheckpoint<T>(path: string): { sim: Simulation; extra: T } | null {
  if (!existsSync(path) || !existsSync(path + '.json')) return null;
  const w = decodeWorld(new Uint8Array(readFileSync(path)));
  return { sim: new Simulation(w), extra: JSON.parse(readFileSync(path + '.json', 'utf8')) as T };
}
