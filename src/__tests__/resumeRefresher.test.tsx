import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import useSWR, { SWRConfig } from 'swr'

import { reloadPage } from '@/lib/reload'
import { holdPageReload, resetPageReloadHolds } from '@/lib/resumeGuard'
import { ResumeRefresher, MIN_UPTIME_MS, RELOAD_AFTER_AWAY_MS } from '@/components/ResumeRefresher'

vi.mock('@/lib/reload', () => ({ reloadPage: vi.fn() }))

const reloaded = vi.mocked(reloadPage)

// Captured before anything spies on it, so the fake clock can still tell the
// real time underneath.
const realNow = Date.now

/** Milliseconds added to every `Date.now()` the code under test reads. */
let clockOffset = 0

/** Jump the wall clock forward — how a suspension looks from inside the page. */
function travel(ms: number) {
  clockOffset += ms
}

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

/** Background the app, spend `awayMs` away, and come back. */
function backgroundAndResume(awayMs = 0) {
  window.dispatchEvent(new Event('pagehide'))
  setVisibility('hidden')
  travel(awayMs)
  setVisibility('visible')
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })
}

function Panel({ swrKey = '/api/panel' }: { swrKey?: string }) {
  const { data, error } = useSWR<string>(swrKey)
  return h('div', null, error ? `error: ${(error as Error).message}` : (data ?? 'loading'))
}

/** A fresh cache per test, so keys never leak between them. */
function renderInSwr(fetcher: (key: string) => Promise<string>, ui?: React.ReactNode) {
  return render(
    h(
      SWRConfig,
      {
        value: {
          fetcher,
          provider: () => new Map(),
          dedupingInterval: 0,
          revalidateOnFocus: false,
        },
      },
      h(ResumeRefresher, null),
      ui ?? h(Panel, null),
    ),
  )
}

beforeEach(() => {
  clockOffset = 0
  reloaded.mockClear()
  resetPageReloadHolds()
  setOnline(true)
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + clockOffset)
})

afterEach(() => {
  setVisibility('visible')
  vi.restoreAllMocks()
})

// ── The short absence: refetch in place, as before ───────────────────────────

