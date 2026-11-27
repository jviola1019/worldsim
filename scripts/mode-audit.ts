/**
 * Round 10: game-mode audit. Each preset and scenario world makes promises in its own description and
 * objectives; this runs 3 seeds of each mode (128², to its horizon) and measures whether the promises hold,
 * plus a line of general metrics for comparing a mode with its nearest neighbour (distinctness).
 *   npx tsx scripts/mode-audit.ts [modes=all] [seeds=3]       (modes: comma-separated keys)
 * Results: docs/data/round10/mode-audit.txt and VALIDATION §R10.
 */
import { POWERS, POWER_BY_ID, applyPower } from '../src/powers/powers';
import { powerAllowed } from '../src/powers/powerSet';
import { TECHS } from '../src/technology/techData';
import { techPermitted } from '../src/technology/research';
import { SPECIES_BY_KEY } from '../src/ecology/species';
import { defaultConfig, presetByKey, START_VARIANTS, randomizeConfig, type WorldConfig } from '../src/config/laws';
import { SCENARIOS } from '../src/scenarios/scenarios';
import { createSimulation } from '../src/sim/bootstrap';
import type { Simulation } from '../src/sim/simulation';
import { B } from '../src/civilizations/buildingTypes';
import { T } from '../src/world/terrain';
import { Deposit } from '../src/world/resources';
import { countPeoples } from '../src/sim/peoples';

export interface Promise { id: string; text: string; at: 'start' | 'horizon' | 'any'; check: (sim: Simulation, start: Snapshot) => boolean }
export interface ModeSpec { key: string; kind: 'preset' | 'scenario'; horizon: number; promises: Promise[]; /** Round 10 addendum: what the player does first (Realistic: drop people and animals by hand). */ setup?: (sim: Simulation) => void; /** Task 8 Part B follow-up: long-run figures reported with the metrics, not pass/fail. */ report?: (sim: Simulation) => Record<string, unknown> }
export interface Snapshot { nations: number; tribes: number; maxEra: number; minEra: number; ruins: number; known: Map<number, Set<string>>; coal: Map<number, number> }

const alive = (sim: Simulation) => [...sim.w.civs.values()].filter((c) => c.alive);
const maxEra = (sim: Simulation) => Math.max(0, ...alive(sim).map((c) => c.era));
const countBld = (sim: Simulation, b: number) => { let n = 0; for (let i = 0; i < sim.w.map.n; i++) if (sim.w.map.bld[i] === b) n++; return n; };
const ev = (sim: Simulation, re: RegExp) => sim.w.events.some((e) => re.test(e.type));
const treatyKinds = (sim: Simulation): string[] => [...((sim.w as unknown as { treaties?: Map<number, { kind: string; ended?: number }> }).treaties?.values() ?? [])].filter((t) => !t.ended).map((t) => t.kind);
const objective = (key: string, id: string) => SCENARIOS.find((s) => s.key === key)!.objectives.find((o) => o.id === id)!.check as unknown as (sim: Simulation) => boolean;

export function snapshot(sim: Simulation): Snapshot {
  const m = sim.w.map;
  const coal = new Map<number, number>();
  for (let i = 0; i < m.n; i++) if (m.dep[i] === Deposit.COAL && m.owner[i]) coal.set(m.owner[i], (coal.get(m.owner[i]) ?? 0) + 1);
  const c = countPeoples(sim.w);
  return {
    nations: c.nations, tribes: c.tribes, maxEra: maxEra(sim), minEra: Math.min(99, ...alive(sim).map((x) => x.era)), ruins: countBld(sim, B.RUINS),
    known: new Map(alive(sim).map((x) => [x.id, new Set(Object.keys(x.techs).filter((t) => x.techs[t]?.known))])), coal,
  };
}

