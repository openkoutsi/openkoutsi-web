import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { render, screen, within } from '@testing-library/react'
import { SWRConfig } from 'swr'

import adminEn from '../../messages/en/admin.json'
import adminFi from '../../messages/fi/admin.json'
import { activeUsersRange, activeUsersUrl } from '@/lib/activeUsers'

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  fetcher: vi.fn(),
  toast: vi.fn(),
  replace: vi.fn(),
}))

// A translator that echoes keys, so assertions read as key names.
const t = ((key: string) => key) as (k: string) => string

vi.mock('next-intl', () => ({
  useTranslations: () => t,
  useLocale: () => 'en',
}))
vi.mock('@/lib/api', () => ({ apiFetch: mocks.apiFetch, fetcher: mocks.fetcher }))
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ isAdmin: true, loading: false }) }))
vi.mock('@/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }))

import AdminPage from '@/app/[locale]/(session)/(app)/admin/page'

function mount(totals: Record<string, number> | 'error') {
  mocks.fetcher.mockImplementation(async (url: string) => {
    if (url.startsWith('/api/admin/active-users/summary')) {
      if (totals === 'error') throw new Error('boom')
      const from = new URL(url, 'http://x').searchParams.get('from')!
      return {
        group_by: 'day',
        from,
        to: null,
        total_active_users: totals[from],
        confirmed_email_accounts: 57,
        buckets: [],
      }
    }
    if (url.startsWith('/api/admin/')) return { items: [], total: 0, page: 1, page_size: 100 }
    throw new Error(`unexpected fetch: ${url}`)
  })
  render(
    h(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, h(AdminPage)),
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('activeUsersRange', () => {
  const now = new Date('2026-11-08T23:30:00Z')

  it('covers today only for the daily window', () => {
    expect(activeUsersRange(1, now)).toEqual({ from: '2026-11-08', to: '2026-11-08' })
  })

  it('counts today as one of the seven and thirty days', () => {
    expect(activeUsersRange(7, now)).toEqual({ from: '2026-11-02', to: '2026-11-08' })
    expect(activeUsersRange(30, now)).toEqual({ from: '2026-10-10', to: '2026-11-08' })
  })

  it('uses UTC dates, matching how the backend counts days', () => {
    // 01:00 in Helsinki on the 9th is still the 8th in UTC.
    const lateUtc = new Date('2026-11-08T23:00:00Z')
    expect(activeUsersRange(1, lateUtc).to).toBe('2026-11-08')
  })

  it('builds the summary URL', () => {
    expect(activeUsersUrl(7, now)).toBe(
      '/api/admin/active-users/summary?group_by=day&from=2026-11-02&to=2026-11-08',
    )
  })
})

describe('active users table', () => {
  it('fetches the confirmed-account count with the daily request, not a fourth one', async () => {
    mount({})
    await screen.findByRole('table', { name: 'activeUsers.title' })
    await screen.findAllByText('—')
    const summaryCalls = mocks.fetcher.mock.calls.filter(([u]) =>
      String(u).startsWith('/api/admin/active-users/summary'),
    )
    expect(new Set(summaryCalls.map(([u]) => u)).size).toBe(3)
  })

  it('shows daily, weekly and monthly unique users above the tabs', async () => {
    const today = new Date()
    mount({
      [activeUsersRange(1, today).from]: 3,
      [activeUsersRange(7, today).from]: 12,
      [activeUsersRange(30, today).from]: 1234,
    })
    const table = await screen.findByRole('table', { name: 'activeUsers.title' })
    expect(within(table).getByText('activeUsers.daily')).toBeTruthy()
    expect(within(table).getByText('activeUsers.weekly')).toBeTruthy()
    expect(within(table).getByText('activeUsers.monthly')).toBeTruthy()
    expect(await within(table).findByText('3')).toBeTruthy()
    expect(await within(table).findByText('12')).toBeTruthy()
    expect(await within(table).findByText((1234).toLocaleString())).toBeTruthy()
    expect(within(table).getByText('activeUsers.confirmed')).toBeTruthy()
    expect(await within(table).findByText('57')).toBeTruthy()

    // It sits above the tab bar, visible whichever tab is open.
    const tabs = screen.getByRole('tablist')
    expect(table.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows a dash rather than breaking the page when the summary fails', async () => {
    mount('error')
    const table = await screen.findByRole('table', { name: 'activeUsers.title' })
    expect((await within(table).findAllByText('—')).length).toBe(4)
    expect(screen.getByText('tabs.users')).toBeTruthy()
  })
})

describe('active users i18n', () => {
  it('keeps both locales structurally identical', () => {
    expect(Object.keys(adminFi.activeUsers).sort()).toEqual(Object.keys(adminEn.activeUsers).sort())
  })
})
