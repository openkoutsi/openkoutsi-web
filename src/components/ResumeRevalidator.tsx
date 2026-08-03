'use client'

import { useCallback } from 'react'
import { useSWRConfig } from 'swr'
import { useAppResume } from '@/lib/appResume'

/**
 * Refetch every mounted SWR key when the app returns to the foreground.
 *
 * Polling with `refreshInterval` cannot survive a backgrounded mobile app: iOS
 * suspends the page's timers and never replays the ticks that were missed, so
 * a screen left open for hours comes back showing exactly the numbers it was
 * left with. Revalidating on resume is what closes that gap, and it also
 * revives panels the suspension itself broke — SWR's polling loop refuses to
 * fetch a key that holds a cached error, which is a likely state after a
 * suspension killed the in-flight request that the resumed access-token
 * refresh would have retried.
 *
 * `mutate` with a key filter only refetches keys that still have a mounted
 * hook; entries left in the cache by screens nobody is looking at are not
 * touched. It also clears SWR's de-duplication markers first, so a request
 * that was cut short mid-suspension does not suppress the new one.
 *
 * Rendered once inside `SWRConfig`, and renders nothing.
 */
export function ResumeRevalidator() {
  const { mutate } = useSWRConfig()

  useAppResume(
    useCallback(() => {
      // Failures land in each hook's own error state; there is nothing useful
      // to do with the aggregate rejection here.
      mutate(() => true).catch(() => {})
    }, [mutate]),
  )

  return null
}
