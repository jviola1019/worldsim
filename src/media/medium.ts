/** How a civilization's news travels, from its adopted technology (no other dependencies). */
import type { Civ, Medium } from '../sim/types';

const adopted = (civ: Civ, key: string): boolean => (civ.techs[key]?.adoption ?? 0) >= 0.3;

export function mediumOf(civ: Civ | undefined): Medium {
  if (!civ) return 'carving';
  if (adopted(civ, 'brain_interfaces')) return 'holo';
  if (adopted(civ, 'internet')) return 'social';
  if (adopted(civ, 'radio') || adopted(civ, 'television')) return 'broadcast';
  if (adopted(civ, 'telegraph') || adopted(civ, 'mass_media')) return 'newspaper';
  if (adopted(civ, 'printing')) return 'broadsheet';
  if (adopted(civ, 'alphabet')) return 'scroll';
  if (adopted(civ, 'writing')) return 'tablet';
  return 'carving';
}
