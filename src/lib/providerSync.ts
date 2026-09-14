/**
 * What to say about a provider import that did not finish (issue #68).
 *
 * A backfill has four ways to end before it reaches the end of an athlete's
 * history — the provider rate-limiting us, the walk's own safety limit, a
 * provider that stops serving activity data, and another import taking the lease
 * — and until the backend started recording them, all four looked exactly like a
 * finished import from here. The athlete saw an import that stopped, with no way
 * to tell whether it was done and no reason to press Sync again.
 *
 * Pure and separate from the card, because the decision worth testing is *which*
 * of those things we tell them, not how it is styled.
 */

import type { ProviderSyncStatus } from '@/lib/types'

export type SyncTone = 'muted' | 'warning'

export interface SyncLine {
  /** Message key under `app.profile.provider.sync`. */
  key: string
  values?: Record<string, string | number>
}

export interface SyncNote {
  tone: SyncTone
  lines: SyncLine[]
}

/** Stop reasons the backend records, mapped to the line each one earns. */
const STOP_LINES: Record<string, string> = {
  throttled: 'stoppedThrottled',
  safety_limit: 'stoppedSafetyLimit',
  provider_outage: 'stoppedProviderOutage',
  lease_lost: 'stoppedLeaseLost',
  error: 'stoppedError',
}

/**
 * The note to show under a provider's card, or null when there is nothing to say.
 *
 * Null for a provider nobody has synced yet: a freshly connected account has not
 * failed at anything, and an empty state that reads like a warning is worse than
 * no line at all.
 */
export function syncNote(sync: ProviderSyncStatus | undefined | null): SyncNote | null {
  if (!sync || sync.status === 'never') return null

  if (sync.status === 'running') {
    return { tone: 'muted', lines: [{ key: 'running' }] }
  }

  if (sync.status === 'completed') {
    return {
      tone: 'muted',
      lines: [{ key: 'finished', values: { count: sync.imported } }],
    }
  }

  const lines: SyncLine[] = [
    sync.status === 'interrupted'
      ? { key: 'interrupted' }
      : // An unrecognised reason still gets a line: "it stopped" is the part the
        // athlete needs, and a future backend reason must not render as silence.
        { key: STOP_LINES[sync.stop_reason ?? ''] ?? 'stoppedError' },
  ]

  if (sync.imported > 0) {
    lines.push({ key: 'importedSoFar', values: { count: sync.imported } })
  }
  if (sync.oldest_seen_on) {
    lines.push({ key: 'reached', values: { date: sync.oldest_seen_on } })
  }
  // One bad afternoon is not worth a sentence; the same stop three runs running
  // is the thing no single run could tell them, and the reason to mention it.
  if (sync.repeat_count > 1) {
    lines.push({ key: 'repeated', values: { n: sync.repeat_count } })
  }
  // The point of the whole line: there is more history, and pressing Sync gets
  // it. Driven by `more_expected` rather than by the status, so a reason this
  // build has never heard of still ends with something to do about it.
  if (sync.more_expected) {
    lines.push({ key: 'resume' })
  }

  return { tone: 'warning', lines }
}

/** Whether the card should invite the athlete to press Sync again. */
export function invitesResume(sync: ProviderSyncStatus | undefined | null): boolean {
  return Boolean(sync?.more_expected)
}
