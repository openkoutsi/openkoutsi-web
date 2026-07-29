import { describe, it, expect } from 'vitest'
import {
  bandColor,
  bandLabelKey,
  coverageIsPartial,
  coverageRatio,
  formatHours,
  formatPct,
  hasData,
  orderedBands,
} from '@/lib/intensityDistribution'
import type { IntensityDistribution } from '@/lib/types'

function distribution(over: Partial<IntensityDistribution> = {}): IntensityDistribution {
  return {
    start: '2026-05-01',
    end: '2026-07-24',
    basis: 'power',
    method: 'time',
    bands: [
      { band: 1, seconds: 36000, pct: 80, sessions: null },
      { band: 2, seconds: 4500, pct: 10, sessions: null },
      { band: 3, seconds: 4500, pct: 10, sessions: null },
    ],
    classification: 'pyramidal',
    coverage: { activities_total: 20, activities_used: 20, seconds_total: 45000 },
    zone_definitions_changed: false,
    ...over,
  }
}

describe('bandLabelKey', () => {
  it('maps each band to its own key', () => {
    expect(bandLabelKey(1)).toBe('bandLow')
    expect(bandLabelKey(2)).toBe('bandModerate')
    expect(bandLabelKey(3)).toBe('bandHigh')
  })
})

describe('bandColor', () => {
  it('gives each band a distinct colour', () => {
    const colors = new Set([bandColor(1), bandColor(2), bandColor(3)])
    expect(colors.size).toBe(3)
  })

  it('falls back to the hard-band colour for anything unexpected', () => {
    expect(bandColor(9)).toBe(bandColor(3))
  })
})

describe('orderedBands', () => {
  it('returns the three bands in ascending order', () => {
    const bands = orderedBands(distribution())
    expect(bands.map((b) => b.band)).toEqual([1, 2, 3])
  })

  it('fills in a band the response omitted', () => {
    const partial = distribution({
      bands: [{ band: 1, seconds: 600, pct: 100, sessions: null }],
    })
    const bands = orderedBands(partial)
    expect(bands.map((b) => b.band)).toEqual([1, 2, 3])
    expect(bands[2]).toEqual({ band: 3, seconds: 0, pct: 0, sessions: null })
  })

  it('handles a missing distribution entirely', () => {
    expect(orderedBands(undefined).map((b) => b.pct)).toEqual([0, 0, 0])
  })
})

describe('hasData', () => {
  it('is false for an undefined or all-zero distribution', () => {
    expect(hasData(undefined)).toBe(false)
    expect(
      hasData(
        distribution({
          bands: [
            { band: 1, seconds: 0, pct: 0, sessions: null },
            { band: 2, seconds: 0, pct: 0, sessions: null },
            { band: 3, seconds: 0, pct: 0, sessions: null },
          ],
        }),
      ),
    ).toBe(false)
  })

  it('is true when any band has a share', () => {
    expect(hasData(distribution())).toBe(true)
  })
})

describe('coverage', () => {
  it('is null for an empty window, so no rides differs from no usable rides', () => {
    const empty = distribution({
      coverage: { activities_total: 0, activities_used: 0, seconds_total: 0 },
    })
    expect(coverageRatio(empty)).toBeNull()
    expect(coverageIsPartial(empty)).toBe(false)
  })

  it('is not partial when every ride was usable', () => {
    expect(coverageIsPartial(distribution())).toBe(false)
  })

  it('is partial when rides were left out', () => {
    const thin = distribution({
      coverage: { activities_total: 40, activities_used: 6, seconds_total: 9000 },
    })
    expect(coverageRatio(thin)).toBeCloseTo(0.15)
    expect(coverageIsPartial(thin)).toBe(true)
  })
})

describe('formatting', () => {
  it('rounds percentages to whole numbers', () => {
    expect(formatPct(80)).toBe('80%')
    expect(formatPct(13.4)).toBe('13%')
  })

  it('shows minutes below an hour and hours above it', () => {
    expect(formatHours(1800)).toBe('30m')
    expect(formatHours(5400)).toBe('1.5h')
    expect(formatHours(180000)).toBe('50h')
  })
})
