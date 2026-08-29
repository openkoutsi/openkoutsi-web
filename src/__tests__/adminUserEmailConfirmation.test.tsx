import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'

import type { Page, UserResponse } from '@/lib/types'

// vi.mock factories are hoisted, so shared state is created via vi.hoisted.
const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  fetcher: vi.fn(),
  toast: vi.fn(),
  replace: vi.fn(),
}))

// A translator that echoes keys, so assertions read as key names. This suite is
// about which state each row shows, not the copy (the i18n test covers that).
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
  useAuth: () => ({ isAdmin: true, loading: false }),
}))

vi.mock('@/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
}))

vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }))

import AdminPage from '@/app/[locale]/(session)/(app)/admin/page'

// ── Helpers ─────────────────────────────────────────────────────────────────

function user(overrides: Partial<UserResponse> = {}): UserResponse {
  return {
    id: 'u1',
    username: null,
    email: 'rider@example.com',
    email_verified_at: '2026-03-01T10:00:00Z',
    roles: ['user'],
    created_at: '2026-02-01T10:00:00Z',
    ...overrides,
  }
}

function mountWith(users: UserResponse[]) {
  const page: Page<UserResponse> = {
    items: users,
    total: users.length,
    page: 1,
    page_size: 100,
  }
  mocks.fetcher.mockImplementation(async (url: string) => {
    if (url.startsWith('/api/admin/users')) return page
    throw new Error(`unexpected fetch: ${url}`)
  })
  return render(
    h(
      SWRConfig,
      { value: { provider: () => new Map(), dedupingInterval: 0 } },
      h(AdminPage),
    ),
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

// ── Tests ───────────────────────────────────────────────────────────────────

describe('admin users — email confirmation status', () => {
  it('marks a confirmed address as confirmed', async () => {
    mountWith([user()])

    await waitFor(() => {
      expect(screen.getByText('rider@example.com')).toBeTruthy()
    })
    expect(screen.getByText('users.emailConfirmed')).toBeTruthy()
    expect(screen.queryByText('users.emailUnconfirmed')).toBeNull()
  })

  it('names the confirmation date, which the badge alone has no room for', async () => {
    mountWith([user()])

    await waitFor(() => {
      expect(screen.getByText('users.emailConfirmed')).toBeTruthy()
    })
    expect(screen.getByText('users.emailConfirmed').getAttribute('title')).toBe(
      'users.emailConfirmedOn',
    )
  })

  it('flags a signup that was never confirmed', async () => {
    // Login by email needs the stamp, so this row cannot sign in at all — and
    // without the badge it reads exactly like the working account above it.
    mountWith([user({ email_verified_at: null })])

    await waitFor(() => {
      expect(screen.getByText('rider@example.com')).toBeTruthy()
    })
    expect(screen.getByText('users.emailUnconfirmed')).toBeTruthy()
    expect(screen.queryByText('users.emailConfirmed')).toBeNull()
  })

  it('treats a missing field as unconfirmed, not as confirmed', async () => {
    // The field is optional in the response type; an API that omits it must not
    // make an unconfirmed row look verified.
    const withoutField = user()
    delete withoutField.email_verified_at
    mountWith([withoutField])

    await waitFor(() => {
      expect(screen.getByText('users.emailUnconfirmed')).toBeTruthy()
    })
  })

  it('says nothing at all about an account that has no address', async () => {
    // An invite-created account is reached by username. There is nothing to
    // confirm, so "not confirmed" would invent a problem it does not have.
    mountWith([user({ email: null, email_verified_at: null, username: 'invited' })])

    await waitFor(() => {
      expect(screen.getByText('invited')).toBeTruthy()
    })
    expect(screen.queryByText('users.emailUnconfirmed')).toBeNull()
    expect(screen.queryByText('users.emailConfirmed')).toBeNull()
  })

  it('keeps each row’s status with its own account', async () => {
    mountWith([
      user({ id: 'u1', email: 'confirmed@example.com' }),
      user({ id: 'u2', email: 'pending@example.com', email_verified_at: null }),
      user({ id: 'u3', email: null, username: 'invited' }),
    ])

    await waitFor(() => {
      expect(screen.getByText('confirmed@example.com')).toBeTruthy()
    })
    expect(screen.getAllByText('users.emailConfirmed')).toHaveLength(1)
    expect(screen.getAllByText('users.emailUnconfirmed')).toHaveLength(1)
  })
})