describe('ResumeRefresher, back after a moment', () => {
  it('refetches a mounted key without reloading', async () => {
    let value = 'first'
    const fetcher = vi.fn(async () => value)
    renderInSwr(fetcher)

    await screen.findByText('first')
    expect(fetcher).toHaveBeenCalledTimes(1)

    value = 'second'
    backgroundAndResume(5_000)

    await screen.findByText('second')
    expect(reloaded).not.toHaveBeenCalled()
  })

  it('retries a key whose last fetch failed', async () => {
    // A request killed by the suspension leaves a cached error, and SWR's
    // polling loop will not touch a key in that state — only the resume can
    // bring the panel back.
    const fetcher = vi
      .fn<(key: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue('recovered')
    renderInSwr(fetcher)

    await screen.findByText('error: offline')

    backgroundAndResume(5_000)

    await screen.findByText('recovered')
  })

  it('does not refetch while the app stays in the foreground', async () => {
    const fetcher = vi.fn(async () => 'first')
    renderInSwr(fetcher)

    await screen.findByText('first')
    expect(fetcher).toHaveBeenCalledTimes(1)

    // A plain window focus is not a resume.
    window.dispatchEvent(new Event('focus'))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    expect(reloaded).not.toHaveBeenCalled()
  })

  it('refetches every mounted key, not just the first', async () => {
    let value = 'first'
    const fetcher = vi.fn(async (key: string) => `${key}:${value}`)
    renderInSwr(
      fetcher,
      h('div', null, h(Panel, { swrKey: '/api/a' }), h(Panel, { swrKey: '/api/b' })),
    )

    await screen.findByText('/api/a:first')
    await screen.findByText('/api/b:first')

    value = 'second'
    backgroundAndResume(5_000)

    await screen.findByText('/api/a:second')
    await screen.findByText('/api/b:second')
  })
})

// ── The long absence: reload ─────────────────────────────────────────────────

describe('ResumeRefresher, back after a while', () => {
  it('reloads the page', async () => {
    const fetcher = vi.fn(async () => 'first')
    renderInSwr(fetcher)
    await screen.findByText('first')

    backgroundAndResume(RELOAD_AFTER_AWAY_MS)

    expect(reloaded).toHaveBeenCalledTimes(1)
  })

  it('reloads rather than refetching, so the panels are left alone', async () => {
    const fetcher = vi.fn(async () => 'first')
    renderInSwr(fetcher)
    await screen.findByText('first')
    expect(fetcher).toHaveBeenCalledTimes(1)

    backgroundAndResume(RELOAD_AFTER_AWAY_MS * 10)

    // The fresh document will do the fetching; this one should not bother.
    await waitFor(() => expect(reloaded).toHaveBeenCalled())
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('refetches instead of reloading when the app is offline', async () => {
    // Reloading with no network swaps the app for the browser's error page,
    // which is a worse place to be than looking at slightly old numbers.
    let value = 'first'
    const fetcher = vi.fn(async () => value)
    renderInSwr(fetcher)
    await screen.findByText('first')

    setOnline(false)
    value = 'second'
    backgroundAndResume(RELOAD_AFTER_AWAY_MS)

    await screen.findByText('second')
    expect(reloaded).not.toHaveBeenCalled()
  })

  it('refetches instead of reloading while a dialog is open', async () => {
    let value = 'first'
    const fetcher = vi.fn(async () => value)
    renderInSwr(
      fetcher,
      h('div', null, h(Panel, null), h('div', { role: 'dialog' }, 'rating in progress')),
    )
    await screen.findByText('first')

    value = 'second'
    backgroundAndResume(RELOAD_AFTER_AWAY_MS)

    await screen.findByText('second')
    expect(reloaded).not.toHaveBeenCalled()
  })

  it('refetches instead of reloading while something holds a claim', async () => {
    let value = 'first'
    const fetcher = vi.fn(async () => value)
    renderInSwr(fetcher)
    await screen.findByText('first')

    const release = holdPageReload()
    value = 'second'
    backgroundAndResume(RELOAD_AFTER_AWAY_MS)

    await screen.findByText('second')
    expect(reloaded).not.toHaveBeenCalled()

    // …and reloads again once the claim is dropped.
    release()
    backgroundAndResume(RELOAD_AFTER_AWAY_MS)
    expect(reloaded).toHaveBeenCalledTimes(1)
  })
})

// ── Restored from the back/forward cache ─────────────────────────────────────

describe('ResumeRefresher, restored from bfcache', () => {
  it('reloads when the absence cannot be measured', async () => {
    // A `pageshow` with no matching `pagehide`: the document could be
    // arbitrarily old, so it is treated as a long absence.
    const fetcher = vi.fn(async () => 'first')
    renderInSwr(fetcher)
    await screen.findByText('first')

    travel(MIN_UPTIME_MS)
    pageShow(true)

    expect(reloaded).toHaveBeenCalledTimes(1)
  })

  it('does not reload a page that has only just loaded', async () => {
    // The loop guard. A `pageshow` delivered right after a navigation must not
    // send the app straight into another one.
    vi.resetModules()
    const [{ ResumeRefresher: Fresh }, { reloadPage: freshReload }] = await Promise.all([
      import('@/components/ResumeRefresher'),
      import('@/lib/reload'),
    ])

    const fetcher = vi.fn(async () => 'first')
    render(
      h(
        SWRConfig,
        { value: { fetcher, provider: () => new Map(), dedupingInterval: 0 } },
        h(Fresh, null),
        h(Panel, null),
      ),
    )
    await screen.findByText('first')

    pageShow(true)

    expect(vi.mocked(freshReload)).not.toHaveBeenCalled()
  })
})
