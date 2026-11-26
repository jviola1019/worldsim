/**
 * Round 10 second addendum: world pandemics (design §6.2, research-notes §5).
 *
 * Local outbreaks emerge town by town (`disease.ts`). On top of that, once a year a novel pathogen may
 * spread worldwide. The yearly chance rises from the pre-industrial rate (a few world pandemics in two
 * millennia: Antonine, Justinian, Black Death, early influenza) to the modern rate (1918, 1957, 1968,
 * 2009, COVID-19: about 4-5 a century) with `connectivity`: the share of settlements that are linked,
 * times an era factor for rail, steamships and flight.
 *
 * Severity is heavy-tailed: the intended world death share follows a Pareto tail with the exponent Marani
 * et al. (2021) fitted to epidemic intensity, scaled so `pandemicSevereShare` of draws are 1918-scale
 * (at least 1% of the world). The historical figures are realised ones: R estimated during each pandemic
 * and deaths under the medicine of its day. So the drawn R and share describe the pandemic in the world's
 * average town as it is: the pathogen's base r0 and lethality are divided by the population-weighted mean
 * of each town's protection (`transmissionFactor`, `lethalityFactor`). Better-protected nations still fare
 * better than the average and worse-protected ones worse; a world that only partly links up sees less.
 * The pathogen seeds the best-linked settlement and spreads through the existing local model, crossing links
 * `pandemicLinkSpread` times as readily as a local outbreak.
 */
import type { Sim } from '../sim/context';
import type { Disease, Settlement } from '../sim/types';
import type { Rng } from '../core/rng';
import { BALANCE } from '../config/balance';
import { clamp } from '../core/math';
import { emergeNovel, infect, transmissionFactor, lethalityFactor } from './disease';
import { logEvent } from '../history/events';
import { emitFx, STATE_FX } from '../sim/conceptFx';

/** Smallest town the local model runs in (`diseaseMonthly` skips smaller ones). */
const MIN_POP = 30;
/** A pandemic is "severe" (1918-scale) at this world death share. */
const SEVERE = 0.01;
/** Largest intended world share (the Black Death's best estimate is about 10% of the world, the highest about 44%). */
const MAX_SHARE = 0.3;
/** Highest base lethality after dividing by the world's protection (a Black Death-scale draw cannot be met in a modern world). */
const MAX_LETHALITY = 0.9;
/** A pandemic still active after this many years is closed (guards against a stalled count). */
const MAX_YEARS = 20;

export interface Severity { r0: number; lethality: number; targetShare: number }

/** Share of settlements with at least one link, times an era factor (rail, steamships, flight). 0 with one settlement or none. */
export function connectivity(sim: Sim): number {
  const w = sim.w;
  if (w.settlements.size <= 1) return 0;
  let lead = 0;
  for (const c of w.civs.values()) if (c.alive) lead = Math.max(lead, c.era);
  const eraFactor = clamp((lead - 6) / 4, 0, 1);
  if (eraFactor === 0) return 0;
  let linked = 0;
  for (const s of w.settlements.values()) if (s.links.length) linked++;
  return (linked / w.settlements.size) * eraFactor;
}

/** Yearly chance of a world pandemic. */
export function pandemicChance(sim: Sim): number {
  return BALANCE.pandemicPreIndustrial + (BALANCE.pandemicModern - BALANCE.pandemicPreIndustrial) * connectivity(sim);
}

/** Final size of an SIR epidemic (share ever infected) for reproduction number r0: z = 1 - exp(-r0 z). */
export function finalSize(r0: number): number {
  if (r0 <= 1) return 0;
  let z = 0.9;
  for (let k = 0; k < 60; k++) z = 1 - Math.exp(-r0 * z);
  return z;
}

/**
 * Heavy-tailed severity. P(targetShare >= x) = (floor / x)^a for x >= floor, with a = pandemicTailExponent and
 * floor chosen so P(targetShare >= 1%) = pandemicSevereShare. r0 is drawn in 1.4-3 (2009 H1N1 1.46 to
 * COVID-19 2.69), and lethality is set so an unprotected reference town loses targetShare (attack rate x lethality).
 */
export function drawSeverity(rng: Rng): Severity {
  const a = BALANCE.pandemicTailExponent;
  const floor = SEVERE * BALANCE.pandemicSevereShare ** (1 / a);
  const u = 1 - rng.float(); // (0, 1]
  const targetShare = Math.min(MAX_SHARE, floor * u ** (-1 / a));
  const r0 = rng.range(1.4, 3);
  const lethality = Math.min(1, targetShare / finalSize(r0));
  return { r0, lethality, targetShare };
}

