import { describe, it, expect } from 'vitest'

import {
  elevationFloor,
  formatGradient,
  formatKm,
  formatPercentFtp,
  formatSpeedFromMs,
  formatTargetTime,
  gradientColor,
  isPlanPending,
  parseTargetPower,
  parseTargetTime,
  profileSeries,
  segmentAtKm,
  segmentTypeOf,
  targetModeOf,
  targetReanalyzeBody,
} from '@/lib/courses'
import type { CourseSegment } from '@/lib/types'

function seg(over: Partial<CourseSegment> = {}): CourseSegment {
  return {
    segment_index: 0,
    start_distance_m: 0,
    end_distance_m: 1000,
    length_m: 1000,
    avg_gradient: 0,
    elevation_change_m: 0,
    segment_type: 'flat',
    power_w: 200,
    speed_ms: 9,
    duration_s: 111,
    start_offset_s: 0,
    speed_capped: false,
    // Unmatched by default: the shape a course has on any instance without a
    // surface matcher, and the one every existing test is written against.
    surface: null,
    surface_confidence: null,
    surface_raw: null,
    crr_used: null,
    ...over,
  }
}

describe('gradientColor', () => {
  it('gives every gradient a colour, in bands', () => {
    // Bands are ordered, so a steeper gradient never gets a cooler colour
    // than a shallower one.
    const samples = [-0.2, -0.08, -0.03, 0, 0.03, 0.05, 0.08, 0.12, 0.2]
    const colours = samples.map(gradientColor)
    expect(colours.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true)
    // The flat band covers both signs of "basically flat".
    expect(gradientColor(0.01)).toBe(gradientColor(-0.01))
    // And the extremes are distinguishable.
    expect(gradientColor(0.2)).not.toBe(gradientColor(-0.2))
  })

  it('is defined below every band minimum', () => {
    expect(gradientColor(-99)).toBeTruthy()
  })
})

describe('segmentTypeOf', () => {
  it('matches the backend thresholds', () => {
    expect(segmentTypeOf(0.05)).toBe('climb')
    expect(segmentTypeOf(0.02)).toBe('climb')
    expect(segmentTypeOf(0.01)).toBe('flat')
    expect(segmentTypeOf(-0.01)).toBe('flat')
    expect(segmentTypeOf(-0.02)).toBe('descent')
  })
})

describe('formatGradient', () => {
  it('always shows the sign, with a real minus', () => {
    expect(formatGradient(0.072)).toBe('+7.2 %')
    expect(formatGradient(-0.031)).toBe('−3.1 %')
    expect(formatGradient(0)).toBe('+0.0 %')
  })

  it('renders an em dash for nothing', () => {
    expect(formatGradient(null)).toBe('—')
    expect(formatGradient(undefined)).toBe('—')
  })
})

describe('formatKm / formatSpeedFromMs / formatPercentFtp', () => {
  it('formats distances in kilometres', () => {
    expect(formatKm(4200)).toBe('4.2 km')
    expect(formatKm(450, 2)).toBe('0.45 km')
    expect(formatKm(null)).toBe('—')
  })

  it('converts metres per second to km/h', () => {
    expect(formatSpeedFromMs(10)).toBe('36.0 km/h')
    expect(formatSpeedFromMs(null)).toBe('—')
  })

  it('states a power target as a share of FTP', () => {
    expect(formatPercentFtp(210, 250)).toBe('84%')
    // No FTP, or a coasting segment, means there is no share to state.
    expect(formatPercentFtp(210, null)).toBeNull()
    expect(formatPercentFtp(0, 250)).toBeNull()
  })
})

describe('isPlanPending', () => {
  it('is true only while the plan is being written', () => {
    expect(isPlanPending('pending')).toBe(true)
    expect(isPlanPending('done')).toBe(false)
    expect(isPlanPending(null)).toBe(false)
    expect(isPlanPending(undefined)).toBe(false)
  })
})

describe('profileSeries', () => {
  it('converts the stored profile into chart points', () => {
    const points = profileSeries({
      profile: [
        [0, 100, 0],
        [500, 120, 0.04],
        [1000, 110, -0.02],
      ],
    })
    expect(points).toHaveLength(3)
    expect(points[1]).toMatchObject({ km: 0.5, elevation: 120, gradient: 0.04 })
    expect(points[1].color).toBe(gradientColor(0.04))
  })

  it('survives a course with no profile', () => {
    expect(profileSeries({ profile: null })).toEqual([])
  })
})

