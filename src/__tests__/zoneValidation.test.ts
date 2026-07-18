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

  it('accepts a gap between zones (low above previous high)', () => {
    const zones = [z('Z1', 100, 120), z('Z2', 130, 140)]
    expect(zonesAreValid(zones)).toBe(true)
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
