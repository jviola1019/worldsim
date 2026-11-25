/**
 * Round 10 addendum: more real animals, every real species placeable by hand, growth rates checked against
 * docs/data/round10/research-notes.md (sourced ranges where a source exists; stylized otherwise).
 */
import { describe, it, expect } from 'vitest';
import { SPECIES, SPECIES_BY_KEY } from '../../src/ecology/species';
import { POWER_BY_ID } from '../../src/powers/powers';
import { ALL_SPRITES } from '../../src/rendering/art/index';
import { T } from '../../src/world/terrain';

const REAL = SPECIES.filter((s) => !s.alien);

// sourced maximum annual growth ranges (research-notes.md §1)
const SOURCED: Record<string, [number, number]> = {
  elephant: [0.05, 0.09], // Foley & Faust 2010: 0.07
  buffalo: [0.1, 0.21], // Kakadu feral buffalo 0.10; African buffalo r_max ~0.21
  seal: [0.079, 0.13], // Baltic grey seal 7.9%; harbour seal max just under 13%
  bison: [0.16, 0.25], // Yellowstone sustained 0.115-0.16 (net of removals); maximum at or above that
  whale: [0.03, 0.07], // humpbacks 6.5% (Gulf of Maine); great whales slower
};

describe('species', () => {
  it('the four new real species exist with sensible habitats', () => {
    expect(SPECIES_BY_KEY.elephant.biomes).toEqual(expect.arrayContaining([T.SAVANNA, T.JUNGLE]));
    expect(SPECIES_BY_KEY.elephant.megafauna).toBeFalsy(); // elephants live today, in every era
    expect(SPECIES_BY_KEY.buffalo.biomes).toEqual(expect.arrayContaining([T.SWAMP]));
    expect(SPECIES_BY_KEY.llama.biomes).toEqual(expect.arrayContaining([T.MOUNTAIN, T.HILLS]));
    expect(SPECIES_BY_KEY.llama.domesticable).toBe(true);
    expect(SPECIES_BY_KEY.seal.aquatic).toBe(true);
    expect(SPECIES_BY_KEY.seal.temp[0]).toBeLessThan(0);
  });

  it('every real species can be placed by hand, with an icon and a sprite in the atlas', () => {
    for (const s of REAL) {
      const p = POWER_BY_ID['animal_' + s.key];
      expect(p, s.key).toBeTruthy();
      expect(p.grounded, s.key).toBe(true);
      expect(ALL_SPRITES[p.icon], `${s.key} icon ${p.icon}`).toBeTruthy();
      expect(ALL_SPRITES[s.sprite], `${s.key} sprite`).toBeTruthy();
    }
  });

  it('alien species cannot be placed in Realistic (they have no grounded power)', () => {
    for (const s of SPECIES.filter((x) => x.alien)) expect(POWER_BY_ID['animal_' + s.key]?.grounded ?? false).toBe(false);
  });

  it('growth rates sit inside the sourced ranges', () => {
    for (const [key, [lo, hi]] of Object.entries(SOURCED)) {
      const g = SPECIES_BY_KEY[key].growth;
      expect(g, key).toBeGreaterThanOrEqual(lo);
      expect(g, key).toBeLessThanOrEqual(hi);
    }
  });
});
