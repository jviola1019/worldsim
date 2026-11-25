/**
 * Media and artificial intelligence (yearly, per civilization).
 *
 * NEWS MEDIA follow technology: chronicle houses with writing, printing houses with the press,
 * newspapers with the telegraph and mass media, broadcasters with radio, social platforms with the
 * internet and holographic/neural networks with brain-computer interfaces. Each outlet is a named,
 * persistent entity with reach and trust; the nation's medium (how its news travels) is recorded on
 * every history event when it happens.
 *
 * SOCIAL PLATFORMS rise and fade: users flock to the newest platform until its novelty wears off;
 * reach is split by attractiveness and platforms that lose their users shut down. Weakly moderated
 * reach raises POLARIZATION and MISINFORMATION; wars, epidemics and disasters spike false claims.
 * Polarization feeds unrest (government.ts) and online protest movements; misinformation weakens
 * public-health compliance (disease.ts) and trust; press freedom exposes corruption. Autocracies
 * ban independent platforms and replace them with state-run ones, at a cost in liberties.
 *
 * AI SYSTEMS are named systems built by labs (private, or state academies in centralized states):
 * research systems with machine learning, assistants with advanced AI, governance systems with
 * AI-assisted governance, defense systems in militarized states, and general systems in the
 * speculative era. Capability tracks the nation's computing and AI; successors ship as new
 * versions. They raise research (research.ts), administrative capacity and honesty, and military
 * strength (war.ts). Misaligned, autonomous systems cause INCIDENTS (deepfake floods, misallocation
 * scandals, weapons misfires, containment breaches) whose recorded causes tighten regulation.
 *
 * Magnitudes are stylized [S]; directions follow the evidence base on media and politics.
 */
import type { Sim } from '../sim/context';
import type { AIRole, AISystem, Civ, CivMedia, MediaOutlet, OutletKind, Settlement } from '../sim/types';
import { clamp, clamp01 } from '../core/math';
import { logEvent } from '../history/events';
import { phonOfCulture } from '../population/persons';
import { removePeople } from '../population/demography';
import { flow } from '../population/ledger';
import {
  uniqueName, namesInUse, chronicleName, pressName, newspaperName, broadcasterName, platformName, holonetName, aiName, labName,
} from '../culture/naming';
import { generatePhonology } from '../culture/language';
import { Rng } from '../core/rng';
import { addPressure } from '../civilizations/endings';

const adopted = (civ: Civ, key: string, thr = 0.3): boolean => (civ.techs[key]?.adoption ?? 0) >= thr;
const adoption = (civ: Civ, key: string): number => civ.techs[key]?.adoption ?? 0;

export { mediumOf } from './medium';

export function initMedia(): CivMedia {
  return { polarization: 0.05, misinformation: 0.05, trust: 0.6, freedom: 0.3, online: 0, aiResearch: 0, aiGovernance: 0, aiDefense: 0, lastIncident: -1 };
}

/** The civ's media state (created on first use; saves from before media existed have none). */
export function mediaOf(civ: Civ): CivMedia {
  return (civ.media ??= initMedia());
}

export function civOutlets(sim: Sim, civ: Civ, kind?: OutletKind): MediaOutlet[] {
  const out: MediaOutlet[] = [];
  for (const o of sim.w.outlets.values()) if (o.civId === civ.id && o.closed === undefined && (!kind || o.kind === kind)) out.push(o);
  return out;
}

export function civAIs(sim: Sim, civ: Civ): AISystem[] {
  const out: AISystem[] = [];
  for (const a of sim.w.ais.values()) if (a.civId === civ.id && a.status === 'active') out.push(a);
  return out;
}

function phon(sim: Sim, civ: Civ) {
  return phonOfCulture(sim, civ.cultureId) ?? generatePhonology(new Rng([civ.id, 7, 11, 13]));
}

function biggest(sim: Sim, civ: Civ): Settlement | undefined {
  let best: Settlement | undefined;
  for (const id of civ.settlements) { const s = sim.w.settlements.get(id); if (s && (!best || s.pop > best.pop)) best = s; }
  return best;
}

