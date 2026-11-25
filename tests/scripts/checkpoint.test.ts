// Round 10 addendum: long scripts checkpoint every 100 years so a container restart cannot lose a run.
import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeSim } from '../helpers';
import { saveCheckpoint, loadCheckpoint } from '../../scripts/lib/checkpoint';

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
});