function worldPopulation(sim: Sim): number {
  let n = 0;
  for (const s of sim.w.settlements.values()) n += s.pop;
  for (const b of sim.w.bands.values()) n += b.members.length;
  return n;
}

/** Population-weighted mean protection of the world's towns: what they leave of transmission and of lethality. */
export function worldProtection(sim: Sim): { trans: number; leth: number } {
  let n = 0, trans = 0, leth = 0;
  for (const s of sim.w.settlements.values()) {
    const civ = sim.w.civs.get(s.civId);
    if (s.pop < MIN_POP || !civ) continue;
    n += s.pop;
    trans += s.pop * transmissionFactor(s, civ);
    leth += s.pop * lethalityFactor(civ);
  }
  return n > 0 ? { trans: trans / n, leth: leth / n } : { trans: 1, leth: 1 };
}

/** Start a world pandemic in the best-linked settlement (then the largest). Returns undefined when no town can host it. */
export function startPandemic(sim: Sim, sev: Severity): Disease | undefined {
  const w = sim.w;
  let best: Settlement | undefined;
  for (const s of w.settlements.values()) {
    if (s.pop < MIN_POP || !w.civs.get(s.civId)) continue;
    if (!best || s.links.length > best.links.length || (s.links.length === best.links.length && s.pop > best.pop)) best = s;
  }
  if (!best) return undefined;
  const prot = worldProtection(sim);
  const d = emergeNovel(sim, best, w.civs.get(best.civId)!, {
    r0: sev.r0 / Math.max(0.05, prot.trans),
    lethality: Math.min(MAX_LETHALITY, sev.lethality / Math.max(0.05, prot.leth)),
    pandemic: true, worldPop: worldPopulation(sim), targetShare: sev.targetShare,
  });
  infect(sim, best, d, 0.002);
  return d;
}

const pct = (share: number) => `${(share * 100).toFixed(share >= 0.01 ? 1 : share >= 0.001 ? 2 : 3)}%`;

/** Close pandemics no longer active anywhere, logging one summary event each. */
export function closePandemics(sim: Sim): void {
  const w = sim.w;
  for (const d of w.diseases.values()) {
    if (!d.pandemic || d.ended !== undefined) continue;
    let active = false;
    for (const s of w.settlements.values()) if (s.pop >= MIN_POP && s.epidemics.some((e) => e.diseaseId === d.id)) { active = true; break; }
    if (active && sim.year - d.emerged < MAX_YEARS) continue;
    d.ended = sim.year;
    if (d.totalDeaths < 20) continue; // it never took hold: no world event
    const reached = [...w.settlements.values()].filter((s) => s.immunity[d.id] !== undefined || s.epidemics.some((e) => e.diseaseId === d.id));
    const civs = [...new Set(reached.map((s) => s.civId))];
    const share = d.totalDeaths / Math.max(1, d.worldPop ?? worldPopulation(sim));
    const origin = w.settlements.get(d.origin);
    logEvent(sim, {
      type: 'pandemic',
      cat: 'demography',
      title: `The ${d.name} pandemic killed ${Math.round(d.totalDeaths).toLocaleString('en-US')} people, ${pct(share)} of the world`,
      text: `It spread from ${origin?.name ?? 'a distant town'} in ${d.emerged} to ${reached.length} settlement${reached.length === 1 ? '' : 's'} in ${civs.length} nation${civs.length === 1 ? '' : 's'}.`,
      civs,
      settlements: origin ? [origin.id] : [],
      x: origin?.x ?? -1,
      y: origin?.y ?? -1,
      importance: share >= SEVERE ? 5 : share >= 0.001 ? 4 : 3,
      causes: [
        { label: 'A novel pathogen no one was immune to', weight: 1 },
        { label: 'Trade and travel links between towns', weight: 0.3 + connectivity(sim) },
      ],
    });
    // visual only: the sickness pall over every town it reached (the event's own pall covers the origin)
    for (const s of reached) emitFx(sim, STATE_FX.pandemicTown, s.x, s.y);
  }
}

/** Global yearly system (simulation day 0): close finished pandemics, then draw a new one. */
export function pandemicYearly(sim: Sim): void {
  if (!sim.w.laws.diseases) return;
  closePandemics(sim);
  if (!sim.w.settlements.size) return;
  if (sim.rng.float() < pandemicChance(sim)) startPandemic(sim, drawSeverity(sim.rng));
}
