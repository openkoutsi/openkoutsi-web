import { afterEach, describe, expect, it, vi } from 'vitest'
import { onAppResume } from '@/lib/appResume'

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

/** jsdom has no PageTransitionEvent, so carry `persisted` on a plain Event. */
function pageShow(persisted: boolean) {
  const event = new Event('pageshow')
  Object.defineProperty(event, 'persisted', { get: () => persisted })
  window.dispatchEvent(event)
}

function pageHide() {
  window.dispatchEvent(new Event('pagehide'))
}

describe('onAppResume', () => {
  afterEach(() => {
    setVisibility('visible')
    vi.useRealTimers()
  })

  it('fires when the page becomes visible again', () => {
    const callback = vi.fn()
    const stop = onAppResume(callback)

    setVisibility('hidden')
    expect(callback).not.toHaveBeenCalled()

    setVisibility('visible')
    expect(callback).toHaveBeenCalledTimes(1)

    stop()
  })

  it('ignores the pageshow of a fresh page load', () => {
    const callback = vi.fn()
    const stop = onAppResume(callback)

    pageShow(false)
    expect(callback).not.toHaveBeenCalled()

    stop()
  })

  it('fires on a pageshow restored from the back/forward cache', () => {
    const callback = vi.fn()
    const stop = onAppResume(callback)

    pageShow(true)
    expect(callback).toHaveBeenCalledTimes(1)

    stop()
  })

  it('fires on pageshow after a pagehide even when it is not persisted', () => {
    // The iOS standalone case: the app was suspended and comes back without a
    // usable visibility transition.
    const callback = vi.fn()
    const stop = onAppResume(callback)

    pageHide()
    pageShow(false)
    expect(callback).toHaveBeenCalledTimes(1)

    stop()
  })

  it('collapses the burst of events from a single resume into one call', () => {
    const callback = vi.fn()
    const stop = onAppResume(callback)

    pageHide()
    setVisibility('hidden')
    pageShow(true)
    setVisibility('visible')
    expect(callback).toHaveBeenCalledTimes(1)

    stop()
  })

  it('fires again once the throttle window has passed', () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    const stop = onAppResume(callback, { throttleMs: 5_000 })

    setVisibility('hidden')
    setVisibility('visible')
    expect(callback).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(5_001)
    setVisibility('hidden')
    setVisibility('visible')
    expect(callback).toHaveBeenCalledTimes(2)

    stop()
  })

  it('fires on a second resume inside the throttle window', () => {
    // The throttle is there to collapse the burst of events one resume
    // delivers, not to ignore a second resume. Flicking to another app and
    // straight back is a new resume however fast it happens (issue #86).
    const callback = vi.fn()
    const stop = onAppResume(callback, { throttleMs: 5_000 })

    setVisibility('hidden')
    setVisibility('visible')
    expect(callback).toHaveBeenCalledTimes(1)

    setVisibility('hidden')
    setVisibility('visible')
    expect(callback).toHaveBeenCalledTimes(2)

    stop()
  })

  describe('the absence it reports', () => {
    it('measures how long the app was away', () => {
      vi.useFakeTimers()
      const callback = vi.fn()
      const stop = onAppResume(callback)

      setVisibility('hidden')
      vi.advanceTimersByTime(90_000)
      setVisibility('visible')

      expect(callback).toHaveBeenCalledWith({ awayMs: 90_000 })

      stop()
    })

    it('measures from the pagehide when one came first', () => {
      vi.useFakeTimers()
      const callback = vi.fn()
      const stop = onAppResume(callback)

      pageHide()
      vi.advanceTimersByTime(1_000)
      setVisibility('hidden')
      vi.advanceTimersByTime(29_000)
      pageShow(true)

      // The app left the foreground at the `pagehide`, not at the visibility
      // change that trailed it.
      expect(callback).toHaveBeenCalledWith({ awayMs: 30_000 })

      stop()
    })

    it('reports an unknown absence for a bare persisted pageshow', () => {
      // Restored from the back/forward cache on a page instance that never saw
      // the matching `pagehide` — the age of the document is not knowable here.
      const callback = vi.fn()
      const stop = onAppResume(callback)

      pageShow(true)

      expect(callback).toHaveBeenCalledWith({ awayMs: null })

      stop()
    })
  })

  it('stops listening after unsubscribing', () => {
    const callback = vi.fn()
    const stop = onAppResume(callback)
    stop()

    setVisibility('hidden')
    setVisibility('visible')
    pageShow(true)
    expect(callback).not.toHaveBeenCalled()
  })
})
