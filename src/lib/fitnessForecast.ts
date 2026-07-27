/**
 * Horizon helpers for the dashboard fitness/fatigue/form projection.
 */

/** Longest projection ever shown, in days. Also the horizon we fetch. */
export const MAX_FORECAST_DAYS = 90

/**
 * How many projected days to show next to `periodDays` of measured history.
 *
 * The dashed tail never outruns the solid data — a one-week view gets a week of
 * projection, not three months of it — and never grows past
 * {@link MAX_FORECAST_DAYS}, so the long periods (6M and up) all keep the same
 * three-month outlook.
 */
export function forecastHorizon(periodDays: number): number {
  return Math.min(Math.max(periodDays, 0), MAX_FORECAST_DAYS)
}
