/**
 * Round 10, Task 12: parameter provenance. Every BALANCE coefficient carries an evidence class ([E] evidence-
 * informed shape, [S] stylized, [C] calibrated against a measured target with a recorded result) and a
 * description, and docs/PARAMETERS.md (tools/param-registry.mjs) lists them exactly as the code has them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BALANCE } from '../../src/config/balance';

const src = readFileSync('src/config/balance.ts', 'utf8');

/** The doc comment directly above `key:` at the top level of BALANCE (two-space indent). */
function docOf(key: string): string | null {
  const m = src.match(new RegExp(`/\\*\\*((?:(?!\\*/)[\\s\\S])*)\\*/\\s*\\n  ${key}:`));
  return m ? m[1].replace(/\\s*\\*\\s?/g, ' ').trim() : null;
}

describe('parameter provenance', () => {
  it('every BALANCE parameter has a description with an evidence class', () => {
    const missing = Object.keys(BALANCE).filter((k) => { const d = docOf(k); return !d || !/\[(E|S|C|T)\]/.test(d) || d.replace(/\[(E|S|C|T)\]/, '').trim().length < 8; });
    expect(missing).toEqual([]);
  });

  it('every calibrated [C] parameter names where its calibration is recorded', () => {
    const bad = Object.keys(BALANCE).filter((k) => /\[C\]/.test(docOf(k) ?? '') && !/(VALIDATION|docs\/data|§R\d+)/.test(docOf(k) ?? ''));
    expect(bad).toEqual([]);
  });

  it('docs/PARAMETERS.md is generated from the code and up to date', () => {
    const fresh = execFileSync('node', ['tools/param-registry.mjs', '--stdout'], { encoding: 'utf8' });
    expect(readFileSync('docs/PARAMETERS.md', 'utf8')).toBe(fresh);
  });
});
