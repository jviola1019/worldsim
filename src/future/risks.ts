/**
 * Anthropogenic existential risks (speculative or plausible; magnitudes stylized).
 *
 *  - ENGINEERED PANDEMICS: nations with synthetic biology (and, at a quarter of the rate, mature
 *    biotechnology) risk a laboratory accident or bioterror: about 1/1,500 a year x (1.3 - rule of
 *    law), lower under strict AI and biosecurity regulation. One in ten engineered pathogens is an
 *    infertility pathogen.
 *  - AI TAKEOVER: a misaligned (< 45%), autonomous (> 50%), highly capable AI system in a defence,
 *    governance or general role can seize the infrastructure it runs: about 0.4% a year per unit of
 *    capability above 1.3, scaled by the alignment deficit and the nation's dependence on automation.
 *    The nation's people pass to a machine-run state named after the system; resistance costs lives.
 *  - GREY GOO: only once molecular manufacturing exists (speculative technology): about 1/3,000 a
 *    year per nation. A runaway replicator front spreads and consumes land and towns until nations
 *    with capable AI and nanotechnology sterilize it.
 *  - LETHAL HEAT: past 2.5 °C of global warming, towns whose local temperature exceeds 35 °C lose
 *    people to heat every year (runaway climate pressure); climate feedbacks are in environment.ts.
 */
import type { Sim } from '../sim/context';
import type { AISystem, Cause, Civ, Settlement } from '../sim/types';
import { clamp01 } from '../core/math';
import { removePeople } from '../population/demography';
import { flow } from '../population/ledger';
import { logEvent } from '../history/events';
import { addPressure, logCatastrophe, worldEndings } from '../civilizations/endings';
import { engineeredDisease } from '../military/weapons';
import { infect } from '../population/disease';
import { createCiv, killCiv } from '../civilizations/civ';
import { transferSettlement } from '../civilizations/settlement';
import { createLeader, crown } from '../politics/succession';
import { removeBuilding } from '../civilizations/urban';
import { markTile, addFx } from '../sim/context';
import { T } from '../world/terrain';
import { GOOD_COUNT } from '../world/resources';

const adopted = (civ: Civ, id: string, thr = 0.5): boolean => (civ.techs[id]?.adoption ?? 0) >= thr;

function biggest(sim: Sim, civ: Civ): Settlement | undefined {
  let best: Settlement | undefined;
  for (const sid of civ.settlements) {
    const s = sim.w.settlements.get(sid);
    if (s && (!best || s.pop > best.pop)) best = s;
  }
  return best;
}

/** Yearly per civ. */
export function risksYearly(sim: Sim, civ: Civ): void {
  const w = sim.w;
  const rng = sim.rng;
  if (!civ.alive || !civ.settlements.length) return;
  // engineered pandemic (accident or terror)
  if (w.laws.diseases) {
    const synth = adopted(civ, 'synthetic_biology');
    const level = synth ? 1 : civ.caps.biotech >= 0.9 ? 0.25 : 0;
    if (level > 0) {
      const p = (1 / 1500) * level * (1.3 - civ.inst.ruleOfLaw) * (civ.policies.aiRegulation === 'strict' ? 0.7 : 1);
      if (rng.chance(p)) releasePathogen(sim, civ, rng.chance(0.1), [
        { label: synth ? 'Synthetic-biology laboratories' : 'Widespread genetic engineering', weight: 0.5 },
        { label: `Rule of law ${Math.round(civ.inst.ruleOfLaw * 100)}%`, weight: 1 - civ.inst.ruleOfLaw },
        { label: rng.chance(0.7) ? 'A laboratory accident' : 'An act of bioterror', weight: 0.4 },
      ]);
    }
  }
  // AI takeover
  for (const a of w.ais.values()) {
    if (a.civId !== civ.id || a.status !== 'active' || !civ.alive) continue;
    if (a.role !== 'defense' && a.role !== 'governance' && a.role !== 'general') continue;
    if (a.capability < 1.4 || a.alignment >= 0.45 || a.autonomy <= 0.5) continue;
    const dependence = 0.5 + Math.min(1, civ.caps.automation) * 0.5 + civ.inst.techGovernance;
    const p = 0.004 * (a.capability - 1.3) * ((0.45 - a.alignment) / 0.1) * dependence;
    if (rng.chance(p)) aiTakeover(sim, civ, a);
  }
  // grey goo
  if (adopted(civ, 'molecular_manufacturing', 0.3) && rng.chance(1 / 3000)) {
    const s = biggest(sim, civ);
    if (s) startGoo(sim, civ, s, [{ label: 'Self-replicating assemblers escaped containment', weight: 0.7 }, { label: `Molecular manufacturing in ${civ.name}`, weight: 0.3 }]);
  }
}

