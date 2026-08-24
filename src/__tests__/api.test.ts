import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  apiFetch,
  clearTokens,
  getAccessToken,
  setAccessToken,
} from '@/lib/api'

// Helper to build a minimal Response mock
function mockResponse(status: number, body?: unknown): Response {
  const json = body !== undefined ? JSON.stringify(body) : ''
  return new Response(json || null, {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('token management', () => {
  it('sets and gets access token', () => {
    setAccessToken('my-token')
    expect(getAccessToken()).toBe('my-token')
  })

  it('clearTokens removes the access token', () => {
    setAccessToken('tok')
    clearTokens()
    expect(getAccessToken()).toBeNull()
  })

  it('clearTokens does not affect localStorage (refresh token is httpOnly cookie)', () => {
    // Refresh token is now managed via httpOnly cookie, not localStorage.
    // JS code should never read/write refresh_token from localStorage.
    localStorage.setItem('refresh_token', 'should-stay')
    clearTokens()
    // clearTokens should NOT touch localStorage at all
    expect(localStorage.getItem('refresh_token')).toBe('should-stay')
  })
})

describe('apiFetch happy path', () => {
  it('resolves with parsed JSON on 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { ok: true })))
    const result = await apiFetch<{ ok: boolean }>('/api/test')
    expect(result).toEqual({ ok: true })
  })

  it('includes Authorization header when access token is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(200, {}))
    vi.stubGlobal('fetch', fetchMock)
    setAccessToken('test-token')

    await apiFetch('/api/test')

    const calledHeaders = fetchMock.mock.calls[0][1].headers
    expect(calledHeaders['Authorization']).toBe('Bearer test-token')
  })

  it('omits Authorization header when no access token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(200, {}))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/api/test')

    const calledHeaders = fetchMock.mock.calls[0][1].headers
    expect(calledHeaders['Authorization']).toBeUndefined()
  })

  it('sends credentials: include on all requests (for cookie-based refresh)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(200, {}))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/api/test')

    const calledOptions = fetchMock.mock.calls[0][1]
    expect(calledOptions.credentials).toBe('include')
  })

  it('returns undefined for 204 No Content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    const result = await apiFetch<undefined>('/api/test', { method: 'DELETE' })
    expect(result).toBeUndefined()
  })

  it('does not set Content-Type for FormData body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(200, {}))
    vi.stubGlobal('fetch', fetchMock)

    const form = new FormData()
    form.append('file', new Blob(['data']), 'test.fit')
    await apiFetch('/api/upload', { method: 'POST', body: form })

    const calledHeaders = fetchMock.mock.calls[0][1].headers
    expect(calledHeaders['Content-Type']).toBeUndefined()
  })

  it('sets Content-Type to application/json for JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(200, {}))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/api/test', {
      method: 'POST',
      body: JSON.stringify({ key: 'value' }),
    })

    const calledHeaders = fetchMock.mock.calls[0][1].headers
    expect(calledHeaders['Content-Type']).toBe('application/json')
  })
})

