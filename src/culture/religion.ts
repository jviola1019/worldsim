/**
 * Religion as a dynamic social institution.
 *
 * EMERGENCE: settled societies with ritual traditions can produce a founder
 * (prophet) — more likely under social stress (famine, epidemics, unrest) and
 * where existing faith is weak — creating a fictional religion with a deity,
 * doctrines and a template-generated origin myth. Doctrines have concrete
 * effects (missionary zeal, tolerance, pro-learning, sacred kingship...).
 * SPREAD: settlement belief shares drift through contact with linked
 * settlements, missionaries, temples and state promotion; minorities persist
 * under tolerance. SECULARIZATION: rising education and security grow the
 * non-religious share (modulated by doctrine and state authority).
 * SCHISM/REFORM: large faiths spread over many civs with low cohesion split
 * into denominations; long coexistence under tolerance can create syncretic faiths.
 * Religions survive the civilizations that founded them.
 */
import type { Sim } from '../sim/context';
import type { Civ, Religion, Settlement } from '../sim/types';
import { clamp01 } from '../core/math';
import { makeName, religionName } from './language';
import { phonOfCulture, createPerson } from '../population/persons';
import { logEvent } from '../history/events';
import { CIV_COLORS } from '../civilizations/civ';
import { HAZARD } from '../world/tilemap';
import { B } from '../civilizations/buildingTypes';

export const DOCTRINES: Record<string, { name: string; desc: string }> = {
  proselytizing: { name: 'Proselytizing', desc: 'Followers actively seek converts; spreads faster.' },
  tolerance: { name: 'Tolerance', desc: 'Accepts other faiths; less religious unrest.' },
  orthodoxy: { name: 'Strict orthodoxy', desc: 'Resists change and innovation; high cohesion.' },
  scholarship: { name: 'Sacred scholarship', desc: 'Values learning; boosts education and research.' },
  charity: { name: 'Charity', desc: 'Aid to the poor; reduces unrest in hard times.' },
  sacred_kingship: { name: 'Sacred kingship', desc: 'Rulers are divinely sanctioned; raises legitimacy of hereditary rule.' },
  pacifism: { name: 'Pacifism', desc: 'Condemns violence; lowers willingness to wage war.' },
  holy_struggle: { name: 'Holy struggle', desc: 'Faith may justify conflict with unbelievers.' },
  asceticism: { name: 'Asceticism', desc: 'Simplicity and self-denial; lower consumption.' },
  nature_reverence: { name: 'Nature reverence', desc: 'Sacred groves and rivers; resists deforestation and pollution.' },
  pilgrimage: { name: 'Pilgrimage', desc: 'Journeys to the holy site spread faith along routes.' },
  fecundity: { name: 'Fecundity', desc: 'Large families are blessed.' },
  monasticism: { name: 'Monastic orders', desc: 'Monasteries preserve knowledge through dark times.' },
  egalitarian: { name: 'Equality of believers', desc: 'Challenges rigid hierarchies.' },
};
const KINDS = ['animism', 'ancestor', 'polytheism', 'monotheism', 'dualism', 'philosophy', 'mystery'];
const MYTH_OPENINGS = [
  (d: string) => `In the beginning there was only silence, until ${d} sang the first word and the world took shape.`,
  (d: string) => `${d} shaped the land from the bones of an ancient serpent and breathed life into clay.`,
  (d: string) => `The ancestors climbed from the deep waters, guided by the light of ${d}.`,
  (d: string) => `${d} and the Shadow wrestled for an age; from their struggle came mountains, seas and people.`,
  (d: string) => `The world is a dream of ${d}, who will wake when all souls have found harmony.`,
];
const MYTH_TEACHINGS = [
  'The faithful must honor the harvest and share it with strangers.',
  'Every river is a path of the spirits and must be kept pure.',
  'Rulers hold power only while they keep the sacred balance.',
  'Knowledge is a lamp given to mortals; to hide it is a sin.',
  'Courage in the face of chaos is the highest virtue.',
  'The humble shall inherit the light at the end of days.',
];

