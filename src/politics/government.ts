/**
 * Government & internal politics (yearly).
 *
 * Institutions are a continuous vector (Institutions); the government LABEL is
 * derived from it. Political FACTIONS arise from the economic and social
 * structure (peasants from agricultural employment, workers from industry,
 * merchants from commerce, clergy from faith, intelligentsia from education,
 * regionalists from cultural minorities...). Each faction has an ideal
 * institutional profile, power and satisfaction. Institutions drift toward
 * the power-weighted ideals (bargaining); when powerful groups are deeply
 * dissatisfied, legitimacy falls and unrest rises, leading to concessions,
 * coups, revolutions or secession (cf. Acemoglu & Robinson on concessions
 * under revolutionary threat; structural-demographic pressures). There is no
 * fixed endpoint: technology widens the feasible range of institutions
 * (e.g. mass participation needs communication & suffrage ideas) but
 * outcomes depend on who holds power.
 */
import { mediaUnrest, mediaCorruptionRelief } from '../media/media';
import { removePeople } from '../population/demography';
import { flow } from '../population/ledger';
import type { Sim } from '../sim/context';
import type { Cause, Civ, Faction, Institutions, Settlement } from '../sim/types';
import { clamp, clamp01, saturate } from '../core/math';
import { SECTOR } from '../civilizations/buildings';
import { deriveGovForm, civDisplayName, GOV_FORMS, type GovFormKey } from './govforms';
import { logEvent } from '../history/events';
import { createLeader, crown } from './succession';
import { BALANCE } from '../config/balance';
import { createCiv, personalityOf } from '../civilizations/civ';
import { transferSettlement } from '../civilizations/settlement';
import { TRAIT_BY_KEY } from '../population/traits';
import { declareWar } from './diplomacy';

// Every institution is contested: a value held by one faction alone would be its goal no matter how
// weak that faction is (power only sets the speed), so hereditary rule and military influence would
// ratchet up everywhere. Commoners, merchants and intellectuals push back; peasants and clergy lean
// traditional.
export const IDEALS: Record<string, Partial<Institutions>> = {
  peasants: { participation: 0.4, welfare: 0.5, federalism: 0.6, centralization: 0.3, hereditary: 0.6, militaryInfluence: 0.4 },
  workers: { participation: 0.85, welfare: 0.85, stateEconomy: 0.6, liberties: 0.6, hereditary: 0.1, militaryInfluence: 0.3 },
  merchants: { participation: 0.6, liberties: 0.75, ruleOfLaw: 0.85, stateEconomy: 0.1, hereditary: 0.2, militaryInfluence: 0.25 },
  nobles: { hereditary: 1, participation: 0.1, centralization: 0.35, federalism: 0.75, militaryInfluence: 0.6 },
  clergy: { religiousAuthority: 0.85, liberties: 0.35, hereditary: 0.7 },
  military: { militaryInfluence: 0.85, centralization: 0.8, participation: 0.2 },
  intelligentsia: { liberties: 0.9, participation: 0.8, religiousAuthority: 0.1, ruleOfLaw: 0.8, hereditary: 0, militaryInfluence: 0.15 },
  technologists: { techGovernance: 0.8, ruleOfLaw: 0.7, stateEconomy: 0.3, militaryInfluence: 0.3 },
  regionalists: { federalism: 0.95, centralization: 0.1 },
};
const NAMES: Record<string, string> = {
  peasants: 'Peasantry', workers: 'Workers', merchants: 'Merchants', nobles: 'Nobility', clergy: 'Clergy',
  military: 'Military', intelligentsia: 'Intelligentsia', technologists: 'Technologists', regionalists: 'Regionalists',
};

function civSettlements(sim: Sim, civ: Civ): Settlement[] {
  const out: Settlement[] = [];
  for (const id of civ.settlements) {
    const s = sim.w.settlements.get(id);
    if (s) out.push(s);
  }
  return out;
}

