/**
 * The yearly cycle of a civilization: census, research & adoption, national
 * economy, politics, diplomacy, military, infrastructure, space, expansion
 * and domestication. Order is fixed for determinism.
 */
import { BALANCE } from '../config/balance';
import type { Sim } from './context';
import type { Civ, Settlement } from './types';
import { researchYearly, computeCaps } from '../technology/research';
import { civEconomyYearly } from '../economy/market';
import { politicsYearly } from '../politics/government';
import { diplomacyYearly } from '../politics/diplomacy';
import { militaryYearly } from '../military/war';
import { infrastructureYearly } from '../economy/trade';
import { spaceYearly } from '../future/space';
import { mediaYearly } from '../media/media';
import { ethosYearly } from '../civilizations/ethos';
import { missionsYearly } from '../civilizations/missions';
import { killCiv } from '../civilizations/civ';
import { spawnAgent } from '../population/agents';
import { isKnown } from '../civilizations/knowledge';
import { TERRAIN } from '../world/terrain';
import { Good } from '../world/resources';
import { SPECIES_BY_KEY } from '../ecology/species';
import { clamp } from '../core/math';
import { removePeople } from '../population/demography';
import { logEvent } from '../history/events';
import { absorptionCandidate, addPressure, decayPressure, ENDINGS, inferEnding } from '../civilizations/endings';
import { risksYearly } from '../future/risks';
import { sclerosisYearly } from '../technology/overtaking';
import { transferSettlement } from '../civilizations/settlement';
import { inAnyWar } from '../politics/diplomacy';
import { emptyLedger } from '../population/ledger';

export function civYearly(sim: Sim, civ: Civ): void {
  const w = sim.w;
  if (!civ.alive) return;
  civ.lastYearly = sim.year;
  // census
  let pop = 0;
  let territory = 0;
  for (const id of civ.settlements) {
    const s = w.settlements.get(id);
    if (!s) continue;
    pop += s.pop;
    territory += s.territory;
  }
  for (const id of civ.bands) pop += w.bands.get(id)?.members.length ?? 0;
  for (const id of civ.space.colonies) pop += w.colonies.get(id)?.pop ?? 0;
  civ.prev = { pop: civ.population, gdp: civ.econ.gdp, territory: civ.territory };
  civ.population = pop;
  civ.territory = territory;
  civ.peakPop = Math.max(civ.peakPop, pop);
  vitalPressure(sim, civ);
  if (pop < 1 && civ.settlements.length === 0 && civ.bands.length === 0 && civ.space.colonies.length === 0) {
    // the ending is the dominant recent cause of death (typed existential pressure)
    const e = inferEnding(civ);
    killCiv(sim, civ, civ.peakPop > 0 ? `Its last people died out (${ENDINGS[e.type].label.toLowerCase()})` : 'Vanished', undefined, e);
    return;
  }
  decayPressure(civ);
  if (civ.capital && !w.settlements.get(civ.capital)) civ.capital = civ.settlements[0] ?? 0;
  if (civ.capital) {
    const c = w.settlements.get(civ.capital);
    if (c) c.capital = true;
  }
  ethosYearly(sim, civ);
  missionsYearly(sim, civ);
  researchYearly(sim, civ);
  civEconomyYearly(sim, civ, civ.tradeExp ?? 0, civ.tradeImp ?? 0);
  politicsYearly(sim, civ);
  exploreYearly(sim, civ);
  if (!civ.alive) return;
  diplomacyYearly(sim, civ);
  militaryYearly(sim, civ);
  if (!civ.alive) return;
  infrastructureYearly(sim, civ);
  spaceYearly(sim, civ);
  mediaYearly(sim, civ);
  risksYearly(sim, civ);
  if (!civ.alive) return;
  sclerosisYearly(sim, civ);
  if (tryAbsorption(sim, civ, 0.02)) return;
  domestication(sim, civ);
  expansion(sim, civ);
  computeCaps(civ);
}