/** Spearman rank correlation: Pearson on ranks, ties given their average rank (Task 8c: ties were ranked by array order). */
export function spearman(xs: number[], ys: number[]): number {
  const rank = (v: number[]) => {
    const o = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array<number>(v.length);
    for (let i = 0; i < o.length; ) {
      let j = i;
      while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++;
      for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2;
      i = j + 1;
    }
    return r;
  };
  const n = xs.length;
  if (n < 3) return 0;
  const rx = rank(xs), ry = rank(ys);
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

/** Task 8c: how far a nation has industrialised: adoption summed over the era-7 and era-8 (industrial) techs. */
const INDUSTRIAL_TECHS = TECHS.filter((t) => t.era === 7 || t.era === 8).map((t) => t.id);
export function industrialisation(civ: { techs: Record<string, { known: boolean; adoption: number } | undefined> }): number {
  let a = 0;
  for (const id of INDUSTRIAL_TECHS) { const st = civ.techs[id]; if (st?.known) a += st.adoption; }
  return a;
}

/** No monsters, horrors, alien wildlife, fantasy peoples or exotic matter. */
function noFiction(sim: Simulation): boolean {
  const w = sim.w;
  if (w.monsters.size) return false;
  if ([...w.settlements.values()].some((x) => x.horror)) return false;
  if ([...w.herds.values()].some((h) => SPECIES_BY_KEY[h.species]?.alien)) return false;
  if ([...w.civs.values()].some((c) => c.species !== 'human')) return false;
  for (let i = 0; i < w.map.n; i++) if (w.map.dep[i] === Deposit.EXOTIC) return false;
  return true;
}

/** The player's first moves in Realistic: a band of humans by fresh water, then deer, horses and wolves nearby. */
function dropLife(sim: Simulation): void {
  const m = sim.w.map;
  const ctx = { selectedCiv: 0 };
  for (let i = 0; i < m.n; i += 7) {
    const x = m.xOf(i), y = m.yOf(i);
    if (!m.hasFreshWater(i) || m.isWater(i) || x < 20 || y < 20 || x > m.w - 20 || y > m.h - 20) continue;
    if (applyPower(sim, 'spawn_human', x, y, 1, ctx) !== null) continue;
    for (const [k, dx] of [['animal_deer', 3], ['animal_horse', -3], ['animal_wolf', 5]] as const) applyPower(sim, k, x + dx, y + 2, 1, ctx);
    return;
  }
}

export const MODES: ModeSpec[] = [
  // round 10 addendum: Realistic (empty real Earth, you drop people and animals, everything science-based, nothing
  // fictional) and Observer (the old hands-off Realistic: no powers at all)
  { key: 'realistic', kind: 'preset', horizon: 250, setup: dropLife, promises: [
    { id: 'empty', text: 'starts empty at year 0, with wildlife and no people', at: 'start', check: (s) => s.year === 0 && s.w.civs.size === 0 && s.w.herds.size > 0 },
    { id: 'life_only', text: 'you can place humans and animals, and nothing else', at: 'start', check: (s) => powerAllowed(s.w.meta.settings, POWER_BY_ID.spawn_human) && powerAllowed(s.w.meta.settings, POWER_BY_ID.animal_elephant) && !['raise', 'river', 'dis_fire', 'asteroid', 'nuke', 'monster', 'tech_grant'].some((id) => powerAllowed(s.w.meta.settings, POWER_BY_ID[id])) },
    { id: 'tech', text: 'every science-based technology is possible', at: 'start', check: (s) => TECHS.every((t) => techPermitted(s, t)) },
    { id: 'village', text: 'the people you placed settle a village', at: 'any', check: (s) => s.w.settlements.size > 0 },
    { id: 'real', text: 'nothing fictional ever appears', at: 'horizon', check: (s) => noFiction(s) },
  ] },
  { key: 'observer', kind: 'preset', horizon: 150, promises: [
    { id: 'peoples', text: 'five peoples at the start, left to themselves', at: 'start', check: (s, st) => st.tribes + st.nations >= 5 },
    { id: 'no_powers', text: 'no powers at all', at: 'start', check: (s) => !POWERS.some((p) => powerAllowed(s.w.meta.settings, p)) },
    { id: 'village', text: 'villages appear', at: 'horizon', check: (s) => s.w.settlements.size > 0 },
    { id: 'real', text: 'nothing fictional ever appears', at: 'horizon', check: (s) => noFiction(s) },
  ] },
  { key: 'primitive', kind: 'preset', horizon: 150, promises: [
    { id: 'bands', text: 'starts with wandering bands only (no towns)', at: 'start', check: (_s, st) => st.nations === 0 && st.tribes > 0 },
    { id: 'village', text: 'a first village appears', at: 'horizon', check: (s) => s.w.settlements.size > 0 },
  ] },
  { key: 'kingdoms', kind: 'preset', horizon: 100, promises: [
    { id: 'kingdoms', text: '≥ 5 nations with towns at start, Bronze-to-Iron era', at: 'start', check: (_s, st) => st.nations >= 5 && st.minEra >= 3 },
    { id: 'temples', text: 'temples stand at start', at: 'start', check: (s) => countBld(s, B.TEMPLE) > 0 },
    { id: 'rivalry', text: 'a war within 100 years (rivalries)', at: 'horizon', check: (s) => s.w.wars.size > 0 },
  ] },
  { key: 'industrial', kind: 'preset', horizon: 120, promises: [
    // Task 8 Part B follow-up: the world starts in era 7 (the description now says so), so "someone reaches the industrial
    // era" held at year 0. The next step can fail: Britain went from early steam (c. 1760) to the second industrial
    // revolution (c. 1870) in about 110 years.
    { id: 'industrial', text: 'every nation starts in the Early Industrial era', at: 'start', check: (_s, st) => st.minEra >= 7 },
    { id: 'late', text: 'someone reaches the Late Industrial era within 120 years', at: 'any', check: (s) => maxEra(s) >= 8 },
    // Task 8c: every nation of the start (coal-less ones too), coal tiles at the start against industrial-tech
    // adoption at the horizon; the era label was tied at 7 for nearly all and reachable without coal
    { id: 'coal', text: 'coal-rich nations industrialise first (rank correlation of coal with industrial-tech adoption > 0)', at: 'horizon', check: (s, st) => {
      const ids = [...st.known.keys()].filter((id) => s.w.civs.get(id)?.alive);
      if (ids.length < 3) return false;
      return spearman(ids.map((id) => st.coal.get(id) ?? 0), ids.map((id) => industrialisation(s.w.civs.get(id)!))) > 0;
    } },
  ] },
  { key: 'modern', kind: 'preset', horizon: 60, promises: [
    { id: 'atomic', text: 'nation-states in the atomic age at start', at: 'start', check: (_s, st) => st.minEra >= 10 },
    { id: 'alliances', text: 'alliances or defensive pacts form', at: 'horizon', check: (s) => treatyKinds(s).some((k) => k === 'alliance' || k === 'defensive') || s.w.orgs.size > 0 },
    { id: 'borders', text: 'tense borders: a border dispute or war', at: 'horizon', check: (s) => s.w.wars.size > 0 || [...s.w.relations.values()].some((r) => r.disputes > 0) },
  ] },
  { key: 'collapse', kind: 'preset', horizon: 150, promises: [
    { id: 'ruins', text: 'ruins of a fallen age at start', at: 'start', check: (_s, st) => st.ruins > 0 },
    { id: 'lost', text: 'knowledge was lost at start', at: 'start', check: (s) => s.w.events.some((e) => e.type === 'tech_lost') },
    { id: 'relearn', text: 'lost knowledge is re-learned', at: 'horizon', check: (s) => {
      const lost = s.w.events.filter((e) => e.type === 'tech_lost' && e.tick === 0);
      return lost.length > 0 && alive(s).some((c) => Object.values(c.techs).filter((t) => t?.known).length > 0) && s.w.events.some((e) => e.type === 'tech' || e.type === 'tech_discovered' || e.type === 'invention');
    } },
    { id: 'survivors', text: 'scattered survivors: ≥ 6 small nations', at: 'start', check: (_s, st) => st.nations >= 6 },
  ] },
  { key: 'alien', kind: 'preset', horizon: 100, promises: [
    { id: 'biomes', text: 'alien biomes (violet meadows, crystal)', at: 'start', check: (s) => { let n = 0; for (let i = 0; i < s.w.map.n; i++) if (s.w.map.terrain[i] === T.ALIEN_GRASS || s.w.map.terrain[i] === T.CRYSTAL) n++; return n > 50; } },
    { id: 'beasts', text: 'alien wildlife', at: 'start', check: (s) => [...s.w.herds.values()].some((h) => /alien/.test(h.species)) },
    { id: 'species', text: 'several intelligent species', at: 'start', check: (s) => new Set([...s.w.civs.values(), ...[]].map((c) => c.species)).size > 1 || new Set([...s.w.bands.values()].map((b) => b.species)).size > 1 },
  ] },
  { key: 'random', kind: 'preset', horizon: 150, promises: [
    { id: 'runs', text: 'a randomised world runs to its horizon', at: 'horizon', check: (s) => s.year >= 150 },
  ] },
  { key: 'cradles', kind: 'scenario', horizon: 400, promises: [
    { id: 'rivers', text: 'a dry world: people start near rivers', at: 'start', check: (s) => [...s.w.bands.values(), ...s.w.settlements.values()].filter((b) => s.w.map.hasFreshWater(s.w.map.idx(Math.floor(b.x), Math.floor(b.y)))).length >= 1 },
    { id: 'agri', text: 'objective: agriculture', at: 'any', check: (s) => objective('cradles', 'agri')(s) },
    { id: 'writing', text: 'objective: writing', at: 'any', check: (s) => objective('cradles', 'writing')(s) },
    { id: 'city', text: 'objective: a settlement of 10,000', at: 'any', check: (s) => objective('cradles', 'city')(s) },
  ] },
  { key: 'islands', kind: 'scenario', horizon: 200, promises: [
    { id: 'sail', text: 'objective: ocean navigation', at: 'any', check: (s) => objective('islands', 'sail')(s) },
    { id: 'sea_trade', text: 'objective: a sea trade route', at: 'any', check: (s) => objective('islands', 'sea_trade')(s) },
  ] },
  { key: 'islands4', kind: 'scenario', horizon: 200, promises: [
    { id: 'sail', text: 'objective: ocean navigation', at: 'any', check: (s) => objective('islands', 'sail')(s) },
    { id: 'sea_trade', text: 'objective: a sea trade route', at: 'any', check: (s) => objective('islands', 'sea_trade')(s) },
  ] },
  { key: 'standoff', kind: 'scenario', horizon: 110, promises: [
    { id: 'org', text: 'objective: an international organization', at: 'any', check: (s) => objective('standoff', 'org')(s) },
    { id: 'no_nukes', text: 'objective: 100 years without a nuclear strike', at: 'horizon', check: (s) => objective('standoff', 'no_nukes')(s) },
    { id: 'brink', text: 'on the brink: at least one war or crisis', at: 'horizon', check: (s) => s.w.wars.size > 0 || ev(s, /crisis|standoff|arms/) },
  ] },
  // Task 8 Part B follow-up: the colony (an era-14 technology, 4 eras above the start) is a long-term goal, reported in
  // each seed's metrics (`colony`: first year, or null) and measured over 450 years by t8b-probes/space-probe.ts
  { key: 'space_race', kind: 'scenario', horizon: 150, report: (s) => ({ colony: s.w.milestones['space:colony'] === undefined ? null : s.w.milestones['space:colony'] - s.w.meta.startYear }), promises: [
    { id: 'race', text: 'objective: two rival nations launch rockets into space', at: 'any', check: (s) => objective('space_race', 'race')(s) },
    { id: 'station', text: 'objective: a space station', at: 'any', check: (s) => objective('space_race', 'station')(s) },
  ] },
  { key: 'fantasy', kind: 'scenario', horizon: 200, promises: [
    { id: 'peoples', text: 'four peoples share the land', at: 'start', check: (s) => new Set([...s.w.civs.values()].map((c) => c.species)).size >= 4 || new Set([...s.w.bands.values()].map((b) => b.species)).size >= 4 },
    { id: 'monsters', text: 'monsters roam', at: 'start', check: (s) => s.w.monsters.size > 0 },
    { id: 'slay', text: 'objective: a monster slain', at: 'any', check: (s) => objective('fantasy', 'slay')(s) },
  ] },
];

export function configFor(key: string, seed: string): WorldConfig {
  const c = defaultConfig();
  c.name = 'Audit'; c.gen.seed = seed; c.gen.width = 128; c.gen.height = 128;
  const p = presetByKey(key);
  const variant = START_VARIANTS.find((x) => x.key === key); // the old era/theme presets: God mode plus the variant
  const sc = SCENARIOS.find((x) => x.key === key);
  if (key === 'islands4') { SCENARIOS.find((x) => x.key === 'islands')!.apply(c); c.settings.startEra = 4; c.gen.width = 128; c.gen.height = 128; return c; } // probe variant
  if (key === 'random') randomizeConfig(c);
  else if (variant) { presetByKey('god')!.apply(c); variant.apply(c); }
  else if (p) p.apply(c);
  else if (sc) sc.apply(c);
  c.gen.width = 128; c.gen.height = 128;
  return c;
}

export function auditMode(spec: ModeSpec, seed: string) {
  const sim = createSimulation(configFor(spec.key, seed));
  const st = snapshot(sim);
  const startMet: Record<string, boolean> = {};
  for (const p of spec.promises) if (p.at === 'start') startMet[p.id] = p.check(sim, st);
  spec.setup?.(sim);
  const met: Record<string, boolean> = { ...startMet };
  for (let y = 1; y <= spec.horizon; y++) {
    sim.runYears(1);
    for (const p of spec.promises) if (p.at === 'any' && !met[p.id] && p.check(sim, st)) met[p.id] = true;
  }
  for (const p of spec.promises) if (p.at === 'horizon') met[p.id] = p.check(sim, st);
  for (const p of spec.promises) met[p.id] ??= false;
  const c = countPeoples(sim.w);
  const metrics = { era: maxEra(sim), nations: c.nations, tribes: c.tribes, wars: sim.w.wars.size, settlements: sim.w.settlements.size, pop: Math.round(c.people), year: sim.year, ...spec.report?.(sim) };
  return { met, metrics };
}

// CLI
if (process.argv[1]?.endsWith('mode-audit.ts')) {
  const want = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : MODES.map((m) => m.key);
  const n = Number(process.argv[3] ?? 3);
  for (const spec of MODES.filter((m) => want.includes(m.key))) {
    const runs: { met: Record<string, boolean>; metrics: Record<string, unknown> }[] = [];
    for (let k = 0; k < n; k++) {
      try { runs.push(auditMode(spec, `audit-${spec.key}-${k}`)); } catch (e) { runs.push({ met: {}, metrics: { error: String(e) } }); }
    }
    console.log(`\n## ${spec.key} (${spec.kind}, ${spec.horizon} years, ${n} seeds)`);
    for (const p of spec.promises) console.log(`  ${p.id.padEnd(10)} ${runs.filter((r) => r.met[p.id]).length}/${n}  ${p.text}`);
    for (const [k, r] of runs.entries()) console.log(`  seed ${k}: ${JSON.stringify(r.metrics)}`);
  }
}