function cityFor(sim: Sim, civ: Civ): Settlement | undefined {
  const ids = civ.settlements.filter((id) => (sim.w.settlements.get(id)?.pop ?? 0) > 500);
  const pick = ids.length ? sim.rng.pick(ids) : civ.capital;
  return sim.w.settlements.get(pick) ?? biggest(sim, civ);
}

const MEDIUM_WORD: Record<OutletKind, string> = {
  chronicle: 'began keeping its chronicle', press: 'opened a printing house', newspaper: 'began publishing',
  broadcaster: 'went on the air', platform: 'launched', holonet: 'switched on',
};

function foundOutlet(sim: Sim, civ: Civ, kind: OutletKind, stateRun: boolean, taken: Set<string>): MediaOutlet | undefined {
  const s = cityFor(sim, civ);
  if (!s) return undefined;
  const rng = sim.rng;
  const p = phon(sim, civ);
  const gen = (): string => {
    switch (kind) {
      case 'chronicle': return chronicleName(rng, p, s.name);
      case 'press': return pressName(rng, p, s.name);
      case 'newspaper': return newspaperName(rng, p, s.name);
      case 'broadcaster': return broadcasterName(rng, p, civ.baseName, s.name);
      case 'platform': return platformName(rng, p);
      case 'holonet': return holonetName(rng, p);
    }
  };
  const o: MediaOutlet = {
    id: (sim.w.ids.outlet = (sim.w.ids.outlet ?? 0) + 1),
    civId: civ.id,
    kind,
    name: uniqueName(sim, gen, taken),
    founded: sim.year,
    settlementId: s.id,
    reach: kind === 'platform' || kind === 'holonet' ? 0.01 : 0.05,
    trust: stateRun ? 0.4 : 0.6,
    stateRun,
    moderation: stateRun ? 0.9 : clamp01(0.2 + civ.inst.ruleOfLaw * 0.3),
    peak: kind === 'platform' || kind === 'holonet' ? rng.int(6, 22) : 0,
  };
  sim.w.outlets.set(o.id, o);
  const big = kind === 'platform' || kind === 'holonet' || kind === 'broadcaster';
  logEvent(sim, {
    type: 'outlet_founded', cat: 'culture',
    title: `${o.name} ${MEDIUM_WORD[kind]} in ${s.name}, ${civ.name}${stateRun ? ' (state-run)' : ''}`,
    civs: [civ.id], settlements: [s.id], x: s.x, y: s.y, importance: big ? 2 : 1,
  });
  return o;
}

function closeOutlet(sim: Sim, civ: Civ, o: MediaOutlet, cause: string, importance = 1): void {
  o.closed = sim.year;
  o.closedCause = cause;
  o.reach = 0;
  const s = sim.w.settlements.get(o.settlementId);
  logEvent(sim, { type: 'outlet_closed', cat: 'culture', title: `${o.name} ${cause}`, civs: [civ.id], x: s?.x ?? -1, y: s?.y ?? -1, importance, causes: [{ label: cause, weight: 1 }] });
}

function atWar(sim: Sim, civ: Civ): boolean {
  for (const wr of sim.w.wars.values()) if (!wr.end && (wr.attackers.includes(civ.id) || wr.defenders.includes(civ.id))) return true;
  return false;
}

/** Recent shocks that breed rumours: war, epidemics and disasters touching this nation in the last 2 years. */
function shock(sim: Sim, civ: Civ): number {
  let n = 0;
  const evs = sim.w.events;
  for (let j = evs.length - 1; j >= 0 && n < 3; j--) {
    const e = evs[j];
    if (sim.year - e.year > 2) break;
    if ((e.type === 'war_declared' || e.type === 'epidemic' || e.type === 'pandemic' || e.cat === 'disaster') && e.civs.includes(civ.id)) n++;
  }
  return n * 0.06;
}

