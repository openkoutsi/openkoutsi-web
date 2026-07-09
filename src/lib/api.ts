import type { AllTimeDistanceBests, AllTimePowerBests, TokenPair } from './types'

const DEFAULT_API_URL = 'http://localhost:8000'

/**
 * Resolve the backend API base URL at runtime.
 *
 * The URL is no longer baked into the JS bundle at build time. On the server it
 * comes from the `API_URL` environment variable; in the browser it is read from
 * `window.__ENV__`, which the root layout injects from the same env var at
 * request time. This lets a single built image target any environment.
 */
export function getApiUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? DEFAULT_API_URL
  }
  return window.__ENV__?.API_URL ?? DEFAULT_API_URL
}

// In-memory access token (not persisted to storage)
let _accessToken: string | null = null

export function setAccessToken(token: string | null) {
  _accessToken = token
}

export function getAccessToken(): string | null {
  return _accessToken
}

export function clearTokens() {
  _accessToken = null
}

// ── LLM subscription gating (issue #9) ─────────────────────────────────────

/** Stable machine-readable code the backend sends when a gated instance denies
 *  an LLM feature. Consumers branch on this, never on message text. */
export const LLM_SUBSCRIPTION_REQUIRED = 'llm_subscription_required'

/** Thrown when an LLM feature is denied because the instance requires a
 *  subscription and the caller has neither an entitlement nor BYOK. */
export class LlmSubscriptionRequiredError extends Error {
  code = LLM_SUBSCRIPTION_REQUIRED
  constructor(message?: string) {
    super(message || 'AI features on this server require a subscription.')
    this.name = 'LlmSubscriptionRequiredError'
  }
}

/** Type guard for the structured `{code, message}` 403 detail. */
export function isSubscriptionRequiredDetail(
  detail: unknown,
): detail is { code: string; message?: string } {
  return (
    typeof detail === 'object' &&
    detail !== null &&
    (detail as { code?: unknown }).code === LLM_SUBSCRIPTION_REQUIRED
  )
}

export type LlmAccessMode = 'ungated' | 'byok' | 'entitled' | 'none'

export interface LlmAccess {
  gated: boolean
  mode: LlmAccessMode
  entitlement: { status: string; expires_at: string | null } | null
}

/** The frontend's single source of truth for the caller's LLM access state. */
export async function getLlmAccess(): Promise<LlmAccess> {
  return apiFetch<LlmAccess>('/api/llm/access')
}

// Non-sensitive session indicator cookie — contains no secret data.
// Used by the Next.js middleware to gate protected pages before the client-side
// AuthProvider can run. The real security enforcement is always done by the backend.
export function setSessionCookie() {
  if (typeof document !== 'undefined') {
    const maxAge = 30 * 24 * 60 * 60
    document.cookie = `session=1; path=/; max-age=${maxAge}; SameSite=Lax`
  }
}

export function clearSessionCookie() {
  if (typeof document !== 'undefined') {
    document.cookie = 'session=; path=/; max-age=0; SameSite=Lax'
  }
}

async function attemptRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiUrl()}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) return false
    const data: TokenPair = await res.json()
    setAccessToken(data.access_token)
    return true
  } catch {
    return false
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`
  }

  // Don't set Content-Type for FormData — browser sets it with boundary
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
  }

  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (res.status === 401 && retry) {
    const refreshed = await attemptRefresh()
    if (refreshed) {
      return apiFetch<T>(path, options, false)
    }
    clearTokens()
    if (typeof window !== 'undefined') {
      const AUTH_PATHS = ['/login', '/register', '/reset-password']
      const onAuthPage = AUTH_PATHS.some((p) => window.location.pathname.includes(p))
      if (!onAuthPage) {
        window.location.href = '/'
      }
    }
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    let subscriptionRequired: LlmSubscriptionRequiredError | null = null
    try {
      const err = await res.json()
      if (isSubscriptionRequiredDetail(err?.detail)) {
        // Issue #9: a gated instance denied an LLM feature.
        subscriptionRequired = new LlmSubscriptionRequiredError(err.detail.message)
      } else if (typeof err.detail === 'string') {
        message = err.detail
      } else if (Array.isArray(err.detail) && err.detail.length > 0) {
        // FastAPI/Pydantic validation error format: detail is an array of {msg, loc, type}
        message = err.detail
          .map((e: { msg: string }) => e.msg.replace(/^Value error,\s*/i, ''))
          .join('. ')
      } else if (typeof err.message === 'string') {
        message = err.message
      }
    } catch {
      // ignore parse errors
    }
    if (subscriptionRequired) throw subscriptionRequired
    throw new Error(message)
  }

  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

// SWR fetcher
export const fetcher = <T>(path: string) => apiFetch<T>(path)

export async function getPowerBests(): Promise<AllTimePowerBests> {
  return apiFetch<AllTimePowerBests>('/api/metrics/bests/power')
}

export async function getDistanceBests(): Promise<AllTimeDistanceBests> {
  return apiFetch<AllTimeDistanceBests>('/api/metrics/bests/distance')
}

export async function apiDownload(
  path: string,
  filename: string,
  retry = true,
): Promise<void> {
  const headers: Record<string, string> = {}
  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`
  }

  const res = await fetch(`${getApiUrl()}${path}`, { headers, credentials: 'include' })

  if (res.status === 401 && retry) {
    const refreshed = await attemptRefresh()
    if (refreshed) {
      return apiDownload(path, filename, false)
    }
    clearTokens()
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const err = await res.json()
      message = err.detail ?? err.message ?? message
    } catch {
      // ignore parse errors
    }
    throw new Error(message)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