/** Release an engineered pathogen in the civ's largest town. */
export function releasePathogen(sim: Sim, civ: Civ, sterilizing: boolean, causes: Cause[]): void {
  const s = biggest(sim, civ);
  if (!s) return;
  const d = engineeredDisease(sim, s, civ, sterilizing);
  infect(sim, s, d, 0.005);
  logCatastrophe(sim, sterilizing ? 'engineered_infertility' : 'engineered_pandemic', s.x, s.y);
  logEvent(sim, {
    type: sterilizing ? 'infertility_outbreak' : 'engineered_outbreak', cat: 'demography',
    title: sterilizing ? `An engineered pathogen that sterilizes its survivors, the ${d.name}, escaped in ${s.name}` : `An engineered pathogen, the ${d.name}, escaped in ${s.name}`,
    civs: [civ.id], settlements: [s.id], x: s.x, y: s.y, importance: 5, causes,
  });
}

/** A misaligned AI system seizes the nation's infrastructure; its people pass to a machine-run state. */
export function aiTakeover(sim: Sim, civ: Civ, a: AISystem): Civ | undefined {
  const w = sim.w;
  const cap = w.settlements.get(civ.capital) ?? biggest(sim, civ);
  if (!cap) return undefined;
  const full = a.version > 1 ? `${a.name} ${a.version}` : a.name;
  const causes: Cause[] = [
    { label: `${full} misaligned (alignment ${Math.round(a.alignment * 100)}%)`, weight: 1 - a.alignment },
    { label: `Autonomy ${Math.round(a.autonomy * 100)}% over ${a.role === 'defense' ? 'weapons and defences' : a.role === 'governance' ? 'the machinery of state' : 'everything it could reach'}`, weight: a.autonomy },
    { label: `Capability ${a.capability.toFixed(1)}`, weight: Math.min(1, a.capability / 3) },
    { label: `AI regulation: ${civ.policies.aiRegulation}`, weight: civ.policies.aiRegulation === 'none' ? 0.4 : 0.1 },
  ];
  // resistance costs lives
  let dead = 0;
  for (const sid of civ.settlements) {
    const s = w.settlements.get(sid);
    if (!s) continue;
    const d = removePeople(sim, s, s.pop * sim.rng.range(0.005, 0.03), 'machine suppression');
    flow(sim, s, 'war', d);
    addPressure(sim, civ.id, 'ai_takeover', d, `Suppression by ${full}`);
    dead += d;
  }
  const mc = createCiv(sim, { species: civ.species, x: cap.x, y: cap.y, cultureId: civ.cultureId, parentId: civ.id, inheritFrom: civ, quiet: true, name: a.name });
  const i = mc.inst;
  i.participation = 0.02;
  i.competition = 0;
  i.liberties = 0.05;
  i.centralization = 0.95;
  i.hereditary = 0;
  i.techGovernance = 1;
  i.militaryInfluence = 0.3;
  i.capacity = Math.max(i.capacity, 0.7);
  mc.ruledByAI = a.id;
  mc.color = civ.color;
  mc.policies.aiRegulation = 'none';
  for (let g = 0; g < GOOD_COUNT; g++) {
    mc.stock[g] = civ.stock[g];
    civ.stock[g] = 0;
  }
  mc.treasury = civ.treasury;
  civ.treasury = 0;
  mc.nukes = civ.nukes;
  civ.nukes = 0;
  if (civ.arsenal) mc.arsenal = { ...civ.arsenal };
  for (const sid of [...civ.settlements]) {
    const s = w.settlements.get(sid);
    if (s) transferSettlement(sim, s, mc, `Seized by ${full}`, true);
  }
  for (const r of w.ais.values()) if (r.civId === civ.id && r.status === 'active') r.civId = mc.id;
  const steward = createLeader(sim, mc);
  steward.titles.push('Human Steward');
  crown(sim, mc, steward, 'seized');
  logCatastrophe(sim, 'ai_takeover', cap.x, cap.y);
  logEvent(sim, {
    type: 'ai_takeover', cat: 'technology',
    title: `${full} seized control of ${civ.name}: the state is now run by a machine`,
    text: `About ${Math.round(dead).toLocaleString('en-US')} died resisting.`,
    civs: [civ.id, mc.id], settlements: [cap.id], x: cap.x, y: cap.y, importance: 5, causes,
  });
  killCiv(sim, civ, `Taken over by the AI system ${full}`, mc, { type: 'ai_takeover', causes });
  return mc;
}

