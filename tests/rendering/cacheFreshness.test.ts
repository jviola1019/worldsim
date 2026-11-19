/**
 * Round 7 ("recall cache for concepts"): every concept that changes something the cached map draws
 * must mark that place for redraw. A tile whose drawn look changed must lie in a dirty chunk, and so
 * must its 8 neighbours (road joins, shorelines and relief shading read the tile next door).
 *
 * Checked for every god power and for long simulations across eras (war, disasters, growth, roads).
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { POWERS, applyPower, endStroke } from '../../src/powers/powers';
import { CHUNK, vegLook, pollutionLook, type Sim } from '../../src/sim/context';
import { DX8, DY8 } from '../../src/core/math';

/**
 * What the chunk cache draws for one tile (terrainLayer, cityBlocks): exact fields, and the
 * thresholds of fields drawn only past a limit (trees above veg 70, smog above pollution 40, snow below 2 °C).
 */
function drawn(sim: Sim): Float64Array[] {
  const m = sim.w.map;
  const built = (i: number) => (m.bld[i] ? 1 : 0);
  return [
    Float64Array.from(m.terrain), Float64Array.from(m.elev), Float64Array.from(m.river, (v) => (v > 0 ? 1 : 0)), Float64Array.from(m.flow),
    Float64Array.from(m.infra), Float64Array.from(m.bld), Float64Array.from(m.bldFlags), Float64Array.from(m.hazard),
    Float64Array.from(m.owner, (v, i) => v * built(i)), Float64Array.from(m.settle, (v, i) => v * built(i)),
    Float64Array.from(m.veg, vegLook),
    Float64Array.from(m.pollution, pollutionLook),
    Float64Array.from(m.temp, (v) => (v < -2 ? 2 : v < 2 ? 1 : 0)),
  ];
}
const FIELDS = ['terrain', 'elev', 'river', 'flow', 'infra', 'bld', 'bldFlags', 'hazard', 'owner', 'settle', 'veg', 'pollution', 'temp<2'];

/** Tiles whose drawn look changed but whose chunk (or a neighbour's chunk) was not marked. */
function stale(sim: Sim, before: Float64Array[]): { field: string; i: number }[] {
  const m = sim.w.map;
  const after = drawn(sim);
  const out: { field: string; i: number }[] = [];
  const dirty = (x: number, y: number) => sim.chunkDirty[((y / CHUNK) | 0) * sim.chunksX + ((x / CHUNK) | 0)] === 1;
  for (let f = 0; f < before.length; f++)
    for (let i = 0; i < m.n; i++) {
      if (before[f][i] === after[f][i]) continue;
      const x = m.xOf(i), y = m.yOf(i);
      let ok = dirty(x, y);
      for (let d = 0; ok && d < 8; d++) if (m.inBounds(x + DX8[d], y + DY8[d]) && !dirty(x + DX8[d], y + DY8[d])) ok = false;
      if (!ok) out.push({ field: FIELDS[f], i });
    }
  return out;
}

const summary = (s: { field: string; i: number }[]) => [...new Set(s.map((e) => e.field))].map((f) => `${f}: ${s.filter((e) => e.field === f).length}`).join(', ');

describe('render caches follow every god power', () => {
  it('each of the 108 powers marks every tile it changes for redraw', () => {
    const sim = makeSim('fresh-powers', 64, (c) => { c.settings.startEra = 6; c.laws.speculativeTech = true; c.laws.horrors = true; });
    sim.runYears(3);
    const failures: string[] = [];
    for (const p of POWERS) {
      const s = [...sim.w.settlements.values()].sort((a, b) => b.pop - a.pop)[0];
      const [x, y] = s ? [s.x, s.y] : [32, 32];
      const before = drawn(sim);
      sim.chunkDirty.fill(0);
      applyPower(sim, p.id, x, y, 3, { selectedCiv: s?.civId ?? 0 });
      endStroke(sim, p.id); // terrain strokes rebuild rivers when the stroke ends
      const bad = stale(sim, before);
      if (bad.length) failures.push(`${p.id} (${summary(bad)})`);
    }
    if (failures.length) throw new Error(failures.join(" | "));
  }, 180000);
});

describe('render caches follow the simulation', () => {
  for (const era of [1, 4, 6]) {
    it(`30 years from era ${era}: every yearly change to a drawn field is marked`, () => {
      const sim = makeSim(`fresh-run-${era}`, 64, (c) => { c.settings.startEra = era; });
      const failures: string[] = [];
      for (let yr = 0; yr < 30; yr++) {
        const before = drawn(sim);
        sim.chunkDirty.fill(0);
        sim.runYears(1);
        const bad = stale(sim, before);
        if (bad.length) failures.push(`year ${yr}: ${summary(bad)}`);
      }
      if (failures.length) throw new Error(failures.join(" | "));
    }, 300000);
  }
});