function domestication(sim: Sim, civ: Civ): void {
  if (civ.caps.herding <= 0) return;
  const w = sim.w;
  for (const h of w.herds.values()) {
    const sp = SPECIES_BY_KEY[h.species];
    if (!sp?.domesticable || h.owner === civ.id) {
      if (h.owner === civ.id && h.species === 'horse') civ.stock[Good.HORSES] += h.count * 0.15;
      continue;
    }
    if (h.owner) continue;
    const i = w.map.idx(Math.floor(h.x), Math.floor(h.y));
    if (w.map.owner[i] !== civ.id) continue;
    h.owner = civ.id;
    const key = `domesticated:${civ.id}:${h.species}`;
    if (!w.milestones[key]) {
      w.milestones[key] = sim.year;
      logEvent(sim, { type: 'domestication', cat: 'nature', title: `${civ.name} domesticated the ${sp.name.toLowerCase()}`, civs: [civ.id], x: Math.floor(h.x), y: Math.floor(h.y), importance: h.species === 'horse' ? 2 : 1 });
    }
  }
}

function siteScore(sim: Sim, civ: Civ, i: number): number {
  const m = sim.w.map;
  const def = TERRAIN[m.terrain[i]];
  if (def.water || !def.buildable) return -1;
  if (m.settle[i] || (m.owner[i] && m.owner[i] !== civ.id)) return -1;
  if (!isKnown(sim, civ.id, i)) return -1;
  const x = m.xOf(i);
  const y = m.yOf(i);
  for (const s of sim.w.settlements.values()) if ((s.x - x) ** 2 + (s.y - y) ** 2 < 30) return -1;
  let score = def.habitability + m.fert[i] / 255;
  // most towns in history grew on rivers, lakes and coasts
  if (m.hasFreshWater(i)) score += 1.2;
  if (m.isCoastal(i)) score += 0.5 * (0.6 + civ.personality.trade);
  let deposits = 0;
  m.forRadius(x, y, 3, (j) => {
    if (m.dep[j]) deposits++;
  });
  score += Math.min(0.5, deposits * 0.1);
  return score;
}

function expansion(sim: Sim, civ: Civ): void {
  const w = sim.w;
  const rng = sim.rng;
  const m = w.map;
  const limit = 3 + Math.floor(civ.caps.adminCapacity * 4 + civ.caps.communication * 1.5 + civ.caps.roadTier);
  if (civ.settlements.length >= limit + (civ.era <= 2 ? 2 : 0)) return;
  let inFlight = 0;
  for (const a of w.agents.values()) if (a.civId === civ.id && (a.kind === 'settler' || a.kind === 'colonist')) inFlight++;
  if (inFlight >= 2) return;
  const candidates: Settlement[] = [];
  for (const id of civ.settlements) {
    const s = w.settlements.get(id);
    if (!s || s.occupiedBy) continue;
    const crowded = s.pop > Math.max(60, s.housing * 0.85);
    if (crowded || (s.pop > 140 && rng.chance(civ.personality.expansion * 0.35))) candidates.push(s);
  }
  if (!candidates.length) return;
  const s = rng.pick(candidates);
  const naval = civ.caps.navalTier >= 3;
  let best = -1;
  let bestScore = 0;
  for (let k = 0; k < 40; k++) {
    const r = rng.range(5, naval && rng.chance(0.3) ? 40 : 18);
    const a = rng.range(0, Math.PI * 2);
    const x = clamp(Math.round(s.x + Math.cos(a) * r), 1, m.w - 2);
    const y = clamp(Math.round(s.y + Math.sin(a) * r), 1, m.h - 2);
    const i = m.idx(x, y);
    const sc = siteScore(sim, civ, i) - r * 0.015;
    if (sc > bestScore) {
      bestScore = sc;
      best = i;
    }
  }
  if (best < 0 || bestScore < 0.6) return;
  const pop = clamp(s.pop * 0.08, 12, 3000);
  const opts = { pop, cultureId: s.cultures[0]?.id ?? civ.cultureId, religionId: s.religions[0]?.id ?? 0, species: s.species, from: s.id };
  let agent = spawnAgent(sim, 'settler', civ.id, s.x, s.y, m.xOf(best), m.yOf(best), opts);
  if (!agent && naval && s.coastal && m.isCoastal(best)) agent = spawnAgent(sim, 'colonist', civ.id, s.x, s.y, m.xOf(best), m.yOf(best), { ...opts, sea: true });
  if (agent) {
    const removed = removePeople(sim, s, pop, 'emigration');
    s.flows.emigration += removed;
    agent.pop = removed;
  }
}

