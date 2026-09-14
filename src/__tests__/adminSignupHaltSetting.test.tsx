import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SWRConfig } from 'swr'

import type { InstanceSettingsResponse } from '@/lib/types'

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  fetcher: vi.fn(),
  toast: vi.fn(),
  replace: vi.fn(),
}))

// A translator that echoes keys, so assertions read as key names. The copy is
// covered by signupHaltI18n.test.ts.
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

function settings(
  overrides: Partial<InstanceSettingsResponse> = {},
): InstanceSettingsResponse {
  return {
    llm_analysis_context: null,
    admin_contact: null,
    llm_models: [],
    llm_requires_subscription: false,
    allow_self_signup: true,
    allow_personal_access_tokens: true,
    allow_mcp_server: true,
    allow_course_recon: false,
    signups_halted: false,
    signup_halt_reason: null,
    ...overrides,
  }
}

async function mountSettingsTab(overrides: Partial<InstanceSettingsResponse> = {}) {
  mocks.fetcher.mockImplementation(async (url: string) => {
    if (url === '/api/admin/settings') return settings(overrides)
    if (url.startsWith('/api/admin/')) return { items: [], total: 0, page: 1, page_size: 100 }
    throw new Error(`unexpected fetch: ${url}`)
  })
  render(
    h(
      SWRConfig,
      { value: { provider: () => new Map(), dedupingInterval: 0 } },
      h(AdminPage),
    ),
  )
  // Radix tabs switch on pointer events, which `fireEvent.click` does not raise.
  await userEvent.click(await screen.findByText('tabs.settings'))
}

/** Mount the Settings tab and wait for the pause switch to appear. */
async function mountWithSwitch(overrides: Partial<InstanceSettingsResponse> = {}) {
  await mountSettingsTab(overrides)
  await waitFor(() => expect(screen.getByText('settings.signupsHalted')).toBeInTheDocument())
}

afterEach(() => vi.clearAllMocks())

// ── Tests ───────────────────────────────────────────────────────────────────

describe('admin settings — pausing sign-ups', () => {
  it('asks for a reason only once the pause is on', async () => {
    await mountWithSwitch()
    // Nothing is paused, so a "reason shown to visitors" field would be a
    // question about nothing.
    expect(screen.queryByText('settings.signupHaltReason')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('settings.signupsHalted'))
    await waitFor(() =>
      expect(screen.getByText('settings.signupHaltReason')).toBeInTheDocument(),
    )
  })

  it('says what the pause leaves open, where the decision is made', async () => {
    await mountWithSwitch({ signups_halted: true })
    expect(screen.getByText('settings.signupsHaltedWarning')).toBeInTheDocument()
  })

  it('hides the pause entirely when self-serve signup is not offered', async () => {
    // A stop on a door that is already shut is noise on the page.
    await mountSettingsTab({ allow_self_signup: false })

    // The tab did render — the toggle it sits under is there.
    await waitFor(() =>
      expect(screen.getByText('settings.allowSelfSignup')).toBeInTheDocument(),
    )
    expect(screen.queryByText('settings.signupsHalted')).not.toBeInTheDocument()
    expect(screen.queryByText('settings.signupHaltReason')).not.toBeInTheDocument()
  })

  it('sends both fields on save', async () => {
    mocks.apiFetch.mockResolvedValue({})
    await mountWithSwitch({ signups_halted: true, signup_halt_reason: 'Out of disk.' })

    fireEvent.click(screen.getByText('settings.save'))

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalled())
    const [url, init] = mocks.apiFetch.mock.calls[0]
    expect(url).toBe('/api/admin/settings')
    expect(JSON.parse(init.body)).toMatchObject({
      signups_halted: true,
      signup_halt_reason: 'Out of disk.',
    })
  })

  it('clears the reason to null rather than to an empty string', async () => {
    // The backend treats "" as "clear it"; sending null says the same thing
    // without relying on that, and keeps the column NULL rather than empty.
    mocks.apiFetch.mockResolvedValue({})
    await mountWithSwitch({ signups_halted: true, signup_halt_reason: 'Out of disk.' })

    fireEvent.change(screen.getByLabelText('settings.signupHaltReason'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByText('settings.save'))

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalled())
    const [, init] = mocks.apiFetch.mock.calls[0]
    expect(JSON.parse(init.body).signup_halt_reason).toBeNull()
  })
})
