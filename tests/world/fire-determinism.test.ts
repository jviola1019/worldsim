/**
 * Regression (round 6): fires set outside ignite() were missing from the cached fire set, so a save
 * made while they burned resumed differently (the reloaded world burned them, the running one did
 * not). Saves must reproduce the future exactly, fires included.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import { nuclearStrike } from '../../src/military/nuclear';
import { ignite } from '../../src/world/environment';
import { POWERS } from '../../src/powers/powers';

const clone = (s: Simulation) => { s.syncRng(); return new Simulation(decodeWorld(encodeWorld(s.w))); };

describe('fires and saves', () => {
  it('a world saved right after a nuclear strike resumes identically', () => {
    const sim = makeSim('fire-nuke', 64, (c) => { c.settings.startEra = 10; });
    sim.runYears(1);
    const s = [...sim.w.settlements.values()].sort((a, b) => b.pop - a.pop)[0];
    nuclearStrike(sim, s);
    const B = clone(sim);
    for (let t = 0; t < 60; t++) { sim.runTicks(1); B.runTicks(1); }
    expect(B.digest()).toBe(sim.digest());
  });

  it('a world saved right after rain put out a fire resumes identically', () => {
    const sim = makeSim('fire-rain', 64, (c) => { c.settings.startEra = 4; });
    sim.runYears(1);
    const m = sim.w.map;
    let x = 20, y = 20;
    for (let i = 0; i < m.n; i++) if (m.isLand(i) && m.veg[i] > 120) { x = m.xOf(i); y = m.yOf(i); break; }
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (m.inBounds(x + dx, y + dy)) ignite(sim, m.idx(x + dx, y + dy), 160);
    POWERS.find((p) => p.id === 'rain')!.apply(sim, x, y, 1, {} as never);
    const B = clone(sim);
    for (let t = 0; t < 30; t++) { sim.runTicks(1); B.runTicks(1); }
    expect(B.digest()).toBe(sim.digest());
  });
});
