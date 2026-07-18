/**
 * Shared formatting helpers for the deterministic plan-adherence scores
 * (issue #26). A score is a 0–100 percentage; `null` means "not yet scored".
 */

/** Format a 0–100 score as a whole-percent string, or an em dash when null. */
export function formatAdherence(score: number | null | undefined): string {
  if (score == null) return '—'
  return `${Math.round(score)}%`
}

/**
 * Whether the UI should surface adherence scores, from the athlete's
 * `app_settings.show_adherence` preference. The score is always computed on the
 * backend; this only gates display. Defaults to **on** (an unset preference
 * shows the scores).
 */
export function showAdherenceScores(
  appSettings: Record<string, unknown> | null | undefined,
): boolean {
  return appSettings?.show_adherence !== false
}

/**
 * Tailwind left-border accent class for a score band, used to stripe the plan
 * calendar's workout chips. Empty string when the score is null (no accent).
 */
export function adherenceAccentClass(score: number | null | undefined): string {
  if (score == null) return ''
  if (score >= 85) return 'border-l-4 border-l-emerald-500'
  if (score >= 60) return 'border-l-4 border-l-amber-500'
  return 'border-l-4 border-l-red-500'
}

/**
 * Tailwind classes (badge background/text) for a score band. Green ≥ 85,
 * amber ≥ 60, red below. Neutral when the score is null.
 */
export function adherenceBadgeClass(score: number | null | undefined): string {
  if (score == null) {
    return 'bg-muted text-muted-foreground'
  }
  if (score >= 85) {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
  }
  if (score >= 60) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  }
  return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
}
