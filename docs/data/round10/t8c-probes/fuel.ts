/**
 * Task 8 Part C: the fuel-order test's preconditions per world (tests/economy/fuelOrder.test.ts). For each seed: the
 * first nation without electricity is given electric power; 13 years on, over 12 months, does it own fossil plants,
 * mine coal, and make energy?
 *
 *   npx tsx docs/data/round10/t8c-probes/fuel.ts [seeds=8]
 */
import { makeSim } from '../../../../tests/helpers';
import { Good } from '../../../../src/world/resources';
import { TECH_BY_ID } from '../../../../src/technology/techData';
import { grantTech } from '../../../../src/technology/research';
import { BUILDINGS } from '../../../../src/civilizations/buildings';
const seeds = Number(process.argv[2] ?? 8);
for (let k = 0; k < seeds; k++) {
  const seed = k ? `int-elec-${k}` : 'int-elec';
  const base = makeSim(seed, 96, (c) => { c.settings.startEra = 7; });
  base.runYears(2);
  const civ = [...base.w.civs.values()].find((c) => c.alive && c.settlements.length && c.caps.electrification === 0 && !c.techs.electric_power?.known);
  if (!civ) { console.log(`${seed}: no nation without electricity`); continue; }
  const need = (t: string): void => { for (const p of TECH_BY_ID.get(t)!.prereqs) need(p); if (!civ.techs[t]?.known) grantTech(base, civ, t, 'god'); };
  need('electric_power');
  base.runYears(13);
  let plants = 0, coal = 0, energy = 0;
  for (let mo = 0; mo < 12; mo++) { base.runTicks(10); coal += civ.acc.prod[Good.COAL] ?? 0; energy += civ.acc.prod[Good.ENERGY] ?? 0; }
  for (const sid of civ.settlements) plants += base.w.settlements.get(sid)?.bld[BUILDINGS.findIndex((b) => b?.key === 'POWER_FOSSIL')] ?? 0;
  console.log(`${seed}: ${civ.name} fossil plants ${plants} · coal mined a year ${coal.toFixed(0)} · energy a year ${energy.toFixed(0)} · alive ${civ.alive}`);
}
