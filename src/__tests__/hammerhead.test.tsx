import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'

/**
 * Hammerhead (Karoo) in the web app (openkoutsi#69): the push-to-Karoo action
 * on a course, the source badge, and the strings both languages need.
 */

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  fetcher: vi.fn(),
  toast: vi.fn(),
  connected: ['hammerhead'] as string[],
  route: { route_id: null } as { route_id: string | null },
}))

const t = ((key: string) => key) as (k: string) => string

vi.mock('next-intl', () => ({
  useTranslations: () => t,
  useLocale: () => 'en',
}))
vi.mock('@/lib/api', () => ({ apiFetch: mocks.apiFetch, fetcher: mocks.fetcher }))
vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }))

import { PushToKarooButton } from '@/components/courses/PushToKarooButton'
import { SourceBadge } from '@/components/activities/SourceBadge'
import appEn from '../../messages/en/app.json'
import appFi from '../../messages/fi/app.json'
import coursesEn from '../../messages/en/courses.json'
import coursesFi from '../../messages/fi/courses.json'

function renderButton() {
  return render(
    h(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } },
      h(PushToKarooButton, { courseId: 'c1' })),
  )
}

afterEach(() => {
  vi.clearAllMocks()
  mocks.connected = ['hammerhead']
  mocks.route = { route_id: null }
})

mocks.fetcher.mockImplementation(async (url: string) =>
  url === '/api/integrations/status'
    ? { connected: mocks.connected, sync: {} }
    : mocks.route,
)

describe('PushToKarooButton', () => {
  it('is absent until Hammerhead is connected', async () => {
    mocks.connected = ['strava']
    renderButton()
    await waitFor(() => expect(mocks.fetcher).toHaveBeenCalledWith('/api/integrations/status'))
    expect(screen.queryByTestId('push-to-karoo')).toBeNull()
    expect(mocks.fetcher).not.toHaveBeenCalledWith('/api/courses/c1/push/hammerhead')
  })

  it('offers to send a course that was never pushed', async () => {
    mocks.route = { route_id: null }
    renderButton()
    await waitFor(() => expect(screen.getByTestId('push-to-karoo').textContent).toContain('karoo.send'))
  })

  it('offers an update once the course is on the Karoo', async () => {
    mocks.route = { route_id: 'r1' }
    renderButton()
    await waitFor(() =>
      expect(screen.getByTestId('push-to-karoo').textContent).toContain('karoo.resend'),
    )
  })

  it('posts the push and says which it was', async () => {
    mocks.route = { route_id: 'r1' }
    mocks.apiFetch.mockResolvedValue({ route_id: 'r1', updated: true })
    renderButton()
    fireEvent.click(await screen.findByTestId('push-to-karoo'))
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: 'karoo.updated' }))
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/courses/c1/push/hammerhead', { method: 'POST' })
  })

  it('explains a refused scope as a reconnect', async () => {
    mocks.route = { route_id: null }
    mocks.apiFetch.mockRejectedValue(new Error('insufficient_scope'))
    renderButton()
    fireEvent.click(await screen.findByTestId('push-to-karoo'))
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'karoo.reconnect', variant: 'destructive' }),
      ),
    )
  })
})

describe('SourceBadge', () => {
  it('names Hammerhead', () => {
    render(h(SourceBadge, { sources: ['hammerhead'] }))
    expect(screen.getByText('Hammerhead')).toBeTruthy()
  })
})

describe('Hammerhead strings', () => {
  const appKeys = [
    'push', 'pushing', 'pushDesc', 'pushDone', 'pushFailed', 'pushReconnect',
    'pushNothing', 'autoPush', 'disconnectWarning',
  ] as const
  const courseKeys = ['send', 'resend', 'sending', 'sent', 'updated', 'failed', 'reconnect'] as const

  it.each([['en', appEn, coursesEn], ['fi', appFi, coursesFi]] as const)(
    'are all present in %s',
    (_lang, app, courses) => {
      for (const key of appKeys) {
        expect(app.profile.hammerhead[key]).toBeTruthy()
      }
      for (const key of courseKeys) {
        expect(courses.karoo[key]).toBeTruthy()
      }
      expect(app.profile.providerDenied).toContain('{name}')
    },
  )

  it('warns that disconnecting deletes what was pushed', () => {
    expect(appEn.profile.hammerhead.disconnectWarning).toMatch(/deletes every route and workout/)
  })
})
