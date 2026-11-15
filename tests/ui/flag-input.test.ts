import { describe, it, expect } from 'vitest';
import { flagPixels, FLAG_W, FLAG_H } from '../../src/rendering/flag';
import { classify } from '../../src/ui/input';

describe('procedural flags', () => {
  it('produce a full grid with at least two colors for every emblem', () => {
    for (let shape = 0; shape < 8; shape++)
      for (let symbol = 0; symbol < 12; symbol++) {
        const px = flagPixels({ color: '#c0392b', emblem: { shape, symbol, c2: '#f1c40f' } });
        expect(px.length).toBe(FLAG_W * FLAG_H);
        if (shape || symbol) expect(new Set(px).size).toBeGreaterThan(1);
      }
  });
  it('keep fields distinct when both colors are equal', () => {
    const px = flagPixels({ color: '#3366cc', emblem: { shape: 1, symbol: 0, c2: '#3366cc' } });
    expect(px[0]).not.toBe(px[FLAG_W * (FLAG_H - 1)]);
  });
  it('are deterministic', () => {
    const f = { color: '#22aa55', emblem: { shape: 3, symbol: 7, c2: '#ffffff' } };
    expect(flagPixels(f)).toEqual(flagPixels(f));
  });
});

describe('gesture classification (pan vs paint)', () => {
  it('two fingers always pinch, even with a brush', () => expect(classify(2, 'brush', false)).toBe('pinch'));
  it('one finger with a brush paints', () => expect(classify(1, 'brush', false)).toBe('paint'));
  it('one finger without a tool pans once moved, otherwise pending tap', () => {
    expect(classify(1, 'none', true)).toBe('pan');
    expect(classify(1, 'none', false)).toBe('pending');
  });
  it('middle/right mouse or space always pans', () => {
    expect(classify(1, 'brush', false, true)).toBe('pan');
    expect(classify(1, 'brush', false, false, 2)).toBe('pan');
  });
});
