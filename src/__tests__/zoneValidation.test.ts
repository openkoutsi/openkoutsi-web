import { describe, it, expect } from 'vitest'
import { validateZones, zonesAreValid, isBlank } from '@/lib/zoneValidation'
import type { Zone } from '@/lib/types'

const z = (name: string, low: number, high: number): Zone => ({ name, low, high })

describe('isBlank', () => {
  it('treats NaN as blank', () => {
    expect(isBlank(NaN)).toBe(true)
  })
  it('treats real numbers (including 0) as not blank', () => {
    expect(isBlank(0)).toBe(false)
    expect(isBlank(120)).toBe(false)
  })
})

describe('validateZones', () => {
  it('accepts contiguous, ascending zones', () => {
    const zones = [z('Z1', 100, 120), z('Z2', 120, 140), z('Z3', 140, 160)]
    expect(validateZones(zones)).toEqual([])
    expect(zonesAreValid(zones)).toBe(true)
  })

  it('rejects a gap between zones (low above previous high)', () => {
    // Gaps used to be allowed. A value landing in one belongs to no zone, and
    // was attributed to the *top* zone — a 10 W gap filed recovery-pace riding
    // as neuromuscular (issue #38).
    const zones = [z('Z1', 100, 120), z('Z2', 130, 140)]
    expect(zonesAreValid(zones)).toBe(false)
  })

  it('flags a blank low bound as required', () => {
    const errors = validateZones([z('Z1', NaN, 120)])
    expect(errors).toContainEqual({ index: 0, field: 'low', code: 'required' })
  })

  it('flags a blank high bound as required', () => {
    const errors = validateZones([z('Z1', 100, NaN)])
    expect(errors).toContainEqual({ index: 0, field: 'high', code: 'required' })
  })

  it('flags low >= high', () => {
    const errors = validateZones([z('Z1', 120, 120)])
    expect(errors).toContainEqual({ index: 0, field: 'low', code: 'lowGteHigh' })

    const errors2 = validateZones([z('Z1', 130, 120)])
    expect(errors2).toContainEqual({ index: 0, field: 'low', code: 'lowGteHigh' })
  })

  it("flags a low below the previous zone's high", () => {
    const zones = [z('Z1', 100, 130), z('Z2', 120, 150)]
    const errors = validateZones(zones)
    expect(errors).toContainEqual({ index: 1, field: 'low', code: 'lowBelowPrev' })
    expect(zonesAreValid(zones)).toBe(false)
  })

  it('does not compare against a previous zone whose high is blank', () => {
    const zones = [z('Z1', 100, NaN), z('Z2', 120, 150)]
    const errors = validateZones(zones)
    expect(errors.some((e) => e.code === 'lowBelowPrev')).toBe(false)
  })

  it('accepts an empty list', () => {
    expect(zonesAreValid([])).toBe(true)
  })
})

describe('validateZones with a fixed zone count', () => {
  const five = [
    z('Z1', 0, 120),
    z('Z2', 120, 140),
    z('Z3', 140, 160),
    z('Z4', 160, 172),
    z('Z5', 172, 200),
  ]

  it('accepts a list of exactly the expected length', () => {
    expect(zonesAreValid(five, 5)).toBe(true)
  })

  it('flags a list that is too short', () => {
    const errors = validateZones(five.slice(0, 3), 5)
    expect(errors.some((e) => e.code === 'wrongCount')).toBe(true)
    expect(zonesAreValid(five.slice(0, 3), 5)).toBe(false)
  })

  it('flags a list that is too long', () => {
    expect(zonesAreValid([...five, z('Z6', 200, 210)], 5)).toBe(false)
  })

  it('treats an empty list as not-configured rather than wrong', () => {
    // A skipped onboarding step leaves no zones at all, which is allowed.
    expect(zonesAreValid([], 5)).toBe(true)
  })

  it('still checks bounds when the count is right', () => {
    const broken = [...five]
    broken[1] = z('Z2', 100, 140) // overlaps Z1
    expect(zonesAreValid(broken, 5)).toBe(false)
  })
})

describe('contiguity', () => {
  it('accepts both contiguous conventions', () => {
    // Inclusive-upper (`low === prev.high + 1`) and exclusive-upper
    // (`low === prev.high`) are both in use.
    expect(zonesAreValid([z('Z1', 0, 120), z('Z2', 120, 140)])).toBe(true)
    expect(zonesAreValid([z('Z1', 0, 120), z('Z2', 121, 140)])).toBe(true)
  })

  it('flags a gap above the previous zone', () => {
    // A value in the gap belongs to no zone, and used to be attributed to the
    // top one — easy riding filed as maximal effort.
    const errors = validateZones([z('Z1', 0, 120), z('Z2', 130, 140)])
    expect(errors.some((e) => e.code === 'gapAbovePrev')).toBe(true)
  })

  it('still flags an overlap separately from a gap', () => {
    const errors = validateZones([z('Z1', 0, 120), z('Z2', 100, 140)])
    expect(errors.some((e) => e.code === 'lowBelowPrev')).toBe(true)
    expect(errors.some((e) => e.code === 'gapAbovePrev')).toBe(false)
  })
})