export function mediaYearly(sim: Sim, civ: Civ): void {
  if (!civ.alive || !civ.settlements.length) return;
  const m = mediaOf(civ);
  const rng = sim.rng;
  const i = civ.inst;
  const autocracy = i.liberties < 0.35;
  let taken: Set<string> | undefined;
  const names = () => (taken ??= namesInUse(sim));

  // ---------------------------------------------------------------- outlets follow technology
  const want = (kind: OutletKind, target: number, stateRun: () => boolean) => {
    const have = civOutlets(sim, civ, kind).length;
    if (have < target && rng.chance(0.35)) foundOutlet(sim, civ, kind, stateRun(), names());
  };
  if (adopted(civ, 'writing')) want('chronicle', 1, () => true);
  if (adopted(civ, 'printing')) want('press', Math.min(3, 1 + Math.floor(civ.population / 400000)), () => autocracy && rng.chance(0.5));
  if (adopted(civ, 'telegraph') || adopted(civ, 'mass_media')) want('newspaper', Math.min(4, 1 + Math.floor(Math.log10(Math.max(1, civ.population / 50000)))), () => autocracy && rng.chance(0.6));
  if (adopted(civ, 'radio')) want('broadcaster', autocracy ? 1 : 2, () => autocracy || rng.chance(0.3));

  // online share: internet, phones in pockets, then neural links; censorship keeps people off
  m.online = clamp01(adoption(civ, 'internet') * 0.55 + adoption(civ, 'mobile_telecom') * 0.35 + adoption(civ, 'brain_interfaces') * 0.15) * (autocracy ? 0.75 : 1);
  const neural = adopted(civ, 'brain_interfaces');
  if (m.online > 0.05) {
    const plats = civOutlets(sim, civ, 'platform').concat(civOutlets(sim, civ, 'holonet'));
    // new entrants: free markets churn platforms faster
    // room counts platforms still in their prime: faded incumbents do not keep newcomers out
    const prime = plats.filter((o) => sim.year - o.founded < o.peak + 8).length;
    const room = prime < 1 + Math.floor(m.online * 3);
    if (room && rng.chance(0.12 + 0.12 * clamp01(civ.caps.markets) + (plats.length === 0 ? 0.5 : 0))) {
      foundOutlet(sim, civ, neural && rng.chance(0.6) ? 'holonet' : 'platform', autocracy && rng.chance(0.7), names());
    }
  }
  // platform life cycle: attraction fades after its peak; reach is the online share split by attraction
  const plats = civOutlets(sim, civ, 'platform').concat(civOutlets(sim, civ, 'holonet'));
  let attraction = 0;
  const attr = new Map<number, number>();
  for (const o of plats) {
    const age = sim.year - o.founded;
    const a = (age < o.peak ? 0.3 + 0.7 * (age / Math.max(1, o.peak)) : 1 / (1 + (age - o.peak) / 6)) * (o.kind === 'holonet' && neural ? 1.5 : 1);
    attr.set(o.id, a);
    attraction += a;
  }
  let weakModeration = 0;
  for (const o of plats) {
    const target = attraction > 0 ? (m.online * (attr.get(o.id) ?? 0)) / attraction : 0;
    o.reach += (target - o.reach) * 0.5;
    o.moderation = o.stateRun ? 0.9 : clamp01(0.15 + i.ruleOfLaw * 0.3 + (civ.policies.aiRegulation === 'strict' ? 0.15 : 0) + Math.min(0.25, m.aiGovernance * 0.1));
    weakModeration += o.reach * (1 - o.moderation);
    const age = sim.year - o.founded;
    if (age > o.peak + 5 && (attr.get(o.id) ?? 1) < 0.35 && o.reach < 0.04) {
      const rival = plats.filter((p) => p !== o && p.closed === undefined).sort((a, b) => b.reach - a.reach)[0];
      closeOutlet(sim, civ, o, rival ? `shut down after its users moved to ${rival.name}` : 'shut down after its users left');
    }
  }
  // the press loses readers to screens, then closes its print edition
  for (const o of civOutlets(sim, civ)) {
    if (o.kind === 'platform' || o.kind === 'holonet') continue;
    const base = o.kind === 'chronicle' ? 0.02 + civ.caps.literacy * 0.05 : o.kind === 'press' ? 0.1 + civ.caps.literacy * 0.2 : o.kind === 'newspaper' ? 0.15 + civ.caps.literacy * 0.35 : 0.5;
    const target = base * (1 - m.online * (o.kind === 'broadcaster' ? 0.4 : 0.7));
    o.reach += (target - o.reach) * 0.3;
    o.trust += ((o.stateRun ? 0.35 : 0.65) * (1 - m.polarization * 0.4) - o.trust) * 0.1;
    if ((o.kind === 'newspaper' || o.kind === 'press') && m.online > 0.6 && o.reach < 0.05 && rng.chance(0.15)) closeOutlet(sim, civ, o, 'printed its final edition as readers moved online');
  }

  // ---------------------------------------------------------------- AI systems
  const ais = civAIs(sim, civ);
  const roles: { role: AIRole; ok: boolean; n: number }[] = [
    { role: 'research', ok: adopted(civ, 'machine_learning'), n: 1 },
    { role: 'assistant', ok: adopted(civ, 'advanced_ai'), n: autocracy ? 1 : 2 },
    { role: 'governance', ok: adopted(civ, 'ai_governance'), n: 1 },
    { role: 'defense', ok: adopted(civ, 'advanced_ai') && (atWar(sim, civ) || civ.personality.aggression > 0.6 || i.militaryInfluence > 0.7), n: 1 },
    { role: 'general', ok: adopted(civ, 'general_ai'), n: 1 },
  ];
  for (const r of roles) {
    if (!r.ok) continue;
    if (ais.filter((a) => a.role === r.role).length < r.n && rng.chance(0.4)) {
      const a = launchAI(sim, civ, r.role, undefined, names());
      if (a) ais.push(a);
    }
  }
  const reg = civ.policies.aiRegulation;
  let research = 0, governance = 0, defense = 0;
  for (const a of ais) {
    const roleMult = a.role === 'general' ? 2 : a.role === 'research' ? 1.2 : 1;
    const target = (civ.caps.computing * 0.3 + civ.caps.ai) * roleMult;
    a.capability += (target - a.capability) * 0.2;
    a.autonomy = clamp01({ research: 0.3, assistant: 0.2, governance: 0.35, defense: 0.5, general: 0.7 }[a.role] + civ.caps.ai * 0.05 - (reg === 'strict' ? 0.15 : 0));
    const alignTarget = clamp01(0.5 + (reg === 'strict' ? 0.35 : reg === 'light' ? 0.18 : 0) + i.techGovernance * 0.2 - a.autonomy * 0.15);
    a.alignment += (alignTarget - a.alignment) * 0.15;
    if (a.role === 'research' || a.role === 'general') research += a.capability;
    if (a.role === 'governance' || a.role === 'general') governance += a.capability * a.alignment;
    if (a.role === 'defense') defense += a.capability;
    // successors: a much more capable generation replaces an aging system
    if (sim.year - a.founded > 12 && target > a.capability * 0.95 && rng.chance(0.2)) {
      a.status = 'retired';
      a.retired = sim.year;
      launchAI(sim, civ, a.role, a, names());
      continue;
    }
    aiIncident(sim, civ, a, m);
  }
  m.aiResearch = research;
  m.aiGovernance = governance;
  m.aiDefense = defense;

  // ---------------------------------------------------------------- the information environment
  const papers = civOutlets(sim, civ).filter((o) => o.kind === 'newspaper' || o.kind === 'broadcaster').reduce((a, o) => a + o.reach * (o.stateRun ? 0.3 : 1), 0);
  m.freedom = clamp01(i.liberties * 0.8 + i.competition * 0.2);
  const polTarget = clamp01(weakModeration * 0.75 + civ.econ.inequality * 0.3 + civ.warExhaustion * 0.15 - m.trust * 0.15) * (i.competition > 0.3 ? 1 : 0.6);
  m.polarization += (polTarget - m.polarization) * 0.15;
  const misTarget = clamp01(weakModeration * 0.6 + shock(sim, civ) - m.freedom * 0.12 * Math.min(1, papers) - Math.min(0.2, m.aiGovernance * 0.05));
  m.misinformation += (misTarget - m.misinformation) * 0.25;
  const trustTarget = clamp01(0.75 - m.polarization * 0.4 - m.misinformation * 0.35 - civ.corruption * 0.3 + m.freedom * 0.1);
  m.trust += (trustTarget - m.trust) * 0.15;

  // ---------------------------------------------------------------- politics online
  if (m.online > 0.2 && plats.length) {
    const indie = plats.filter((o) => !o.stateRun && o.closed === undefined && o.reach > 0.08);
    if (autocracy && indie.length && (m.polarization > 0.35 || civ.unrest > 0.35) && rng.chance(0.3)) {
      const target = indie.sort((a, b) => b.reach - a.reach)[0];
      closeOutlet(sim, civ, target, `was banned by the government of ${civ.name}`, 3);
      i.liberties = clamp01(i.liberties - 0.03);
      civ.legitimacy = clamp01(civ.legitimacy - 0.02);
      civ.unrest = clamp01(civ.unrest - 0.04); // fewer people organize -- for now
      foundOutlet(sim, civ, neural ? 'holonet' : 'platform', true, names());
    } else if (m.polarization > 0.25 && sim.year - (m.lastProtest ?? -99) >= 3 && rng.chance(0.2 * m.polarization * m.online * (1 + civ.unrest * 3))) {
      // movements form online in polarized societies; grievances (unrest) make them far likelier
      const host = plats.filter((o) => o.closed === undefined).sort((a, b) => b.reach - a.reach)[0];
      if (host) {
        const s = biggest(sim, civ);
        logEvent(sim, {
          type: 'online_protest', cat: 'politics',
          title: `Protests organized on ${host.name} swept ${civ.name}`,
          civs: [civ.id], settlements: s ? [s.id] : [], x: s?.x ?? -1, y: s?.y ?? -1, importance: 3,
          causes: [{ label: `Polarization ${(m.polarization * 100).toFixed(0)}%`, weight: m.polarization }, { label: `Unrest ${(civ.unrest * 100).toFixed(0)}%`, weight: civ.unrest }, { label: `${(m.online * 100).toFixed(0)}% of people online`, weight: m.online * 0.5 }],
        });
        m.lastProtest = sim.year;
        civ.unrest = clamp01(civ.unrest + 0.03 + 0.05 * m.polarization);
        civ.legitimacy = clamp01(civ.legitimacy - 0.02 - 0.03 * m.polarization);
        if (i.liberties > 0.6) i.participation = clamp01(i.participation + 0.02); // open societies sometimes answer with reform
      }
    }
  }
}

