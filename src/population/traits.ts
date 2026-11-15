/**
 * Personality traits of individuals. Traits shape skills and, for leaders,
 * the decision weights of their civilization (aggression, expansion, piety,
 * science, trade, caution). Values are stylized game-design choices.
 */
export interface TraitDef {
  key: string;
  name: string;
  opposite?: string;
  /** Probability a child inherits it from a parent who has it. */
  heritable: number;
  /** Base chance to appear spontaneously. */
  rarity: number;
  skills?: Partial<{ admin: number; military: number; diplomacy: number; learning: number }>;
  /** Leader influence on civ personality / politics. */
  lead?: Partial<{ aggression: number; expansion: number; piety: number; science: number; trade: number; caution: number; corruption: number; legitimacy: number; tolerance: number; reform: number }>;
  health?: number;
  /** 'innate' traits are rolled at birth / inherited; 'acquired' are earned through life events. */
  kind?: 'innate' | 'acquired';
  /** Short explanation shown in the inspector. */
  desc?: string;
}

export const TRAITS: TraitDef[] = [
  { key: 'ambitious', name: 'Ambitious', opposite: 'content', heritable: 0.2, rarity: 0.12, lead: { expansion: 0.25, aggression: 0.1, reform: 0.1 } },
  { key: 'content', name: 'Content', opposite: 'ambitious', heritable: 0.2, rarity: 0.1, lead: { expansion: -0.2, caution: 0.1 } },
  { key: 'brave', name: 'Brave', opposite: 'craven', heritable: 0.15, rarity: 0.12, skills: { military: 1.5 }, lead: { aggression: 0.1 } },
  { key: 'craven', name: 'Craven', opposite: 'brave', heritable: 0.15, rarity: 0.07, skills: { military: -1.5 }, lead: { caution: 0.2, aggression: -0.15 } },
  { key: 'cruel', name: 'Cruel', opposite: 'kind', heritable: 0.1, rarity: 0.06, lead: { aggression: 0.2, tolerance: -0.2, legitimacy: -0.05 } },
  { key: 'kind', name: 'Kind', opposite: 'cruel', heritable: 0.1, rarity: 0.1, skills: { diplomacy: 1 }, lead: { aggression: -0.15, legitimacy: 0.05, tolerance: 0.1 } },
  { key: 'greedy', name: 'Greedy', opposite: 'generous', heritable: 0.1, rarity: 0.1, lead: { trade: 0.15, corruption: 0.15 } },
  { key: 'generous', name: 'Generous', opposite: 'greedy', heritable: 0.1, rarity: 0.08, lead: { legitimacy: 0.05, corruption: -0.05 } },
  { key: 'pious', name: 'Pious', opposite: 'skeptical', heritable: 0.3, rarity: 0.14, lead: { piety: 0.3 } },
  { key: 'skeptical', name: 'Skeptical', opposite: 'pious', heritable: 0.2, rarity: 0.08, skills: { learning: 1 }, lead: { piety: -0.25, science: 0.1 } },
  { key: 'curious', name: 'Curious', opposite: 'traditionalist', heritable: 0.2, rarity: 0.12, skills: { learning: 1.5 }, lead: { science: 0.25, expansion: 0.05 } },
  { key: 'traditionalist', name: 'Traditionalist', opposite: 'curious', heritable: 0.3, rarity: 0.1, lead: { science: -0.15, reform: -0.25 } },
  { key: 'charismatic', name: 'Charismatic', opposite: 'awkward', heritable: 0.15, rarity: 0.08, skills: { diplomacy: 2 }, lead: { legitimacy: 0.12 } },
  { key: 'awkward', name: 'Awkward', opposite: 'charismatic', heritable: 0.15, rarity: 0.08, skills: { diplomacy: -1.5 }, lead: { legitimacy: -0.05 } },
  { key: 'wise', name: 'Wise', opposite: 'foolish', heritable: 0.1, rarity: 0.07, skills: { admin: 2, diplomacy: 1 }, lead: { caution: 0.1 } },
  { key: 'foolish', name: 'Foolish', opposite: 'wise', heritable: 0.1, rarity: 0.06, skills: { admin: -2 }, lead: { corruption: 0.05 } },
  { key: 'warlike', name: 'Warlike', opposite: 'peaceful', heritable: 0.25, rarity: 0.1, skills: { military: 2 }, lead: { aggression: 0.35 } },
  { key: 'peaceful', name: 'Peaceful', opposite: 'warlike', heritable: 0.25, rarity: 0.1, skills: { diplomacy: 1 }, lead: { aggression: -0.3, trade: 0.1 } },
  { key: 'diligent', name: 'Diligent', opposite: 'lazy', heritable: 0.15, rarity: 0.12, skills: { admin: 1.5 } },
  { key: 'lazy', name: 'Lazy', opposite: 'diligent', heritable: 0.15, rarity: 0.08, skills: { admin: -1.5 }, lead: { corruption: 0.05 } },
  { key: 'honest', name: 'Honest', opposite: 'deceitful', heritable: 0.1, rarity: 0.1, lead: { corruption: -0.15 } },
  { key: 'deceitful', name: 'Deceitful', opposite: 'honest', heritable: 0.1, rarity: 0.08, skills: { diplomacy: 1 }, lead: { corruption: 0.15 } },
  { key: 'tolerant', name: 'Tolerant', opposite: 'zealous', heritable: 0.2, rarity: 0.1, lead: { tolerance: 0.3 } },
  { key: 'zealous', name: 'Zealous', opposite: 'tolerant', heritable: 0.2, rarity: 0.07, lead: { tolerance: -0.3, piety: 0.2 } },
  { key: 'paranoid', name: 'Paranoid', opposite: 'trusting', heritable: 0.1, rarity: 0.06, lead: { caution: 0.25, aggression: 0.05 } },
  { key: 'trusting', name: 'Trusting', opposite: 'paranoid', heritable: 0.1, rarity: 0.08, lead: { caution: -0.15 } },
  { key: 'reformer', name: 'Reformer', heritable: 0.05, rarity: 0.05, lead: { reform: 0.4 } },
  { key: 'explorer', name: 'Wanderlust', heritable: 0.15, rarity: 0.06, lead: { expansion: 0.15 } },
  { key: 'genius', name: 'Genius', heritable: 0.05, rarity: 0.015, skills: { learning: 4, admin: 1 }, lead: { science: 0.3 } },
  { key: 'strong', name: 'Strong', opposite: 'frail', heritable: 0.3, rarity: 0.08, skills: { military: 1 }, health: 0.15 },
  { key: 'frail', name: 'Frail', opposite: 'strong', heritable: 0.3, rarity: 0.06, health: -0.2 },
  // --- acquired through life (population/development.ts); never inherited or rolled at birth
  { key: 'veteran', name: 'Veteran', kind: 'acquired', heritable: 0, rarity: 0, skills: { military: 1 }, lead: { caution: 0.05 }, desc: 'Fought in three or more battles.' },
  { key: 'scarred', name: 'Scarred', kind: 'acquired', heritable: 0, rarity: 0, health: -0.05, lead: { aggression: 0.05 }, desc: 'Wounded in a lost battle.' },
  { key: 'conqueror', name: 'Conqueror', kind: 'acquired', heritable: 0, rarity: 0, skills: { military: 0.5 }, lead: { expansion: 0.15, aggression: 0.1, legitimacy: 0.05 }, desc: 'Five victories, or a decisive war won.' },
  { key: 'tactician', name: 'Tactician', kind: 'acquired', heritable: 0, rarity: 0, skills: { military: 0.5 }, desc: 'Military skill mastered.' },
  { key: 'scholar', name: 'Scholar', kind: 'acquired', heritable: 0, rarity: 0, skills: { learning: 0.5 }, lead: { science: 0.15 }, desc: 'Learning mastered.' },
  { key: 'silver_tongue', name: 'Silver-tongued', kind: 'acquired', heritable: 0, rarity: 0, skills: { diplomacy: 0.5 }, lead: { legitimacy: 0.04, trade: 0.05 }, desc: 'Diplomacy mastered.' },
  { key: 'statesman', name: 'Statesman', kind: 'acquired', heritable: 0, rarity: 0, skills: { admin: 0.5 }, lead: { legitimacy: 0.08, corruption: -0.05 }, desc: 'A decade of capable rule.' },
  { key: 'beloved', name: 'Beloved', kind: 'acquired', heritable: 0, rarity: 0, lead: { legitimacy: 0.1 }, desc: 'Long reign with high legitimacy.' },
  { key: 'tyrant', name: 'Tyrant', kind: 'acquired', heritable: 0, rarity: 0, lead: { legitimacy: -0.1, aggression: 0.1, tolerance: -0.15 }, desc: 'Rules through fear while illegitimate.' },
  { key: 'melancholic', name: 'Melancholic', kind: 'acquired', heritable: 0, rarity: 0, skills: { admin: -1 }, lead: { caution: 0.1, reform: -0.1 }, desc: 'Worn down by chronic stress; may lift in peace.' },
  { key: 'survivor', name: 'Survivor', kind: 'acquired', heritable: 0, rarity: 0, health: 0.05, desc: 'Lived through a deadly epidemic.' },
  { key: 'venerable', name: 'Venerable', kind: 'acquired', heritable: 0, rarity: 0, skills: { diplomacy: 0.5 }, lead: { caution: 0.1, legitimacy: 0.03 }, desc: 'Reached seventy years.' },
];

/** Traits that can be rolled at birth (acquired ones excluded). */
export const INNATE_TRAITS: TraitDef[] = [];

export const TRAIT_BY_KEY: Record<string, TraitDef> = Object.fromEntries(TRAITS.map((t) => [t.key, t]));

for (const t of TRAITS) if (t.kind !== 'acquired') INNATE_TRAITS.push(t);