describe('elevationFloor', () => {
  it('sits below the lowest point so the shape stays readable', () => {
    // A course between 100 m and 200 m must not be drawn from zero, or the
    // whole profile flattens into a line at the top of the chart.
    const floor = elevationFloor([{ elevation: 100 }, { elevation: 200 }])
    expect(floor).toBeLessThan(100)
    expect(floor).toBeGreaterThan(80)
  })

  it('still leaves room for a pancake-flat course', () => {
    const floor = elevationFloor([{ elevation: 50 }, { elevation: 50 }])
    expect(floor).toBeLessThan(50)
  })

  it('is zero when there is nothing to draw', () => {
    expect(elevationFloor([])).toBe(0)
  })
})

describe('segmentAtKm', () => {
  const segments = [
    seg({ segment_index: 0, start_distance_m: 0, end_distance_m: 2000 }),
    seg({ segment_index: 1, start_distance_m: 2000, end_distance_m: 5000 }),
  ]

  it('finds the segment covering a distance', () => {
    expect(segmentAtKm(segments, 1)?.segment_index).toBe(0)
    expect(segmentAtKm(segments, 3)?.segment_index).toBe(1)
  })

  it('returns nothing past the end of the course', () => {
    expect(segmentAtKm(segments, 9)).toBeUndefined()
  })
})

describe('parseTargetTime', () => {
  it('reads h:mm:ss', () => {
    expect(parseTargetTime('4:30:00')).toBe(4 * 3600 + 30 * 60)
    expect(parseTargetTime(' 1:00:00 ')).toBe(3600)
  })

  it('reads two parts as hours and minutes, not minutes and seconds', () => {
    // A course target is a finish time, and a course worth uploading takes
    // hours — so "4:30" is four and a half hours. The field says so, because
    // the other reading is off by a factor of sixty.
    expect(parseTargetTime('4:30')).toBe(4 * 3600 + 30 * 60)
    expect(parseTargetTime('0:45')).toBe(45 * 60)
  })

  it('is null for anything that is not a time', () => {
    expect(parseTargetTime('')).toBeNull()
    expect(parseTargetTime('soon')).toBeNull()
    expect(parseTargetTime('4')).toBeNull()
    expect(parseTargetTime('1:2:3:4')).toBeNull()
    expect(parseTargetTime('-1:00')).toBeNull()
  })
})

describe('formatTargetTime', () => {
  it('round-trips through parseTargetTime', () => {
    for (const seconds of [3600, 16200, 45 * 60, 9 * 3600 + 7 * 60 + 3]) {
      expect(parseTargetTime(formatTargetTime(seconds))).toBe(seconds)
    }
  })

  it('is empty for no target, so the field opens empty', () => {
    expect(formatTargetTime(null)).toBe('')
    expect(formatTargetTime(undefined)).toBe('')
  })
})

describe('parseTargetPower', () => {
  it('reads whole watts, with or without the unit', () => {
    expect(parseTargetPower('210')).toBe(210)
    expect(parseTargetPower(' 210 W ')).toBe(210)
    expect(parseTargetPower('210w')).toBe(210)
  })

  it('is null for anything the API would reject', () => {
    // The API takes an integer above zero, so everything else is a mistake
    // worth naming rather than a request worth sending.
    expect(parseTargetPower('')).toBeNull()
    expect(parseTargetPower('0')).toBeNull()
    expect(parseTargetPower('-40')).toBeNull()
    expect(parseTargetPower('210.5')).toBeNull()
    expect(parseTargetPower('hard')).toBeNull()
  })
})

describe('targetModeOf', () => {
  it('reads the mode off whichever target is set', () => {
    expect(targetModeOf({ target_time_s: null, target_power_w: null })).toBe('none')
    expect(targetModeOf({ target_time_s: 3600, target_power_w: null })).toBe('time')
    expect(targetModeOf({ target_time_s: null, target_power_w: 210 })).toBe('power')
  })
})

describe('targetReanalyzeBody', () => {
  it('sends only the target being set, and lets the API clear the other', () => {
    expect(targetReanalyzeBody('time', '4:30')).toEqual({ target_time_s: 4 * 3600 + 30 * 60 })
    expect(targetReanalyzeBody('power', '210')).toEqual({ target_power_w: 210 })
  })

  it('names both only to clear both', () => {
    expect(targetReanalyzeBody('none', '')).toEqual({
      target_time_s: null,
      target_power_w: null,
    })
  })

  it('is null for a value that does not parse, so the caller can say so', () => {
    expect(targetReanalyzeBody('time', 'soon')).toBeNull()
    expect(targetReanalyzeBody('power', '')).toBeNull()
    expect(targetReanalyzeBody('power', '-1')).toBeNull()
  })
})
