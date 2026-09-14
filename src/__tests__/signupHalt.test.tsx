import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'

import type { InstanceInfoResponse } from '@/lib/types'

const mocks = vi.hoisted(() => ({
  fetcher: vi.fn(),
  signup: vi.fn(),
}))

// A translator that echoes keys, so assertions read as key names. The copy
// itself is covered by signupHaltI18n.test.ts.
const t = ((key: string) => key) as (k: string) => string

vi.mock('next-intl', () => ({
  useTranslations: () => t,
  useLocale: () => 'en',
}))

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
  fetcher: mocks.fetcher,
}))

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ signup: mocks.signup }) }))

vi.mock('@/navigation', () => ({
  Link: ({ children, ...rest }: { children: React.ReactNode }) =>
    h('a', rest, children),
}))

import SignupPage from '@/app/[locale]/(session)/(auth)/signup/page'

// ── Helpers ─────────────────────────────────────────────────────────────────

function instanceInfo(overrides: Partial<InstanceInfoResponse> = {}): InstanceInfoResponse {
  return {
    admin_contact: null,
    privacy_policy_url: 'https://example.test/privacy',
    email_enabled: true,
    allow_self_signup: true,
    allow_personal_access_tokens: true,
    allow_course_recon: false,
    signups_halted: false,
    signup_halt_reason: null,
    ...overrides,
  }
}

function mountWith(info: InstanceInfoResponse) {
  mocks.fetcher.mockImplementation(async (url: string) => {
    if (url === '/api/public/instance-info') return info
    throw new Error(`unexpected fetch: ${url}`)
  })
  return render(
    h(
      SWRConfig,
      { value: { provider: () => new Map(), dedupingInterval: 0 } },
      h(SignupPage),
    ),
  )
}

afterEach(() => vi.clearAllMocks())

// ── Tests ───────────────────────────────────────────────────────────────────

describe('the sign-up page while sign-ups are paused', () => {
  it('explains the pause instead of offering the form', async () => {
    mountWith(instanceInfo({ signups_halted: true }))

    await waitFor(() => expect(screen.getByText('signup.onHoldTitle')).toBeInTheDocument())
    expect(screen.getByText('signup.onHoldDesc')).toBeInTheDocument()
    expect(screen.queryByLabelText('signup.email')).not.toBeInTheDocument()
    // Not the "never offered here" copy — this instance does offer signup.
    expect(screen.queryByText('signup.unavailableTitle')).not.toBeInTheDocument()
  })

  it("shows the administrator's reason word for word", async () => {
    mountWith(
      instanceInfo({
        signups_halted: true,
        signup_halt_reason: "We're at our Strava API limit until the 12th.",
      }),
    )

    await waitFor(() =>
      expect(
        screen.getByText("We're at our Strava API limit until the 12th."),
      ).toBeInTheDocument(),
    )
    expect(screen.getByText('signup.onHoldReason')).toBeInTheDocument()
  })

  it('leaves the reason block out when no reason was given', async () => {
    mountWith(instanceInfo({ signups_halted: true }))

    await waitFor(() => expect(screen.getByText('signup.onHoldTitle')).toBeInTheDocument())
    expect(screen.queryByText('signup.onHoldReason')).not.toBeInTheDocument()
  })

  it('points at the administrator when the instance published a contact', async () => {
    mountWith(
      instanceInfo({ signups_halted: true, admin_contact: 'admin@example.test' }),
    )

    await waitFor(() => expect(screen.getByText('admin@example.test')).toBeInTheDocument())
    expect(screen.getByText('signup.onHoldContact')).toBeInTheDocument()
  })

  it('never admits to a halt on an instance that offers no self-serve signup', async () => {
    // Mirrors the backend, where the 404 wins over the 503: saying "paused,
    // because <reason>" here would publish the admin's note on an instance
    // that never opened the door.
    mountWith(
      instanceInfo({
        allow_self_signup: false,
        signups_halted: true,
        signup_halt_reason: 'Out of disk.',
      }),
    )

    await waitFor(() =>
      expect(screen.getByText('signup.unavailableTitle')).toBeInTheDocument(),
    )
    expect(screen.queryByText('signup.onHoldTitle')).not.toBeInTheDocument()
    expect(screen.queryByText('Out of disk.')).not.toBeInTheDocument()
  })

  it('offers the form again once the pause is lifted', async () => {
    mountWith(instanceInfo())

    await waitFor(() => expect(screen.getByLabelText('signup.email')).toBeInTheDocument())
    expect(screen.queryByText('signup.onHoldTitle')).not.toBeInTheDocument()
  })
})