export function foundReligion(sim: Sim, s: Settlement, civ: Civ, founderId = 0, parent?: Religion): Religion {
  const w = sim.w;
  const rng = sim.rng;
  const phon = phonOfCulture(sim, s.cultures[0]?.id ?? civ.cultureId)!;
  const deity = parent && rng.chance(0.6) ? parent.deity : makeName(rng, phon, 'deity');
  const doctrines: string[] = parent ? [...parent.doctrines] : [];
  const keys = Object.keys(DOCTRINES);
  if (parent) {
    // reform: replace one or two doctrines
    for (let k = 0; k < rng.int(1, 2); k++) {
      if (doctrines.length) doctrines.splice(rng.int(0, doctrines.length - 1), 1);
      const nd = rng.pick(keys);
      if (!doctrines.includes(nd)) doctrines.push(nd);
    }
  } else while (doctrines.length < 3) {
    const nd = rng.pick(keys);
    if (!doctrines.includes(nd) && !(nd === 'pacifism' && doctrines.includes('holy_struggle')) && !(nd === 'holy_struggle' && doctrines.includes('pacifism')) && !(nd === 'tolerance' && doctrines.includes('orthodoxy'))) doctrines.push(nd);
  }
  let founder = founderId;
  if (!founder) {
    const p = createPerson(sim, { born: sim.year - rng.int(25, 50), species: s.species, civId: civ.id, settlementId: s.id, cultureId: s.cultures[0]?.id ?? civ.cultureId, religionId: 0, role: 'prophet', notable: true });
    p.titles.push('Prophet');
    founder = p.id;
  }
  const r: Religion = {
    id: ++w.ids.religion,
    name: '',
    founded: sim.year,
    founderId: founder,
    originSettlement: s.id,
    originCiv: civ.id,
    holySite: w.map.idx(s.x, s.y),
    parentId: parent?.id ?? 0,
    kind: parent ? parent.kind : rng.pick(KINDS),
    deity,
    doctrines,
    myth: `${rng.pick(MYTH_OPENINGS)(deity)} ${rng.pick(MYTH_TEACHINGS)}`,
    color: CIV_COLORS[rng.int(0, CIV_COLORS.length - 1)],
    symbol: rng.int(0, 11),
    cohesion: 0.8,
    headId: founder,
    adherents: 0,
  };
  r.name = parent ? `Reformed ${parent.name.replace(/^Reformed /, '')}` : religionName(rng, phon, deity);
  if (parent && rng.chance(0.5)) r.name = `${makeName(rng, phon, 'word')} ${parent.name.replace(/^(The |Reformed )/, '')}`;
  w.religions.set(r.id, r);
  w.map.hazard[r.holySite] |= HAZARD.SACRED;
  const fp = w.persons.get(founder);
  if (fp) fp.religionId = r.id;
  return r;
}

function share(s: Settlement, id: number): number {
  return s.religions.find((r) => r.id === id)?.f ?? 0;
}

function shift(s: Settlement, id: number, amount: number): void {
  if (amount <= 0) return;
  amount = Math.min(amount, 1);
  for (const r of s.religions) r.f *= 1 - amount;
  const ex = s.religions.find((r) => r.id === id);
  if (ex) ex.f += amount;
  else s.religions.push({ id, f: amount });
  s.religions.sort((a, b) => b.f - a.f || a.id - b.id);
  if (s.religions.length > 4) s.religions.length = 4;
  const tot = s.religions.reduce((a, b) => a + b.f, 0);
  if (tot > 0) for (const r of s.religions) r.f /= tot;
}

