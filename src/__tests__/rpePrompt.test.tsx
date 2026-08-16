import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SWRConfig } from 'swr'

import type { Activity, AthleteProfile } from '@/lib/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────
// vi.mock factories are hoisted, so shared state is created via vi.hoisted.
const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  fetcher: vi.fn(),
  athlete: { app_settings: {} } as Partial<AthleteProfile>,
}))

// A minimal translator that echoes keys, so assertions read as key names.
const t = ((key: string) => key) as (k: string) => string

vi.mock('next-intl', () => ({
  useTranslations: () => t,
  useLocale: () => 'en',
}))

vi.mock('@/lib/api', () => ({
  apiFetch: mocks.apiFetch,
  fetcher: mocks.fetcher,
}))

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ athlete: mocks.athlete }),
}))

vi.mock('@/lib/reanalyze', () => ({ scheduleReanalyze: vi.fn() }))

vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }))

import { RpePrompt } from '@/components/activities/RpePrompt'

// ── Helpers ───────────────────────────────────────────────────────────────────

function ride(id: string, name = `Ride ${id}`): Activity {
  return {
    id,
    athlete_id: 'a1',
    sources: ['strava'],
    name,
    sport_type: 'cycling',
    start_time: '2026-08-01T06:00:00Z',
    duration_s: 5400,
    distance_m: 40000,
    elevation_m: 300,
    avg_power: 210,
    weighted_power: 225,
    avg_hr: 141,
    max_hr: 172,
    avg_cadence: 88,
    load: 95,
    intensity: 0.78,
    efficiency_factor: null,
    variability_index: null,
    decoupling_pct: null,
    decoupling_reason: null,
    workout_category: null,
    labels: [],
    notes: null,
    rpe: null,
    has_fit_file: true,
    original_format: null,
    status: 'processed',
    created_at: `2026-08-01T07:00:00Z`,
  }
}

/** What `GET /api/activities/rpe-queue` answers with. */
function queue(...items: Activity[]) {
  return { items, rpe_head: null }
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

/** Background the app and bring it back, the way a phone does. */
async function backgroundAndResume() {
  await act(async () => {
    window.dispatchEvent(new Event('pagehide'))
    setVisibility('hidden')
    setVisibility('visible')
  })
}

/**
 * Let the 60 s poll tick. SWR schedules the next revalidation with a timer, so
 * the clock has to be faked — and advanced inside `act`, because the refetch it
 * kicks off settles in microtasks that render.
 */
async function pollTick() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000)
  })
}

/** A fresh SWR cache per render, so keys never leak between tests. */
function renderPrompt(props: { reloadSignal?: number } = {}) {
  return render(
    h(
      SWRConfig,
      { value: { provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false } },
      h(RpePrompt, props),
    ),
  )
}

const dialog = () => screen.queryByRole('dialog')

/**
 * The dialog names the ride being asked about. Matched loosely because the
 * description also carries the "N more to go" tail when the queue is longer.
 */
const prompted = (name: string) => screen.findByText(new RegExp(name))

beforeEach(() => {
  mocks.apiFetch.mockReset().mockResolvedValue({})
  mocks.fetcher.mockReset()
  mocks.athlete = { app_settings: {} } as Partial<AthleteProfile>
})

afterEach(() => {
  setVisibility('visible')
  vi.useRealTimers()
})

