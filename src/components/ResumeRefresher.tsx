'use client'

import { useCallback } from 'react'
import { useSWRConfig } from 'swr'
import { useAppResume, type AppResumeInfo } from '@/lib/appResume'
import { isPageReloadHeld } from '@/lib/resumeGuard'
import { reloadPage } from '@/lib/reload'

/**
 * How long the app has to have been away before returning to it reloads the
 * page rather than just refetching.
 *
 * A minute, matching the dashboard's `REFRESH_INTERVAL_MS`: below it the
 * polling loop would have covered the gap anyway, and reloading the page for a
 * glance at another app would be an obnoxious way to answer a tab switch.
 */
export const RELOAD_AFTER_AWAY_MS = 60_000

/**
 * How long a page instance has to have been alive before it is allowed to
 * reload itself.
 *
 * Purely a loop guard. Some browsers deliver a `pageshow` immediately after a
 * navigation, and a reload triggered by that would land on another one. The
 * clock is the wall clock, so this can only ever suppress a reload in the first
 * seconds after a load — never one that follows a genuine long absence.
 */
export const MIN_UPTIME_MS = 10_000

const pageLoadedAt = Date.now()

/**
 * Whether reloading is the right answer to this resume, or whether the app
 * should quietly refetch in place instead.
 */
function shouldReload(awayMs: number | null): boolean {
  // `null` means no matching `pagehide` was seen, which is the restored-from-
  // bfcache case: the document could be arbitrarily old, so treat it as long.
  if (awayMs !== null && awayMs < RELOAD_AFTER_AWAY_MS) return false

  // Reloading without a network replaces the app with the browser's error
  // page, which is a far worse place to be than looking at slightly old data.
  // A phone that has just woken often lands here for a moment.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false

  if (Date.now() - pageLoadedAt < MIN_UPTIME_MS) return false

  // Someone is part-way through something a reload would throw away.
  if (isPageReloadHeld()) return false

  // Any modal is open. One query covers every Radix dialog in the app — the RPE
  // prompt, the upload and export dialogs, the custom-function editor — without
  // each of them having to remember to take a claim.
  if (typeof document !== 'undefined' && document.querySelector('[role="dialog"]')) {
    return false
  }

  return true
}

/**
 * Bring the app up to date when it returns to the foreground.
 *
 * Polling with `refreshInterval` cannot survive a backgrounded mobile app: iOS
 * suspends the page's timers and never replays the ticks that were missed, so a
 * screen left open for hours comes back showing exactly the numbers it was left
 * with. Something has to happen on resume, and what that something should be
 * depends on how long the app was away.
 *
 * **A long absence reloads the page** (issue #86). Refetching in place looks
 * like the gentler option and is not: the access token expires after an hour,
 * so every one of the ten-odd mounted keys answers 401 at once and the athlete
 * waits out a fan-out of refresh-and-retry round-trips on a radio that has only
 * just woken up. A reload asks once — the fresh document's `AuthProvider`
 * restores a single token and fetches once — and picks up any new deploy while
 * it is at it. It is both the faster path and the more thorough one.
 *
 * **A short absence refetches in place**, and so does any resume where a reload
 * would destroy something (see {@link shouldReload}). `mutate` with a key
 * filter only touches keys that still have a mounted hook, and it revives
 * panels the suspension itself broke — SWR's polling loop refuses to fetch a
 * key holding a cached error, which is a likely state after a suspension killed
 * the in-flight request underneath it.
 *
 * Rendered once inside `SWRConfig`, and renders nothing.
 */
export function ResumeRefresher() {
  const { mutate } = useSWRConfig()

  useAppResume(
    useCallback(
      ({ awayMs }: AppResumeInfo) => {
        if (shouldReload(awayMs)) {
          reloadPage()
          return
        }
        // Failures land in each hook's own error state; there is nothing useful
        // to do with the aggregate rejection here.
        mutate(() => true).catch(() => {})
      },
      [mutate],
    ),
  )

  return null
}
