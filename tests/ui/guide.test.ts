/**
 * Round 8: the interactive code guide (public/guide/, served at /guide/) keeps the game's security policy and
 * its facts stay in step with the code (regenerate with `node tools/guide-facts.mjs`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { CSP_META } from '../../src/security/policy';

const html = readFileSync('public/guide/index.html', 'utf8');
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

describe('the code guide page', () => {
  it('carries the same Content Security Policy as the game, with no inline script or style', () => {
    const meta = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
    expect(meta).toBe(CSP_META);
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/\sstyle="/);
    expect(html).not.toMatch(/<style/);
    expect(html).not.toMatch(/https?:\/\/(?!github\.com\/jviola1019)/); // no third-party resources
  });

  it('its facts match the code (file count and every source file described)', () => {
    const facts = JSON.parse(readFileSync('public/guide/facts.json', 'utf8'));
    const src = walk('src').filter((f) => /\.(ts|tsx)$/.test(f));
    expect(facts.totals.srcFiles, 'run node tools/guide-facts.mjs').toBe(src.length);
    const listed = new Set(facts.files.map((f: { path: string }) => f.path));
    for (const f of src) expect(listed.has(f), f).toBe(true);
  });

  it('the balance chart data covers the four natural histories, the latest round against the one before', () => {
    const b = JSON.parse(readFileSync('public/guide/balance.json', 'utf8'));
    expect(b.labels).toEqual({ before: 'round 9', after: 'round 10' }); // round 10: was stuck at rounds 7 and 8
    expect(b.worlds.map((w: { world: string }) => w.world)).toEqual(['modern-1', 'modern-2', 'modern-3', 'realistic-1']);
    for (const w of b.worlds) for (const r of [w.before, w.after]) { expect(Number.isFinite(r.unemp)).toBe(true); expect(Number.isFinite(r.warm)).toBe(true); }
    const html = readFileSync('public/guide/index.html', 'utf8');
    expect(html).not.toMatch(/round 7 against round 8/);
  });
});