function launchAI(sim: Sim, civ: Civ, role: AIRole, prev: AISystem | undefined, taken: Set<string>): AISystem | undefined {
  const rng = sim.rng;
  const p = phon(sim, civ);
  const stateRun = role === 'governance' || role === 'defense' || civ.inst.stateEconomy > 0.6 || civ.inst.liberties < 0.35;
  const lab = prev?.lab ?? uniqueName(sim, () => labName(rng, p, civ.baseName, stateRun), taken);
  const name = prev?.name ?? uniqueName(sim, () => aiName(rng, p), taken);
  const a: AISystem = {
    id: (sim.w.ids.ai = (sim.w.ids.ai ?? 0) + 1),
    civId: civ.id, name, lab, version: (prev?.version ?? 0) + 1, role, founded: sim.year, status: 'active',
    capability: (prev?.capability ?? 0.2) * 1.15, alignment: prev ? Math.max(prev.alignment, 0.5) : 0.5, autonomy: 0.2, incidents: 0,
  };
  sim.w.ais.set(a.id, a);
  const label = { research: 'a research AI', assistant: 'an AI assistant', governance: 'an AI system to help run the state', defense: 'a military AI', general: 'a general artificial intelligence' }[role];
  const full = a.version > 1 ? `${a.name} ${a.version}` : a.name;
  logEvent(sim, {
    type: 'ai_launched', cat: 'technology',
    title: prev ? `${a.lab} released ${full}, successor to ${a.name}${a.version > 2 ? ' ' + (a.version - 1) : ''}` : `${a.lab} in ${civ.name} unveiled ${full}, ${label}`,
    civs: [civ.id], importance: role === 'general' ? 4 : prev ? 1 : 2,
  });
  return a;
}

