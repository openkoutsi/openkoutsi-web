import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'

import en from '../../messages/en/onboarding.json'
import fi from '../../messages/fi/onboarding.json'

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  fetcher: vi.fn(),
}))

// Echo keys (and return an empty object for t.raw) so assertions read as key names.
const t = Object.assign((key: string) => key, { raw: () => ({}) })

vi.mock('next-intl', () => ({
  useTranslations: () => t,
  useLocale: () => 'en',
}))

vi.mock('@/lib/api', () => ({
  apiFetch: mocks.apiFetch,
  apiDownload: vi.fn(),
  fetcher: mocks.fetcher,
}))

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ logout: vi.fn() }) }))

vi.mock('@/components/onboarding/WizardShell', () => ({
  WizardShell: ({ children }: { children: unknown }) => h('div', null, children as never),
}))

import { CONSENT_VERSION, Step0Consent } from '@/components/onboarding/steps/Step0Consent'

function mount(onAccepted = vi.fn()) {
  mocks.fetcher.mockResolvedValue({ privacy_policy_url: null })
  render(
    h(
      SWRConfig,
      { value: { provider: () => new Map(), dedupingInterval: 0 } },
      h(Step0Consent, { onAccepted }),
    ),
  )
  return onAccepted
}

const acceptButton = () => screen.getByRole('button', { name: 'consent.accept' })

afterEach(() => {
  vi.clearAllMocks()
})

describe('Step0Consent adult confirmation', () => {
  it('keeps Accept disabled until both data consent and age are confirmed', () => {
    mount()
    expect(acceptButton()).toBeDisabled()

    fireEvent.click(screen.getByLabelText('consent.checkboxLabel'))
    expect(acceptButton()).toBeDisabled()

    fireEvent.click(screen.getByLabelText('consent.adultCheckboxLabel'))
    expect(acceptButton()).toBeEnabled()
  })

  it('does not accept the age claim alone', () => {
    mount()
    fireEvent.click(screen.getByLabelText('consent.adultCheckboxLabel'))
    expect(acceptButton()).toBeDisabled()
  })

  it('sends the adult confirmation with the current consent version', async () => {
    mocks.apiFetch.mockResolvedValue({})
    const onAccepted = mount()
    fireEvent.click(screen.getByLabelText('consent.checkboxLabel'))
    fireEvent.click(screen.getByLabelText('consent.adultCheckboxLabel'))
    fireEvent.click(acceptButton())

    await waitFor(() => expect(onAccepted).toHaveBeenCalled())
    expect(CONSENT_VERSION).toBe('1.1')
    const [url, init] = mocks.apiFetch.mock.calls[0]
    expect(url).toBe('/api/consent')
    expect(JSON.parse(init.body)).toEqual({ consent_version: '1.1', confirmed_adult: true })
  })
})

describe('adult confirmation copy', () => {
  it('states the 18-year threshold in every locale', () => {
    expect(en.consent.adultCheckboxLabel).toMatch(/18/)
    expect(fi.consent.adultCheckboxLabel).toMatch(/18/)
  })
})
