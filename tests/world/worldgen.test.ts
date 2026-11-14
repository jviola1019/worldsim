import { describe, expect, it } from 'vitest';
import { generateWorld, DEFAULT_GEN, type WorldGenParams } from '../../src/world/worldgen';
import { T } from '../../src/world/terrain';
import { Deposit } from '../../src/world/resources';
import { DX8, DY8 } from '../../src/core/math';

const P = (o: Partial<WorldGenParams> = {}): WorldGenParams => ({ ...DEFAULT_GEN, width: 96, height: 96, seed: 't1', ...o });

describe('worldgen', () => {
  it('is deterministic for a given seed', () => {
    const a = generateWorld(P()).map;
    const b = generateWorld(P()).map;
    expect(Array.from(a.elev)).toEqual(Array.from(b.elev));
    expect(Array.from(a.terrain)).toEqual(Array.from(b.terrain));
    expect(Array.from(a.river)).toEqual(Array.from(b.river));
    expect(Array.from(a.dep)).toEqual(Array.from(b.dep));
  });

  it('different seeds give different worlds', () => {
    const a = generateWorld(P({ seed: 'x1' })).map;
    const b = generateWorld(P({ seed: 'x2' })).map;
    let diff = 0;
    for (let i = 0; i < a.n; i++) if (a.terrain[i] !== b.terrain[i]) diff++;
    expect(diff).toBeGreaterThan(a.n * 0.2);
  });

  it.each([0.4, 0.6, 0.8])('approximates ocean coverage %f', (oc) => {
    const m = generateWorld(P({ oceanCoverage: oc, seed: 'oc' + oc })).map;
    let water = 0;
    for (let i = 0; i < m.n; i++) if (m.elev[i] <= 0) water++;
    expect(Math.abs(water / m.n - oc)).toBeLessThan(0.06);
  });

  it('rivers flow downhill to water (lake or sea)', () => {
    const m = generateWorld(P({ rivers: 0.9, seed: 'rv' })).map;
    let rivers = 0;
    for (let i = 0; i < m.n; i++) {
      if (m.river[i] === 0) continue;
      rivers++;
      let cur = i;
      let steps = 0;
      while (m.isLand(cur) && steps < m.n) {
        const d = m.flow[cur];
        expect(d).toBeGreaterThanOrEqual(0);
        cur = (m.yOf(cur) + DY8[d]) * m.w + m.xOf(cur) + DX8[d];
        steps++;
      }
      expect(m.isWater(cur)).toBe(true);
    }
    expect(rivers).toBeGreaterThan(10);
  });

  it('places deposits according to geology', () => {
    const m = generateWorld(P({ resources: 2, seed: 'geo', width: 128, height: 128 })).map;
    for (let i = 0; i < m.n; i++) {
      const d = m.dep[i];
      if (!d) continue;
      if (d === Deposit.FISH) expect(m.terrain[i] === T.SHALLOW || m.terrain[i] === T.LAKE).toBe(true);
      else expect(m.isLand(i)).toBe(true);
      if (d === Deposit.SPICES) expect(m.temp[i]).toBeGreaterThanOrEqual(19);
      expect(m.depAmt[i]).toBeGreaterThan(0);
    }
  });

  it('handles extreme settings', () => {
    for (const [w, oc] of [[128, 0.2], [128, 0.9], [200, 0.5]] as const) {
      for (const landmass of ['continents', 'pangaea', 'archipelago', 'islands'] as const) {
        const m = generateWorld(P({ width: w, height: w, oceanCoverage: oc, landmass, mountains: 1, rivers: 0, seed: `ex${w}${oc}${landmass}` })).map;
        let land = 0;
        for (let i = 0; i < m.n; i++) if (m.isLand(i)) land++;
        expect(land).toBeGreaterThan(0);
      }
    }
  });
});
