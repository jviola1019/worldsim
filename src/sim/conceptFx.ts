/**
 * Round 7: the one place that decides what every concept shows on the map.
 *
 * Every god power and every event type has an entry: an effect spec, or `{ none: reason }`. Systems
 * never push effects themselves. Powers draw through `powerFx` (called by applyPower), events
 * through `eventFx` (called by logEvent), and ongoing states (battles, sieges, disasters, outbreaks)
 * through `emitFx` with a spec from STATE_FX or DISASTER_FX. Effects are visual only: they live in
 * `sim.fx`, which is never saved or digested and never touches `sim.rng`.
 */
import type { Sim, FxSpec } from './context';
import { addFx } from './context';
import type { HistoryEvent } from './types';

export type { FxSpec };
export type FxEntry = FxSpec | { none: string };

const fx = (kind: string, dur: number, o: Partial<FxSpec> = {}): FxSpec => ({ kind: 'fx.' + kind, dur, ...o });
const none = (reason: string): FxEntry => ({ none: reason });
export const isSpec = (e: FxEntry | undefined): e is FxSpec => !!e && 'kind' in e;

// ------------------------------------------------------------------------------- ongoing states

/** Disasters draw themselves with their real radius (natural ones and the god powers alike). */
export const DISASTER_FX: Record<string, FxSpec> = {
  earthquake: fx('quake', 3, { area: true }),
  volcano: fx('explosion', 1.2, { area: true, then: fx('smoke_dark', 3) }),
  flood: fx('flood', 3, { area: true }),
  tsunami: fx('wave', 2, { area: true, then: fx('flood', 2) }),
  storm: fx('tornado', 3, { area: true }),
  meteor: fx('meteor', 0.8, { then: fx('explosion', 1.2, { area: true, then: fx('smoke', 2) }) }),
  drought: fx('dust', 3, { area: true }),
  blizzard: fx('snow', 3, { area: true }),
  lightning: fx('lightning', 0.6),
  fire: fx('fire_big', 2),
  plague: fx('plague', 3, { area: true }),
};

/** Effects of states that last (fighting, sieges, outbreaks), emitted by their systems while they last. */
export const STATE_FX = {
  battle: fx('clash', 0.6, { cap: 2 }),
  siege: fx('smoke', 1, { cap: 2 }),
  horrorAttack: fx('fire', 1, { cap: 2 }),
  monsterAttack: fx('fire', 2, { cap: 2 }),
  gooSpread: fx('anomaly', 2, { cap: 2 }),
  nuclearBlast: fx('nuke', 4, { area: true, radius: 5, flash: 'white', then: fx('radiation', 3) }),
  orbitalStrike: fx('alien_beam', 1, { then: fx('explosion', 1.2) }),
} satisfies Record<string, FxSpec>;

// ------------------------------------------------------------------------------- god powers

const BRUSH_TERRAIN = fx('dust', 0.5, { cap: 1 });
const BIOMES = ['grass', 'forest', 'jungle', 'desert', 'steppe', 'savanna', 'snow', 'tundra', 'swamp', 'volcanic', 'beach', 'alien_grass', 'corrupt', 'crystal'];
const RESOURCES = ['copper', 'tin', 'iron', 'gold', 'gems', 'coal', 'oil', 'gas', 'uranium', 'rare', 'spices', 'furs', 'fish', 'exotic'];
const ANIMALS = ['deer', 'wolf', 'bison', 'horse', 'sheep', 'bear', 'mammoth', 'fish', 'rabbit', 'elk', 'goat', 'cow', 'boar', 'chicken', 'camel', 'elephant', 'buffalo', 'llama', 'crocodile', 'bigcat', 'penguin', 'seal', 'whale', 'bird'];
const BY_DISASTER = 'drawn by the disaster itself, with its real radius';

