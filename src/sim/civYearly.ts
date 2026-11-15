/**
 * The yearly cycle of a civilization: census, research & adoption, national
 * economy, politics, diplomacy, military, infrastructure, space, expansion
 * and domestication. Order is fixed for determinism.
 */
import type { Sim } from './context';
import type { Civ, Settlement } from './types';
import { researchYearly, computeCaps } from '../technology/research';
import { civEconomyYearly } from '../economy/market';
import { politicsYearly } from '../politics/government';
import { diplomacyYearly } from '../politics/diplomacy';
import { militaryYearly } from '../military/war';
import { infrastructureYearly } from '../economy/trade';
import { spaceYearly } from '../future/space';
import { killCiv } from '../civilizations/civ';
import { spawnAgent } from '../population/agents';
import { isKnown } from '../civilizations/knowledge';
import { TERRAIN } from '../world/terrain';
import { Good } from '../world/resources';
import { SPECIES_BY_KEY } from '../ecology/species';
import { clamp } from '../core/math';
import { removePeople } from '../population/demography';
import { logEvent } from '../history/events';

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
  if (pop < 1 && civ.settlements.length === 0 && civ.bands.length === 0 && civ.space.colonies.length === 0) {
    killCiv(sim, civ, civ.peakPop > 0 ? 'Its last people died out or dispersed' : 'Vanished');
    return;
  }
  if (civ.capital && !w.settlements.get(civ.capital)) civ.capital = civ.settlements[0] ?? 0;
  if (civ.capital) {
    const c = w.settlements.get(civ.capital);
    if (c) c.capital = true;
  }
  researchYearly(sim, civ);
  civEconomyYearly(sim, civ, civ.tradeExp ?? 0, civ.tradeImp ?? 0);
  politicsYearly(sim, civ);
  if (!civ.alive) return;
  diplomacyYearly(sim, civ);
  militaryYearly(sim, civ);
  infrastructureYearly(sim, civ);
  spaceYearly(sim, civ);
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
  if (m.hasFreshWater(i)) score += 0.5;
  if (m.isCoastal(i)) score += 0.25 * (1 + civ.personality.trade);
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