describe('RpePrompt', () => {
  it('prompts for a pending ride on first load', async () => {
    mocks.fetcher.mockResolvedValue(queue(ride('r1', 'Morning loop')))
    renderPrompt()

    expect(await prompted('Morning loop')).toBeInTheDocument()
  })

  it('stays quiet when nothing is pending', async () => {
    mocks.fetcher.mockResolvedValue(queue())
    renderPrompt()

    await waitFor(() => expect(mocks.fetcher).toHaveBeenCalled())
    expect(dialog()).not.toBeInTheDocument()
  })

  it('does not fetch at all when the athlete turned the prompt off', async () => {
    mocks.athlete = { app_settings: { ask_for_rpe: false } } as Partial<AthleteProfile>
    mocks.fetcher.mockResolvedValue(queue(ride('r1')))
    renderPrompt()

    await backgroundAndResume()
    expect(mocks.fetcher).not.toHaveBeenCalled()
    expect(dialog()).not.toBeInTheDocument()
  })

  it('prompts again after the app returns from the background', async () => {
    // The reported bug: an iOS app resumed from the background never remounts,
    // so nothing used to re-check the queue.
    mocks.fetcher.mockResolvedValue(queue(ride('r1', 'Morning loop')))
    const user = userEvent.setup()
    renderPrompt()

    await prompted('Morning loop')
    await user.click(screen.getByText('rpePrompt.askLater'))
    await waitFor(() => expect(dialog()).not.toBeInTheDocument())

    await backgroundAndResume()

    expect(await prompted('Morning loop')).toBeInTheDocument()
  })

  it('prompts on resume for a ride that synced while the app was away', async () => {
    mocks.fetcher.mockResolvedValueOnce(queue()).mockResolvedValue(queue(ride('r2', 'Evening spin')))
    renderPrompt()

    await waitFor(() => expect(mocks.fetcher).toHaveBeenCalled())
    expect(dialog()).not.toBeInTheDocument()

    await backgroundAndResume()

    expect(await prompted('Evening spin')).toBeInTheDocument()
  })

  it('leaves a rating in progress alone when the app is backgrounded and resumed', async () => {
    mocks.fetcher.mockResolvedValue(queue(ride('r1', 'Morning loop'), ride('r2', 'Evening spin')))
    const user = userEvent.setup()
    renderPrompt()

    await prompted('Morning loop')
    await user.click(screen.getByRole('button', { name: '7' }))

    await backgroundAndResume()

    // Still the same ride, still the same answer.
    expect(screen.getByText(/Morning loop/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '7' })).toHaveClass('bg-primary')
  })

  describe('while the page stays open', () => {
    // Radix keeps `pointer-events: none` on the body until the open animation
    // has settled, which a faked clock never lets happen — and the check is not
    // what these tests are about.
    const timerAware = { advanceTimers: vi.advanceTimersByTime, pointerEventsCheck: 0 }

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    it('does not re-open a dismissed prompt when nothing has changed', async () => {
      mocks.fetcher.mockResolvedValue(queue(ride('r1', 'Morning loop')))
      const user = userEvent.setup({ ...timerAware })
      renderPrompt()

      await prompted('Morning loop')
      await user.click(screen.getByText('rpePrompt.askLater'))
      await waitFor(() => expect(dialog()).not.toBeInTheDocument())

      await pollTick()

      expect(mocks.fetcher.mock.calls.length).toBeGreaterThan(1)
      expect(dialog()).not.toBeInTheDocument()
    })

    it('prompts when a new ride turns up in the queue', async () => {
      mocks.fetcher.mockResolvedValue(queue(ride('r1', 'Morning loop')))
      const user = userEvent.setup({ ...timerAware })
      renderPrompt()

      await prompted('Morning loop')
      await user.click(screen.getByText('rpePrompt.askLater'))
      await waitFor(() => expect(dialog()).not.toBeInTheDocument())

      mocks.fetcher.mockResolvedValue(queue(ride('r1', 'Morning loop'), ride('r2', 'Evening spin')))
      await pollTick()

      // The queue is worked oldest-first, so the ride that was dismissed leads
      // it again — what matters is that the athlete is asked at all.
      expect(await prompted('Morning loop')).toBeInTheDocument()
    })
  })

  it('re-checks the queue when the reload signal is bumped', async () => {
    // The dashboard's refresh button and the activities page's upload both do
    // this: an explicit request to be shown whatever is pending.
    mocks.fetcher.mockResolvedValue(queue(ride('r1', 'Morning loop')))
    const user = userEvent.setup()
    const { rerender } = renderPrompt({ reloadSignal: 0 })

    await prompted('Morning loop')
    await user.click(screen.getByText('rpePrompt.askLater'))
    await waitFor(() => expect(dialog()).not.toBeInTheDocument())

    rerender(
      h(
        SWRConfig,
        { value: { provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false } },
        h(RpePrompt, { reloadSignal: 1 }),
      ),
    )

    expect(await prompted('Morning loop')).toBeInTheDocument()
  })

  it('advances the server-side cursor and moves on when a ride is rated', async () => {
    mocks.fetcher.mockResolvedValue(queue(ride('r1', 'Morning loop'), ride('r2', 'Evening spin')))
    const user = userEvent.setup()
    renderPrompt()

    await prompted('Morning loop')
    await user.click(screen.getByRole('button', { name: '7' }))
    await user.click(screen.getByText('rpePrompt.rate'))

    expect(await prompted('Evening spin')).toBeInTheDocument()
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/api/activities/r1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ rpe: 7 }) }),
    )
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/api/athlete',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })
})
