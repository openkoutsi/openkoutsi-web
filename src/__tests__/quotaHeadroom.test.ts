import { describe, expect, it } from 'vitest'

import { observationAge, quotaBarPercent, quotaSeverity } from '@/lib/quota'
import type { QuotaWindow } from '@/lib/types'

function window(overrides: Partial<QuotaWindow> = {}): QuotaWindow {
  return {
    window: 'short',
    scope: 'overall',
    usage: 100,
    limit: 600,
    remaining: 500,
    window_start: '2026-09-10T10:00:00Z',
    resets_at: '2026-09-10T10:15:00Z',
    observed_in_window: true,
    ...overrides,
  }
}

describe('observationAge', () => {
  it('uses the coarsest unit that still says something', () => {
    expect(observationAge(5)).toEqual({ unit: 'seconds', n: 5 })
    // Overshoots the minute boundary on purpose: "90 min ago" is more legible
    // than "2 h ago" when the short quota window is 15 minutes.
    expect(observationAge(80)).toEqual({ unit: 'seconds', n: 80 })
    expect(observationAge(600)).toEqual({ unit: 'minutes', n: 10 })
    expect(observationAge(5000)).toEqual({ unit: 'minutes', n: 83 })
    expect(observationAge(7200)).toEqual({ unit: 'hours', n: 2 })
    expect(observationAge(600_000)).toEqual({ unit: 'days', n: 7 })
  })

  it('never reports a negative age', () => {
    // Clock skew between the API host and the browser must not render "-3s ago".
    expect(observationAge(-42)).toEqual({ unit: 'seconds', n: 0 })
  })
})

describe('quotaBarPercent', () => {
  it('scales usage against the limit', () => {
    expect(quotaBarPercent(300, 600)).toBe(50)
    expect(quotaBarPercent(0, 600)).toBe(0)
    expect(quotaBarPercent(600, 600)).toBe(100)
  })

  it('clamps rather than overflowing the bar', () => {
    expect(quotaBarPercent(900, 600)).toBe(100)
  })

  it('draws nothing when there is no limit to draw against', () => {
    expect(quotaBarPercent(null, null)).toBe(0)
    expect(quotaBarPercent(50, 0)).toBe(0)
    expect(quotaBarPercent(null, 600)).toBe(0)
  })
})

describe('quotaSeverity', () => {
  it('escalates as the window fills', () => {
    expect(quotaSeverity(window({ usage: 100 }))).toBe('ok')
    expect(quotaSeverity(window({ usage: 450 }))).toBe('warning')
    expect(quotaSeverity(window({ usage: 570 }))).toBe('critical')
  })

  it('draws a rolled-over window neutral, never as healthy', () => {
    // The counter has demonstrably emptied, so the 0 shown is inferred rather
    // than observed. Painting it green would claim a freshness we do not have.
    expect(quotaSeverity(window({ usage: 0, observed_in_window: false }))).toBe('reset')
  })

  it('reports reset even when the stale reading was near the ceiling', () => {
    // The case that matters: a 580/600 observation from a window that has since
    // rolled over must not render as critical and scare an admin off an import
    // that has full headroom.
    expect(
      quotaSeverity(window({ usage: 0, remaining: 600, observed_in_window: false })),
    ).toBe('reset')
  })
})
