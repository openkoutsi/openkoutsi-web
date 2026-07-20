/**
 * Shared preference helper for the dashboard weekly-load chart.
 */

/**
 * Whether the UI should surface the weekly training-load chart, from the
 * athlete's `app_settings.show_weekly_load` preference. The load is always
 * computed on the backend; this only gates display. Defaults to **on** (an
 * unset preference shows the chart).
 */
export function showWeeklyLoad(
  appSettings: Record<string, unknown> | null | undefined,
): boolean {
  return appSettings?.show_weekly_load !== false
}
