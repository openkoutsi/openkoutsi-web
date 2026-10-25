import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import { syncNote } from '@/lib/providerSync'
import type { ProviderSyncStatus } from '@/lib/types'
import { ProviderCard } from '@/components/profile/ProviderCard'
import appEn from '../../messages/en/app.json'
import appFi from '../../messages/fi/app.json'
import commonEn from '../../messages/en/common.json'

function sync(over: Partial<ProviderSyncStatus> = {}): ProviderSyncStatus {
  return {
    status: 'completed',
    stop_reason: null,
    stop_detail: null,
    started_at: '2026-09-10T10:00:00Z',
    finished_at: '2026-09-10T10:04:00Z',
    imported: 412,
    listed: 1400,
    oldest_seen_on: '2019-04-02',
    more_expected: false,
    repeat_count: 0,
    repeat_since: null,
    ...over,
  }
}

function keys(note: ReturnType<typeof syncNote>): string[] {
  return (note?.lines ?? []).map((line) => line.key)
}

describe('syncNote', () => {
  it('says nothing about a provider nobody has synced yet', () => {
    // A freshly connected account has not failed at anything, and an empty
    // state that reads like a warning is worse than no line at all.
    expect(syncNote(undefined)).toBeNull()
    expect(syncNote(sync({ status: 'never' }))).toBeNull()
  })

  it('reports a finished import quietly', () => {
    const note = syncNote(sync({ status: 'completed' }))
    expect(note?.tone).toBe('muted')
    expect(keys(note)).toEqual(['finished'])
  })

  it('reports a live import as in progress', () => {
    const note = syncNote(sync({ status: 'running' }))
    expect(note?.tone).toBe('muted')
    expect(keys(note)).toEqual(['running'])
  })

  it.each([
    ['throttled', 'stoppedThrottled'],
    ['safety_limit', 'stoppedSafetyLimit'],
    ['provider_outage', 'stoppedProviderOutage'],
    ['lease_lost', 'stoppedLeaseLost'],
    ['error', 'stoppedError'],
  ] as const)('names %s as the reason it stopped', (reason, key) => {
    const note = syncNote(
      sync({ status: 'stopped', stop_reason: reason, more_expected: true, imported: 0, oldest_seen_on: null }),
    )
    expect(note?.tone).toBe('warning')
    expect(keys(note)).toEqual([key, 'resume'])
  })

  it('still says something about a reason this build has not heard of', () => {
    // The backend's vocabulary can grow; a new reason must not render as silence.
    const note = syncNote(
      sync({
        status: 'stopped',
        stop_reason: 'quota_exhausted' as ProviderSyncStatus['stop_reason'],
        more_expected: true,
        imported: 0,
        oldest_seen_on: null,
      }),
    )
    expect(keys(note)).toEqual(['stoppedError', 'resume'])
  })

  it('treats a run whose process died as a stop, not as a live import', () => {
    const note = syncNote(
      sync({ status: 'interrupted', more_expected: true, imported: 0, oldest_seen_on: null }),
    )
    expect(note?.tone).toBe('warning')
    expect(keys(note)).toEqual(['interrupted', 'resume'])
  })

  it('says what it did get, and how far back it reached', () => {
    const note = syncNote(
      sync({ status: 'stopped', stop_reason: 'throttled', more_expected: true }),
    )
    expect(keys(note)).toEqual(['stoppedThrottled', 'importedSoFar', 'reached', 'resume'])
  })

  it('mentions a repeat only once it is a repeat', () => {
    const once = sync({ status: 'stopped', stop_reason: 'throttled', repeat_count: 1, imported: 0, oldest_seen_on: null })
    expect(keys(syncNote(once))).not.toContain('repeated')

    // Three stops in the same place is a provider problem or a poisoned range of
    // activities — the one thing no single run could have told them.
    const thrice = { ...once, repeat_count: 3 }
    expect(keys(syncNote(thrice))).toContain('repeated')
  })
})

function renderCard(over: Partial<ProviderSyncStatus> | null, connected = true) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ app: appEn, common: commonEn }}
    >
      <ProviderCard
        name="Strava"
        connected={connected}
        configured
        onConnect={() => {}}
        onSync={() => {}}
        onDisconnect={() => {}}
        sync={over ? sync(over) : undefined}
      />
    </NextIntlClientProvider>,
  )
}

describe('ProviderCard sync note', () => {
  it('tells a stopped import apart from a finished one', () => {
    renderCard({ status: 'stopped', stop_reason: 'throttled', more_expected: true })
    const note = screen.getByTestId('provider-sync-note')
    expect(note.textContent).toContain('Strava rate-limited us')
    expect(note.textContent).toContain('Press Sync now')
    expect(note.className).toContain('amber')
  })

  it('renders a finished import without a warning', () => {
    renderCard({ status: 'completed' })
    const note = screen.getByTestId('provider-sync-note')
    expect(note.textContent).toContain('412 new activities')
    expect(note.className).not.toContain('amber')
  })

  it('shows nothing at all for a provider that is not connected', () => {
    renderCard({ status: 'stopped', stop_reason: 'throttled', more_expected: true }, false)
    expect(screen.queryByTestId('provider-sync-note')).toBeNull()
  })
})

describe('sync message catalogues', () => {
  const SYNC_KEYS = [
    'running',
    'finished',
    'interrupted',
    'stoppedThrottled',
    'stoppedSafetyLimit',
    'stoppedProviderOutage',
    'stoppedLeaseLost',
    'stoppedError',
    'importedSoFar',
    'reached',
    'repeated',
    'resume',
  ]

  it.each(SYNC_KEYS)('has %s in both locales', (key) => {
    // A locale that drifts here shows a raw message id on the profile page.
    expect(appEn.profile.provider.sync).toHaveProperty(key)
    expect(appFi.profile.provider.sync).toHaveProperty(key)
  })

  it('has no key in one locale that the other lacks', () => {
    expect(Object.keys(appFi.profile.provider.sync).sort()).toEqual(
      Object.keys(appEn.profile.provider.sync).sort(),
    )
  })
})
