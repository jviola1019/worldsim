/**
 * Round 10 addendum (CI #73/#75, axe target-size on WebKit desktop): clickable chips were about 22 px tall on a fine
 * pointer (2 px padding, 13 px text), under WCAG 2.5.8's 24 px minimum where chips sit side by side (a ruler's
 * family links in the person inspector). The audit opens a random ruler, so it surfaced only on some worlds.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/ui/styles.css', 'utf8');
// rules outside any @media block (a crude but sufficient split for this stylesheet)
const topLevel = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');

describe('target size (WCAG 2.5.8)', () => {
  it('a clickable chip is at least 24 px tall on every pointer, not only on touch screens', () => {
    const rule = topLevel.match(/button\.chip\s*\{([^}]*)\}/);
    expect(rule, 'a top-level button.chip rule').not.toBeNull();
    const min = Number((rule![1].match(/min-height:\s*(\d+)px/) ?? [])[1] ?? 0);
    expect(min).toBeGreaterThanOrEqual(24);
  });
});
