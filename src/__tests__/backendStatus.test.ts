import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { BackendStatusProvider, useBackendStatus } from '@/lib/backendStatus'
import type { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) =>
  React.createElement(BackendStatusProvider, { children })

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useBackendStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    setVisibility('visible')
  })

  it('isBackendDown is false when health check returns 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const { result } = renderHook(() => useBackendStatus(), { wrapper })
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled())
    expect(result.current.isBackendDown).toBe(false)
  })

  it('isBackendDown is true when health check returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const { result } = renderHook(() => useBackendStatus(), { wrapper })
    await waitFor(() => expect(result.current.isBackendDown).toBe(true))
  })

  it('isBackendDown is true when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const { result } = renderHook(() => useBackendStatus(), { wrapper })
    await waitFor(() => expect(result.current.isBackendDown).toBe(true))
  })

  it('isBackendDown recovers when recheck is called after backend comes back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const { result } = renderHook(() => useBackendStatus(), { wrapper })
    await waitFor(() => expect(result.current.isBackendDown).toBe(true))

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    result.current.recheck()
    await waitFor(() => expect(result.current.isBackendDown).toBe(false))
  })

  it('does not poll while the tab is hidden and re-checks on becoming visible', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    setVisibility('visible')
    renderHook(() => useBackendStatus(), { wrapper })

    // Initial check on mount.
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Go to background: the interval stops, no new polls.
    act(() => setVisibility('hidden'))
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Back to foreground: immediate re-check, then polling resumes.
    act(() => setVisibility('visible'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
