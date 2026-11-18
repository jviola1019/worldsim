/**
 * Media & AI (round 4): era-appropriate outlets, platform life cycles, named AI systems, and their
 * causal effects, tested as counterfactuals on identical clones (one intervention, compare).
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { Simulation } from '../../src/sim/simulation';
import { mediaYearly, mediaOf, mediumOf, civOutlets, civAIs, initMedia } from '../../src/media/media';
import { isBlocked, uniqueName, platformName, aiName, newspaperName, labName } from '../../src/culture/naming';
import { generatePhonology } from '../../src/culture/language';
import { researchOutput } from '../../src/technology/research';
import { armyStrength } from '../../src/military/war';
import { politicsYearly } from '../../src/politics/government';
import { Rng } from '../../src/core/rng';
import { applyPower } from '../../src/powers/powers';
import type { Civ } from '../../src/sim/types';

const clone = (s: Simulation) => { s.syncRng(); return new Simulation(decodeWorld(encodeWorld(s.w))); };
const big = (sim: Simulation): Civ => [...sim.w.civs.values()].filter((c) => c.alive && c.settlements.length).sort((a, b) => b.population - a.population)[0];

describe('names: unbounded, culture-specific, never real brands, never duplicated', () => {
  it('thousands of generated platform, AI, lab and newspaper names contain no real brand', () => {
    const rng = new Rng('names');
    let n = 0;
    for (let k = 0; k < 60; k++) {
      const p = generatePhonology(rng);
      for (let j = 0; j < 50; j++) {
        for (const name of [platformName(rng, p), aiName(rng, p), labName(rng, p, 'Veyra', j % 2 === 0), newspaperName(rng, p, 'Kalthos')]) {
          expect(name.length).toBeGreaterThan(1);
          expect(isBlocked(name), name).toBe(false);
          n++;
        }
      }
    }
    expect(n).toBe(12000);
  });

  it('the blocklist catches real platforms, AIs and outlets', () => {
    for (const real of ['Facebook', 'Twitter Hub', 'TikTok', 'YouTube', 'ChatGPT', 'Claude', 'Gemini', 'Siri', 'Skynet', 'HAL', 'BBC News', 'Reddit']) expect(isBlocked(real), real).toBe(true);
    for (const ok of ['Kavaloop', 'Vellapulse', 'The Kalthos Herald', 'Radio Veyra', 'Sviraion']) expect(isBlocked(ok), ok).toBe(false);
  });

  it('uniqueName never repeats a name, even when the generator keeps proposing the same one', () => {
    const sim = makeSim('names-uniq', 48);
    const taken = new Set<string>();
    const seen = new Set<string>();
    for (let k = 0; k < 500; k++) {
      const n = uniqueName(sim, () => 'Umak', taken);
      expect(seen.has(n)).toBe(false);
      seen.add(n);
    }
  });

  it('no two nations or religions in a long run share a name', () => {
    const sim = makeSim('names-world', 96, (c) => { c.settings.startEra = 4; });
    sim.runYears(80);
    const civs = [...sim.w.civs.values()].map((c) => c.baseName.toLowerCase());
    const rel = [...sim.w.religions.values()].map((r) => r.name.toLowerCase());
    expect(new Set(civs).size).toBe(civs.length);
    expect(new Set(rel).size).toBe(rel.length);
  }, 120000);
});

describe('media follow technology', () => {
  it('the medium of the news follows adopted technology, from carvings to holograms', () => {
    const sim = makeSim('medium', 48, (c) => { c.settings.startEra = 4; });
    const civ = big(sim);
    const set = (keys: string[]) => { for (const k of Object.keys(civ.techs)) civ.techs[k].adoption = 0; for (const k of keys) civ.techs[k] = { known: true, progress: 1, adoption: 1, year: 0 }; };
    const seq: [string[], string][] = [
      [[], 'carving'], [['writing'], 'tablet'], [['writing', 'alphabet'], 'scroll'], [['printing'], 'broadsheet'],
      [['telegraph'], 'newspaper'], [['radio'], 'broadcast'], [['internet'], 'social'], [['internet', 'brain_interfaces'], 'holo'],
    ];
    for (const [keys, medium] of seq) { set(keys); expect(mediumOf(civ), keys.join('+')).toBe(medium); }
  });

  it('every history event records the medium it was told in', () => {
    const sim = makeSim('medium-ev', 64, (c) => { c.settings.startEra = 8; });
    sim.runYears(5);
    const withCiv = sim.w.events.filter((e) => e.civs.length);
    expect(withCiv.length).toBeGreaterThan(0);
    expect(withCiv.every((e) => e.medium)).toBe(true);
  });

  it('a digital-age world grows named outlets, platforms that rise and shut down, and AI systems', () => {
    const sim = makeSim('media-2', 96, (c) => { c.settings.startEra = 11; });
    sim.runYears(150);
    const kinds = new Set([...sim.w.outlets.values()].map((o) => o.kind));
    for (const k of ['chronicle', 'newspaper', 'broadcaster', 'platform']) expect(kinds.has(k as never), k).toBe(true);
    expect(sim.w.events.some((e) => e.type === 'outlet_closed' && /shut down/.test(e.title))).toBe(true); // platform churn
    expect(sim.w.ais.size).toBeGreaterThan(0);
    expect([...sim.w.ais.values()].some((a) => a.version > 1)).toBe(true); // successors
    const names = [...sim.w.outlets.values()].map((o) => o.name.toLowerCase()).concat([...sim.w.ais.values()].filter((a) => a.version === 1).map((a) => a.name.toLowerCase()));
    expect(new Set(names).size).toBe(names.length);
  }, 180000);

  it('outlets and AI systems survive a save exactly (identical futures)', () => {
    const sim = makeSim('media-save', 64, (c) => { c.settings.startEra = 11; });
    sim.runYears(60);
    const B = clone(sim);
    expect(B.digest()).toBe(sim.digest());
    sim.runYears(10); B.runYears(10);
    expect(B.digest()).toBe(sim.digest());
    expect(B.w.outlets.size).toBe(sim.w.outlets.size);
  }, 120000);
});

describe('media and AI change what happens (counterfactuals)', () => {
  const base = makeSim('media-cf', 64, (c) => { c.settings.startEra = 11; });
  base.runYears(3);
  const civId = big(base).id;

  it('polarization raises unrest', () => {
    const A = clone(base), B = clone(base);
    expect(B.digest()).toBe(A.digest());
    const a = A.w.civs.get(civId)!, b = B.w.civs.get(civId)!;
    a.media = { ...initMedia(), polarization: 0 };
    b.media = { ...initMedia(), polarization: 0.9 };
    politicsYearly(A, a); politicsYearly(B, b);
    expect(b.unrest).toBeGreaterThan(a.unrest);
  });

  it('misinformation makes the same epidemic deadlier', () => {
    const A = clone(base), B = clone(base);
    const a = A.w.civs.get(civId)!, b = B.w.civs.get(civId)!;
    a.media = { ...initMedia(), misinformation: 0 };
    b.media = { ...initMedia(), misinformation: 0.9 };
    const s = (sim: Simulation) => sim.w.settlements.get(civId === 0 ? 0 : sim.w.civs.get(civId)!.capital)!;
    // the same outbreak in both worlds
    const sa = s(A), sb = s(B);
    expect(applyPower(A, 'dis_plague', sa.x, sa.y, 1, { selectedCiv: 0 })).toBeNull();
    expect(applyPower(B, 'dis_plague', sb.x, sb.y, 1, { selectedCiv: 0 })).toBeNull();
    for (let k = 0; k < 6; k++) { A.runTicks(10); B.runTicks(10); a.media!.misinformation = 0; b.media!.misinformation = 0.9; }
    expect(b.ledger?.disease ?? 0).toBeGreaterThan(a.ledger?.disease ?? 0);
  }, 60000);

  it('research AIs raise research output; defense AIs raise military strength', () => {
    const A = clone(base);
    const civ = A.w.civs.get(civId)!;
    civ.media = { ...initMedia(), aiResearch: 0, aiDefense: 0 };
    const r0 = researchOutput(A, civ);
    const army = A.w.armies.get(civ.armies[0]);
    const s0 = army ? armyStrength(A, army, civ) : 0;
    civ.media = { ...initMedia(), aiResearch: 2, aiDefense: 2 };
    expect(researchOutput(A, civ)).toBeGreaterThan(r0 * 1.3);
    if (army) expect(armyStrength(A, army, civ)).toBeGreaterThan(s0 * 1.15);
  });

  it('an autocracy bans an independent platform and replaces it with a state-run one', () => {
    const A = clone(base);
    const civ = A.w.civs.get(civId)!;
    civ.inst.liberties = 0.2;
    for (const k of ['internet', 'mobile_telecom']) civ.techs[k] = { known: true, progress: 1, adoption: 1, year: 0 };
    // an independent platform with a real audience
    const id = (A.w.ids.outlet = (A.w.ids.outlet ?? 0) + 1);
    A.w.outlets.set(id, { id, civId: civ.id, kind: 'platform', name: 'Testloop', founded: A.year, settlementId: civ.capital, reach: 0.4, trust: 0.6, stateRun: false, moderation: 0.3, peak: 20 });
    let banned = false;
    for (let y = 0; y < 30 && !banned; y++) {
      civ.inst.liberties = 0.2;
      const m = mediaOf(civ);
      m.polarization = 0.6;
      civ.unrest = 0.5;
      mediaYearly(A, civ);
      banned = A.w.events.some((e) => e.type === 'outlet_closed' && /banned/.test(e.title) && e.civs.includes(civ.id));
    }
    expect(banned).toBe(true);
    expect(civOutlets(A, civ).some((o) => (o.kind === 'platform' || o.kind === 'holonet') && o.stateRun)).toBe(true);
  });

  it('a misaligned, autonomous AI causes incidents, and a free society tightens AI regulation', () => {
    const A = clone(base);
    const civ = A.w.civs.get(civId)!;
    civ.inst.liberties = 0.8;
    civ.policies.aiRegulation = 'none';
    for (const k of ['machine_learning', 'advanced_ai']) civ.techs[k] = { known: true, progress: 1, adoption: 1, year: 0 };
    civ.caps.ai = Math.max(2, civ.caps.ai);
    let incidents = 0;
    for (let y = 0; y < 80 && incidents === 0; y++) {
      mediaYearly(A, civ);
      for (const a of civAIs(A, civ)) { a.alignment = 0; a.capability = 3; }
      incidents = A.w.events.filter((e) => e.type === 'ai_incident' && e.civs.includes(civ.id)).length;
    }
    expect(incidents).toBeGreaterThan(0);
    expect(civ.policies.aiRegulation).not.toBe('none');
    const ev = A.w.events.find((e) => e.type === 'ai_incident')!;
    expect(ev.causes?.length).toBeGreaterThan(0); // recorded causes
  });
});
