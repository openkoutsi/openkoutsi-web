import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'

import type { AccountResponse, InstanceInfoResponse } from '@/lib/types'

// vi.mock factories are hoisted, so shared state is created via vi.hoisted.
const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  fetcher: vi.fn(),
  toast: vi.fn(),
}))

// A translator that echoes keys, so assertions read as key names. This suite is
// about behaviour, not copy (emailCardI18n.test.ts covers the strings).
const t = ((key: string) => key) as (k: string) => string

vi.mock('next-intl', () => ({
  useTranslations: () => t,
  useLocale: () => 'en',
}))

vi.mock('@/lib/api', () => ({
  apiFetch: mocks.apiFetch,
  fetcher: mocks.fetcher,
}))

vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }))

import { EmailCard } from '@/components/profile/EmailCard'

// ── Helpers ─────────────────────────────────────────────────────────────────

function instanceInfo(emailEnabled: boolean): InstanceInfoResponse {
  return {
    admin_contact: null,
    privacy_policy_url: 'https://example.test/privacy',
    email_enabled: emailEnabled,
    allow_self_signup: false,
    allow_personal_access_tokens: true,
  }
}

function account(overrides: Partial<AccountResponse> = {}): AccountResponse {
  return {
    username: null,
    email: 'rider@example.com',
    email_verified: true,
    pending_email: null,
    ...overrides,
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
      h(EmailCard),
    ),
  )
}

async function openDialog() {
  await waitFor(() => expect(screen.getByText('profile.email.changeBtn')).toBeTruthy())
  fireEvent.click(screen.getByText('profile.email.changeBtn'))
}

function fill(labelKey: string, value: string) {
  const input = document.getElementById(labelKey) as HTMLInputElement
  fireEvent.change(input, { target: { value } })
}

afterEach(() => {
  vi.clearAllMocks()
})

// ── Tests ───────────────────────────────────────────────────────────────────

describe('EmailCard', () => {
  it('hides itself when the instance has no email provider', async () => {
    const { container } = mountWith({
      '/api/public/instance-info': instanceInfo(false),
    })

    await waitFor(() => {
      expect(container.textContent).not.toContain('profile.email.title')
    })
  })

  it('shows the current address when there is one', async () => {
    mountWith({
      '/api/public/instance-info': instanceInfo(true),
      '/api/auth/account': account(),
    })

    await waitFor(() => {
      expect(screen.getByText('rider@example.com')).toBeTruthy()
    })
    expect(screen.getByText('profile.email.changeBtn')).toBeTruthy()
  })

  it('offers to *add* an address on an invite account that has none', async () => {
    mountWith({
      '/api/public/instance-info': instanceInfo(true),
      '/api/auth/account': account({ email: null, email_verified: false, username: 'invited' }),
    })

    await waitFor(() => {
      expect(screen.getByText('profile.email.setBtn')).toBeTruthy()
    })
    expect(screen.getByText('profile.email.none')).toBeTruthy()
    expect(screen.queryByText('profile.email.changeBtn')).toBeNull()
  })

  it('posts the new address with the password and reports the generic ack', async () => {
    mocks.apiFetch.mockResolvedValue({ detail: 'ok' })
    mountWith({
      '/api/public/instance-info': instanceInfo(true),
      '/api/auth/account': account(),
    })

    await openDialog()
    fill('new-email', 'new@example.com')
    fill('current-password', 'Testpass1234')
    fireEvent.click(screen.getByText('profile.email.submit'))

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith('/api/auth/change-email', {
        method: 'POST',
        body: JSON.stringify({ new_email: 'new@example.com', password: 'Testpass1234' }),
      })
    })
    // The ack says a link *may* be on its way — never that the address was free.
    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'profile.email.requestedTitle' }),
      )
    })
  })

  it('will not submit without both fields', async () => {
    mountWith({
      '/api/public/instance-info': instanceInfo(true),
      '/api/auth/account': account(),
    })

    await openDialog()
    fill('new-email', 'new@example.com')

    const submit = screen.getByText('profile.email.submit').closest('button')!
    expect(submit.hasAttribute('disabled')).toBe(true)
    expect(mocks.apiFetch).not.toHaveBeenCalled()
  })

  it('surfaces a refusal instead of claiming success', async () => {
    mocks.apiFetch.mockRejectedValue(new Error('Invalid password'))
    mountWith({
      '/api/public/instance-info': instanceInfo(true),
      '/api/auth/account': account(),
    })

    await openDialog()
    fill('new-email', 'new@example.com')
    fill('current-password', 'wrong')
    fireEvent.click(screen.getByText('profile.email.submit'))

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'profile.email.requestFailed',
          description: 'Invalid password',
          variant: 'destructive',
        }),
      )
    })
  })

  it('shows a pending change and cancels it', async () => {
    mocks.apiFetch.mockResolvedValue(undefined)
    mountWith({
      '/api/public/instance-info': instanceInfo(true),
      '/api/auth/account': account({ pending_email: 'new@example.com' }),
    })

    await waitFor(() => {
      expect(screen.getByText('profile.email.pending')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('profile.email.cancel'))
    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith('/api/auth/cancel-email-change', {
        method: 'POST',
      })
    })
  })
})