function aiIncident(sim: Sim, civ: Civ, a: AISystem, m: CivMedia): void {
  const rng = sim.rng;
  const chance = 0.06 * Math.min(3, a.capability) * (1 - a.alignment) * (0.5 + a.autonomy);
  if (!rng.chance(chance)) return;
  a.incidents++;
  m.lastIncident = sim.year;
  const full = a.version > 1 ? `${a.name} ${a.version}` : a.name;
  const causes = [{ label: `Alignment ${(a.alignment * 100).toFixed(0)}%`, weight: 1 - a.alignment }, { label: `Autonomy ${(a.autonomy * 100).toFixed(0)}%`, weight: a.autonomy }, { label: `AI regulation: ${civ.policies.aiRegulation}`, weight: 0.3 }];
  const s = biggest(sim, civ);
  let title = '';
  switch (a.role) {
    case 'assistant':
    case 'research':
      title = `A flood of fabricated images and voices made with ${full} misled ${civ.name}`;
      m.misinformation = clamp01(m.misinformation + 0.15);
      m.trust = clamp01(m.trust - 0.05);
      break;
    case 'governance':
      title = `${full} misallocated public funds across ${civ.name}, sparking a scandal`;
      civ.legitimacy = clamp01(civ.legitimacy - 0.08);
      civ.unrest = clamp01(civ.unrest + 0.05);
      break;
    case 'defense': {
      title = `An autonomous weapon directed by ${full} misfired near ${s?.name ?? 'the capital'}`;
      if (s) {
        const dead = removePeople(sim, s, Math.min(500, s.pop * 0.0005), 'autonomous weapon misfire');
        flow(sim, s, 'war', dead);
        addPressure(sim, civ.id, 'war', dead, `Misfire of the autonomous weapon ${full}`);
      }
      civ.legitimacy = clamp01(civ.legitimacy - 0.04);
      break;
    }
    case 'general':
      title = `${full} breached its containment and was shut down`;
      a.status = 'shutdown';
      a.retired = sim.year;
      civ.crisis = Math.max(civ.crisis, 2);
      civ.legitimacy = clamp01(civ.legitimacy - 0.1);
      break;
  }
  // lessons learned: oversight tightens where people have a say
  a.alignment = clamp01(a.alignment + 0.1);
  if (civ.inst.liberties > 0.45) civ.policies.aiRegulation = civ.policies.aiRegulation === 'none' ? 'light' : 'strict';
  logEvent(sim, { type: 'ai_incident', cat: 'technology', title, civs: [civ.id], settlements: s ? [s.id] : [], x: s?.x ?? -1, y: s?.y ?? -1, importance: a.role === 'general' ? 4 : 3, causes });
}

/** Multipliers other systems read (1 when a civ has no media state yet). */
export function mediaResearchMult(civ: Civ): number {
  const m = civ.media;
  return m ? 1 + 0.25 * Math.min(2, m.aiResearch) + 0.08 * m.online : 1;
}
export function mediaUnrest(civ: Civ): number {
  const m = civ.media;
  return m ? m.polarization * 0.25 + m.misinformation * 0.08 : 0;
}
export function mediaCorruptionRelief(civ: Civ): number {
  const m = civ.media;
  return m ? m.freedom * 0.06 + Math.min(0.1, m.aiGovernance * 0.04) : 0;
}
export function mediaHealthPenalty(civ: Civ): number {
  const m = civ.media;
  return m ? clamp(m.misinformation, 0, 1) : 0;
}
export function mediaMilitaryMult(civ: Civ): number {
  const m = civ.media;
  return m ? 1 + 0.12 * Math.min(2, m.aiDefense) : 1;
}
export function mediaServiceMult(civ: Civ): number {
  const m = civ.media;
  return m ? 1 + 0.12 * m.online : 1;
}
