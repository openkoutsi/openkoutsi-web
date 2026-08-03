import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import useSWR, { SWRConfig } from 'swr'
import { ResumeRevalidator } from '@/components/ResumeRevalidator'

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

/** Background the app and bring it back, the way a phone would. */
function backgroundAndResume() {
  window.dispatchEvent(new Event('pagehide'))
  setVisibility('hidden')
  setVisibility('visible')
}

function Panel({ swrKey = '/api/panel' }: { swrKey?: string }) {
  const { data, error } = useSWR<string>(swrKey)
  return h('div', null, error ? `error: ${(error as Error).message}` : (data ?? 'loading'))
}

/** A fresh cache per test, so keys never leak between them. */
function renderInSwr(fetcher: (key: string) => Promise<string>, ui: React.ReactNode) {
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
      h(ResumeRevalidator, null),
      ui,
    ),
  )
}

describe('ResumeRevalidator', () => {
  afterEach(() => {
    setVisibility('visible')
  })

  it('refetches a mounted key when the app returns to the foreground', async () => {
    let value = 'first'
    const fetcher = vi.fn(async () => value)
    renderInSwr(fetcher, h(Panel, null))

    await screen.findByText('first')
    expect(fetcher).toHaveBeenCalledTimes(1)

    value = 'second'
    backgroundAndResume()

    await screen.findByText('second')
  })

  it('retries a key whose last fetch failed', async () => {
    // A request killed by the suspension leaves a cached error, and SWR's
    // polling loop will not touch a key in that state — only the resume can
    // bring the panel back.
    const fetcher = vi
      .fn<(key: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue('recovered')
    renderInSwr(fetcher, h(Panel, null))

    await screen.findByText('error: offline')

    backgroundAndResume()

    await screen.findByText('recovered')
  })

  it('does not refetch while the app stays in the foreground', async () => {
    const fetcher = vi.fn(async () => 'first')
    renderInSwr(fetcher, h(Panel, null))

    await screen.findByText('first')
    expect(fetcher).toHaveBeenCalledTimes(1)

    // A plain window focus is not a resume.
    window.dispatchEvent(new Event('focus'))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
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
    backgroundAndResume()

    await screen.findByText('/api/a:second')
    await screen.findByText('/api/b:second')
  })
})