describe('apiFetch 401 handling', () => {
  it('attempts refresh via cookie and retries on 401', async () => {
    // Refresh token is in an httpOnly cookie — the browser sends it automatically.
    // The mock simulates a successful refresh returning a new access_token.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(401))                               // first attempt → 401
      .mockResolvedValueOnce(mockResponse(200, { access_token: 'new-access', token_type: 'bearer' })) // refresh succeeds
      .mockResolvedValueOnce(mockResponse(200, { data: 'ok' }))              // retry succeeds

    vi.stubGlobal('fetch', fetchMock)

    const result = await apiFetch<{ data: string }>('/api/protected')

    expect(result).toEqual({ data: 'ok' })
    expect(getAccessToken()).toBe('new-access')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('refresh call is sent without body (cookie-based)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(401))                               // original → 401
      .mockResolvedValueOnce(mockResponse(200, { access_token: 'new-access', token_type: 'bearer' }))
      .mockResolvedValueOnce(mockResponse(200, { data: 'ok' }))

    vi.stubGlobal('fetch', fetchMock)
    await apiFetch('/api/protected')

    // The second call is the refresh — it should have no body
    const refreshCall = fetchMock.mock.calls[1]
    expect(refreshCall[0]).toContain('/api/auth/refresh')
    expect(refreshCall[1].body).toBeUndefined()
    expect(refreshCall[1].credentials).toBe('include')
  })

  it('clears tokens and throws when refresh fails', async () => {
    setAccessToken('old-access')

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(401))   // original → 401
      .mockResolvedValueOnce(mockResponse(401))   // refresh → 401 (cookie absent or expired)

    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/api/protected')).rejects.toThrow('Unauthorized')
    expect(getAccessToken()).toBeNull()
  })

  it('does not retry when retry=false', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(401))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/api/protected', {}, false)).rejects.toThrow()

    // Should only call fetch once — no refresh attempt when retry=false
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('apiFetch refresh when many requests 401 at once', () => {
  // What a resume looks like: every mounted key refetches together, and after
  // an hour in the background every one of them answers 401 at the same moment
  // (issue #86).
  it('mints one refresh for the whole burst, and retries them all', async () => {
    setAccessToken('expired')

    let refreshes = 0
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/auth/refresh')) {
        refreshes += 1
        // Resolve on a later tick, so the burst really does overlap.
        await new Promise((resolve) => setTimeout(resolve, 0))
        return mockResponse(200, { access_token: 'fresh', token_type: 'bearer' })
      }
      return getAccessToken() === 'fresh'
        ? mockResponse(200, { data: url })
        : mockResponse(401)
    })
    vi.stubGlobal('fetch', fetchMock)

    const paths = ['/api/a', '/api/b', '/api/c', '/api/d', '/api/e']
    const results = await Promise.all(paths.map((path) => apiFetch<{ data: string }>(path)))

    expect(refreshes).toBe(1)
    expect(results.map((r) => r.data)).toEqual(paths.map((p) => `http://localhost:8000${p}`))
  })

  it('starts a new refresh for a later 401, once the first has settled', async () => {
    setAccessToken('expired')

    let refreshes = 0
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/auth/refresh')) {
        refreshes += 1
        return mockResponse(200, { access_token: `fresh-${refreshes}`, token_type: 'bearer' })
      }
      return getAccessToken()?.startsWith('fresh')
        ? mockResponse(200, { data: 'ok' })
        : mockResponse(401)
    })
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/api/one')
    setAccessToken('expired')
    await apiFetch('/api/two')

    // The in-flight promise is shared, not cached — a token that expires again
    // later must still be refreshable.
    expect(refreshes).toBe(2)
  })
})

describe('apiFetch when the refresh itself cannot be made', () => {
  // A phone whose radio has only just come back with the app drops requests.
  // Reading that as "your session is over" is how an athlete used to get logged
  // out for one bad packet (issue #86).
  const survives = async (refreshResult: unknown) => {
    setAccessToken('still-good')
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/auth/refresh')) {
        if (refreshResult instanceof Error) throw refreshResult
        return refreshResult as Response
      }
      return mockResponse(401)
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/api/protected')).rejects.toThrow('Unauthorized')
    // The token survives, so the retry that SWR schedules can still use it.
    expect(getAccessToken()).toBe('still-good')
  }

  it('keeps the session on a network error', async () => {
    await survives(new TypeError('Failed to fetch'))
  })

  it('keeps the session when the refresh endpoint rate-limits', async () => {
    await survives(mockResponse(429, { detail: 'Too many requests' }))
  })

  it('keeps the session when the backend is briefly broken', async () => {
    await survives(mockResponse(503))
  })

  it('ends the session when the refresh is actually rejected', async () => {
    // 401/403 is the backend saying the cookie is gone or superseded. That one
    // really is the end of the session.
    setAccessToken('old-access')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(401))
      .mockResolvedValueOnce(mockResponse(403))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/api/protected')).rejects.toThrow('Unauthorized')
    expect(getAccessToken()).toBeNull()
  })
})

describe('apiFetch error handling', () => {
  it('extracts error message from detail field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse(400, { detail: 'Bad request' })),
    )
    await expect(apiFetch('/api/test')).rejects.toThrow('Bad request')
  })

  it('extracts error message from message field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse(400, { message: 'Validation failed' })),
    )
    await expect(apiFetch('/api/test')).rejects.toThrow('Validation failed')
  })

  it('falls back to HTTP status when no error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    )
    await expect(apiFetch('/api/missing')).rejects.toThrow('HTTP 404')
  })

  it('throws on 500 server error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse(500, { detail: 'Internal error' })),
    )
    await expect(apiFetch('/api/test')).rejects.toThrow('Internal error')
  })
})