/** Monthly local belief dynamics: emergence, diffusion, secularization. id 0 = no religion. */
export function localBeliefMonthly(sim: Sim, s: Settlement, civ: Civ): void {
  const w = sim.w;
  if (!w.laws.religiousChange) return;
  const rng = sim.rng;
  const dominant = s.religions[0];
  const faith = s.religions.reduce((a, r) => a + (r.id ? r.f : 0), 0);
  // emergence: settled, with ritual tradition, under stress or spiritual vacuum
  if (civ.techs['spirituality']?.known && s.pop > 120) {
    const stress = clamp01(s.unrest + (s.flows.famine + s.flows.disease) / Math.max(1, s.pop) * 10);
    const vacuum = 1 - faith;
    const recent = sim.year - (w.milestones[`faith:${civ.id}`] ?? -1e9) < 80;
    const p = recent ? 0 : 0.00025 * (0.3 + stress) * (0.15 + vacuum) * (1 + civ.personality.piety);
    if (rng.float() < p) {
      const r = foundReligion(sim, s, civ);
      w.milestones[`faith:${civ.id}`] = sim.year;
      shift(s, r.id, 0.25 + vacuum * 0.3);
      logEvent(sim, {
        type: 'religion_founded',
        cat: 'religion',
        title: `${w.persons.get(r.founderId)?.name ?? 'A prophet'} founded ${r.name} in ${s.name}`,
        text: r.myth,
        civs: [civ.id],
        settlements: [s.id],
        persons: [r.founderId],
        x: s.x,
        y: s.y,
        importance: 3,
        causes: [
          ...(stress > 0.2 ? [{ label: 'Social stress (hunger, disease, unrest)', weight: stress }] : []),
          ...(vacuum > 0.3 ? [{ label: 'No established faith', weight: vacuum }] : []),
          { label: 'Ritual traditions', weight: 0.3 },
        ],
      });
    }
  }
  // diffusion from linked settlements & state promotion
  if (dominant && (w.tick / 10 + s.id) % 3 < 1) {
    for (const lid of s.links) {
      const o = w.settlements.get(lid);
      if (!o || !o.religions[0]) continue;
      const rid = o.religions[0].id;
      if (!rid) continue;
      const rel = w.religions.get(rid);
      if (!rel) continue;
      let rate = 0.004 * o.religions[0].f;
      if (rel.doctrines.includes('proselytizing')) rate *= 2;
      if (rel.doctrines.includes('pilgrimage')) rate *= 1.3;
      if (o.bld[B.TEMPLE] > 0) rate *= 1.2;
      // incumbent faith resists conversion
      const incumbent = s.religions[0].id === rid ? 0 : s.religions[0].f;
      shift(s, rid, rate * (1 - incumbent * 0.6));
    }
  }
  if (civ.stateReligion && civ.policies.tolerance !== 'secular') {
    const press = civ.policies.tolerance === 'persecution' ? 0.006 : civ.policies.tolerance === 'state_faith' ? 0.002 : 0.0005;
    shift(s, civ.stateReligion, press * (s.bld[B.TEMPLE] > 0 ? 1.5 : 1));
    if (civ.policies.tolerance === 'persecution' && share(s, civ.stateReligion) < 0.7) s.unrest = clamp01(s.unrest + 0.004);
  }
  // secularization: education + security, unless doctrine/state resist
  const security = clamp01((s.prosperity - 1.5) / 3);
  const secular = (s.education * 0.6 + security * 0.4) * 0.0025 * (1 - civ.inst.religiousAuthority * 0.6) * (civ.policies.tolerance === 'secular' ? 1.5 : 1);
  if (secular > 0 && faith > 0) shift(s, 0, secular);
}

