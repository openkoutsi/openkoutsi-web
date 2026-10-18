import { describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Activity } from '@/lib/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

vi.mock('@/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) =>
    h('a', { href }, children),
}))

import { ActivityCard } from '@/components/activities/ActivityCard'

const activity = {
  id: 'a1',
  name: 'Morning ride',
  sport_type: 'Ride',
  start_time: '2026-08-01T06:00:00Z',
  duration_s: 3600,
  distance_m: 30000,
  workout_category: null,
  sources: [],
  status: 'processed',
  bike_id: null,
} as unknown as Activity

describe('ActivityCard selection mode', () => {
  it('links to the activity when not selecting', () => {
    render(h(ActivityCard, { activity }))
    expect(screen.getByRole('link')).toHaveAttribute('href', '/activities/a1')
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('selects instead of navigating when selecting', async () => {
    const onToggleSelect = vi.fn()
    render(h(ActivityCard, { activity, selected: false, onToggleSelect }))
    expect(screen.queryByRole('link')).toBeNull()

    await userEvent.click(screen.getByText('Morning ride'))
    expect(onToggleSelect).toHaveBeenCalledTimes(1)

    // The checkbox itself toggles once, not once for it and once for the card.
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onToggleSelect).toHaveBeenCalledTimes(2)
  })
})