/**
 * Births far below natural deaths for years add demographic-collapse pressure (or infertility
 * pressure where a sterilizing pathogen has struck).
 */
function vitalPressure(sim: Sim, civ: Civ): void {
  const L = civ.ledger ?? emptyLedger();
  const mark = civ.vitalMark;
  civ.vitalMark = { births: L.births, deaths: L.deaths };
  if (!mark) return;
  const b = L.births - mark.births;
  const d = L.deaths - mark.deaths;
  if (!(d > 5) || b >= 0.75 * d) return;
  let pop = 0;
  let sterile = 0;
  for (const id of civ.settlements) {
    const s = sim.w.settlements.get(id);
    if (!s) continue;
    pop += s.pop;
    sterile += (s.sterility ?? 0) * s.pop;
  }
  const st = pop > 0 ? sterile / pop : 0;
  if (st > 0.15) addPressure(sim, civ.id, 'infertility', d - b, `${Math.round(st * 100)}% of adults left sterile`);
  else addPressure(sim, civ.id, 'demographic_collapse', d - b, `Births only ${Math.round((b / d) * 100)}% of deaths`);
}

/**
 * Peaceful absorption of a small state into a much larger neighbour that shares its culture (or, for a
 * state shrunk by demographic collapse, any friendly larger neighbour). Returns true if it happened.
 */
export function tryAbsorption(sim: Sim, civ: Civ, chance: number): boolean {
  if (!civ.alive || civ.settlements.length === 0 || civ.settlements.length > 3) return false;
  if (inAnyWar(sim, civ.id)) return false;
  const c = absorptionCandidate(sim, civ);
  if (!c || inAnyWar(sim, c.by.id) || !sim.rng.chance(chance)) return false;
  for (const id of [...civ.settlements]) {
    const s = sim.w.settlements.get(id);
    if (s) transferSettlement(sim, s, c.by, c.type === 'assimilation' ? 'Peaceful union with a kindred people' : 'Absorbed after demographic decline', true);
  }
  logEvent(sim, {
    type: c.type === 'assimilation' ? 'assimilation' : 'demographic_absorption', cat: 'culture',
    title: c.type === 'assimilation' ? `${civ.name} merged peacefully into ${c.by.name}, whose culture its people already shared` : `Dwindling ${civ.name} was absorbed by ${c.by.name}`,
    civs: [civ.id, c.by.id], importance: 3, causes: c.causes,
  });
  killCiv(sim, civ, c.type === 'assimilation' ? `Absorbed by ${c.by.name}` : `Absorbed by ${c.by.name} after demographic collapse`, c.by, { type: c.type, causes: c.causes });
  return true;
}

/**
 * Round 10 (mode audit): seafaring nations send explorers. The explorer agent reveals the land it passes and
 * makes first contact (population/agents.ts), but nothing launched one, so peoples across water never met.
 * A nation that can sail (naval tier ≥ 2) and has a coastal town sends at most one voyage at a time, toward
 * a coast it has not charted, 20–60 tiles away.
 */
function exploreYearly(sim: Sim, civ: Civ): void {
  const w = sim.w;
  const m = w.map;
  const rng = sim.rng;
  if (civ.caps.navalTier < 2) return;
  if (!rng.chance(BALANCE.explorerChance)) return;
  for (const a of w.agents.values()) if (a.civId === civ.id && a.kind === 'explorer') return;
  const ports = civ.settlements.map((id) => w.settlements.get(id)).filter((s): s is NonNullable<typeof s> => !!s && s.coastal && !s.occupiedBy);
  if (!ports.length) return;
  const s = rng.pick(ports);
  for (let k = 0; k < 24; k++) {
    const r = rng.range(20, 60);
    const ang = rng.range(0, Math.PI * 2);
    const x = clamp(Math.round(s.x + Math.cos(ang) * r), 1, m.w - 2);
    const y = clamp(Math.round(s.y + Math.sin(ang) * r), 1, m.h - 2);
    const i = m.idx(x, y);
    if (!m.isLand(i) || !m.isCoastal(i) || isKnown(sim, civ.id, i)) continue;
    if (spawnAgent(sim, 'explorer', civ.id, s.x, s.y, x, y, { sea: true, from: s.id })) return;
  }
}