export function computeFactions(sim: Sim, civ: Civ): Faction[] {
  const ss = civSettlements(sim, civ);
  const emp = new Array(7).fill(0);
  let pop = 0;
  let edu = 0;
  let faith = 0;
  const minority = new Map<number, number>();
  for (const s of ss) {
    for (let k = 0; k < 7; k++) emp[k] += s.employment[k];
    pop += s.pop;
    edu += s.education * s.pop;
    faith += s.pop * s.religions.reduce((a, r) => a + (r.id ? r.f : 0), 0);
    const cu = s.cultures[0]?.id;
    if (cu && cu !== civ.cultureId) minority.set(cu, (minority.get(cu) ?? 0) + s.pop);
  }
  const workforce = emp.reduce((a, b) => a + b, 0) || 1;
  const i = civ.inst;
  const c = civ.caps;
  const raw: { key: string; size: number; power: number; cultureId?: number }[] = [
    { key: 'peasants', size: emp[SECTOR.FOOD] / workforce, power: 0.4 },
    { key: 'workers', size: (emp[SECTOR.INDUSTRY] + emp[SECTOR.RESOURCES] + emp[SECTOR.CONSTRUCTION] + emp[SECTOR.UNEMPLOYED]) / workforce * (c.industry > 0 ? 1 : 0.4), power: 0.5 + c.mediaReach * 0.2 },
    { key: 'merchants', size: (emp[SECTOR.SERVICES] / workforce) * (c.currency > 0 ? 0.6 : 0.2), power: 1 + c.markets + c.finance },
    { key: 'nobles', size: 0.02 * (0.3 + i.hereditary), power: 3 * i.hereditary * (1 - i.participation) },
    { key: 'clergy', size: 0.015 * (pop > 0 ? faith / pop : 0), power: 1.5 + i.religiousAuthority * 3 },
    { key: 'military', size: emp[SECTOR.MILITARY] / workforce + 0.01, power: 1.5 + i.militaryInfluence * 3 + civ.mobilization * 2 },
    { key: 'intelligentsia', size: (pop > 0 ? edu / pop : 0) * 0.15, power: 1 + c.literacy },
  ];
  if (c.computing > 0.5) raw.push({ key: 'technologists', size: 0.02 + c.ai * 0.03, power: 1 + c.ai });
  for (const [cu, n] of minority) if (n / Math.max(1, pop) > 0.05) raw.push({ key: 'regionalists', size: n / pop, power: 0.8, cultureId: cu });
  let totalPower = 0;
  for (const r of raw) totalPower += Math.max(0, r.size) * r.power;
  const old = new Map(civ.factions.map((f) => [f.key + (f.cultureId ?? ''), f.satisfaction]));
  const out: Faction[] = [];
  for (const r of raw) {
    if (r.size <= 0.001) continue;
    const ideal = IDEALS[r.key];
    let dist = 0;
    let n = 0;
    for (const k of Object.keys(ideal) as (keyof Institutions)[]) {
      dist += Math.abs((ideal[k] ?? 0) - i[k]);
      n++;
    }
    const instSat = 1 - (n ? dist / n : 0) * 2;
    let material = 0;
    if (r.key === 'peasants' || r.key === 'workers') material = clamp((civ.econ.livingStandard - 1.2) * 0.4, -0.6, 0.4) - civ.econ.unemployment * 2;
    if (r.key === 'merchants') material = clamp(civ.econ.growth * 5, -0.4, 0.4) - (civ.crisis > 0 ? 0.3 : 0);
    if (r.key === 'military') material = civ.budget.military > 0.2 ? 0.2 : -0.2;
    if (r.key === 'clergy') material = civ.stateReligion ? 0.2 : -0.3;
    const ruling = civ.rulingFaction === r.key ? 0.25 : 0;
    const target = clamp(instSat * 0.6 + material + ruling, -1, 1);
    const prev = old.get(r.key + (r.cultureId ?? '')) ?? target;
    out.push({
      key: r.key,
      name: r.cultureId ? `${sim.w.cultures.get(r.cultureId)?.name ?? ''} ${NAMES[r.key]}` : NAMES[r.key],
      size: r.size,
      power: totalPower > 0 ? (r.size * r.power) / totalPower : 0,
      satisfaction: prev + (target - prev) * 0.35,
      ideal,
      cultureId: r.cultureId,
    });
  }
  out.sort((a, b) => b.power - a.power);
  return out;
}