/** Yearly: state religion choices, schisms, syncretism, adherent counts, extinction. */
export function religionYearly(sim: Sim): void {
  const w = sim.w;
  const rng = sim.rng;
  const adherents = new Map<number, number>();
  const civSpan = new Map<number, Set<number>>();
  for (const s of w.settlements.values()) {
    for (const r of s.religions) {
      if (!r.id) continue;
      adherents.set(r.id, (adherents.get(r.id) ?? 0) + r.f * s.pop);
      let set = civSpan.get(r.id);
      if (!set) civSpan.set(r.id, (set = new Set()));
      if (r.f > 0.3) set.add(s.civId);
    }
  }
  for (const r of w.religions.values()) {
    if (r.extinct) continue;
    r.adherents = adherents.get(r.id) ?? 0;
    const span = civSpan.get(r.id)?.size ?? 0;
    r.cohesion = clamp01(r.cohesion + (r.doctrines.includes('orthodoxy') ? 0.01 : 0) - span * 0.006 + 0.004);
    if (r.adherents < 1 && sim.year - r.founded > 5) {
      r.extinct = sim.year;
      logEvent(sim, { type: 'religion_extinct', cat: 'religion', title: `${r.name} has no remaining followers`, importance: 2 });
      continue;
    }
    // schism / reform
    if (span >= 3 && r.cohesion < 0.35 && r.adherents > 50000 && rng.chance(0.08)) {
      const candidates = [...w.settlements.values()].filter((s) => s.religions[0]?.id === r.id && s.civId !== r.originCiv);
      if (candidates.length) {
        const s = rng.pick(candidates);
        const civ = w.civs.get(s.civId)!;
        const nr = foundReligion(sim, s, civ, 0, r);
        for (const o of w.settlements.values()) if (o.civId === s.civId) {
          const f = share(o, r.id);
          if (f > 0) shift(o, nr.id, f * rng.range(0.3, 0.8));
        }
        r.cohesion = Math.min(1, r.cohesion + 0.3);
        logEvent(sim, { type: 'schism', cat: 'religion', title: `Schism: ${nr.name} broke away from ${r.name}`, civs: [civ.id], settlements: [s.id], persons: [nr.founderId], x: s.x, y: s.y, importance: 3, causes: [{ label: `Faith spread across ${span} states`, weight: span / 5 }, { label: 'Weak institutional cohesion', weight: 1 - r.cohesion }] });
      }
    }
  }
  // civs adopt/abandon a state religion
  for (const civ of w.civs.values()) {
    if (!civ.alive) continue;
    const counts = new Map<number, number>();
    for (const sid of civ.settlements) {
      const s = w.settlements.get(sid);
      if (s) for (const r of s.religions) counts.set(r.id, (counts.get(r.id) ?? 0) + r.f * s.pop);
    }
    let best = 0;
    let bestN = 0;
    let total = 0;
    for (const [id, n] of counts) {
      total += n;
      if (id && n > bestN) {
        best = id;
        bestN = n;
      }
    }
    const secular = (counts.get(0) ?? 0) / Math.max(1, total);
    if (civ.stateReligion !== best && best && bestN / Math.max(1, total) > 0.5 && civ.inst.religiousAuthority > 0.15 && secular < 0.5) {
      civ.stateReligion = best;
      const r = w.religions.get(best)!;
      logEvent(sim, { type: 'state_religion', cat: 'religion', title: `${civ.name} adopted ${r.name} as its state faith`, civs: [civ.id], importance: 2 });
    } else if (civ.stateReligion && secular > 0.55 && civ.policies.tolerance !== 'persecution') {
      civ.stateReligion = 0;
      civ.policies.tolerance = 'secular';
      logEvent(sim, { type: 'secularization', cat: 'religion', title: `${civ.name} separated religion from the state`, civs: [civ.id], importance: 2, causes: [{ label: `${Math.round(secular * 100)}% of people are non-religious`, weight: 1 }] });
    }
  }
}

/** Player power: found a religion at a settlement. */
export function godFoundReligion(sim: Sim, s: Settlement): Religion | null {
  const civ = sim.w.civs.get(s.civId);
  if (!civ) return null;
  const r = foundReligion(sim, s, civ);
  shift(s, r.id, 0.6);
  logEvent(sim, { type: 'religion_founded', cat: 'god', title: `Divine revelation: ${r.name} was founded in ${s.name}`, text: r.myth, civs: [civ.id], settlements: [s.id], persons: [r.founderId], x: s.x, y: s.y, importance: 3 });
  return r;
}

export function godSpreadReligion(sim: Sim, s: Settlement, rid: number, amount = 0.3): void {
  if (sim.w.religions.has(rid)) shift(s, rid, amount);
}
