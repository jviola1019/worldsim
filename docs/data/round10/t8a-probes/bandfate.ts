// Realistic: fate of the hand-placed band (mode-audit dropLife) over many seeds
import { MODES, configFor } from '../../../../scripts/mode-audit';
import { createSimulation } from '../../../../src/sim/bootstrap';
const from = Number(process.argv[2] ?? 0), to = Number(process.argv[3] ?? 24), YEARS = Number(process.argv[4] ?? 120);
const spec = MODES.find((m) => m.key === 'realistic')!;
for (let k = from; k < to; k++) {
  const sim = createSimulation(configFor('realistic', `audit-realistic-${k}`));
  spec.setup!(sim);
  const b = [...sim.w.bands.values()][0];
  if (!b) { console.log(`k${k}: no band placed`); continue; }
  const ps = b.members.map((id) => sim.w.persons.get(id)!);
  const fem = ps.filter((p) => p.female).length, fAdult = ps.filter((p) => p.female && sim.year - p.born >= 15 && sim.year - p.born < 45).length;
  const pairs = ps.filter((p) => p.female && p.spouseId).length;
  let settled = -1, extinct = -1;
  for (let y = 1; y <= YEARS; y++) {
    sim.runYears(1);
    if (settled < 0 && sim.w.settlements.size > 0) settled = sim.year;
    if (sim.w.bands.size === 0 && sim.w.settlements.size === 0) { extinct = sim.year; break; }
    if (settled > 0) break;
  }
  const L = sim.w.popLedger as Record<string, number>;
  console.log(`k${k}: size ${ps.length} women ${fem} (15-44: ${fAdult}, partnered ${pairs}) -> ${extinct > 0 ? `EXTINCT y${extinct}` : settled > 0 ? `settled y${settled}` : `alive, not settled by y${YEARS} (${[...sim.w.bands.values()].reduce((a, x) => a + x.members.length, 0)} people)`} births ${L.births} deaths ${L.deaths} famine ${L.famine}`);
}
