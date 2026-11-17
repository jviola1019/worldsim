/**
 * Abstract public-health model.
 *
 * Pathogens EMERGE with a probability that rises with population density,
 * livestock contact (zoonosis) and poor sanitation; they SPREAD between
 * settlements along trade/road links, with migrants and with armies; within a
 * settlement they follow SIR dynamics (Kermack–McKendrick) with an effective
 * reproduction rate scaled by density, sanitation, medicine and quarantine
 * policy. Recovered people are immune for a while. No real pathogen biology is
 * modelled — parameters are abstract (r0, lethality, duration, immunity).
 */
import { flow } from './ledger';
import { onEpidemicSurvived } from './development';
import type { Sim } from '../sim/context';
import type { Civ, Disease, Settlement } from '../sim/types';
import { BALANCE } from '../config/balance';
import { clamp, clamp01 } from '../core/math';
import { removePeople } from './demography';
import { logEvent } from '../history/events';
import { makeName } from '../culture/language';
import { phonOfCulture } from './persons';
import { B } from '../civilizations/buildingTypes';

const NAMES = ['Fever', 'Pox', 'Plague', 'Cough', 'Flux', 'Sweating Sickness', 'Blight', 'Ague', 'Wasting'];

function emerge(sim: Sim, s: Settlement, civ: Civ): Disease {
  const w = sim.w;
  const rng = sim.rng;
  const phon = phonOfCulture(sim, s.cultures[0]?.id ?? civ.cultureId);
  const d: Disease = {
    id: ++w.ids.disease,
    name: `${phon ? makeName(rng, phon, 'word') : 'Red'} ${rng.pick(NAMES)}`,
    r0: rng.range(1.4, 4.5),
    lethality: rng.chance(0.15) ? rng.range(0.15, 0.4) : rng.range(0.01, 0.12),
    duration: rng.range(0.5, 2),
    immunity: rng.chance(0.6) ? 1200 : rng.int(24, 240),
    origin: s.id,
    emerged: sim.year,
    zoonotic: s.bld[B.PASTURE] > 0 && rng.chance(0.6),
    totalDeaths: 0,
  };
  w.diseases.set(d.id, d);
  return d;
}

export function infect(sim: Sim, s: Settlement, d: Disease, fraction: number): void {
  if (s.epidemics.some((e) => e.diseaseId === d.id)) return;
  const immune = clamp01(s.immunity[d.id] ?? 0);
  s.epidemics.push({ diseaseId: d.id, s: 1 - immune - fraction, i: fraction, r: immune, deaths: 0 });
}

export function diseaseMonthly(sim: Sim, s: Settlement, civ: Civ): void {
  const w = sim.w;
  if (!w.laws.diseases || s.pop < 30) return;
  const rng = sim.rng;
  const caps = civ.caps;
  // emergence
  const density = Math.log10(Math.max(10, s.pop)) - 1; // ~0.5 villages .. 5 megacities
  const livestock = 1 + (s.bld[B.PASTURE] > 0 ? 0.8 : 0);
  const sanitation = clamp01(caps.sanitation);
  const pEmerge = (BALANCE.pathogenEmergence / 12) * density * livestock * (1.3 - sanitation) * (1 + s.links.length * 0.1);
  if (rng.float() < pEmerge) {
    const d = emerge(sim, s, civ);
    infect(sim, s, d, 0.002);
  }
  if (!s.epidemics.length) {
    // immunity wanes
    for (const k in s.immunity) {
      s.immunity[k] *= 0.995;
      if (s.immunity[k] < 0.02) delete s.immunity[k];
    }
    return;
  }
  const control = clamp01(caps.diseaseControl);
  const quarantine = civ.caps.healthcare > 0.3 ? 0.15 : 0;
  for (const e of s.epidemics) {
    const d = w.diseases.get(e.diseaseId);
    if (!d) continue;
    const gamma = 1 / Math.max(0.3, d.duration); // recoveries per month
    const crowd = clamp(0.55 + density * 0.18, 0.5, 1.5);
    const beta = d.r0 * gamma * crowd * (1 - sanitation * 0.45) * (1 - control * 0.6) * (1 - quarantine);
    const newInf = Math.min(e.s, beta * e.s * e.i);
    const rec = gamma * e.i;
    const lethal = d.lethality * (1 - control * 0.85) * (1 - clamp01(caps.healthcare) * 0.4);
    const dead = rec * lethal;
    e.s -= newInf;
    e.i += newInf - rec;
    e.r += rec - dead;
    const deaths = dead * s.pop;
    if (deaths > 0.01) {
      const removed = removePeople(sim, s, deaths, d.name.toLowerCase());
      e.deaths += removed;
      d.totalDeaths += removed;
      flow(sim, s, 'disease', removed);
    }
    // export infection to linked settlements
    if (e.i > 0.01) {
      for (const lid of s.links) {
        const o = w.settlements.get(lid);
        if (o && rng.chance(e.i * 0.4 * (1 - control * 0.5))) infect(sim, o, d, 0.001);
      }
    }
  }
  // finished epidemics leave immunity behind and are recorded if deadly
  s.epidemics = s.epidemics.filter((e) => {
    if (e.i > 0.0005) return true;
    const d = w.diseases.get(e.diseaseId);
    s.immunity[e.diseaseId] = Math.max(s.immunity[e.diseaseId] ?? 0, e.r);
    if (d && e.deaths > Math.max(20, s.pop * 0.03)) onEpidemicSurvived(sim, s.id, d.name);
    if (d && e.deaths > Math.max(20, s.pop * 0.03))
      logEvent(sim, {
        type: 'epidemic',
        cat: 'demography',
        title: `The ${d.name} killed ${Math.round(e.deaths).toLocaleString('en-US')} in ${s.name}`,
        civs: [civ.id],
        settlements: [s.id],
        x: s.x,
        y: s.y,
        importance: e.deaths > 5000 ? 3 : 2,
        causes: [
          { label: `Population density (${Math.round(s.pop).toLocaleString('en-US')} people)`, weight: density },
          { label: 'Limited sanitation', weight: 1 - sanitation },
          { label: 'Limited medicine', weight: 1 - control },
          ...(d.zoonotic ? [{ label: 'Spillover from livestock', weight: 0.4 }] : []),
        ],
      });
    return false;
  });
}

/** Total share of a settlement currently infected (for UI/overlays). */
export function infectedShare(s: Settlement): number {
  return s.epidemics.reduce((a, e) => a + e.i, 0);
}
