import { MODES, configFor } from '../../../../scripts/mode-audit';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { forageCapacity } from '../../../../src/economy/production';
import { TERRAIN } from '../../../../src/world/terrain';
const k = Number(process.argv[2] ?? 0);
const years = Number(process.argv[3] ?? 250);
const spec = MODES.find((m) => m.key === 'realistic')!;
const sim = createSimulation(configFor('realistic', `audit-realistic-${k}`));
spec.setup!(sim);
const m = sim.w.map;
const show = () => {
  const L = sim.w.popLedger as Record<string, number> | undefined;
  const bands = [...sim.w.bands.values()];
  const parts = bands.map((b) => { const i = m.idx(Math.floor(b.x), Math.floor(b.y)); const ages = b.members.map((id) => sim.year - (sim.w.persons.get(id)?.born ?? 0)); const fem = b.members.filter((id) => sim.w.persons.get(id)?.female).length; return `b${b.id}c${b.civId}[${b.members.length} f${fem} ages ${Math.min(...ages)}-${Math.max(...ages)} food ${b.food.toFixed(1)} @${b.x.toFixed(0)},${b.y.toFixed(0)} ${TERRAIN[m.terrain[i]].name ?? m.terrain[i]} cap ${forageCapacity(sim, b.x, b.y, 4).toFixed(0)} fresh ${m.hasFreshWater(i) ? 1 : 0}]`; });
  console.log(`y${sim.year} bands ${bands.length} settl ${sim.w.settlements.size} civs ${[...sim.w.civs.values()].filter((c) => c.alive).length} ledger ${L ? JSON.stringify(Object.fromEntries(Object.entries(L).map(([a, v]) => [a, Math.round(v)]))) : '-'} ${parts.join(' ')}`);
};
show();
for (let y = 1; y <= years; y++) {
  sim.runYears(1);
  if (y <= 30 || y % 10 === 0 || sim.w.bands.size === 0) show();
  if (sim.w.bands.size === 0 && sim.w.settlements.size === 0) { console.log('all gone at', sim.year); break; }
  if (sim.w.settlements.size > 0) { console.log('settled at', sim.year); break; }
}
for (const e of sim.w.events.slice(-30)) console.log(`  ev y${e.year ?? ''} t${e.tick} ${e.type}: ${e.title}`);
