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