export const FX_BY_POWER: Record<string, FxEntry> = {
  // terrain brushes: a dust puff at the stroke (the changed land is the main feedback)
  raise: BRUSH_TERRAIN, lower: BRUSH_TERRAIN, mountain: BRUSH_TERRAIN,
  ocean: fx('splash', 0.5, { cap: 1 }), shallow: fx('foam', 0.5, { cap: 1 }), river: fx('splash', 0.5, { cap: 1 }),
  fertility_up: fx('sparkle', 0.6, { cap: 1 }), fertility_down: BRUSH_TERRAIN,
  ...Object.fromEntries(BIOMES.map((b) => ['biome_' + b, fx('sparkle', 0.6, { cap: 1 })])),
  ...Object.fromEntries(RESOURCES.map((r) => ['res_' + r, fx('star', 0.8, { cap: 1 })])),
  res_remove: BRUSH_TERRAIN,
  // nature
  trees: fx('sparkle', 0.6, { cap: 1 }), clear: BRUSH_TERRAIN,
  rain: fx('rain', 2.5, { area: true, radius: 4 }),
  ...Object.fromEntries(ANIMALS.map((a) => ['animal_' + a, fx('hand', 0.9, { cap: 3, sprite: 'ani.' + a })])),
  monster: fx('smoke_dark', 1, { then: fx('skull', 1.5) }),
  // civilizations
  // round 10 addendum: a pixel hand drops the placed people (about 0.9 s; at most 3 in one place)
  ...Object.fromEntries(['human', 'sylvan', 'delver', 'grakk'].map((k) => ['spawn_' + k, fx('hand', 0.9, { cap: 3, sprite: 'unit.citizen.0' })])),
  found_city: fx('banner', 1.5, { then: fx('sparkle', 1) }),
  grow: fx('heal', 1.5),
  new_nation: fx('flag', 2, { then: fx('sparkle', 1) }),
  transfer: fx('ring', 1.5, { area: true, radius: 2 }),
  destroy_city: fx('explosion', 1.2, { area: true, radius: 2, then: fx('smoke_dark', 2.5) }),
  // religion and culture
  religion_found: fx('star', 2), sacred_site: fx('star', 2),
  culture_seed: fx('ring', 1.5, { area: true, radius: 3 }), tolerance: fx('heal', 1.5),
  religion_spread: fx('star', 0.8, { cap: 1 }),
  // technology
  tech_grant: fx('book', 2), tech_inspire: fx('star', 2), tech_forget: fx('smoke', 2),
  tech_diffuse: fx('book', 1.2, { then: fx('ring', 1.2, { area: true, radius: 3 }) }),
  anomaly: fx('anomaly', 4),
  // diplomacy
  peace: fx('ring', 2, { area: true, radius: 3 }), alliance: fx('flag', 2), coup: fx('clash', 1.5), bless_ruler: fx('heal', 1.5),
  discord: fx('clash', 0.6, { cap: 1 }), harmony: fx('heal', 0.6, { cap: 1 }), rebellion: fx('fire', 0.6, { cap: 1 }),
  // war
  war: fx('banner', 1.2, { then: fx('clash', 1.2) }), spawn_army: fx('banner', 1.5), inspire_troops: fx('flag', 0.6, { cap: 1 }),
  // disasters
  dis_lightning: fx('lightning', 0.6), dis_meteor: none(BY_DISASTER), dis_earthquake: none(BY_DISASTER), dis_volcano: none(BY_DISASTER),
  dis_flood: none(BY_DISASTER), dis_storm: none(BY_DISASTER), dis_drought: none(BY_DISASTER), dis_tsunami: none(BY_DISASTER),
  dis_blizzard: none(BY_DISASTER), dis_fire: fx('fire', 0.6, { cap: 2 }),
  dis_plague: fx('plague', 3, { area: true, radius: 3 }),
  horror_zombie: fx('skull', 1.5, { then: fx('fire', 1.5) }),
  horror_ghoul: fx('skull', 1.5, { then: fx('smoke_dark', 1.5) }),
  horror_blight: fx('skull', 1.5, { then: fx('plague', 1.5) }),
  // future
  nuke: none('drawn by each nuclear blast (state effect) at the struck city'),
  nuclear_war: none('drawn by each nuclear blast (state effect) at the struck cities'),
  asteroid: fx('meteor', 0.8, { flash: 'white', then: fx('explosion', 1.5, { area: true, radius: 6, then: fx('smoke_dark', 3) }) }),
  supervolcano: fx('explosion', 1.5, { area: true, radius: 8, then: fx('smoke_dark', 3) }),
  superflare: fx('star', 2, { area: true, radius: 6, flash: 'white' }),
  gamma_burst: fx('star', 2, { area: true, radius: 8, flash: 'white' }),
  engineered_plague: fx('plague', 2, { area: true, radius: 3, then: fx('skull', 1.5) }),
  infertility_plague: fx('plague', 2.5, { area: true, radius: 3 }),
  ai_uprising: fx('emp', 1.5, { area: true, radius: 3, then: fx('anomaly', 2) }),
  grey_goo: fx('anomaly', 3, { area: true, radius: 3 }),
  emp: fx('emp', 2, { area: true, radius: 5, flash: 'white' }),
  alien: fx('ufo', 3, { then: fx('alien_beam', 2.5) }),
  climate_warm: fx('steam', 2, { area: true, radius: 5 }),
  climate_cool: fx('snow', 2, { area: true, radius: 5 }),
  ai_awaken: fx('anomaly', 3),
};

// ------------------------------------------------------------------------------- events