function ruler(sim: Sim, civ: Civ) {
  return sim.w.persons.get(civ.rulerId);
}

function rulerLead(sim: Sim, civ: Civ, key: string): number {
  const r = ruler(sim, civ);
  if (!r) return 0;
  let v = 0;
  for (const t of r.traits) v += ((TRAIT_BY_KEY[t]?.lead as Record<string, number> | undefined)?.[key] ?? 0) as number;
  return v;
}

export function politicsYearly(sim: Sim, civ: Civ): void {
  const w = sim.w;
  const rng = sim.rng;
  if (!civ.settlements.length) return;
  civ.regimeAge++;
  const i = civ.inst;
  const c = civ.caps;
  civ.factions = computeFactions(sim, civ);
  // --- legitimacy
  const tradition = saturate(civ.regimeAge, 25) * 0.25 * (0.5 + i.hereditary);
  const performance = clamp(civ.econ.growth * 3 + (civ.econ.livingStandard - 1.3) * 0.15, -0.3, 0.25);
  const procedural = i.participation * i.competition * 0.35;
  const sacred = i.religiousAuthority * (civ.stateReligion ? 0.2 : 0.05);
  const charisma = rulerLead(sim, civ, 'legitimacy');
  const target = clamp01(0.3 + tradition + performance + procedural + sacred + charisma - civ.corruption * 0.3 - civ.warExhaustion * 0.3);
  civ.legitimacy += (target - civ.legitimacy) * 0.2;
  // --- unrest from dissatisfied power, hardship and repression
  let grievance = 0;
  for (const f of civ.factions) if (f.satisfaction < 0) grievance += -f.satisfaction * f.power;
  let local = 0;
  let pop = 0;
  let shortage = 0;
  for (const s of civSettlements(sim, civ)) {
    local += s.unrest * s.pop;
    pop += s.pop;
    shortage += (s.flows.famine + s.flows.disease) / Math.max(1, s.pop);
  }
  local = pop > 0 ? local / pop : 0;
  const repression = i.centralization * i.militaryInfluence * 0.3;
  const unrestTarget = clamp01(grievance * 1.2 + local * 0.5 + shortage * 2 + civ.econ.inequality * 0.2 + civ.warExhaustion * 0.3 + mediaUnrest(civ) - repression - civ.legitimacy * 0.25);
  civ.unrest += (unrestTarget - civ.unrest) * 0.3;
  civ.stability += (clamp01(civ.legitimacy * 0.6 + (1 - civ.unrest) * 0.4 - (civ.crisis > 0 ? 0.1 : 0)) - civ.stability) * 0.25;
  // --- corruption & capacity
  const rents = civ.econ.gdp > 0 ? clamp01((civ.econ.sectors[1] ?? 0) / civ.econ.gdp) : 0;
  const corrTarget = clamp01(0.35 - i.ruleOfLaw * 0.3 - i.liberties * 0.1 - c.ruleOfLaw * 0.2 + saturate(civ.regimeAge, 60) * 0.15 + rents * 0.25 + rulerLead(sim, civ, 'corruption') - mediaCorruptionRelief(civ));
  civ.corruption += (corrTarget - civ.corruption) * 0.1;
  const capTarget = clamp01((0.05 + c.adminCapacity * 0.12) * (0.6 + 0.8 * civ.budget.admin) * (1 - civ.corruption * 0.5));
  i.capacity += (capTarget - i.capacity) * 0.08;
  // --- institutional drift toward power-weighted ideals (bounded by ideas & technology)
  const maxParticipation = clamp01(0.3 + c.participation * 0.45 + c.communication * 0.02);
  const reform = 0.03 * (1 + rulerLead(sim, civ, 'reform')) * (0.5 + civ.stability);
  for (const k of Object.keys(i) as (keyof Institutions)[]) {
    if (k === 'capacity') continue;
    let tw = 0;
    let tv = 0;
    for (const f of civ.factions) {
      const v = f.ideal[k];
      if (v === undefined) continue;
      tw += f.power;
      tv += f.power * v;
    }
    if (tw <= 0) continue;
    let goal = tv / tw;
    if (k === 'participation') goal = Math.min(goal, maxParticipation);
    if (k === 'competition') goal = Math.min(i.participation, goal);
    if (k === 'techGovernance') goal = Math.min(goal, c.ai * 0.4);
    if (k === 'welfare') goal = Math.min(goal, 0.15 + c.welfare * 0.7);
    i[k] = clamp01(i[k] + (goal - i[k]) * reform * tw);
  }
  i.competition = clamp01(i.competition + (i.participation * 0.9 - i.competition) * 0.05);
  i.ruleOfLaw = clamp01(i.ruleOfLaw + (c.ruleOfLaw * 0.6 + 0.2 - i.ruleOfLaw) * 0.04);
  // --- elections
  if (i.participation >= 0.3 && i.hereditary < 0.5 && sim.year - civ.lastElection >= BALANCE.electionInterval) election(sim, civ);
  // --- crises
  if (w.laws.rebellions) {
    const mil = civ.factions.find((f) => f.key === 'military');
    if (mil && mil.power > 0.25 && mil.satisfaction < -0.25 && civ.legitimacy < 0.4 && rng.chance(0.25)) coup(sim, civ);
    else if (civ.unrest > BALANCE.revolutionThreshold && rng.chance(0.3)) revolution(sim, civ);
    else secessionCheck(sim, civ);
    if (civ.alive && civ.stability < 0.1 && civ.legitimacy < 0.15 && civ.settlements.length >= 4 && rng.chance(0.2)) collapse(sim, civ);
  }
  if (!civ.alive) return;
  policyDecisions(sim, civ);
  // --- labels & personality
  const nCult = new Set(civSettlements(sim, civ).map((s) => s.cultures[0]?.id)).size;
  const form = deriveGovForm(civ, civ.settlements.length, nCult);
  if (form !== civ.govForm) {
    const before = civ.govForm;
    civ.govForm = form;
    const oldName = civ.name;
    civ.name = civDisplayName(civ);
    if (before !== 'band')
      logEvent(sim, { type: 'government_change', cat: 'politics', title: `${oldName} became ${aOrAn(GOV_FORMS[form].label.toLowerCase())}: ${civ.name}`, civs: [civ.id], importance: 3, causes: institutionCauses(civ) });
  } else civ.name = civDisplayName(civ);
  civ.personality = personalityOf(sim, civ);
}

