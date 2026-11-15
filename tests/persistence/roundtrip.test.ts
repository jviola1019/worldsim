import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { packWorld, unpackWorld, encodeWorld, decodeWorld, SaveError } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';

describe('save round trip', () => {
  it.each([
    ['primitive 96²', 'rt-a', 96, 0, 120],
    ['industrial start', 'rt-b', 96, 9, 30],
  ])('%s: save/load does not alter the future', async (_l, seed, size, era, years) => {
    const a = makeSim(seed as string, size as number, (c) => { c.settings.startEra = era as number; });
    a.runYears(years as number);
    a.runTicks(53);
    a.syncRng();
    const b = new Simulation(await unpackWorld(await packWorld(a.w)));
    for (let k = 0; k < 40; k++) {
      a.runTicks(120);
      b.runTicks(120);
      expect(b.digest(), `year ${a.year}`).toBe(a.digest());
    }
  }, 240000);

  it('restored world has the same digest and the same future', async () => {
    const a = makeSim('save-1');
    a.runYears(40);
    a.runTicks(37); // mid-year, mid-month save
    a.syncRng();
    const bytes = await packWorld(a.w);
    const b = new Simulation(await unpackWorld(bytes));
    expect(b.digest()).toBe(a.digest());
    a.runYears(25);
    b.runYears(25);
    expect(b.digest()).toBe(a.digest());
  }, 90000);

  it('raw encode/decode preserves persons with development data', () => {
    const a = makeSim('save-2');
    a.runYears(30);
    const w2 = decodeWorld(encodeWorld(a.w));
    const p1 = [...a.w.persons.values()].find((p) => p.deeds?.length);
    if (p1) expect(w2.persons.get(p1.id)?.deeds).toEqual(p1.deeds);
    expect(w2.persons.size).toBe(a.w.persons.size);
  }, 60000);

  it('detects corruption', async () => {
    const a = makeSim('save-3');
    a.syncRng();
    const bytes = await packWorld(a.w);
    bytes[bytes.length - 20] ^= 0xff;
    await expect(unpackWorld(bytes)).rejects.toBeInstanceOf(Error);
    void SaveError;
  });
});