const BY_POWER = 'god intervention: drawn by the power hook';
const FREQUENT = 'too frequent to mark on the map';
const NO_PLACE = 'no place: shown in the news feed';

/** Keys ending in '*' match a type prefix (treaty_trade, horror_zombie, space_moon, ...). */
export const FX_BY_EVENT: Record<string, FxEntry> = {
  ai_incident: fx('anomaly', 2), ai_launched: fx('star', 2), ai_takeover: fx('emp', 1.5, { area: true, radius: 3, then: fx('anomaly', 2) }),
  alliance_broken: none(NO_PLACE), assimilation: none('gradual process'),
  asteroid: fx('meteor', 0.8, { flash: 'white', then: fx('explosion', 1.5, { area: true, radius: 6, then: fx('smoke_dark', 3) }) }),
  battle: fx('clash', 1.2, { then: fx('smoke', 1.5) }), bioweapon: fx('plague', 2, { then: fx('skull', 1.5) }),
  bombing: fx('explosion', 1.2, { then: fx('smoke', 1.5) }), chemical_attack: fx('plague', 2, { area: true, radius: 2 }),
  chemical_ban: none('a law: shown in the news feed'), civ_fell: fx('skull', 2), civ_founded: fx('flag', 2, { then: fx('sparkle', 1) }),
  climate_tipping: none('global change, no single place'), collapse: fx('smoke_dark', 1.5, { then: fx('skull', 1.5) }),
  colony_independence: fx('flag', 2), construction: none(FREQUENT), coup: fx('clash', 1.5),
  culture_blend: fx('ring', 1.5, { area: true, radius: 2 }), culture_diverged: fx('ring', 1.5, { area: true, radius: 2 }),
  cyberattack: fx('emp', 1.5), debt_crisis: none(NO_PLACE), demographic_collapse: none('gradual process'),
  deposit_exhausted: fx('dust', 1.5), disaster: none(BY_DISASTER), dispersal: fx('dust', 1.5), domestication: fx('sparkle', 1.5),
  election: none(FREQUENT), emp_strike: fx('emp', 2, { area: true, radius: 4, flash: 'white' }), epidemic: fx('plague', 2, { area: true, radius: 2 }),
  ethos_change: none('national values: shown in the news feed'), exploration: fx('star', 1.5), famine: fx('skull', 2),
  federation: fx('flag', 1.5, { then: fx('ring', 1.5, { area: true, radius: 3 }) }), financial_crisis: none(NO_PLACE), first_contact: fx('ring', 1.5, { area: true, radius: 2 }),
  gamma_ray_burst: fx('star', 2, { flash: 'white' }), generated_start: none('world setup'),
  god_alien: none(BY_POWER), god_culture: none(BY_POWER), god_horror: none(BY_POWER), god_nuke: none(BY_POWER), god_people: none(BY_POWER),
  god_plague: none(BY_POWER), god_rain: none(BY_POWER), god_solar: none(BY_POWER),
  goo_contained: fx('heal', 1.5), government_change: fx('banner', 1.5), grey_goo: fx('anomaly', 3, { area: true, radius: 3 }),
  'horror_*': fx('skull', 1.5, { then: fx('plague', 1.5) }), horror_contained: fx('heal', 1.5),
  impact: fx('meteor', 0.8, { then: fx('explosion', 1.2, { area: true, radius: 4, then: fx('smoke', 2) }) }),
  independence: fx('flag', 2), infertility_outbreak: fx('plague', 2), leader: none(FREQUENT), leapfrog: fx('book', 1.5),
  league_founded: fx('coin', 1.5), mission_start: none('a national plan: shown in the news feed'), module: fx('steam', 1.5),
  monster_attack: fx('skull', 1.5), monster_slain: fx('star', 1.5), notable_death: none(FREQUENT), nuclear_state: fx('radiation', 2),
  nuclear_strike: none('drawn by each nuclear blast (state effect) at the struck city'), online_protest: none('online: no place'),
  orbital_strike: none('drawn by the strike itself (state effect)'), org_founded: none('an international body: no place'), org_join: none('an international body: no place'),
  outlet_closed: none(FREQUENT + ' (media churn)'), outlet_founded: none(FREQUENT + ' (media churn)'),
  peace: fx('ring', 2, { area: true, radius: 3 }), religion_extinct: fx('smoke', 2), religion_founded: fx('star', 2),
  revolution: fx('fire', 1.5, { then: fx('flag', 1.5) }), royal_marriage: fx('heal', 1.5), ruler_death: none(FREQUENT), scenario: none('scenario goals'),
  schism: fx('clash', 1.5), sea_level: fx('wave', 2), secession: fx('flag', 2), secularization: none('gradual process'),
  settlement_founded: fx('banner', 1.5), settlement_lost: fx('smoke_dark', 2), settlement_transfer: fx('flag', 1.5), siege: fx('smoke', 1.5),
  'space_*': fx('steam', 2), species_extinct: fx('skull', 1.5), sports_champion: fx('firework', 2), sports_cup: fx('firework', 2),
  state_religion: fx('star', 1.5), subspecies: fx('sparkle', 1.5), succession_crisis: none('court politics: shown in the news feed'),
  tech_lead: none(FREQUENT), tech_lost: fx('smoke', 1.5), trade_disrupted: none('route-level change: shown on the trade overlay'),
  trade_route: fx('coin', 1.5), 'treaty_*': fx('ring', 1.5, { area: true, radius: 2 }), treaty_arms_control: fx('ring', 1.5, { area: true, radius: 2 }),
  ultimatum: none('a diplomatic note: no place'), union: fx('flag', 1.5, { then: fx('ring', 1.5, { area: true, radius: 3 }) }),
  uprising_crushed: fx('fire', 1.2, { then: fx('smoke', 1.5) }), war_declared: fx('banner', 1.2, { then: fx('clash', 1.2) }), war_joined: fx('banner', 1.5),
  weapon_first: fx('star', 1.5), world_created: none('world setup'), world_games: fx('firework', 2.5),
  zombie_cure: fx('heal', 1.5), zombie_refugees: fx('dust', 1.5), zombie_spread: fx('skull', 1.5),
};

