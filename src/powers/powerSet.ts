/**
 * Round 10: which god powers a world allows. 'all' is god mode, 'grounded' is Realistic (real people, real
 * animals, shaping the land, natural disasters), 'none' is Observer. Older saves have no powerSet: an observer
 * save stays 'none', anything else is 'all'.
 */
import type { PowerSet, WorldSettings, WorldState } from '../sim/types';
import type { WorldConfig } from '../config/laws';
import { SPECIES_BY_KEY } from '../ecology/species';

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

/** A loaded real-world save (forged or old) keeps no fictional beings, whatever it claims. */
export function stripFiction(w: WorldState): void {
  if (!realWorld(w.meta.settings)) return;
  w.meta.settings.fantasy = false;
  w.meta.settings.alien = false;
  w.laws.fantasyCreatures = false;
  w.laws.horrors = false;
  w.monsters.clear();
  for (const [id, h] of w.herds) if (SPECIES_BY_KEY[h.species]?.alien) w.herds.delete(id);
  for (const s of w.settlements.values()) delete s.horror;
}
