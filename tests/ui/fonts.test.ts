/**
 * Round 10, Task 11: era typography. Every font the interface or the canvas asks for is bundled with the game
 * (or is a generic fallback), each news medium has its own display and body faces, and no generic Georgia or
 * Times is left. Guards against a font that is named but never shipped (the old newspaper masthead).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { MEDIUM_FONTS } from '../../src/ui/mediumTheme';

const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'system-ui', 'ui-monospace', 'ui-rounded', 'ui-serif', 'cursive', 'inherit', 'emoji']);
const css = readFileSync('src/ui/styles.css', 'utf8');
const main = readFileSync('src/main.tsx', 'utf8');
/** Families bundled by main.tsx: '@fontsource/im-fell-english/400.css' → 'im fell english'. */
const bundled = new Set([...main.matchAll(/@fontsource\/([a-z0-9-]+)\//g)].map((m) => m[1].replace(/-/g, ' ')));
const norm = (f: string) => f.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
const known = (f: string) => GENERIC.has(norm(f)) || bundled.has(norm(f)) || norm(f).startsWith('var(');

function familiesIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/font-family:\s*([^;}]+)/g)) out.push(...m[1].split(','));
  for (const m of text.matchAll(/--m-(?:display|body):\s*([^;}]+)/g)) out.push(...m[1].split(','));
  for (const m of text.matchAll(/--font(?:-body)?:\s*([^;}]+)/g)) out.push(...m[1].split(','));
  return out.map((f) => f.trim()).filter(Boolean);
}
function canvasFamilies(): string[] {
  const out: string[] = [];
  for (const dir of ['src/rendering', 'src/ui/charts']) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts') || x.endsWith('.tsx'))) {
      const src = readFileSync(`${dir}/${f}`, 'utf8');
      for (const m of src.matchAll(/font\s*=\s*[`'"]([^`'"]+)[`'"]/g)) {
        const fam = m[1].replace(/\$\{[^}]*\}/g, '').replace(/^.*?\d*px\s*/, '');
        out.push(...fam.split(','));
      }
      for (const m of src.matchAll(/FONT_[A-Z_]+\s*=\s*['"]([^'"]+)['"]/g)) out.push(...m[1].split(','));
    }
  }
  return out.map((f) => f.trim()).filter(Boolean);
}

describe('era typography', () => {
  it('every font family named in the CSS and on the canvas is bundled or generic', () => {
    const missing = [...new Set([...familiesIn(css), ...canvasFamilies()].filter((f) => !known(f)).map(norm))];
    expect(missing).toEqual([]);
  });

  it('no generic Georgia or Times is left', () => {
    expect(/Georgia|Times New Roman/.test(css)).toBe(false);
    for (const dir of ['src/rendering', 'src/ui']) {
      for (const f of readdirSync(dir).filter((x) => /\.tsx?$/.test(x))) expect(/Georgia|Times New Roman/.test(readFileSync(`${dir}/${f}`, 'utf8')), `${dir}/${f}`).toBe(false);
    }
  });

  it("each medium's CSS display and body faces equal MEDIUM_FONTS, and all are bundled", () => {
    for (const [m, f] of Object.entries(MEDIUM_FONTS)) {
      const block = css.match(new RegExp(`\\[data-medium="${m}"\\]\\s*\\{([^}]*)\\}`))?.[1] ?? '';
      expect(block.match(/--m-display:\s*([^;]+);/)?.[1].trim(), `${m} display`).toBe(f.display);
      expect(block.match(/--m-body:\s*([^;]+);/)?.[1].trim(), `${m} body`).toBe(f.body);
      for (const fam of [f.display, f.body]) expect(known(fam.split(',')[0]), `${m}: ${fam}`).toBe(true);
    }
  });
});
