/**
 * Photo album layout records: exact, per-save, bounded, saved, and validated on load.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { encodeWorld, decodeWorld, SaveError } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import { snapshotCity, albumCities, albumYearly, unb64 } from '../../src/history/album';
import { B } from '../../src/civilizations/buildingTypes';

const clone = (s: Simulation) => { s.syncRng(); return new Simulation(decodeWorld(encodeWorld(s.w))); };

describe('photo album', () => {
  const sim = makeSim('album-1', 96, (c) => { c.settings.startEra = 8; });
  sim.runYears(51);

  it('records the main cities of every nation in year 50', () => {
    const at50 = (sim.w.album ?? []).filter((a) => a.year === 50);
    const civs = [...sim.w.civs.values()].filter((c) => c.alive && c.settlements.length);
    expect(at50.length).toBeGreaterThanOrEqual(civs.length);
    for (const a of at50) expect(a.n).toBeGreaterThan(2);
  });

  it('a record knows where every building stands: change one tile, only its column changes', () => {
    const civ = [...sim.w.civs.values()].find((c) => c.alive && c.settlements.length)!;
    const s = albumCities(sim, civ)[0];
    const before = unb64(snapshotCity(sim, civ, s).cols);
    const m = sim.w.map;
    // put a tower on the southern-most tile of the city's own land in a column east of the centre
    let tile = -1;
    for (let dy = Math.ceil(s.radius); dy >= -Math.ceil(s.radius) && tile < 0; dy--) {
      const i = m.idx(s.x + 1, s.y + dy);
      if (m.settle[i] === s.id && m.isLand(i)) tile = i;
    }
    expect(tile).toBeGreaterThanOrEqual(0);
    m.bld[tile] = B.TOWER;
    m.bldFlags[tile] = 7;
    const after = unb64(snapshotCity(sim, civ, s).cols);
    const r = Math.ceil(s.radius) + 1;
    const col = 1 + r; // dx = +1
    expect(after[col * 5]).toBe(B.TOWER); // tallest building of that column
    for (let k = 0; k < after.length / 5; k++) if (k !== col) expect(Array.from(after.slice(k * 5, k * 5 + 5))).toEqual(Array.from(before.slice(k * 5, k * 5 + 5)));
  });

  it('survives a save exactly and differs between worlds', () => {
    const B2 = clone(sim);
    expect(B2.w.album).toEqual(sim.w.album);
    const other = makeSim('album-2', 96, (c) => { c.settings.startEra = 8; });
    other.runYears(51);
    expect(other.w.album!.map((a) => a.cols).join()).not.toBe(sim.w.album!.map((a) => a.cols).join());
  });

  it('stays bounded over a long game (oldest records thinned)', () => {
    const A = clone(sim);
    for (let k = 0; k < 400; k++) A.w.album!.push({ ...A.w.album![0], year: 100 + k });
    (A as any).w.tick = 100 * 120; // year 100
    albumYearly(A);
    expect(A.w.album!.length).toBeLessThanOrEqual(600);
  });

  it('the loader rejects malformed or oversized album data', () => {
    const bad = clone(sim);
    bad.w.album![0].cols = 'A'.repeat(10000);
    const w = decodeWorld(encodeWorld(bad.w));
    expect(w.album).toBeUndefined(); // dropped rather than trusted
    const bad2 = clone(sim);
    (bad2.w.album![0] as any).color = 'javascript:alert(1)';
    expect(decodeWorld(encodeWorld(bad2.w)).album).toBeUndefined();
    expect(SaveError).toBeTruthy();
  });
});
