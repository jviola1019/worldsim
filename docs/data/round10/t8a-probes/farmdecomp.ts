import { defaultConfig, presetByKey, eraPeopleDefault } from '../../../../src/config/laws';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { loadCheckpoint } from '../../../../scripts/lib/checkpoint';
import { B, BUILDING_KEYS } from '../../../../src/civilizations/buildingTypes';
import { getSites, cropSuitability } from '../../../../src/economy/production';
const c = defaultConfig(); presetByKey('observer')!.apply(c); c.gen.seed = 'disease-1'; c.gen.width = 96; c.gen.height = 96; c.settings.startEra = 10; c.settings.startCivs = eraPeopleDefault('observer', 10);
const fresh = createSimulation(c);
const later = loadCheckpoint<unknown>(process.argv[2])!.sim;
for (const [name, sim] of [['y0', fresh], [`y${later.year}`, later]] as const) {
  const m = sim.w.map; let farms = 0, fert = 0, pol = 0, suit = 0, owned = 0, inSite = 0, pot = 0, pop = 0, water = 0;
  const counts = new Map<number, number>();
  for (let i = 0; i < m.n; i++) { const b = m.bld[i]; if (b) counts.set(b, (counts.get(b) ?? 0) + 1); if (m.isWater(i)) water++;
    if (b === B.FARM) { farms++; fert += m.fert[i]; pol += m.pollution[i]; suit += cropSuitability(m.temp[i], m.moist[i], false); if (m.settle[i]) owned++; } }
  for (const s of sim.w.settlements.values()) { const st = getSites(sim, s); inSite += st.farms; pot += st.farmPot; pop += s.pop; }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([b, n]) => `${BUILDING_KEYS[b]}:${n}`).join(' ');
  console.log(`${name}: pop ${Math.round(pop)} water tiles ${water} farm tiles ${farms} (in a town's sites ${inSite}, settled ${owned}) mean fert ${(fert / farms).toFixed(0)} mean pollution ${(pol / farms).toFixed(0)} mean crop suit ${(suit / farms).toFixed(2)} farmPot ${pot.toFixed(0)} | buildings ${top}`);
}