function aOrAn(s: string): string {
  return (/^[aeiou]/.test(s) ? 'an ' : 'a ') + s;
}

function institutionCauses(civ: Civ): Cause[] {
  return civ.factions.slice(0, 4).map((f) => ({ label: `${f.name} (${Math.round(f.power * 100)}% of influence, ${f.satisfaction >= 0 ? 'satisfied' : 'discontented'})`, weight: f.power }));
}

function election(sim: Sim, civ: Civ): void {
  civ.lastElection = sim.year;
  const rng = sim.rng;
  const opts = civ.factions.filter((f) => f.size > 0.02);
  if (!opts.length) return;
  const incumbent = civ.rulingFaction;
  const weights = opts.map((f) => f.size * (1 + f.satisfaction * (f.key === incumbent ? 1 : -0.5)) * (f.key === incumbent ? 1 + civ.econ.growth * 5 : 1));
  // weak competition lets incumbents rig outcomes
  if (incumbent) {
    const k = opts.findIndex((f) => f.key === incumbent);
    if (k >= 0) weights[k] *= 1 + (1 - civ.inst.competition) * 3 + civ.corruption;
  }
  const winner = opts[Math.max(0, rng.weighted(weights))];
  const changed = winner.key !== incumbent;
  civ.rulingFaction = winner.key;
  const termLimit = rng.chance(0.4);
  if (changed || termLimit) {
    const leader = createLeader(sim, civ);
    crown(sim, civ, leader, 'elected');
  }
  logEvent(sim, {
    type: 'election',
    cat: 'politics',
    title: `${civ.name} held elections: the ${winner.name.toLowerCase()} ${changed ? 'took power' : 'kept power'}`,
    civs: [civ.id],
    importance: changed ? 2 : 1,
  });
}

