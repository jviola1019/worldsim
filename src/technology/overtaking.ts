/**
 * Technological overtaking.
 *
 * Leaders can stagnate and laggards can catch up, so the lead changes hands across histories:
 *  - INSTITUTIONAL SCLEROSIS (Olson, The Rise and Decline of Nations; direction evidence-informed,
 *    magnitudes stylized): a long-lived regime with weak political competition, entrenched hereditary
 *    elites, corruption and the complacency of leadership slows research and adoption by up to 35%
 *    (technology/research.ts). Revolutions, coups and crises reset it.
 *  - LEAPFROGGING (technology/research.ts `leapfrogGap`): latecomers copy a contact's newer
 *    infrastructure technology and skip one generation (e.g. straight to mobile telephony or solar).
 * The world's technology leader and every change of lead are recorded in `WorldState.endings.techLead`.
 */
import type { Sim } from '../sim/context';
import type { Civ } from '../sim/types';
import { clamp01, saturate } from '../core/math';
import { worldEndings } from '../civilizations/endings';
import { logEvent } from '../history/events';

/** Yearly sclerosis update for one civ (called from the civ's yearly cycle). */
export function sclerosisYearly(sim: Sim, civ: Civ): void {
  const i = civ.inst;
  const leader = sim.w.endings?.techLead.civ === civ.id;
  const entrenched = saturate(civ.regimeAge, 80) * (1 - i.competition * 0.7);
  const target = clamp01(entrenched * 0.6 + civ.corruption * 0.4 + i.hereditary * 0.1 + (leader ? 0.15 : 0) - civ.unrest * 0.2 - (civ.crisis > 0 ? 0.1 : 0));
  let s = civ.sclerosis ?? 0;
  if (civ.regimeAge < 2) s *= 0.5; // a new order sweeps away old interests
  s += (target - s) * 0.05;
  civ.sclerosis = s < 1e-4 ? 0 : s;
}

/** Yearly (world): who leads in technology; a change needs a 3% margin to avoid flicker. */
export function techLeadYearly(sim: Sim): void {
  const e = worldEndings(sim);
  const lead = e.techLead;
  let best: Civ | undefined;
  for (const c of sim.w.civs.values()) if (c.alive && c.settlements.length && (!best || c.techScore > best.techScore)) best = c;
  if (!best || best.techScore <= 0) return;
  const cur = sim.w.civs.get(lead.civ);
  if (cur && cur.alive && cur.id !== best.id && best.techScore < cur.techScore * 1.03) return;
  if (best.id === lead.civ) return;
  const prev = cur;
  lead.civ = best.id;
  lead.since = sim.year;
  if (prev) {
    lead.changes++;
    logEvent(sim, {
      type: 'tech_lead', cat: 'technology',
      title: `${best.name} overtook ${prev.name} as the world's technological leader`,
      civs: [best.id, prev.id], importance: 3,
      causes: [
        ...(prev.alive ? [] : [{ label: `${prev.name} fell`, weight: 0.6 }]),
        ...((prev.sclerosis ?? 0) > 0.25 ? [{ label: `Institutional sclerosis in ${prev.name} (${Math.round((prev.sclerosis ?? 0) * 100)}%)`, weight: prev.sclerosis ?? 0 }] : []),
        { label: `Research output ${Math.round(best.researchRate)} vs ${Math.round(prev.researchRate)} a year`, weight: 0.4 },
      ],
    });
  }
  lead.history.push(sim.year, best.id);
  if (lead.history.length > 400) lead.history.splice(0, lead.history.length - 400);
}
