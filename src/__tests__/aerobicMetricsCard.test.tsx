import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

import type { ActivityDetail } from '@/lib/types'

// A minimal translator that echoes keys (and supports `t.has`).
const t = ((key: string) => key) as ((k: string) => string) & { has: (k: string) => boolean }
t.has = () => true

vi.mock('next-intl', () => ({
  useTranslations: () => t,
  useLocale: () => 'en',
}))

import { AerobicMetricsCard } from '@/components/activities/AerobicMetricsCard'

function activity(overrides: Partial<ActivityDetail> = {}): ActivityDetail {
  return {
    id: 'a1',
    athlete_id: 'ath1',
    sources: ['strava'],
    name: 'Morning Ride',
    sport_type: 'Ride',
    start_time: '2026-08-01T06:00:00Z',
    duration_s: 5400,
    distance_m: 40000,
    elevation_m: 300,
    avg_power: 210,
    weighted_power: 225,
    avg_hr: 141,
    max_hr: 172,
    avg_cadence: 88,
    load: 95,
    intensity: 0.78,
    efficiency_factor: 1.6,
    variability_index: 1.07,
    decoupling_pct: 3.4,
    decoupling_reason: null,
    workout_category: 'endurance',
    labels: [],
    notes: null,
    rpe: null,
    has_fit_file: true,
    original_format: null,
    status: 'processed',
    created_at: '2026-08-01T08:00:00Z',
    streams: {},
    power_bests: {},
    distance_bests: {},
    power_pr_badges: {},
    distance_pr_badges: {},
    intervals: [],
    cp_w: null,
    w_prime_j: null,
    cp_fit_points: null,
    ...overrides,
  }
}

describe('AerobicMetricsCard', () => {
  it('renders the metrics for a cycling activity', () => {
    render(h(AerobicMetricsCard, { activity: activity() }))
    expect(screen.getByText('detail.aerobic.title')).toBeInTheDocument()
  })

  it('accepts the other cycling sport types', () => {
    for (const sport of ['VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'cycling']) {
      const { unmount } = render(h(AerobicMetricsCard, { activity: activity({ sport_type: sport }) }))
      expect(screen.getByText('detail.aerobic.title')).toBeInTheDocument()
      unmount()
    }
  })

  it('hides itself on non-cycling activities', () => {
    for (const sport of ['Run', 'Swim', 'WeightTraining', 'Walk']) {
      const { container } = render(h(AerobicMetricsCard, { activity: activity({ sport_type: sport }) }))
      expect(container).toBeEmptyDOMElement()
    }
  })

  it('hides itself on rides labelled as a commute', () => {
    const { container } = render(
      h(AerobicMetricsCard, { activity: activity({ labels: ['commute'] }) }),
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('still shows on a ride carrying other labels', () => {
    render(h(AerobicMetricsCard, { activity: activity({ labels: ['race'] }) }))
    expect(screen.getByText('detail.aerobic.title')).toBeInTheDocument()
  })

  it('hides itself when the ride has no aerobic data at all', () => {
    const { container } = render(
      h(AerobicMetricsCard, {
        activity: activity({
          efficiency_factor: null,
          variability_index: null,
          decoupling_pct: null,
          decoupling_reason: null,
        }),
      }),
    )
    expect(container).toBeEmptyDOMElement()
  })
})