function coup(sim: Sim, civ: Civ): void {
  const i = civ.inst;
  i.militaryInfluence = clamp01(i.militaryInfluence + 0.4);
  i.participation = clamp01(i.participation * 0.4);
  i.competition = clamp01(i.competition * 0.3);
  i.liberties = clamp01(i.liberties * 0.6);
  i.hereditary = Math.min(i.hereditary, 0.3);
  civ.regimeAge = 0;
  civ.rulingFaction = 'military';
  const gen = createLeader(sim, civ);
  gen.role = 'general';
  gen.titles.push('General');
  crown(sim, civ, gen, 'seized');
  logEvent(sim, {
    type: 'coup',
    cat: 'politics',
    title: `Military coup in ${civ.name}`,
    civs: [civ.id],
    persons: [gen.id],
    importance: 3,
    causes: [
      { label: 'Discontented, powerful military', weight: 0.5 },
      { label: `Low legitimacy (${Math.round(civ.legitimacy * 100)}%)`, weight: 0.3 },
      ...(civ.warExhaustion > 0.3 ? [{ label: 'War exhaustion', weight: civ.warExhaustion }] : []),
    ],
  });
}

function revolution(sim: Sim, civ: Civ): void {
  const rng = sim.rng;
  const rebels = [...civ.factions].filter((f) => f.satisfaction < 0).sort((a, b) => a.satisfaction * b.power - b.satisfaction * a.power)[0];
  if (!rebels) return;
  const military = civ.factions.find((f) => f.key === 'military');
  const rebelStrength = rebels.power * (1 - rebels.satisfaction) + civ.unrest;
  const regimeStrength = (military && military.satisfaction > 0 ? military.power * 2 : 0.2) + civ.legitimacy;
  const causes: Cause[] = [
    { label: `${rebels.name} deeply discontented`, weight: -rebels.satisfaction * rebels.power + 0.1 },
    { label: `Unrest at ${Math.round(civ.unrest * 100)}%`, weight: civ.unrest },
    ...(civ.econ.livingStandard < 1.1 ? [{ label: 'Hardship and hunger', weight: 0.3 }] : []),
    ...(civ.econ.inequality > 0.45 ? [{ label: 'High inequality', weight: civ.econ.inequality - 0.3 }] : []),
    ...(civ.warExhaustion > 0.3 ? [{ label: 'War exhaustion', weight: civ.warExhaustion }] : []),
    ...(civ.corruption > 0.4 ? [{ label: 'Corruption', weight: civ.corruption - 0.2 }] : []),
  ];
  if (rng.float() < rebelStrength / (rebelStrength + regimeStrength)) {
    const i = civ.inst;
    for (const [k, v] of Object.entries(rebels.ideal) as [keyof Institutions, number][]) i[k] = clamp01(i[k] + (v - i[k]) * 0.7);
    if (rebels.key !== 'nobles') i.hereditary = Math.min(i.hereditary, 0.2);
    civ.regimeAge = 0;
    civ.rulingFaction = rebels.key;
    civ.unrest *= 0.4;
    civ.legitimacy = 0.5;
    if (rebels.key === 'clergy' && civ.stateReligion === 0) {
      const cap = sim.w.settlements.get(civ.capital);
      civ.stateReligion = cap?.religions[0]?.id ?? 0;
    }
    const leader = createLeader(sim, civ);
    leader.role = 'rebel';
    leader.titles.push('Revolutionary');
    crown(sim, civ, leader, 'seized');
    logEvent(sim, { type: 'revolution', cat: 'politics', title: `Revolution in ${civ.adjective} lands: the ${rebels.name.toLowerCase()} overthrew the old order`, civs: [civ.id], persons: [leader.id], importance: 4, causes });
  } else {
    civ.unrest *= 0.7;
    civ.legitimacy = clamp01(civ.legitimacy - 0.05);
    civ.inst.liberties = clamp01(civ.inst.liberties - 0.08);
    // repression costs lives
    for (const s of civSettlements(sim, civ)) if (s.unrest > 0.5) flow(sim, s, 'war', removePeople(sim, s, s.pop * 0.002, 'repression'));
    logEvent(sim, { type: 'uprising_crushed', cat: 'politics', title: `An uprising of the ${rebels.name.toLowerCase()} in ${civ.name} was crushed`, civs: [civ.id], importance: 2, causes });
  }
}

