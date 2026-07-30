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
  | 'gapAbovePrev' // low leaves a gap above the previous zone's high
  | 'wrongCount' // the list does not have the fixed number of zones

export interface ZoneFieldError {
  index: number
  field: 'low' | 'high'
  code: ZoneErrorCode
}

/**
 * Validate a list of zones for the constraints enforced on save:
 *  - the list has exactly `expectedCount` zones, when one is given
 *  - both bounds must be filled in
 *  - low must be strictly below high within a zone
 *  - a zone's low must not be lower than the high of the zone below it
 *
 * Zones are assumed to be ordered from lowest to highest.
 */
export function validateZones(zones: Zone[], expectedCount?: number): ZoneFieldError[] {
  const errors: ZoneFieldError[] = []

  // The API rejects any other length (issue #38), so catch it here rather than
  // letting the athlete find out via a 422 after filling the whole form in.
  // An empty list is "not configured yet", which is allowed and is what a
  // skipped onboarding step leaves behind.
  if (expectedCount !== undefined && zones.length > 0 && zones.length !== expectedCount) {
    errors.push({ index: 0, field: 'low', code: 'wrongCount' })
  }

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
      if (lowSet && !isBlank(prev.high)) {
        if (zone.low < prev.high) {
          errors.push({ index: i, field: 'low', code: 'lowBelowPrev' })
        } else if (zone.low > prev.high + 1) {
          // A value falling in a gap belongs to no zone at all, and used to be
          // attributed to the top one. Both `low === prev.high` and
          // `low === prev.high + 1` count as contiguous, depending on whether
          // the upper bound is read as inclusive.
          errors.push({ index: i, field: 'low', code: 'gapAbovePrev' })
        }
      }
    }
  })

  return errors
}

export function zonesAreValid(zones: Zone[], expectedCount?: number): boolean {
  return validateZones(zones, expectedCount).length === 0
}
