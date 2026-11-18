/**
 * VISITOR ACCORDS (yearly): friendly nations at peace that both have a harbour (and later an
 * airport) open their borders to each other's travellers: pilgrims and merchants by sea in the age
 * of sail, tourists by air in the jet age. An accord brings visitor spending (treasury) and warmer
 * relations every year it lasts; war ends it. Signed with the simulation's random stream; the
 * treaties are ordinary saved treaties.
 */
import type { Sim } from '../sim/context';
import type { Civ } from '../sim/types';
import { B } from '../civilizations/buildingTypes';
import { makeTreaty, hasTreaty, atWarWith } from '../politics/diplomacy';
import { ensureRelation } from '../civilizations/knowledge';

function ports(sim: Sim, civ: Civ): { harbor: number; airport: number } {
  let harbor = 0, airport = 0;
  for (const id of civ.settlements) { const s = sim.w.settlements.get(id); if (s) { harbor += s.bld[B.HARBOR]; airport += s.bld[B.AIRPORT]; } }
  return { harbor, airport };
}

/** A gateway for travellers: harbours from the age of sail, airports once flight exists. */
export function hasGateway(sim: Sim, civ: Civ): boolean {
  const p = ports(sim, civ);
  return p.airport > 0 || (p.harbor > 0 && civ.era >= 5);
}

export function visitorsYearly(sim: Sim): void {
  const w = sim.w;
  const civs = [...w.civs.values()].filter((c) => c.alive && c.settlements.length && c.era >= 5);
  const gate = new Map(civs.map((c) => [c.id, hasGateway(sim, c)]));
  for (const t of w.treaties.values()) {
    if (!t.active || t.kind !== 'visitors') continue;
    const a = w.civs.get(t.a), b = w.civs.get(t.b);
    if (!a?.alive || !b?.alive || atWarWith(sim, t.a, t.b) || t.end <= sim.year) { t.active = false; continue; }
    // visitors spend money and come home with friendlier views
    const air = ports(sim, a).airport > 0 && ports(sim, b).airport > 0 ? 2 : 1;
    a.treasury += Math.max(0, b.econ.gdp) * 0.001 * air;
    b.treasury += Math.max(0, a.econ.gdp) * 0.001 * air;
    const r = ensureRelation(sim, t.a, t.b);
    r.opinion = Math.min(100, r.opinion + 1);
  }
  for (const a of civs) {
    if (!gate.get(a.id)) continue;
    for (const id of a.knownCivs) {
      if (id <= a.id || !gate.get(id)) continue;
      const b = w.civs.get(id)!;
      if (!b?.alive || hasTreaty(sim, a.id, id, 'visitors') || atWarWith(sim, a.id, id)) continue;
      const r = ensureRelation(sim, a.id, id);
      if (r.opinion < 0 || r.rival || a.policies.migration === 'closed' || b.policies.migration === 'closed') continue;
      // friendlier pairs open up sooner; merchant peoples court travellers
      const p = (0.03 + r.opinion / 400) * (a.ethos?.key === 'mercantile' || b.ethos?.key === 'mercantile' ? 1.8 : 1);
      if (sim.rng.chance(p)) makeTreaty(sim, a, b, 'visitors', 25);
    }
  }
}