function secessionCheck(sim: Sim, civ: Civ): void {
  const w = sim.w;
  const rng = sim.rng;
  if (civ.settlements.length < 2) return;
  const cap = w.settlements.get(civ.capital);
  if (!cap) return;
  for (const s of civSettlements(sim, civ)) {
    if (s.capital || s.pop < 300) continue;
    const foreign = (s.cultures[0]?.id ?? civ.cultureId) !== civ.cultureId ? 1 : 0;
    const d = Math.hypot(s.x - cap.x, s.y - cap.y);
    const reach = 12 + civ.caps.communication * 4 + civ.caps.roadTier * 3;
    const remote = clamp01(d / reach - 0.5);
    const pressure = foreign * 0.45 + remote * 0.35 + s.unrest * 0.4 + (1 - s.loyalty) * 0.4 - civ.inst.federalism * 0.25 - civ.legitimacy * 0.2 - civ.inst.militaryInfluence * 0.1;
    if (pressure > BALANCE.secessionThreshold * 0.85 && rng.chance(0.15)) {
      secede(sim, civ, s, [
        ...(foreign ? [{ label: `Distinct ${w.cultures.get(s.cultures[0].id)?.name ?? 'local'} identity`, weight: 0.45 }] : []),
        ...(remote > 0 ? [{ label: 'Distance from the capital', weight: remote * 0.35 }] : []),
        { label: `Local unrest (${Math.round(s.unrest * 100)}%)`, weight: s.unrest * 0.4 },
        { label: 'Weak loyalty to the central government', weight: (1 - s.loyalty) * 0.4 },
      ]);
      return;
    }
  }
}

export function secede(sim: Sim, civ: Civ, s: Settlement, causes: Cause[]): Civ {
  const w = sim.w;
  const cultureId = s.cultures[0]?.id ?? civ.cultureId;
  const nc = createCiv(sim, { species: s.species, x: s.x, y: s.y, cultureId, parentId: civ.id, inheritFrom: civ, quiet: true });
  nc.inst.federalism = clamp01(nc.inst.federalism + 0.1);
  transferSettlement(sim, s, nc, 'Secession', true);
  // nearby settlements of the same culture may join
  for (const o of civSettlements(sim, civ)) {
    if (o.capital || o === s) continue;
    if ((o.cultures[0]?.id ?? 0) === cultureId && Math.hypot(o.x - s.x, o.y - s.y) < 12 && o.loyalty < 0.7) transferSettlement(sim, o, nc, 'Joined the secession', true);
  }
  const leader = createLeader(sim, nc);
  crown(sim, nc, leader, 'founded');
  logEvent(sim, { type: 'secession', cat: 'politics', title: `${nc.name} declared independence from ${civ.name}`, civs: [civ.id, nc.id], settlements: [s.id], x: s.x, y: s.y, importance: 4, causes });
  // the parent may fight to keep it
  if (w.laws.warfare && civ.personality.aggression > 0.4 && sim.rng.chance(0.5 + civ.personality.aggression * 0.3)) declareWar(sim, civ, nc, 'reconquest', [{ label: 'Refusal to recognize the secession', weight: 1 }]);
  return nc;
}

function collapse(sim: Sim, civ: Civ): void {
  const w = sim.w;
  const rng = sim.rng;
  const ss = civSettlements(sim, civ).filter((s) => !s.capital).sort((a, b) => b.pop - a.pop);
  const breakaways = ss.slice(0, Math.max(1, Math.floor(ss.length / 2)));
  const causes: Cause[] = [
    { label: `Stability ${Math.round(civ.stability * 100)}%`, weight: 1 - civ.stability },
    { label: `Legitimacy ${Math.round(civ.legitimacy * 100)}%`, weight: 1 - civ.legitimacy },
    ...(civ.crisis > 0 ? [{ label: 'Economic crisis', weight: 0.4 }] : []),
    ...(civ.warExhaustion > 0.3 ? [{ label: 'Exhausted by war', weight: civ.warExhaustion }] : []),
  ];
  logEvent(sim, { type: 'collapse', cat: 'politics', title: `${civ.name} fragmented into rival states`, civs: [civ.id], importance: 4, causes });
  for (const s of breakaways) {
    if (s.civId !== civ.id) continue;
    if (rng.chance(0.7)) secede(sim, civ, s, causes);
  }
  civ.stability = 0.35;
  civ.unrest *= 0.5;
  void w;
}

