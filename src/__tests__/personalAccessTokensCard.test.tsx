import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'

import type {
  InstanceInfoResponse,
  PersonalAccessTokenResponse,
  TokenScopesResponse,
} from '@/lib/types'

// vi.mock factories are hoisted, so shared state is created via vi.hoisted.
const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  fetcher: vi.fn(),
}))

// A translator that echoes keys, so assertions read as key names. Values with
// placeholders echo the key too — this suite is about behaviour, not copy
// (personalAccessTokensI18n.test.ts covers the strings).
const t = ((key: string) => key) as (k: string) => string

vi.mock('next-intl', () => ({
  useTranslations: () => t,
  useLocale: () => 'en',
}))

vi.mock('@/lib/api', () => ({
  apiFetch: mocks.apiFetch,
  fetcher: mocks.fetcher,
}))

vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }))

import { PersonalAccessTokensCard } from '@/components/settings/PersonalAccessTokensCard'

// ── Helpers ─────────────────────────────────────────────────────────────────

const VOCABULARY: TokenScopesResponse = {
  scopes: [
    { name: 'activities:read', description: 'Read activities.', sensitive: false },
    { name: 'athlete:export', description: 'Download everything.', sensitive: true },
  ],
  allowed_lifetime_days: [7, 30, 90, 180, 365],
  default_lifetime_days: 90,
  max_lifetime_days: 365,
}

function token(
  overrides: Partial<PersonalAccessTokenResponse> = {},
): PersonalAccessTokenResponse {
  return {
    id: 't1',
    name: 'nightly-backup',
    scopes: ['activities:read'],
    status: 'active',
    expires_at: '2027-01-01T00:00:00Z',
    last_used_at: null,
    revoked_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function instanceInfo(enabled: boolean): InstanceInfoResponse {
  return {
    admin_contact: null,
    privacy_policy_url: 'https://example.test/privacy',
    email_enabled: false,
    allow_self_signup: false,
    allow_personal_access_tokens: enabled,
  }
}

function mountWith(routes: Record<string, unknown>) {
  mocks.fetcher.mockImplementation(async (url: string) => {
    if (url in routes) return routes[url]
    throw new Error(`unexpected fetch: ${url}`)
  })
  return render(
    h(
      SWRConfig,
      { value: { provider: () => new Map(), dedupingInterval: 0 } },
      h(PersonalAccessTokensCard),
    ),
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

// ── Tests ───────────────────────────────────────────────────────────────────

describe('PersonalAccessTokensCard', () => {
  it('hides itself when the instance has the feature switched off', async () => {
    const { container } = mountWith({
      '/api/public/instance-info': instanceInfo(false),
    })

    await waitFor(() => {
      expect(container.textContent).not.toContain('settings.tokens.title')
    })
    // …and it never asks for the token list on an instance that has none.
    expect(mocks.fetcher).not.toHaveBeenCalledWith('/api/tokens')
  })

  it('renders the card when the instance allows tokens', async () => {
    mountWith({
      '/api/public/instance-info': instanceInfo(true),
      '/api/tokens': [],
      '/api/tokens/scopes': VOCABULARY,
    })

    expect(await screen.findByText('settings.tokens.title')).toBeTruthy()
    expect(await screen.findByText('settings.tokens.empty')).toBeTruthy()
  })

  it('groups active tokens apart from expired and revoked ones', async () => {
    mountWith({
      '/api/public/instance-info': instanceInfo(true),
      '/api/tokens': [
        token({ id: 'live', name: 'live-token' }),
        token({ id: 'old', name: 'old-token', status: 'expired' }),
        token({ id: 'gone', name: 'gone-token', status: 'revoked' }),
      ],
      '/api/tokens/scopes': VOCABULARY,
    })

    expect(await screen.findByText('settings.tokens.active')).toBeTruthy()
    expect(await screen.findByText('settings.tokens.inactive')).toBeTruthy()
    // Dead tokens are kept, not deleted — the list is the user's own record.
    expect(screen.getByText('old-token')).toBeTruthy()
    expect(screen.getByText('gone-token')).toBeTruthy()
  })

  it('offers revoke only on a token that is still live', async () => {
    mountWith({
      '/api/public/instance-info': instanceInfo(true),
      '/api/tokens': [
        token({ id: 'live', name: 'live-token' }),
        token({ id: 'gone', name: 'gone-token', status: 'revoked' }),
      ],
      '/api/tokens/scopes': VOCABULARY,
    })

    await screen.findByText('live-token')
    // One revoke button, for the one live token — revoking a dead token is
    // meaningless and the API would have nothing to do.
    expect(screen.getAllByText('settings.tokens.revoke')).toHaveLength(1)
  })

  it("shows a token's scopes read-only, with no way to edit them", async () => {
    mountWith({
      '/api/public/instance-info': instanceInfo(true),
      '/api/tokens': [token({ scopes: ['activities:read', 'metrics:read'] })],
      '/api/tokens/scopes': VOCABULARY,
    })

    expect(await screen.findByText('activities:read')).toBeTruthy()
    expect(screen.getByText('metrics:read')).toBeTruthy()
    // A token is immutable: widening one means revoking it and issuing another.
    expect(screen.queryByText('settings.tokens.edit')).toBeNull()
    expect(screen.queryByText('settings.tokens.save')).toBeNull()
  })
})
