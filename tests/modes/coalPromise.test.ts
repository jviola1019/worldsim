/**
 * Task 8c: the mode audit's "coal-rich nations industrialise first" check measured the wrong thing.
 * 1. It ranked ties by array order: in an Industrializing world nearly every nation is in era 7 at the horizon, so
 *    the sign of the correlation was set by the nations' order, not by coal.
 * 2. It kept only nations with at least one coal tile (`snapshot().coal` has no entry for the others), so the
 *    coal-poor, the comparison the promise is about, were never compared.
 * 3. It used the era label, which every nation holds from the start (era-7 start) and which 10 of the 14 era-7
 *    techs can earn without coal. The counterfactual probe (docs/data/round10/t8b-probes/coal-probe.ts) shows coal's
 *    real effect is on industrial adoption: removing all coal lowers mean era-7/8 adoption in 6 of 6 worlds.
 */
import { describe, it, expect } from 'vitest';
import { MODES, spearman, type Snapshot } from '../../scripts/mode-audit';
import { TECHS } from '../../src/technology/techData';
import type { Simulation } from '../../src/sim/simulation';

const coal = MODES.find((m) => m.key === 'industrial')!.promises.find((p) => p.id === 'coal')!;

/** A stand-in world: nations with the given coal tiles and share of era-7/8 techs adopted, all in era 7. */
function world(rows: { coal: number; adopted: number }[]) {
  const ind = TECHS.filter((t) => t.era === 7 || t.era === 8);
  const civs = new Map(rows.map((r, k) => {
    const techs: Record<string, { known: boolean; adoption: number; progress: number; year: number }> = {};
    ind.forEach((t, j) => { if (j < Math.round(r.adopted * ind.length)) techs[t.id] = { known: true, adoption: 1, progress: 0, year: 0 }; });
    return [k + 1, { id: k + 1, alive: true, era: 7, techs }];
  }));
  const st = { coal: new Map(rows.map((r, k) => [k + 1, r.coal] as [number, number]).filter(([, c]) => c > 0)), known: new Map(rows.map((_, k) => [k + 1, new Set<string>()])) } as unknown as Snapshot;
  return { sim: { w: { civs } } as unknown as Simulation, st };
}

describe('the coal promise measures industrialisation (Task 8c)', () => {
  it('ties get average ranks: a measure with no spread has no correlation', () => {
    expect(spearman([1, 2, 3, 4], [7, 7, 7, 7])).toBe(0); // was 1: tied eras ranked by array order
    expect(spearman([4, 3, 2, 1], [7, 7, 7, 7])).toBe(0); // was -1
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([0, 0, 5, 9], [1, 2, 3, 4])).toBeCloseTo(0.949, 3); // ranks 0.5,0.5,2,3 against 0,1,2,3
  });

  it('nations without coal are compared too, by how far they have industrialised', () => {
    // all in era 7; the coal-rich have adopted more of the industrial techs
    const rich = world([{ coal: 0, adopted: 0.3 }, { coal: 0, adopted: 0.35 }, { coal: 5, adopted: 0.5 }, { coal: 9, adopted: 0.6 }]);
    expect(coal.check(rich.sim, rich.st)).toBe(true);
    // the coal-rich lag behind
    const poor = world([{ coal: 0, adopted: 0.6 }, { coal: 0, adopted: 0.5 }, { coal: 5, adopted: 0.35 }, { coal: 9, adopted: 0.3 }]);
    expect(coal.check(poor.sim, poor.st)).toBe(false);
  });
});
