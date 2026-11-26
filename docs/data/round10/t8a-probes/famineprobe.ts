import { defaultConfig, presetByKey, eraPeopleDefault } from '../../../../src/config/laws';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { TICKS_PER_YEAR } from '../../../../src/core/time';
import { Good } from '../../../../src/world/resources';
import { B } from '../../../../src/civilizations/buildingTypes';
import { BALANCE } from '../../../../src/config/balance';
const k = Number(process.argv[2] ?? 0), YEARS = Number(process.argv[3] ?? 60), SIZE = Number(process.argv[4] ?? 96), start = process.argv[5] ?? 'observer', ERA = Number(process.argv[6] ?? 10);
const c = defaultConfig(); presetByKey(start)!.apply(c); c.gen.seed = `disease-${k}`; c.gen.width = SIZE; c.gen.height = SIZE;
c.settings.startEra = ERA; c.settings.startCivs = eraPeopleDefault(start as 'observer', ERA);
import { loadCheckpoint } from '../../../../scripts/lib/checkpoint';
const sim = process.env.LOAD ? loadCheckpoint<unknown>(process.env.LOAD)!.sim : createSimulation(c);
console.log('climate anomaly', sim.w.climate.anomaly.toFixed(2), 'year', sim.year);
const tot = new Map<number, { famine: number; births: number; deaths: number; emig: number; years: number[] }>();
let wf = 0;
for (let y = 1; y <= YEARS; y++) {
  sim.runTicks(TICKS_PER_YEAR - 1);
  let yf = 0; const rows: string[] = [];
  for (const s of sim.w.settlements.values()) {
    const t = tot.get(s.id) ?? { famine: 0, births: 0, deaths: 0, emig: 0, years: [] };
    t.famine += s.flows.famine; t.births += s.flows.births; t.deaths += s.flows.deaths; t.emig += s.flows.emigration;
    if (s.flows.famine > 0.01 * s.pop) { t.years.push(y); const civ = sim.w.civs.get(s.civId)!;
      rows.push(`   s${s.id} ${s.name} civ${s.civId} e${civ.era} pop ${Math.round(s.pop)} famine ${Math.round(s.flows.famine)} (${(100 * s.flows.famine / s.pop).toFixed(1)}%) food ${Math.round(s.food)} need/mo ${Math.round(s.pop * BALANCE.foodNeedPerCapita / 12)} farms ${s.bld[B.FARM]} terr ${s.territory} emp-food ${Math.round(s.employment[0])} civStock ${Math.round(civ.stock[Good.FOOD])} civNeed/yr ${Math.round(civ.population * BALANCE.foodNeedPerCapita)} civShort ${(100 * civ.acc.foodShort / Math.max(1, civ.acc.foodNeed)).toFixed(1)}% access ${s.access.toFixed(2)} occupied ${s.occupiedBy} prosperity ${s.prosperity.toFixed(2)} farmPot ${(s.sites?.farmPot ?? 0).toFixed(1)} sitesFarms ${s.sites?.farms ?? 0} rain ${(sim.w.climate.rain[((s.y / sim.w.climate.cellSize) | 0) * sim.w.climate.cellsX + ((s.x / sim.w.climate.cellSize) | 0)] ?? 0).toFixed(2)} temp ${sim.w.map.temp[sim.w.map.idx(s.x, s.y)].toFixed(1)} eco ${(s.ecoStress ?? 0).toFixed(2)} mech ${civ.caps.farmMechanization.toFixed(2)} farming ${civ.caps.farming.toFixed(2)} tfrdev`); }
    tot.set(s.id, t); yf += s.flows.famine;
  }
  wf += yf;
  if (yf > 0 && (y <= 15 || y % 5 === 0)) { console.log(`y${y} world famine ${Math.round(yf)} pop ${Math.round([...sim.w.settlements.values()].reduce((a, s) => a + s.pop, 0))}`); console.log(rows.slice(0, 8).join('\n')); }
  sim.runTicks(1);
}
console.log('total famine', Math.round(wf));
const top = [...tot.entries()].sort((a, b) => b[1].famine - a[1].famine).slice(0, 10);
for (const [id, t] of top) { const s = sim.w.settlements.get(id); console.log(`s${id} ${s?.name ?? '(gone)'} famine ${Math.round(t.famine)} births ${Math.round(t.births)} deaths ${Math.round(t.deaths)} years ${t.years.length} first ${t.years.slice(0, 12).join(',')}`); }
