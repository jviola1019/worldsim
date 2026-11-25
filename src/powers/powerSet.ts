/**
 * Round 10: which god powers a world allows. 'all' is god mode, 'grounded' is Realistic (addendum: placing real
 * people and real animals only), 'none' is Observer. Older saves have no powerSet: an observer
 * save stays 'none', anything else is 'all'.
 */
import type { PowerSet, WorldSettings, WorldState } from '../sim/types';
import type { WorldConfig } from '../config/laws';
import { SPECIES_BY_KEY } from '../ecology/species';
import { Deposit } from '../world/resources';
import { T } from '../world/terrain';

export const POWER_SETS: readonly PowerSet[] = ['all', 'grounded', 'none'];

export function powerSetOf(s: WorldSettings): PowerSet {
  return s.powerSet ?? (s.observer ? 'none' : 'all');
}

export function powerAllowed(s: WorldSettings, p: { grounded?: boolean }): boolean {
  const set = powerSetOf(s);
  return set === 'all' || (set === 'grounded' && !!p.grounded);
}

/** Inspector god controls (trait editor, missions, laws) belong to god mode only. */
export const godMode = (s: WorldSettings): boolean => powerSetOf(s) === 'all';

/**
 * Round 10 addendum: Realistic and Observer are "real-world" worlds. They contain only what could exist in
 * the real world: no fantasy peoples or monsters, no god-only horrors, no alien land or wildlife, no exotic
 * matter. Every technically possible thing stays (AI, future weapons, holograms, nuclear war, pandemics).
 */
export const realWorld = (s: WorldSettings): boolean => powerSetOf(s) !== 'all';

/** Turn off every fictional option of a real-world config (before the map is generated). Idempotent. */
export function normalizeReal(cfg: WorldConfig): void {
  if (!realWorld(cfg.settings)) return;
  cfg.settings.fantasy = false;
  cfg.settings.alien = false;
  cfg.gen.fantasy = false;
  cfg.gen.alien = false;
  cfg.laws.fantasyCreatures = false;
  cfg.laws.horrors = false;
}

const FICTION_TERRAIN = new Set<number>([T.ALIEN, T.ALIEN_GRASS, T.CORRUPT, T.CRYSTAL]);

/** Does this world hold anything that could not exist in the real world? */
export function holdsFiction(w: WorldState): boolean {
  if (w.monsters.size) return true;
  for (const s of w.settlements.values()) if (s.horror) return true;
  for (const h of w.herds.values()) if (SPECIES_BY_KEY[h.species]?.alien) return true;
  for (const c of w.civs.values()) if (c.species !== 'human') return true;
  for (const b of w.bands.values()) if (b.species !== 'human') return true;
  const m = w.map;
  for (let i = 0; i < m.n; i++) if (m.dep[i] === Deposit.EXOTIC || FICTION_TERRAIN.has(m.terrain[i])) return true;
  return false;
}

/**
 * A loaded save that claims to be Realistic or Observer but holds fiction (forged, or an early round-10 Realistic
 * world where the Fantasy box was ticked) loads as a god-mode world, intact: no world that counts as real can hold
 * fiction, and nothing is destroyed (review fix: deleting monsters left fantasy peoples and exotic matter behind).
 * A clean one keeps its rules, with every fictional option forced off.
 */
export function reconcileRealWorld(w: WorldState): void {
  if (!realWorld(w.meta.settings)) return;
  if (holdsFiction(w)) {
    w.meta.settings.powerSet = 'all';
    w.meta.settings.observer = false;
    return;
  }
  w.meta.settings.fantasy = false;
  w.meta.settings.alien = false;
  w.laws.fantasyCreatures = false;
  w.laws.horrors = false;
}
