import { describe, expect, it } from 'vitest'
import {
  cn,
  formatDate,
  formatDecoupling,
  formatDistance,
  formatDuration,
  formatEfficiencyFactor,
  formatHoursMinutes,
  formatHR,
  formatPower,
  formatVariabilityIndex,
  formatWPrime,
  relativeAge,
} from '@/lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('resolves tailwind conflicts (last wins)', () => {
    // tailwind-merge: p-4 and p-2 conflict — p-2 wins
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('filters falsy values', () => {
    expect(cn('text-red-500', false && 'text-blue-500')).toBe('text-red-500')
    expect(cn('foo', null, undefined, 'bar')).toBe('foo bar')
  })

  it('handles empty input', () => {
    expect(cn()).toBe('')
  })
})

describe('formatDate', () => {
  it('formats a date string into a readable date', () => {
    const result = formatDate('2025-01-15')
    // Should contain the year and day
    expect(result).toContain('2025')
    expect(result).toContain('15')
  })
})

describe('formatDuration', () => {
  it('formats hours and minutes', () => {
    expect(formatDuration(3661)).toBe('1h 1m')
    expect(formatDuration(3600)).toBe('1h 0m')
    expect(formatDuration(7320)).toBe('2h 2m')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1m 30s')
    expect(formatDuration(60)).toBe('1m 0s')
  })

  it('formats seconds only', () => {
    expect(formatDuration(45)).toBe('45s')
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(1)).toBe('1s')
  })

  it('omits zero hours', () => {
    expect(formatDuration(120)).not.toContain('h')
  })
})

describe('formatHoursMinutes', () => {
  it('always shows hours and minutes', () => {
    expect(formatHoursMinutes(45 * 60)).toBe('0h 45m')
    expect(formatHoursMinutes(3600)).toBe('1h 0m')
    expect(formatHoursMinutes(45296)).toBe('12h 34m')
    expect(formatHoursMinutes(0)).toBe('0h 0m')
  })
})

describe('formatDistance', () => {
  it('shows meters for distances under 1 km', () => {
    expect(formatDistance(500)).toBe('500 m')
    expect(formatDistance(999)).toBe('999 m')
  })

  it('shows kilometres for distances >= 1 km', () => {
    expect(formatDistance(1000)).toBe('1.0 km')
    expect(formatDistance(1500)).toBe('1.5 km')
    expect(formatDistance(42195)).toBe('42.2 km')
  })
})

describe('formatPower', () => {
  it('returns dash for null', () => {
    expect(formatPower(null)).toBe('—')
  })

  it('returns dash for undefined', () => {
    expect(formatPower(undefined)).toBe('—')
  })

  it('rounds and appends W', () => {
    expect(formatPower(250)).toBe('250 W')
    expect(formatPower(250.7)).toBe('251 W')
    expect(formatPower(0)).toBe('0 W')
  })
})

describe('formatHR', () => {
  it('returns dash for null', () => {
    expect(formatHR(null)).toBe('—')
  })

  it('returns dash for undefined', () => {
    expect(formatHR(undefined)).toBe('—')
  })

  it('rounds and appends bpm', () => {
    expect(formatHR(148)).toBe('148 bpm')
    expect(formatHR(148.6)).toBe('149 bpm')
    expect(formatHR(0)).toBe('0 bpm')
  })
})

// ── Aerobic response metrics (issue #37) ──────────────────────────────────────

describe('formatEfficiencyFactor', () => {
  it('returns dash when missing', () => {
    expect(formatEfficiencyFactor(null)).toBe('—')
    expect(formatEfficiencyFactor(undefined)).toBe('—')
  })

  it('shows two decimals with the unit', () => {
    expect(formatEfficiencyFactor(1.5238)).toBe('1.52 W/bpm')
    expect(formatEfficiencyFactor(2)).toBe('2.00 W/bpm')
  })
})

describe('formatVariabilityIndex', () => {
  it('returns dash when missing', () => {
    expect(formatVariabilityIndex(null)).toBe('—')
    expect(formatVariabilityIndex(undefined)).toBe('—')
  })

  it('shows two decimals and no unit', () => {
    expect(formatVariabilityIndex(1.067)).toBe('1.07')
    expect(formatVariabilityIndex(1)).toBe('1.00')
  })
})

describe('formatDecoupling', () => {
  it('returns dash when missing', () => {
    // A gated-out decoupling is null; the card explains why alongside the dash.
    expect(formatDecoupling(null)).toBe('—')
    expect(formatDecoupling(undefined)).toBe('—')
  })

  it('always carries a sign, because the sign is the meaning', () => {
    expect(formatDecoupling(3.42)).toBe('+3.4 %')
    expect(formatDecoupling(-1.24)).toBe('−1.2 %')
    expect(formatDecoupling(0)).toBe('+0.0 %')
  })
})

describe('formatWPrime', () => {
  it('returns dash when missing', () => {
    expect(formatWPrime(null)).toBe('—')
    expect(formatWPrime(undefined)).toBe('—')
  })

  it('converts joules to kilojoules', () => {
    expect(formatWPrime(15000)).toBe('15.0 kJ')
    expect(formatWPrime(23480)).toBe('23.5 kJ')
  })
})

describe('relativeAge', () => {
  const now = new Date('2026-07-31T12:00:00Z').getTime()
  const minutesAgo = (m: number) => now - m * 60_000

  it('reads as "now" under a minute', () => {
    expect(relativeAge(now, now)).toEqual({ unit: 'now' })
    expect(relativeAge(now - 59_000, now)).toEqual({ unit: 'now' })
  })

  it('counts whole minutes up to an hour', () => {
    expect(relativeAge(minutesAgo(1), now)).toEqual({ unit: 'minutes', value: 1 })
    expect(relativeAge(minutesAgo(59), now)).toEqual({ unit: 'minutes', value: 59 })
  })

  it('switches to whole hours at an hour', () => {
    expect(relativeAge(minutesAgo(60), now)).toEqual({ unit: 'hours', value: 1 })
    expect(relativeAge(minutesAgo(179), now)).toEqual({ unit: 'hours', value: 2 })
  })

  it('treats a timestamp from the future as now', () => {
    // Clock skew between the device and the server should not read as negative.
    expect(relativeAge(now + 60_000, now)).toEqual({ unit: 'now' })
  })
})
