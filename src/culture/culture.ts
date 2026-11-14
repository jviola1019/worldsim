/**
 * Cultural change (yearly).
 *  - ASSIMILATION: minority cultures within a civ shift toward the state
 *    culture, faster with mass media, schooling and assimilation policy,
 *    slower when the minority is large; cultures can survive conquest.
 *  - DIVERGENCE: a settlement long separated from its culture's political
 *    core (different civ, far away) develops a daughter culture with a
 *    daughter language (sound shifts) — related names, drifting values.
 *  - BLENDING: long coexistence of two large groups can produce a hybrid culture.
 */
import type { Sim } from '../sim/context';
import type { Settlement } from '../sim/types';
import { createCulture, randomValues } from '../civilizations/civ';
import { mixShares } from '../civilizations/settlement';
import { logEvent } from '../history/events';

export function cultureYearly(sim: Sim): void {
  const w = sim.w;
  const rng = sim.rng;
  const alive = new Set<number>();
  for (const s of w.settlements.values()) {
    const civ = w.civs.get(s.civId);
    if (!civ) continue;
    for (const c of s.cultures) alive.add(c.id);
    // assimilation toward the civ's culture
    const own = s.cultures.find((c) => c.id === civ.cultureId)?.f ?? 0;
    if (own < 0.999) {
      const policy = civ.policies.assimilation === 'forced' ? 2 : civ.policies.assimilation === 'encourage' ? 1 : 0.4;
      const rate = 0.004 * policy * (1 + civ.caps.mediaReach * 0.6 + s.education) * (0.4 + own);
      mixShares(s.cultures, civ.cultureId, rate);
      if (civ.policies.assimilation === 'forced') s.unrest = Math.min(1, s.unrest + 0.01 * (1 - own));
    }
    // divergence
    const primary = s.cultures[0];
    const culture = primary ? w.cultures.get(primary.id) : undefined;
    if (culture && primary.f > 0.7 && s.pop > 500 && rng.chance(0.004)) {
      const origin = w.civs.get(culture.originCiv);
      const originCap = origin ? w.settlements.get(origin.capital) : undefined;
      const separated = !origin || !origin.alive || origin.id !== s.civId || (originCap && Math.hypot(originCap.x - s.x, originCap.y - s.y) > 30);
      if (separated && sim.year - culture.founded > 150) diverge(sim, s, culture.id);
    }
    // blending
    if (s.cultures.length >= 2 && s.cultures[1].f > 0.3 && s.pop > 2000 && rng.chance(0.002)) {
      const a = w.cultures.get(s.cultures[0].id);
      const b = w.cultures.get(s.cultures[1].id);
      if (a && b) {
        const v = randomValues(sim, {
          tradition: (a.values.tradition + b.values.tradition) / 2,
          collectivism: (a.values.collectivism + b.values.collectivism) / 2,
          martial: (a.values.martial + b.values.martial) / 2,
          hierarchy: (a.values.hierarchy + b.values.hierarchy) / 2,
          mercantile: (a.values.mercantile + b.values.mercantile) / 2,
          seafaring: (a.values.seafaring + b.values.seafaring) / 2,
          piety: (a.values.piety + b.values.piety) / 2,
          nature: (a.values.nature + b.values.nature) / 2,
        }, 0.1);
        const hybrid = createCulture(sim, { parentId: a.id, languageId: rng.chance(0.5) ? a.languageId : b.languageId, originCiv: s.civId, values: v });
        hybrid.blendOf = [a.id, b.id];
        s.cultures = [{ id: hybrid.id, f: 1 }];
        logEvent(sim, { type: 'culture_blend', cat: 'culture', title: `A new ${hybrid.name} culture blended ${a.name} and ${b.name} traditions in ${s.name}`, civs: [s.civId], settlements: [s.id], x: s.x, y: s.y, importance: 2 });
      }
    }
  }
  for (const c of w.cultures.values()) {
    if (!c.extinct && !alive.has(c.id) && sim.year - c.founded > 20) {
      // cultures of nomadic bands are alive too
      let inBand = false;
      for (const b of w.bands.values()) if (b.cultureId === c.id) inBand = true;
      if (!inBand) c.extinct = sim.year;
    }
  }
}

function diverge(sim: Sim, s: Settlement, parentId: number): void {
  const w = sim.w;
  const parent = w.cultures.get(parentId)!;
  const child = createCulture(sim, { parentId, originCiv: s.civId });
  // neighbours of the same culture in the same civ follow
  for (const o of w.settlements.values()) {
    if (o.civId !== s.civId || o.cultures[0]?.id !== parentId) continue;
    if (Math.hypot(o.x - s.x, o.y - s.y) < 14) o.cultures[0].id = child.id;
  }
  const civ = w.civs.get(s.civId);
  if (civ && civ.cultureId === parentId && civ.settlements.length && civ.capital === s.id) {
    civ.cultureId = child.id;
    civ.languageId = child.languageId;
  }
  logEvent(sim, {
    type: 'culture_diverged',
    cat: 'culture',
    title: `The ${child.name} culture and ${w.languages.get(child.languageId)?.name ?? 'a new'} language emerged from ${parent.name} roots`,
    civs: [s.civId],
    settlements: [s.id],
    x: s.x,
    y: s.y,
    importance: 2,
    causes: [{ label: 'Long separation from the cultural homeland', weight: 1 }],
  });
}
