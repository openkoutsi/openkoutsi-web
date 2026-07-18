import type { Zone } from './types'

/**
 * A blank numeric zone field is represented as `NaN` while editing so that the
 * input can be cleared completely. Use this helper to tell a real, entered
 * value apart from a blank one.
 */
export function isBlank(value: number): boolean {
  return !Number.isFinite(value)
}

export type ZoneErrorCode =
  | 'required' // field is empty
  | 'lowGteHigh' // low is not below high within the same zone
  | 'lowBelowPrev' // low is lower than the previous (lower) zone's high

export interface ZoneFieldError {
  index: number
  field: 'low' | 'high'
  code: ZoneErrorCode
}

/**
 * Validate a list of zones for the constraints enforced on save:
 *  - both bounds must be filled in
 *  - low must be strictly below high within a zone
 *  - a zone's low must not be lower than the high of the zone below it
 *
 * Zones are assumed to be ordered from lowest to highest.
 */
export function validateZones(zones: Zone[]): ZoneFieldError[] {
  const errors: ZoneFieldError[] = []

  zones.forEach((zone, i) => {
    const lowSet = !isBlank(zone.low)
    const highSet = !isBlank(zone.high)

    if (!lowSet) errors.push({ index: i, field: 'low', code: 'required' })
    if (!highSet) errors.push({ index: i, field: 'high', code: 'required' })

    if (lowSet && highSet && zone.low >= zone.high) {
      errors.push({ index: i, field: 'low', code: 'lowGteHigh' })
    }

    if (i > 0) {
      const prev = zones[i - 1]
      if (lowSet && !isBlank(prev.high) && zone.low < prev.high) {
        errors.push({ index: i, field: 'low', code: 'lowBelowPrev' })
      }
    }
  })

  return errors
}

export function zonesAreValid(zones: Zone[]): boolean {
  return validateZones(zones).length === 0
}
