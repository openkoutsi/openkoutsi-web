'use client'

import { useEffect, useRef } from 'react'

/**
 * Ignore further resume signals for this long after one fires.
 *
 * A single return to the foreground can deliver several events — `pageshow`
 * and `visibilitychange` both arrive when iOS restores a suspended web app —
 * and they all describe the same resume, so one pass is enough. The window
 * matches SWR's default `focusThrottleInterval`.
 */
export const RESUME_THROTTLE_MS = 5_000

export interface AppResumeOptions {
  /** Override the de-duplication window. Mostly useful in tests. */
  throttleMs?: number
}

/** What the resume handler is told about the absence that just ended. */
export interface AppResumeInfo {
  /**
   * How long the app spent in the background, in milliseconds, or `null` when
   * that is not knowable — a `pageshow` restoring a page instance that never
   * saw the matching `pagehide`. Callers that care should read `null` as "we
   * do not know, assume it was a long time".
   *
   * Measured on the wall clock, which is the right one here: it keeps running
   * while the page is suspended, and suspension is exactly what is being
   * measured.
   */
  awayMs: number | null
}

/**
 * Run `callback` whenever the app comes back to the foreground.
 *
 * Mobile browsers — iOS Safari in particular, and most aggressively when the
 * site is launched from a Home Screen icon — suspend JavaScript entirely while
 * the app is backgrounded. Timers do not fire while suspended and do not catch
 * up afterwards, so anything that keeps data fresh with an interval alone goes
 * silent the moment the user switches away and never recovers on return. This
 * is the signal that lets those callers refetch on resume.
 *
 * Three listeners, because no single one is dependable on iOS:
 *
 * - `visibilitychange` is the ordinary tab-switch signal, and by definition a
 *   transition to `visible` can only follow a period of being hidden.
 * - `pageshow` covers restores where the visibility state arrives late or not
 *   at all, which is the historical failure mode of iOS standalone web apps.
 *   Its `persisted` flag marks a page restored from the back/forward cache.
 * - `pagehide` records that the app left the foreground, so a later `pageshow`
 *   can tell a genuine resume from the one that fires on a fresh page load.
 *
 * The first `pageshow` of a normal page load is deliberately ignored: the
 * caller has just mounted and fetched, and a resume callback there would only
 * duplicate that work.
 *
 * The callback is told how long the app was away (see {@link AppResumeInfo}),
 * because a two-second glance at another app and a night on the bedside table
 * do not deserve the same response.
 *
 * Returns an unsubscribe function. Safe to call during SSR, where it does
 * nothing.
 */
export function onAppResume(
  callback: (info: AppResumeInfo) => void,
  options: AppResumeOptions = {},
): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {}
  }

  const throttleMs = options.throttleMs ?? RESUME_THROTTLE_MS
  let lastFiredAt = 0
  let wasHidden = false
  let hiddenAt: number | null = null

  const fire = () => {
    const now = Date.now()
    if (now - lastFiredAt < throttleMs) return
    lastFiredAt = now
    const awayMs = hiddenAt === null ? null : now - hiddenAt
    hiddenAt = null
    callback({ awayMs })
  }

  /**
   * Leaving the foreground. The throttle is reset here rather than only being
   * measured from the last fire: the window exists to collapse the burst of
   * events that *one* resume delivers, and going away and coming back is by
   * definition a new resume however quickly it happens. Without the reset, an
   * athlete who flicks to another app and straight back gets nothing.
   */
  const markHidden = () => {
    wasHidden = true
    if (hiddenAt === null) hiddenAt = Date.now()
    lastFiredAt = 0
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      markHidden()
      return
    }
    wasHidden = false
    fire()
  }

  const handlePageShow = (event: PageTransitionEvent) => {
    // A fresh load, not a resume — the caller is mounting right now.
    if (!event.persisted && !wasHidden) return
    wasHidden = false
    fire()
  }

  const handlePageHide = () => {
    markHidden()
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('pageshow', handlePageShow)
  window.addEventListener('pagehide', handlePageHide)

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('pageshow', handlePageShow)
    window.removeEventListener('pagehide', handlePageHide)
  }
}

/**
 * React binding for {@link onAppResume}.
 *
 * The callback is held in a ref, so it may be redefined on every render
 * without re-subscribing.
 */
export function useAppResume(
  callback: (info: AppResumeInfo) => void,
  options: AppResumeOptions = {},
) {
  const callbackRef = useRef(callback)
  const throttleMs = options.throttleMs

  useEffect(() => {
    callbackRef.current = callback
  })

  useEffect(
    () => onAppResume((info) => callbackRef.current(info), { throttleMs }),
    [throttleMs],
  )
}