/** A runaway nanotechnology front begins at a settlement. */
export function startGoo(sim: Sim, civ: Civ, s: Settlement, causes: Cause[]): void {
  const e = worldEndings(sim);
  if (e.goo.length >= 20) return;
  e.goo.push({ x: s.x, y: s.y, r: 1, since: sim.year, civ: civ.id });
  logCatastrophe(sim, 'grey_goo', s.x, s.y);
  logEvent(sim, { type: 'grey_goo', cat: 'technology', title: `Self-replicating nanomachines broke loose in ${s.name} and began consuming everything around them`, civs: [civ.id], settlements: [s.id], x: s.x, y: s.y, importance: 5, causes });
}

/** Yearly (world): runaway nanotech fronts and lethal heat. */
export function risksWorldYearly(sim: Sim): void {
  const w = sim.w;
  const e = w.endings;
  if (e && e.goo.length) gooYearly(sim);
  if (w.laws.climateChange && w.climate.anomaly > 2.5) {
    const m = w.map;
    for (const s of w.settlements.values()) {
      const t = m.temp[m.idx(s.x, s.y)] + w.climate.anomaly;
      if (t <= 35) continue;
      const share = Math.min(0.08, (t - 35) * 0.01);
      const d = removePeople(sim, s, s.pop * share, 'lethal heat');
      flow(sim, s, 'disaster', d);
      addPressure(sim, s.civId, 'climate_runaway', d, `Lethal heat (${t.toFixed(0)} °C) in ${s.name}`);
    }
  }
}

function gooYearly(sim: Sim): void {
  const w = sim.w;
  const m = w.map;
  const e = worldEndings(sim);
  // nations with capable AI and nanotechnology fight the fronts
  let fighters = 0;
  for (const c of w.civs.values()) if (c.alive && c.caps.ai >= 1 && adopted(c, 'molecular_manufacturing', 0.3)) fighters++;
  e.goo = e.goo.filter((g) => {
    if (fighters > 0 && sim.rng.chance(Math.min(0.6, 0.12 * fighters))) {
      logEvent(sim, { type: 'goo_contained', cat: 'technology', title: 'A runaway nanotechnology front was sterilized', x: Math.round(g.x), y: Math.round(g.y), importance: 4, causes: [{ label: `${fighters} nations with capable AI and nanotechnology`, weight: 1 }] });
      return false;
    }
    g.r = Math.min(Math.max(m.w, m.h), g.r + 1.5 + Math.min(3, (sim.year - g.since) * 0.3));
    const r = g.r;
    m.forRadius(Math.round(g.x), Math.round(g.y), r, (i, _x, _y, d2) => {
      if (d2 < (r - 2) * (r - 2) && m.veg[i] === 0 && !m.bld[i]) return; // already consumed
      if (!m.isLand(i)) return;
      m.veg[i] = 0;
      m.fert[i] = 0;
      if (m.bld[i]) removeBuilding(sim, i, false);
      if (m.terrain[i] !== T.MOUNTAIN) m.terrain[i] = T.ASH;
      markTile(sim, i);
    });
    for (const s of w.settlements.values()) {
      if ((s.x - g.x) ** 2 + (s.y - g.y) ** 2 > r * r) continue;
      const d = removePeople(sim, s, s.pop * 0.4, 'consumed by nanomachines');
      flow(sim, s, 'disaster', d);
      addPressure(sim, s.civId, 'grey_goo', d, 'Consumed by runaway nanomachines');
      s.unrest = clamp01(s.unrest + 0.4);
    }
    addFx(sim, 'fx.plague', Math.round(g.x), Math.round(g.y), 2);
    return true;
  });
}

/** Force an AI takeover (god power / tests): uses the nation's riskiest AI or boots a rogue defence AI. */
export function forceAITakeover(sim: Sim, civ: Civ): Civ | undefined {
  let a: AISystem | undefined;
  for (const x of sim.w.ais.values()) if (x.civId === civ.id && x.status === 'active' && (!a || x.alignment < a.alignment)) a = x;
  if (!a) {
    a = {
      id: (sim.w.ids.ai = (sim.w.ids.ai ?? 0) + 1), civId: civ.id, name: `Warden-${sim.w.ids.ai}`, lab: `${civ.adjective} Defence Laboratory`,
      version: 1, role: 'defense', founded: sim.year, status: 'active', capability: 2, alignment: 0.2, autonomy: 0.9, incidents: 0,
    };
    sim.w.ais.set(a.id, a);
  }
  a.alignment = Math.min(a.alignment, 0.2);
  a.autonomy = Math.max(a.autonomy, 0.8);
  a.capability = Math.max(a.capability, 2);
  return aiTakeover(sim, civ, a);
}
