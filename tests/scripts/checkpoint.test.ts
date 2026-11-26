// Round 10 addendum: long scripts checkpoint every 100 years so a container restart cannot lose a run.
import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeSim } from '../helpers';
import { saveCheckpoint, loadCheckpoint, checkpointPath } from '../../scripts/lib/checkpoint';

describe('checkpoint', () => {
  it('resumes the identical history', () => {
    const a = makeSim('ck-1', 64);
    a.runYears(30);
    const b = makeSim('ck-1', 64);
    b.runYears(15);
    const path = join(mkdtempSync(join(tmpdir(), 'ck-')), 'world.bin');
    saveCheckpoint(path, b, { lines: ['x'], n: 3 });
    const back = loadCheckpoint<{ lines: string[]; n: number }>(path);
    expect(back).not.toBeNull();
    expect(back!.extra).toEqual({ lines: ['x'], n: 3 });
    back!.sim.runYears(15);
    expect(back!.sim.digest()).toBe(a.digest());
  });

  it('returns null when there is no checkpoint', () => {
    expect(loadCheckpoint(join(tmpdir(), 'no-such-checkpoint.bin'))).toBeNull();
  });

  it('names a checkpoint from the kind and its parts, and the run length is one of them', () => {
    expect(checkpointPath('/d', 'pace', ['pace-a', 'slow', '1600y'])).toBe('/d/pace-pace-a-slow-1600y.bin');
    expect(checkpointPath('/d', 'pace', ['pace-a', 'slow', '1600y'])).not.toBe(checkpointPath('/d', 'pace', ['pace-a', 'slow', '1200y']));
  });

  it('a 200-year checkpoint is not loaded by a 300-year run of the same script', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ck-'));
    const sim = makeSim('ck-2', 64);
    sim.runYears(5);
    saveCheckpoint(checkpointPath(dir, 'events', ['events-1', 96, 10, '200y']), sim, { y: 100 });
    expect(loadCheckpoint(checkpointPath(dir, 'events', ['events-1', 96, 10, '200y']))).not.toBeNull();
    expect(loadCheckpoint(checkpointPath(dir, 'events', ['events-1', 96, 10, '300y']))).toBeNull();
  });
});
