/**
 * Simulation time scales.
 *
 * The simulation advances in discrete TICKS that are independent of the
 * rendering frame rate. One year = 120 ticks (one tick is ~3 days).
 *
 *   per tick   : movement of agents (bands, settlers, armies, fleets, herds),
 *                battles, fires, weather effects
 *   monthly    : settlement demography, production, construction, disease,
 *                local religion/culture diffusion — STAGGERED: settlement s
 *                updates on tick-in-month (s.id % TICKS_PER_MONTH)
 *   yearly     : civilization decisions, research & adoption, politics,
 *                diplomacy — STAGGERED: civ c updates on day (c.id * 37 % 120)
 *   decadal+   : climate change, species evolution, border snapshots
 *
 * Staggering spreads computational load evenly over ticks, which keeps frame
 * times smooth on phones while preserving deterministic ordering.
 */
export const TICKS_PER_MONTH = 10;
export const MONTHS_PER_YEAR = 12;
export const TICKS_PER_YEAR = TICKS_PER_MONTH * MONTHS_PER_YEAR;

export const MONTH_NAMES = ['Thaw', 'Bloom', 'Sowing', 'Rains', 'Highsun', 'Harvest', 'Gold', 'Ember', 'Frost', 'Dark', 'Deepwinter', 'Waking'];
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
export type Season = (typeof SEASONS)[number];

export function yearOf(tick: number, startYear: number): number {
  return startYear + Math.floor(tick / TICKS_PER_YEAR);
}
export function monthOf(tick: number): number {
  return Math.floor((tick % TICKS_PER_YEAR) / TICKS_PER_MONTH);
}
/** Season index 0..3 for the northern hemisphere convention (month 0-2 spring...). */
export function seasonOf(tick: number): number {
  return Math.floor(monthOf(tick) / 3);
}
/** Growing-season weight for a month at a given absolute latitude (0..1). Used for harvest timing. */
export function growingWeight(month: number, absLat: number): number {
  // Tropics grow all year; high latitudes have a short summer peak.
  const summerPeak = Math.cos(((month - 4.5) / 12) * 2 * Math.PI); // 1 at mid-summer
  const seasonality = Math.min(1, absLat / 60);
  return Math.max(0, 1 - seasonality + seasonality * (0.35 + 0.65 * summerPeak) * 1.15);
}

export function formatYear(year: number): string {
  return year < 0 ? `${-year} BE` : `Year ${year}`;
}
