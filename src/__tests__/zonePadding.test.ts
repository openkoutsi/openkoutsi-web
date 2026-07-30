import { describe, it, expect } from 'vitest'
import {
  padZones,
  HR_ZONE_COUNT,
  HR_ZONE_NAMES,
  POWER_ZONE_COUNT,
  POWER_ZONE_NAMES,
} from '@/lib/zoneDefaults'
import { zonesAreValid } from '@/lib/zoneValidation'
import type { Zone } from '@/lib/types'

const z = (name: string, low: number, high: number): Zone => ({ name, low, high })

describe('padZones', () => {
  it('leaves an unconfigured list empty', () => {
    // Empty means "not set up yet", which is a valid state — a skipped
    // onboarding step leaves it, and padding would invent seven blank rows.
    expect(padZones([], POWER_ZONE_COUNT, POWER_ZONE_NAMES)).toEqual([])
  })

  it('pads a legacy short list to the fixed count', () => {
    const legacy = [z('Z1', 0, 150), z('Z2', 151, 210), z('Z3', 211, 300)]
    const padded = padZones(legacy, POWER_ZONE_COUNT, POWER_ZONE_NAMES)
    expect(padded).toHaveLength(POWER_ZONE_COUNT)
    // The boundaries the athlete actually set are preserved…
    expect(padded[0].low).toBe(0)
    expect(padded[2].high).toBe(300)
    // …and nothing is invented for the rest.
    expect(Number.isNaN(padded[3].low)).toBe(true)
    expect(Number.isNaN(padded[6].high)).toBe(true)
  })

  it('applies the canonical names', () => {
    const legacy = [z('Recovery', 0, 120), z('Endurance', 120, 140)]
    const padded = padZones(legacy, HR_ZONE_COUNT, HR_ZONE_NAMES)
    expect(padded.map((p) => p.name)).toEqual(HR_ZONE_NAMES)
  })

  it('truncates a list that is too long', () => {
    const many = Array.from({ length: 10 }, (_, i) => z(`Z${i + 1}`, i * 10, i * 10 + 10))
    expect(padZones(many, HR_ZONE_COUNT, HR_ZONE_NAMES)).toHaveLength(HR_ZONE_COUNT)
  })

  it('leaves a padded legacy list invalid until it is filled in', () => {
    // The point of padding is to make the list editable, not to make it look
    // saveable — the blank rows must still read as required.
    const padded = padZones([z('Z1', 0, 150)], POWER_ZONE_COUNT, POWER_ZONE_NAMES)
    expect(zonesAreValid(padded, POWER_ZONE_COUNT)).toBe(false)
  })

  it('leaves an already-canonical list untouched', () => {
    const good = HR_ZONE_NAMES.map((name, i) => z(name, i * 20, i * 20 + 20))
    const padded = padZones(good, HR_ZONE_COUNT, HR_ZONE_NAMES)
    expect(padded).toEqual(good)
    expect(zonesAreValid(padded, HR_ZONE_COUNT)).toBe(true)
  })
})
