/**
 * Round 5 security audit (docs/SECURITY.md, threat matrix). Regression tests for each fix and
 * static guards that keep the app's attack surface as small as the audit found it.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { sanitizePrefs, loadPrefs, DEFAULT_PREFS } from '../../src/ui/screens/SettingsScreen';
import { framedCrossOrigin } from '../../src/security/framing';
import { CSP_META, CSP_HEADER, headersFile, CSP_DIRECTIVES } from '../../src/security/policy';
import { makeSim } from '../helpers';
import { encodeWorld, decodeWorld, SaveError } from '../../src/persistence/serialize';

const read = (p: string) => readFileSync(p, 'utf8');
function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}
const SRC = walk('src');

describe('stored preferences are validated (threats 16, 31, 36)', () => {
  it('keeps only known keys of the right type', () => {
    const p = sanitizePrefs({ sound: false, labels: 'yes', autosaveMinutes: 10, injected: '<img onerror=x>', tutorialSeen: 1 });
    expect(p).toEqual({ ...DEFAULT_PREFS, sound: false, autosaveMinutes: 10 });
    expect(Object.keys(p).sort()).toEqual(Object.keys(DEFAULT_PREFS).sort());
  });
  it('rejects out-of-range autosave intervals (0 would be fine, -1, 1e9, NaN and strings are not)', () => {
    for (const bad of [-1, 1e9, Number.NaN, '3', 2.5, null]) expect(sanitizePrefs({ autosaveMinutes: bad }).autosaveMinutes).toBe(3);
    expect(sanitizePrefs({ autosaveMinutes: 0 }).autosaveMinutes).toBe(0);
  });
  it('a __proto__ key neither pollutes Object.prototype nor adds properties', () => {
    const p = sanitizePrefs(JSON.parse('{"__proto__": {"polluted": true}, "constructor": {"prototype": {"x": 1}}, "sound": false}'));
    expect(({} as any).polluted).toBeUndefined();
    expect((p as any).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(p)).toBe(Object.prototype);
    expect(p.sound).toBe(false);
  });
  it('the reduce-motion preference is a boolean, off by default', () => {
    expect(DEFAULT_PREFS.reduceMotion).toBe(false);
    expect(sanitizePrefs({ reduceMotion: true }).reduceMotion).toBe(true);
    expect(sanitizePrefs({ reduceMotion: 'yes' }).reduceMotion).toBe(false);
  });
  it('arrays, null and primitives fall back to defaults', () => {
    for (const raw of [null, [], 42, 'x', undefined]) expect(sanitizePrefs(raw)).toEqual(DEFAULT_PREFS);
  });

  describe('loadPrefs with a hostile localStorage', () => {
    const g = globalThis as any;
    const prev = g.localStorage;
    afterEach(() => { g.localStorage = prev; });
    const store = (value: string | null, throws = false) => ({ getItem: () => { if (throws) throw new Error('denied'); return value; }, setItem() {} });
    it('malformed JSON, oversized values and storage errors all give defaults', () => {
      for (const s of [store('{not json'), store('x'.repeat(5000)), store(null, true), store('"string"')]) {
        g.localStorage = s;
        expect(loadPrefs()).toEqual(DEFAULT_PREFS);
      }
      g.localStorage = store(JSON.stringify({ sound: false, autosaveMinutes: 1 }));
      expect(loadPrefs()).toEqual({ ...DEFAULT_PREFS, sound: false, autosaveMinutes: 1 });
    });
  });
});

describe('clickjacking fallback (threat 51)', () => {
  const me = { origin: 'https://example.github.io' };
  it('runs normally at top level and inside a same-origin frame', () => {
    const top: any = { location: me };
    top.self = top; top.top = top;
    expect(framedCrossOrigin({ self: top, top, location: me })).toBe(false);
    const child = { self: {}, top, location: me };
    expect(framedCrossOrigin(child)).toBe(false);
  });
  it('refuses to run when another origin frames it, whether or not the parent can be read', () => {
    expect(framedCrossOrigin({ self: {}, top: { location: { origin: 'https://evil.example' } }, location: me })).toBe(true);
    const opaque = { get location(): never { throw new DOMException('Blocked a frame', 'SecurityError'); } };
    expect(framedCrossOrigin({ self: {}, top: opaque, location: me })).toBe(true);
  });
});

describe('Content-Security-Policy and headers (threats 43, 53, 71)', () => {
  it('allows no inline script, eval, wildcard or third-party origin', () => {
    for (const csp of [CSP_META, CSP_HEADER]) {
      expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|unsafe-hashes|wasm-unsafe-eval|\*|https?:\/\//);
    }
    const d = Object.fromEntries(CSP_DIRECTIVES);
    expect(d['script-src']).toBe("'self'");
    expect(d['object-src']).toBe("'none'");
    expect(d['base-uri']).toBe("'self'");
    expect(d['form-action']).toBe("'none'");
    expect(CSP_META).not.toContain('frame-ancestors'); // ignored in a meta tag, only in the header
    expect(CSP_HEADER).toContain("frame-ancestors 'self'");
  });
  it('public/_headers matches the policy module', () => {
    expect(read('public/_headers')).toBe(headersFile());
    for (const h of ['Strict-Transport-Security', 'X-Content-Type-Options: nosniff', 'Referrer-Policy', 'Permissions-Policy', 'X-Frame-Options']) expect(read('public/_headers')).toContain(h);
  });
  it('index.html loads nothing from another origin and has no inline script or handlers', () => {
    const html = read('index.html');
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/); // every script has a src
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });
  it('the production build injects the CSP meta tag (vite plugin, build only)', () => {
    const cfg = read('vite.config.ts');
    expect(cfg).toMatch(/apply: 'build'/);
    expect(cfg).toContain('CSP_META');
  });
});

describe('save decoder bounds the round-5 catastrophe state (threats 49, 80)', () => {
  const sim = makeSim('sec-endings', 48, (c) => { c.settings.startEra = 8; });
  sim.runYears(2);
  sim.syncRng();
  const split = (b: Uint8Array) => {
    const hlen = new DataView(b.buffer, b.byteOffset).getUint32(4, true);
    const header = JSON.parse(new TextDecoder().decode(b.subarray(8, 8 + hlen)));
    const binStart = 8 + hlen + ((4 - ((8 + hlen) % 4)) % 4);
    return { header, bin: b.slice(binStart) };
  };
  const build = (header: unknown, bin: Uint8Array) => {
    const h = new TextEncoder().encode(JSON.stringify(header));
    const pad = (4 - ((8 + h.length) % 4)) % 4;
    const out = new Uint8Array(8 + h.length + pad + bin.length);
    out.set(new TextEncoder().encode('EPCH'), 0);
    new DataView(out.buffer).setUint32(4, h.length, true);
    out.set(h, 8);
    out.set(bin, 8 + h.length + pad);
    return out;
  };
  const withEndings = (edit: (e: any) => void) => {
    const { header, bin } = split(encodeWorld(sim.w));
    header.state.endings ??= { techLead: { civ: 0, since: 0, changes: 0, history: [] }, chemBan: 0, lastNuclearUse: 0, coolingSource: 'vei7', uv: 0, log: [], cure: {}, goo: [] };
    edit(header.state.endings);
    return build(header, bin);
  };
  it('a well-formed state still loads', () => {
    expect(() => decodeWorld(withEndings(() => {}))).not.toThrow();
  });
  it.each([
    ['an enormous log entry type', (e: any) => { e.log = [{ year: 1, x: 1, y: 1, type: 'x'.repeat(1e5) }]; }],
    ['a non-string log type', (e: any) => { e.log = [{ year: 1, x: 1, y: 1, type: { a: 1 } }]; }],
    ['cure progress outside 0..1', (e: any) => { e.cure = { 1: 1e9 }; }],
    ['non-numeric cure progress', (e: any) => { e.cure = { 1: 'x' }; }],
    ['an oversized cooling source', (e: any) => { e.coolingSource = 'y'.repeat(1000); }],
    ['an unbounded tech-lead history', (e: any) => { e.techLead.history = new Array(3000).fill(1); }],
    ['a nanotech front larger than any map', (e: any) => { e.goo = [{ x: 1, y: 1, r: 1e9 }]; }],
  ])('rejects %s with a SaveError', (_label, edit) => {
    expect(() => decodeWorld(withEndings(edit))).toThrow(SaveError);
  });
  it.each([
    ['a megabyte world name', (h: any) => { h.state.meta.name = 'n'.repeat(1e6); }],
    ['a non-string world name', (h: any) => { h.state.meta.name = { toString: 1 }; }],
    ['an oversized seed', (h: any) => { h.state.meta.seed = 's'.repeat(1000); }],
  ])('rejects %s (names are shown in the UI and used in file names)', (_label, edit) => {
    const { header, bin } = split(encodeWorld(sim.w));
    edit(header);
    expect(() => decodeWorld(build(header, bin))).toThrow(SaveError);
  });
});

describe('static guards on the source tree (threats 13, 43, 45, 54, 55, 65, 87)', () => {
  const offenders = (re: RegExp, allow: string[] = []) => SRC.filter((f) => !allow.some((a) => f.endsWith(a)) && re.test(read(f)));
  it('no HTML sinks or dynamic code execution', () => {
    expect(offenders(/\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|dangerouslySetInnerHTML|document\.write|\beval\s*\(|new Function\s*\(|setTimeout\(\s*['"`]|setInterval\(\s*['"`]/)).toEqual([]);
  });
  it('no network calls (nothing to forge, leak or redirect)', () => {
    expect(offenders(/\bfetch\s*\(|XMLHttpRequest|new WebSocket|EventSource|sendBeacon|import\(\s*['"`]https?:/)).toEqual([]);
  });
  it('no window message listener (postMessage is only used with the same-origin world-generation worker)', () => {
    expect(offenders(/(window|self|globalThis)\.addEventListener\(\s*['"]message['"]|window\.onmessage/, ['workers/worldgen.worker.ts'])).toEqual([]);
  });
  it('Math.random is confined to cosmetic UI code, never the simulation or anything token-like', () => {
    expect(offenders(/Math\.random/, ['ui/game/Game.tsx', 'ui/audio.ts', 'config/laws.ts'])).toEqual([]);
  });
  it('no secrets or credentials in the source (simple patterns; gitleaks-style scan recorded in docs/SECURITY.md)', () => {
    expect(offenders(/AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|github_pat_|sk-[A-Za-z0-9]{32,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[A-Za-z0-9-]+|AIza[0-9A-Za-z_-]{35}/)).toEqual([]);
  });
  it('links that open new tabs use noopener', () => {
    for (const f of SRC) for (const m of read(f).matchAll(/target="_blank"[^>]*/g)) expect(m[0], f).toMatch(/noopener/);
  });
});

