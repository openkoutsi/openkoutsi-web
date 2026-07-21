import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}))

import { apiFetch } from '@/lib/api'
import {
  cancelReanalyze,
  reanalyzeDelayMs,
  scheduleReanalyze,
} from '@/lib/reanalyze'

const mockedFetch = vi.mocked(apiFetch)

describe('reanalyzeDelayMs', () => {
  it('escalates 5s → 15s → 45s → 135s and caps at 5min', () => {
    expect(reanalyzeDelayMs(0)).toBe(5_000)
    expect(reanalyzeDelayMs(1)).toBe(15_000)
    expect(reanalyzeDelayMs(2)).toBe(45_000)
    expect(reanalyzeDelayMs(3)).toBe(135_000)
    expect(reanalyzeDelayMs(20)).toBe(5 * 60 * 1000)
  })
})

describe('scheduleReanalyze', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    cancelReanalyze('a1')
    cancelReanalyze('a2')
    mockedFetch.mockReset()
    mockedFetch.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is a no-op when auto-analysis is disabled', async () => {
    scheduleReanalyze('a1', { enabled: false })
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it('fires the analyze endpoint after the first 5s with the locale', async () => {
    scheduleReanalyze('a1', { enabled: true, locale: 'fi' })
    expect(mockedFetch).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(mockedFetch).toHaveBeenCalledTimes(1)
    expect(mockedFetch).toHaveBeenCalledWith('/api/activities/a1/analyze', {
      method: 'POST',
      body: JSON.stringify({ locale: 'fi' }),
    })
  })

  it('omits the body locale when none is provided', async () => {
    scheduleReanalyze('a2', { enabled: true })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(mockedFetch).toHaveBeenCalledWith('/api/activities/a2/analyze', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  })

  it('coalesces rapid edits and escalates the backoff to 15s', async () => {
    scheduleReanalyze('a1', { enabled: true }) // step 0 → 5s
    await vi.advanceTimersByTimeAsync(4_000) // 1s left, still pending
    scheduleReanalyze('a1', { enabled: true }) // reschedule → step 1 → 15s
    await vi.advanceTimersByTimeAsync(5_000) // only 5s since reschedule
    expect(mockedFetch).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(10_000) // 15s since reschedule
    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })

  it('resets the backoff to 5s after firing', async () => {
    scheduleReanalyze('a1', { enabled: true })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(mockedFetch).toHaveBeenCalledTimes(1)

    scheduleReanalyze('a1', { enabled: true }) // fresh cycle → 5s again
    await vi.advanceTimersByTimeAsync(5_000)
    expect(mockedFetch).toHaveBeenCalledTimes(2)
  })
})
