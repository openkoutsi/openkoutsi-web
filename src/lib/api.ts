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

// ── Coded API errors (issue #44) ───────────────────────────────────────────

/**
 * A `{code, message}` error detail the caller is expected to branch on.
 *
 * Chat needs this in a way the rest of the API does not. Every other surface
 * has one way to fail and one sentence for it, while a refused chat turn has
 * five quite different causes — the instance is busy, the model cannot call
 * tools, today's budget is spent, this conversation is full, an answer is
 * already running — and they want five different sentences, in fourteen
 * languages. So the backend sends a machine key and the web app owns the copy;
 * `message` is the English fallback for a code this build predates.
 */
export class ApiCodeError extends Error {
  constructor(
    readonly code: string,
    message?: string,
    readonly status?: number,
    /**
     * The whole detail object, for the codes that carry more than a key. The
     * garage's `sport_already_claimed` names the bike already holding the
     * sport, and a refusal that cannot say *which* bike leaves the athlete
     * hunting for it (issue #64).
     */
    readonly detail?: Record<string, unknown>,
  ) {
    super(message || code)
    this.name = 'ApiCodeError'
  }
}

/** Type guard for any structured `{code, message}` detail. */
export function isCodedDetail(
  detail: unknown,
): detail is { code: string; message?: string } {
  return (
    typeof detail === 'object' &&
    detail !== null &&
    typeof (detail as { code?: unknown }).code === 'string'
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

/**
 * What a refresh attempt settled as.
 *
 * The distinction that matters is between "the server told us this session is
 * over" and "we could not ask". Treating the second as the first is what used
 * to log an athlete out for one dropped packet — which is a routine event on a
 * phone whose radio has just come back with the app (issue #86).
 */
type RefreshOutcome = 'refreshed' | 'rejected' | 'unavailable'

/**
 * The refresh in flight, if any, shared by every caller that wants one.
 *
 * A resume refetches every mounted key at once, and after an hour in the
 * background every one of those requests answers 401 at the same moment. Each
 * would otherwise mint its own refresh — nine or ten POSTs racing for the same
 * cookie, ten round-trips deep before the first panel can render, and enough
 * traffic to reach the endpoint's own rate limit. One shared attempt is both
 * faster and the only version that cannot rate-limit itself.
 */
let _refreshInFlight: Promise<RefreshOutcome> | null = null

async function requestRefresh(): Promise<RefreshOutcome> {
  try {
    const res = await fetch(`${getApiUrl()}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    // 401/403 is the backend saying the refresh cookie is gone, expired, or
    // superseded — the session really has ended. Anything else (429 from the
    // endpoint's own limiter, a 5xx, a proxy hiccup) says nothing about the
    // session, so the token is left alone and the original request's error is
    // allowed to surface, where SWR retries it with backoff.
    if (res.status === 401 || res.status === 403) return 'rejected'
    if (!res.ok) return 'unavailable'
    const data: TokenPair = await res.json()
    setAccessToken(data.access_token)
    return 'refreshed'
  } catch {
    // Network error — we never reached the server, so we know nothing.
    return 'unavailable'
  }
}

async function attemptRefresh(): Promise<RefreshOutcome> {
  if (_refreshInFlight) return _refreshInFlight
  const attempt = requestRefresh().finally(() => {
    if (_refreshInFlight === attempt) _refreshInFlight = null
  })
  _refreshInFlight = attempt
  return attempt
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
    const outcome = await attemptRefresh()
    if (outcome === 'refreshed') {
      return apiFetch<T>(path, options, false)
    }
    // Could not reach the refresh endpoint: the session may well still be
    // good, so keep the token and let the caller's own error handling retry.
    if (outcome === 'unavailable') {
      throw new Error('Unauthorized')
    }
    clearTokens()
    if (typeof window !== 'undefined') {
      const AUTH_PATHS = ['/login', '/register', '/signup', '/verify-email', '/reset-password',
        '/confirm-email-change']
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
    let coded: ApiCodeError | null = null
    try {
      const err = await res.json()
      if (isSubscriptionRequiredDetail(err?.detail)) {
        // Issue #9: a gated instance denied an LLM feature.
        subscriptionRequired = new LlmSubscriptionRequiredError(err.detail.message)
      } else if (isCodedDetail(err?.detail)) {
        // Any other structured `{code, message}` refusal (issue #44). Checked
        // after the subscription case so that keeps its own typed error and the
        // `LlmUpsell` handling every AI surface already has.
        coded = new ApiCodeError(
          err.detail.code,
          err.detail.message,
          res.status,
          err.detail,
        )
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
    if (coded) throw coded
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
    const outcome = await attemptRefresh()
    if (outcome === 'refreshed') {
      return apiDownload(path, filename, false)
    }
    if (outcome === 'unavailable') {
      throw new Error('Unauthorized')
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
