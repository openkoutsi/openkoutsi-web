import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { GoalGuidance } from '@/lib/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────
// vi.mock factories are hoisted, so shared state is created via vi.hoisted.
const mocks = vi.hoisted(() => {
  class LlmSubscriptionRequiredError extends Error {}
  return {
    LlmSubscriptionRequiredError,
    apiFetch: vi.fn(),
    mutate: vi.fn(),
    swr: { data: undefined as GoalGuidance | undefined },
  }
})

// A minimal translator that echoes keys (and supports `t.has`).
const t = ((key: string) => key) as ((k: string) => string) & { has: (k: string) => boolean }
t.has = () => true

vi.mock('next-intl', () => ({
  useTranslations: () => t,
  useLocale: () => 'en',
}))

vi.mock('@/lib/api', () => ({
  fetcher: vi.fn(),
  apiFetch: mocks.apiFetch,
  LlmSubscriptionRequiredError: mocks.LlmSubscriptionRequiredError,
}))

vi.mock('@/components/LlmUpsell', () => ({
  LlmUpsell: () => h('div', { 'data-testid': 'llm-upsell' }, 'upsell'),
}))

vi.mock('swr', () => ({
  default: () => ({ data: mocks.swr.data, mutate: mocks.mutate }),
}))

import { GoalGuidanceCard } from '@/components/goals/GoalGuidanceCard'

beforeEach(() => {
  mocks.swr.data = undefined
  mocks.apiFetch.mockReset()
  mocks.mutate.mockReset()
})

describe('GoalGuidanceCard', () => {
  it('shows the get-guidance button when there is no guidance yet', () => {
    mocks.swr.data = { status: null, verdict: null, guidance: null, updated_at: null }
    render(h(GoalGuidanceCard, { goalId: 'g1' }))
    expect(screen.getByText('goals.guidance.getGuidance')).toBeInTheDocument()
  })

  it('shows a thinking bubble while pending', () => {
    mocks.swr.data = { status: 'pending', verdict: null, guidance: null, updated_at: null }
    render(h(GoalGuidanceCard, { goalId: 'g1' }))
    expect(screen.getByText('goals.guidance.thinking')).toBeInTheDocument()
  })

  it('renders the verdict badge and prose when done', () => {
    mocks.swr.data = {
      status: 'done',
      verdict: 'ambitious',
      guidance: 'A real stretch on this timeline.\n\nStay consistent and it comes.',
      updated_at: '2026-07-13T09:00:00Z',
    }
    render(h(GoalGuidanceCard, { goalId: 'g1' }))
    expect(screen.getByText('goals.guidance.verdict.ambitious')).toBeInTheDocument()
    expect(screen.getByText('A real stretch on this timeline.')).toBeInTheDocument()
    expect(screen.getByText('Stay consistent and it comes.')).toBeInTheDocument()
  })

  it('shows an error message when guidance failed', () => {
    mocks.swr.data = { status: 'error', verdict: null, guidance: null, updated_at: null }
    render(h(GoalGuidanceCard, { goalId: 'g1' }))
    expect(screen.getByText('goals.guidance.error')).toBeInTheDocument()
  })

  it('triggers generation on button click', async () => {
    mocks.swr.data = { status: null, verdict: null, guidance: null, updated_at: null }
    mocks.apiFetch.mockResolvedValueOnce(undefined)
    render(h(GoalGuidanceCard, { goalId: 'g1' }))
    await userEvent.click(screen.getByText('goals.guidance.getGuidance'))
    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        '/api/goals/g1/guidance',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(mocks.mutate).toHaveBeenCalled()
  })

  it('shows the upsell when the instance gates AI features', async () => {
    mocks.swr.data = { status: null, verdict: null, guidance: null, updated_at: null }
    mocks.apiFetch.mockRejectedValueOnce(new mocks.LlmSubscriptionRequiredError('nope'))
    render(h(GoalGuidanceCard, { goalId: 'g1' }))
    await userEvent.click(screen.getByText('goals.guidance.getGuidance'))
    await waitFor(() => {
      expect(screen.getByTestId('llm-upsell')).toBeInTheDocument()
    })
  })
})
