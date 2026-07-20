import { describe, expect, it } from 'vitest'
import { showWeeklyLoad } from '@/lib/weeklyLoad'

describe('showWeeklyLoad', () => {
  it('defaults to on when unset', () => {
    expect(showWeeklyLoad(undefined)).toBe(true)
    expect(showWeeklyLoad(null)).toBe(true)
    expect(showWeeklyLoad({})).toBe(true)
  })

  it('respects an explicit false', () => {
    expect(showWeeklyLoad({ show_weekly_load: false })).toBe(false)
    expect(showWeeklyLoad({ show_weekly_load: true })).toBe(true)
  })
})
