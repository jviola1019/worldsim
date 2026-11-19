/**
 * Round 6: nation colour on buildings becomes an accent (muted), so cities are not one flat hue.
 */
import { describe, it, expect } from 'vitest';
import { mutedTeamShades, hexToRgb } from '../../src/rendering/art/palette';
import { composeBlock, streetPoint, type BlockContext } from '../../src/rendering/cityBlocks';
import { B } from '../../src/civilizations/buildingTypes';

const dist = (a: string, b: string) => {
  const [r1, g1, b1] = hexToRgb(a), [r2, g2, b2] = hexToRgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
};

describe('muted nation colour', () => {
  it('sits closer to the neutral material than to the nation colour', () => {
    const t = mutedTeamShades('#c9463d').T;
    expect(dist(t, '#9a8f86')).toBeLessThan(dist(t, '#c9463d'));
  });
  it('is deterministic and still tells nations apart', () => {
    expect(mutedTeamShades('#3a7bd5')).toEqual(mutedTeamShades('#3a7bd5'));
    expect(mutedTeamShades('#3a7bd5').T).not.toBe(mutedTeamShades('#c9463d').T);
  });
});

describe('street-scale walkers and traffic', () => {
  const ctx: BlockContext = { b: B.HOUSE, tier: 6, band: 'city', nb: Array(8).fill('built'), road: 0, h: 99 };
  const plan = composeBlock(ctx);
  it('people walk on sidewalks and vehicles drive in the lane, always inside a street', () => {
    for (let k = 0; k < 50; k++)
      for (const t of [0, 0.37, 0.99]) {
        for (const lane of [false, true]) {
          const p = streetPoint(plan, k * 7919, t, lane)!;
          expect(p).toBeTruthy();
          const inside = plan.streets.some((s) => p.x >= s.x && p.x < s.x + s.w && p.y >= s.y && p.y < s.y + s.h);
          expect(inside).toBe(true);
          const s = plan.streets[p.seg];
          const across = s.w < s.h ? p.x - s.x : p.y - s.y;
          const width = Math.min(s.w, s.h);
          if (lane) expect(across).toBeGreaterThan(0), expect(across).toBeLessThan(width - 1);
          else expect(across === 0 || across === width - 1).toBe(true);
        }
      }
  });
  it('a block with no street has no street point', () => {
    const lone = composeBlock({ ...ctx, nb: Array(8).fill('open') });
    expect(streetPoint(lone, 1, 0.5, false)).toBeNull();
  });
});
