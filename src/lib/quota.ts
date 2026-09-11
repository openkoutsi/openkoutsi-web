/**
 * Display logic for the admin quota-headroom panel (issue #66).
 *
 * Pure, and separate from the component, because these three decisions are the
 * ones that make the panel honest or misleading — and they are worth testing
 * without mounting a page behind an auth guard.
 */

import type { QuotaWindow } from '@/lib/types'

export type AgeUnit = 'seconds' | 'minutes' | 'hours' | 'days'

/**
 * The coarsest unit that still says something useful about an observation's age.
 *
 * Headroom is a *now* number, but it is only as fresh as our last call to the
 * provider, so the age is shown rather than left for the reader to assume. The
 * thresholds overshoot each unit deliberately — "90 min ago" is more legible
 * than "2 h ago" when the short window is 15 minutes.
 */
export function observationAge(seconds: number): { unit: AgeUnit; n: number } {
  const s = Math.max(0, seconds)
  if (s < 90) return { unit: 'seconds', n: Math.round(s) }
  if (s < 5400) return { unit: 'minutes', n: Math.round(s / 60) }
  if (s < 172800) return { unit: 'hours', n: Math.round(s / 3600) }
  return { unit: 'days', n: Math.round(s / 86400) }
}

/** How full the window's bar should be drawn, clamped to 0–100. */
export function quotaBarPercent(usage: number | null, limit: number | null): number {
  if (!limit || limit <= 0) return 0
  return Math.min(100, Math.max(0, Math.round(((usage ?? 0) / limit) * 100)))
}

export type QuotaSeverity = 'reset' | 'critical' | 'warning' | 'ok'

/**
 * How to colour a window's bar.
 *
 * `reset` comes first and unconditionally: when the observation predates the
 * current window the counter has demonstrably emptied, and the 0 we display is
 * inferred rather than seen. Painting an inferred zero as healthy green would
 * be a claim we have not earned — it is drawn neutral instead.
 */
export function quotaSeverity(w: QuotaWindow): QuotaSeverity {
  if (!w.observed_in_window) return 'reset'
  const pct = quotaBarPercent(w.usage, w.limit)
  if (pct >= 90) return 'critical'
  if (pct >= 70) return 'warning'
  return 'ok'
}
