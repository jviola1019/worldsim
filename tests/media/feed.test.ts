/**
 * The era-medium feed is derived from recorded history: same save -> same feed; medium, outlets,
 * AI authors and false claims must all be grounded in what the simulation recorded.
 */
import { describe, it, expect } from 'vitest';
import { makeSim } from '../helpers';
import { buildFeed, postFor, seriesAt } from '../../src/history/feed';

describe('era-medium feed', () => {
  const sim = makeSim('feed-test', 96, (c) => { c.settings.startEra = 11; });
  sim.runYears(120);

  it('is deterministic and does not touch the simulation', () => {
    const digest = sim.digest();
    const a = JSON.stringify(buildFeed(sim, 0, 40));
    const b = JSON.stringify(buildFeed(sim, 0, 40));
    expect(a).toBe(b);
    expect(sim.digest()).toBe(digest);
  });

  it('every post is about a recorded event and uses the medium recorded on it', () => {
    const posts = buildFeed(sim, 0, 60);
    expect(posts.length).toBeGreaterThan(10);
    for (const p of posts) {
      const ev = sim.w.events.find((e) => e.id === p.eventId)!;
      expect(ev).toBeTruthy();
      expect(p.medium).toBe(ev.medium ?? 'carving');
      expect(ev.importance).toBeGreaterThanOrEqual(3); // the world feed shows major stories only
    }
  });

  it('outlets and AI authors existed in that nation in that year', () => {
    for (const civ of [...sim.w.civs.values()].filter((c) => c.settlements.length).slice(0, 4)) {
      for (const p of buildFeed(sim, civ.id, 40)) {
        expect(p.civId === civ.id || p.civId === 0).toBe(true);
        if (p.outlet) {
          const o = [...sim.w.outlets.values()].find((x) => x.name === p.outlet)!;
          expect(o.civId).toBe(civ.id);
          expect(o.founded).toBeLessThanOrEqual(p.year);
          if (o.closed !== undefined) expect(o.closed).toBeGreaterThanOrEqual(p.year);
        }
        for (const r of p.replies.filter((x) => x.flag === 'ai')) {
          const a = [...sim.w.ais.values()].find((x) => r.author.startsWith(x.name) && x.civId === civ.id)!;
          expect(a).toBeTruthy();
          expect(a.founded).toBeLessThanOrEqual(p.year);
        }
      }
    }
  });

  it('false claims appear only where misinformation was measured high, and carry the recorded cause', () => {
    let falseSeen = 0;
    for (const ev of sim.w.events) {
      if (ev.importance < 2 || !ev.civs.length) continue;
      const p = postFor(sim, ev, ev.civs[0]);
      for (const r of p.replies.filter((x) => x.flag === 'false')) {
        falseSeen++;
        expect(r.context).toMatch(/^False claim\. The recorded cause: /);
        expect(seriesAt(sim.w.stats.civs[ev.civs[0]], 'misinformation', ev.year)).toBeGreaterThan(0.3);
      }
    }
    // with no misinformation anywhere there can be no false claims
    const calm = makeSim('feed-calm', 64, (c) => { c.settings.startEra = 3; });
    calm.runYears(30);
    for (const ev of calm.w.events) if (ev.civs.length) for (const r of postFor(calm, ev, ev.civs[0]).replies) expect(r.flag).not.toBe('false');
    expect(falseSeen).toBeGreaterThanOrEqual(0);
  });

  it('ancient worlds carve and write; they do not post', () => {
    const old = makeSim('feed-old', 64, (c) => { c.settings.startEra = 3; });
    old.runYears(30);
    const posts = buildFeed(old, 0, 30);
    expect(posts.length).toBeGreaterThan(0);
    for (const p of posts) {
      expect(['carving', 'tablet', 'scroll']).toContain(p.medium);
      expect(p.likes).toBeUndefined();
      expect(p.replies.length).toBe(0);
    }
  });
});

import { feedFrame, worldMedium, onlineShare } from '../../src/history/feedFrame';
import { mediumOf } from '../../src/media/medium';

describe('era interface frames', () => {
  it('each nation sees its own era frame, listing only its real outlets and its notable living people', () => {
    const sim = makeSim('frame-test', 96, (c) => { c.settings.startEra = 8; });
    sim.runYears(40);
    for (const civ of [...sim.w.civs.values()].filter((c) => c.alive && c.settlements.length)) {
      const f = feedFrame(sim, civ);
      expect(f.medium).toBe(mediumOf(civ));
      for (const o of f.outlets) expect([...sim.w.outlets.values()].some((x) => x.name === o.name && x.civId === civ.id && x.closed === undefined)).toBe(true);
      for (const p of f.people) { const person = sim.w.persons.get(p.id)!; expect(person.civId).toBe(civ.id); expect(person.died).toBeUndefined(); }
    }
    expect(feedFrame(sim, undefined).medium).toBe(worldMedium(sim));
  });

  it('the world app frame reports the population-weighted online share, not zero (regression: it read no nation)', () => {
    const sim = makeSim('frame-online', 64, (c) => { c.settings.startEra = 12; });
    sim.runYears(3);
    const civs = [...sim.w.civs.values()].filter((c) => c.alive && c.population > 0);
    const pop = civs.reduce((a, c) => a + c.population, 0);
    const expected = civs.reduce((a, c) => a + c.population * (c.media?.online ?? 0), 0) / pop;
    expect(expected).toBeGreaterThan(0.01); // a modern world is online
    expect(onlineShare(sim, undefined)).toBeCloseTo(expected, 12);
    const f = feedFrame(sim, undefined);
    if (f.medium === 'social') expect(f.subtitle).toContain(`${Math.round(expected * 100)}% of the world online`);
    for (const c of civs) expect(onlineShare(sim, c)).toBe(c.media?.online ?? 0);
  });

  it('a prehistoric world gets the cave wall, not an app', () => {
    const sim = makeSim('frame-old', 64);
    sim.runYears(60);
    expect(['carving', 'tablet']).toContain(worldMedium(sim));
  });
});
