import { apiFetch } from './api'

/**
 * Automatic activity re-analysis scheduler (issue #32).
 *
 * When auto-analysis is enabled, editing an activity's notes or RPE should
 * regenerate its AI coaching analysis so it reflects the athlete's feedback.
 * Because notes/RPE are often edited in bursts, each edit reschedules the
 * trigger with an escalating backoff — 5s, then 15s, then 45s, and so on
 * (×3 each step, capped) — so a flurry of edits results in a single analysis
 * once editing settles.
 *
 * State is module-level and keyed by activity id so the escalation is shared
 * across every edit site (activity detail page, dashboard RPE prompt) and
 * survives component unmounts — e.g. the RPE dialog closing right after a
 * rating still lets the deferred trigger fire.
 *
 * The trigger is the uniform server-side endpoint `POST /activities/{id}/analyze`,
 * which is idempotent while an analysis is pending and works for every user
 * (it resolves each athlete's own LLM config server-side).
 */

const BASE_DELAY_MS = 5_000
const BACKOFF_FACTOR = 3
const MAX_DELAY_MS = 5 * 60 * 1000

interface Pending {
  timer: ReturnType<typeof setTimeout>
  /** Number of times this activity has already been (re)scheduled. */
  step: number
}

const pending = new Map<string, Pending>()

/** Backoff delay for the nth consecutive schedule of an activity (0-based). */
export function reanalyzeDelayMs(step: number): number {
  return Math.min(BASE_DELAY_MS * BACKOFF_FACTOR ** step, MAX_DELAY_MS)
}

async function trigger(activityId: string, locale?: string): Promise<void> {
  pending.delete(activityId)
  try {
    await apiFetch(`/api/activities/${activityId}/analyze`, {
      method: 'POST',
      body: JSON.stringify(locale ? { locale } : {}),
    })
  } catch {
    // Best-effort background re-analysis: swallow errors (e.g. LLM access
    // denied). The athlete can still trigger analysis manually.
  }
}

export interface ScheduleReanalyzeOptions {
  /** Whether auto-analysis is enabled; when false this is a no-op. */
  enabled: boolean
  /** Locale for the analysis language; falls back to the athlete's saved one. */
  locale?: string
}

/**
 * Schedule (or reschedule) an automatic re-analysis for an activity after its
 * notes or RPE were edited. Successive calls before the timer fires escalate
 * the backoff. No-op unless `enabled`.
 */
export function scheduleReanalyze(
  activityId: string,
  { enabled, locale }: ScheduleReanalyzeOptions,
): void {
  if (!enabled) return
  const existing = pending.get(activityId)
  if (existing) clearTimeout(existing.timer)
  const step = existing ? existing.step + 1 : 0
  const timer = setTimeout(() => {
    void trigger(activityId, locale)
  }, reanalyzeDelayMs(step))
  pending.set(activityId, { timer, step })
}

/** Cancel any pending re-analysis for an activity. */
export function cancelReanalyze(activityId: string): void {
  const existing = pending.get(activityId)
  if (existing) {
    clearTimeout(existing.timer)
    pending.delete(activityId)
  }
}
