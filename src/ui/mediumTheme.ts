/**
 * Round 10: the colours of each news medium. The whole feed panel takes these on (CSS `[data-medium]` blocks
 * in styles.css carry the same values; tests/ui/mediumTheme.test.ts checks both and their WCAG AA contrast).
 */
import type { Medium } from '../sim/types';

export const MEDIUM_TOKENS = ['surface', 'ink', 'muted', 'accent', 'line', 'chip', 'chipInk', 'focus', 'card', 'cardInk'] as const;
export type MediumToken = (typeof MEDIUM_TOKENS)[number];

export const MEDIUM_THEME: Record<Medium, Record<MediumToken, string>> = {
  carving: { surface: '#3f342a', ink: '#f3e7cf', muted: '#d2c0a0', accent: '#f0a070', line: '#9a8466', chip: '#56483a', chipInk: '#f3e7cf', focus: '#ffd27a', card: '#4d4034', cardInk: '#f3e7cf' },
  tablet: { surface: '#c7a77a', ink: '#2a1a0c', muted: '#4e3820', accent: '#6b2410', line: '#6e5434', chip: '#b39066', chipInk: '#2a1a0c', focus: '#2a1a0c', card: '#d6bb92', cardInk: '#2a1a0c' },
  scroll: { surface: '#e4d3a0', ink: '#2a1c0e', muted: '#55432a', accent: '#7a2a12', line: '#8a7448', chip: '#d3bf86', chipInk: '#2a1c0e', focus: '#2a1c0e', card: '#ecdfb4', cardInk: '#2a1c0e' },
  broadsheet: { surface: '#efe3c8', ink: '#2b2118', muted: '#5a4b3a', accent: '#8c1c13', line: '#8a7a62', chip: '#e2d3b2', chipInk: '#2b2118', focus: '#8c1c13', card: '#f6edd8', cardInk: '#2b2118' },
  newspaper: { surface: '#e8e6df', ink: '#1d1d1b', muted: '#4a4a46', accent: '#1d1d1b', line: '#7d7b74', chip: '#d9d6cd', chipInk: '#1d1d1b', focus: '#1d1d1b', card: '#f4f3ee', cardInk: '#1d1d1b' },
  broadcast: { surface: '#10233f', ink: '#ffffff', muted: '#c4d0e4', accent: '#f2b544', line: '#5f7aa6', chip: '#1c3760', chipInk: '#ffffff', focus: '#f2b544', card: '#173057', cardInk: '#ffffff' },
  social: { surface: '#f5f7fb', ink: '#14213d', muted: '#4b5872', accent: '#2459d6', line: '#7a869c', chip: '#e4e9f3', chipInk: '#14213d', focus: '#2459d6', card: '#ffffff', cardInk: '#14213d' },
  holo: { surface: '#1a1240', ink: '#b8f3ff', muted: '#9fc6e0', accent: '#ff8ad8', line: '#6a5fb0', chip: '#2a2160', chipInk: '#b8f3ff', focus: '#ff8ad8', card: '#221a52', cardInk: '#b8f3ff' },
};

/** Round 10, Task 11: each medium's display face (headings, masthead) and readable body face. All bundled (main.tsx). */
export const MEDIUM_FONTS: Record<Medium, { display: string; body: string }> = {
  carving: { display: "'Pixelify Sans', monospace", body: "'Pixelify Sans', monospace" },
  tablet: { display: "'Cinzel', serif", body: "'Alegreya', serif" },
  scroll: { display: "'Almendra', serif", body: "'Alegreya', serif" },
  broadsheet: { display: "'IM Fell English', serif", body: "'IM Fell English', serif" },
  newspaper: { display: "'Old Standard TT', serif", body: "'Old Standard TT', serif" },
  broadcast: { display: "'Oswald', sans-serif", body: "'Atkinson Hyperlegible', sans-serif" },
  social: { display: "'Atkinson Hyperlegible', sans-serif", body: "'Atkinson Hyperlegible', sans-serif" },
  holo: { display: "'Orbitron', sans-serif", body: "'Atkinson Hyperlegible', sans-serif" },
};