/** Effect sprites no concept uses, with the reason (the coverage test checks this list). */
export const UNUSED_SPRITES: Record<string, string> = {};

export function eventEntry(type: string): FxEntry | undefined {
  const exact = FX_BY_EVENT[type];
  if (exact) return exact;
  for (const k of Object.keys(FX_BY_EVENT)) if (k.endsWith('*') && type.startsWith(k.slice(0, -1))) return FX_BY_EVENT[k];
  return undefined;
}

// ------------------------------------------------------------------------------- emitting

/** How many effects of this kind are alive within 2 tiles. */
function nearby(sim: Sim, kind: string, x: number, y: number): number {
  let n = 0;
  for (const f of sim.fx) if (f.kind === kind && (f.x - x) ** 2 + (f.y - y) ** 2 <= 4) n++;
  return n;
}

/** Push one spec at (x, y). `r` is the power or disaster radius for area rings. Throttled per place. */
export function emitFx(sim: Sim, spec: FxSpec, x: number, y: number, r = 0): void {
  // inside a power that draws its own effect, the systems it sets off stay quiet (one tap, one effect)
  if ((sim.cache.fxPower as PowerScope | undefined)?.own) return;
  if (x >= 0 && nearby(sim, spec.kind, x, y) >= (spec.cap ?? 3)) return;
  const ring = spec.area ? Math.max(1, spec.radius ?? r) : 0;
  addFx(sim, spec.kind, x, y, spec.dur, r || undefined, { ring: ring || undefined, then: spec.then, flash: spec.flash, sprite: spec.sprite });
}

interface PowerScope { placed: { x: number; y: number } | null; own: boolean }

/**
 * Run a god power with the event hook muted: one tap draws one effect. The power's effect is drawn at
 * the place its first placed event names (the affected settlement), else at the tap point.
 */
export function withPowerFx<T>(sim: Sim, id: string, x: number, y: number, r: number, run: () => T, applied: (res: T) => boolean): T {
  const prev = sim.cache.fxPower as PowerScope | undefined;
  const own = isSpec(FX_BY_POWER[id]);
  const scope: PowerScope = { placed: null, own };
  sim.cache.fxPower = scope;
  let res: T;
  try {
    res = run();
  } finally {
    sim.cache.fxPower = prev;
  }
  if (applied(res)) {
    const e = FX_BY_POWER[id];
    if (isSpec(e)) emitFx(sim, e, scope.placed?.x ?? x, scope.placed?.y ?? y, r);
  }
  return res;
}

/** The event hook (called by logEvent). Events without a place only flash. */
export function eventFx(sim: Sim, ev: HistoryEvent): void {
  const scope = sim.cache.fxPower as PowerScope | undefined;
  if (scope) {
    if (!scope.placed && ev.x >= 0 && ev.y >= 0) scope.placed = { x: ev.x, y: ev.y };
    return;
  }
  const e = eventEntry(ev.type);
  if (!isSpec(e) || ev.importance < (e.minImportance ?? 2)) return;
  if (ev.x >= 0 && ev.y >= 0) emitFx(sim, e, ev.x, ev.y);
  else if (e.flash) addFx(sim, 'flash', -1, -1, 0.4, undefined, { flash: e.flash });
}