describe('CI/CD hardening (threats 72–75)', () => {
  const flows = readdirSync('.github/workflows').map((f) => ['.github/workflows/' + f, read('.github/workflows/' + f)] as const);
  it('every action is pinned to a full commit SHA', () => {
    for (const [f, y] of flows) for (const m of y.matchAll(/uses:\s*(\S+)/g)) expect(m[1], f).toMatch(/@[0-9a-f]{40}$/);
  });
  it('workflows declare read-only default permissions and never use pull_request_target', () => {
    for (const [f, y] of flows) {
      expect(y, f).toMatch(/^permissions:\n\s+contents: read\s*$/m);
      expect(y, f).not.toContain('pull_request_target');
      // no attacker-controlled text in workflows (script injection); the one exception is the commit SHA that CI
      // tested, which the Pages deploy checks out (a 40-hex id, not free text)
      const y2 = y.replace('${{ github.event.workflow_run.head_sha || github.sha }}', '');
      expect(y2, f).not.toMatch(/\$\{\{\s*github\.(event|head_ref)/);
    }
  });
  it('checkout does not leave the token in the workspace', () => {
    for (const [f, y] of flows) if (y.includes('actions/checkout')) expect(y, f).toContain('persist-credentials: false');
  });
  it('Pages deploys only after a green CI run of a push in this repository (round 7)', () => {
    const y = read('.github/workflows/pages.yml');
    expect(y).toMatch(/workflow_run:\n\s+workflows: \[CI\]\n\s+types: \[completed\]/);
    expect(y).not.toMatch(/^\s+push:/m);
    expect(y).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(y).toContain("github.event.workflow_run.event == 'push'");
    expect(y).toContain('github.event.workflow_run.head_repository.full_name == github.repository');
  });
  it('only the Pages deploy job can write, and only to Pages', () => {
    for (const [f, y] of flows) {
      const writes = [...y.matchAll(/^\s+([a-z-]+): write/gm)].map((m) => m[1]);
      expect(writes, f).toEqual(f.endsWith('pages.yml') ? ['pages', 'id-token'] : []);
    }
  });
});