function policyDecisions(sim: Sim, civ: Civ): void {
  const w = sim.w;
  const c = civ.caps;
  const b = civ.budget;
  const atWar = [...w.wars.values()].some((x) => !x.end && (x.attackers.includes(civ.id) || x.defenders.includes(civ.id)));
  // budget targets
  const t = {
    admin: 0.2 + civ.inst.centralization * 0.1,
    military: (atWar ? 0.4 : 0.12) + civ.personality.aggression * 0.08 + civ.inst.militaryInfluence * 0.1,
    infrastructure: 0.12 + c.roadTier * 0.01,
    education: 0.03 + c.literacy * 0.15 + civ.personality.science * 0.04,
    health: 0.03 + c.healthcare * 0.15,
    research: 0.02 + civ.personality.science * 0.05 + c.research * 0.01,
    welfare: c.welfare > 0 ? civ.inst.welfare * 0.3 : 0.01,
    religion: 0.02 + civ.inst.religiousAuthority * 0.2,
  };
  let sum = 0;
  for (const k of Object.keys(t) as (keyof typeof t)[]) sum += t[k];
  for (const k of Object.keys(t) as (keyof typeof t)[]) b[k] += (t[k] / sum - b[k]) * 0.25;
  // taxes
  const deficit = civ.econ.spending > civ.econ.revenue * 1.05;
  const taxCap = 0.08 + civ.inst.capacity * 0.35 + (c.welfare > 0 ? civ.inst.welfare * 0.15 : 0);
  if (deficit || atWar) civ.taxRate = Math.min(taxCap, civ.taxRate + 0.01);
  else if (civ.unrest > 0.4) civ.taxRate = Math.max(0.03, civ.taxRate - 0.01);
  else civ.taxRate += (Math.min(taxCap, 0.06 + civ.inst.capacity * 0.25) - civ.taxRate) * 0.1;
  // religious policy follows ruler & institutions
  const tol = rulerLead(sim, civ, 'tolerance');
  if (civ.stateReligion) {
    const zeal = civ.inst.religiousAuthority + civ.personality.piety * 0.3 - tol - civ.inst.liberties * 0.5;
    civ.policies.tolerance = zeal > 0.75 ? 'persecution' : zeal > 0.35 ? 'state_faith' : 'tolerant';
  }
  // environment: polluted democracies (or strict-minded rulers) regulate
  const pollution = civ.econ.emissions / Math.max(1, civ.population) * 1000;
  if (c.pollutionControl > 0 && pollution > 0.5 && civ.inst.participation > 0.45) civ.policies.environment = pollution > 2 ? 'strict' : 'basic';
  // migration: closed when crowded/hungry, open otherwise
  civ.policies.migration = civ.econ.livingStandard < 1 || civ.unrest > 0.5 ? 'restricted' : civ.personality.caution > 0.8 ? 'restricted' : 'open';
  // trade policy
  civ.policies.trade = civ.personality.trade > 0.65 ? 'free' : civ.personality.caution > 0.8 ? 'autarky' : 'tariffs';
  civ.policies.conscription = atWar && civ.mobilization > 0.05;
  // automation shock: universal basic income where unemployment is high and welfare exists
  civ.policies.ubi = c.welfare > 0 && c.automation > 0.4 && civ.econ.unemployment > 0.15 && civ.inst.participation > 0.4;
  if (c.ai > 0.5) civ.policies.aiRegulation = civ.inst.liberties > 0.6 ? 'strict' : civ.inst.techGovernance > 0.4 ? 'light' : 'none';
  if (civ.policies.ubi) civ.inst.welfare = clamp01(civ.inst.welfare + 0.02);
}

export type { GovFormKey };
