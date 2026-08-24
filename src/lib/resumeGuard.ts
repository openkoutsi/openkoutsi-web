'use client'

import { useEffect } from 'react'

/**
 * Claims against reloading the page out from under work in progress.
 *
 * Coming back from the background reloads the app (see `ResumeRefresher`), and
 * a reload throws away everything held in component state. Most of that is
 * cheap to rebuild, but some of it is the athlete's own typing: a half-written
 * chat message, a file part-way through uploading, the middle of the
 * onboarding wizard. Anything holding that kind of state takes a claim here,
 * and while at least one is outstanding the app revalidates in place instead.
 *
 * A counter rather than a flag, because two holders can overlap and the second
 * releasing must not cancel the first.
 */
let holds = 0

/** Take a claim. Call the returned function to release it. */
export function holdPageReload(): () => void {
  holds += 1
  let released = false
  return () => {
    if (released) return
    released = true
    holds -= 1
  }
}

/** Whether anything currently objects to the page being reloaded. */
export function isPageReloadHeld(): boolean {
  return holds > 0
}

/** Test seam: drop every outstanding claim. */
export function resetPageReloadHolds() {
  holds = 0
}

/**
 * Hold a claim for as long as `active` is true.
 *
 * The React binding for {@link holdPageReload}, and how every caller in the app
 * uses it — `useHoldPageReload(draft.length > 0)` reads as what it means.
 */
export function useHoldPageReload(active: boolean) {
  useEffect(() => {
    if (!active) return
    return holdPageReload()
  }, [active])
}
