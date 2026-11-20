/**
 * Round 10: each news medium themes the whole feed panel. Every text pair meets WCAG AA (4.5:1) and every
 * border/focus pair 3:1, and the CSS tokens are the same as the table the test checks.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MEDIUM_THEME, MEDIUM_TOKENS } from '../../src/ui/mediumTheme';

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255]
    .map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
};
const ratio = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const MEDIUMS = ['carving', 'tablet', 'scroll', 'broadsheet', 'newspaper', 'broadcast', 'social', 'holo'] as const;

describe('medium themes', () => {
  it('covers all 8 mediums', () => {
    expect(Object.keys(MEDIUM_THEME).sort()).toEqual([...MEDIUMS].sort());
  });

  for (const m of MEDIUMS) {
    it(`${m}: text pairs meet 4.5:1, borders and focus 3:1`, () => {
      const t = MEDIUM_THEME[m];
      expect(ratio(t.ink, t.surface), 'ink/surface').toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.muted, t.surface), 'muted/surface').toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.muted, t.card), 'muted/card').toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.accent, t.surface), 'accent/surface').toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.chipInk, t.chip), 'chipInk/chip').toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.cardInk, t.card), 'cardInk/card').toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.line, t.surface), 'line/surface').toBeGreaterThanOrEqual(3);
      expect(ratio(t.focus, t.surface), 'focus/surface').toBeGreaterThanOrEqual(3);
      expect(ratio(t.focus, t.card), 'focus/card').toBeGreaterThanOrEqual(3);
    });
  }

  it('the CSS tokens equal the table', () => {
    const css = readFileSync('src/ui/styles.css', 'utf8');
    for (const m of MEDIUMS) {
      const block = css.match(new RegExp(`\\[data-medium="${m}"\\]\\s*\\{([^}]*)\\}`))?.[1] ?? '';
      for (const k of MEDIUM_TOKENS) {
        const v = block.match(new RegExp(`--m-${k}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
        expect(v?.toLowerCase(), `${m} --m-${k}`).toBe(MEDIUM_THEME[m][k].toLowerCase());
      }
    }
  });
});
