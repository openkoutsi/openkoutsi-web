import { describe, expect, it } from 'vitest'

import {
  byMostRecent,
  formatTier,
  gamificationEnabled,
  highestTier,
  nextTier,
  tierProgress,
} from '@/lib/gamification'
import type { AchievementDefinition, AchievementUnlock } from '@/lib/types'

const definition: AchievementDefinition = {
  id: 'activity_count',
  category: 'volume',
  tiers: [1, 10, 50],
  unit: 'count',
  requires: null,
}

function unlock(id: string, tier: number, achievedOn = '2026-01-01'): AchievementUnlock {
  return {
    achievement_id: id,
    tier,
    achieved_on: achievedOn,
    created_at: null,
    seen: false,
    context: null,
  }
}

describe('gamificationEnabled', () => {
  it('defaults to on when unset', () => {
    expect(gamificationEnabled(undefined)).toBe(true)
    expect(gamificationEnabled(null)).toBe(true)
    expect(gamificationEnabled({})).toBe(true)
  })

  it('respects an explicit false', () => {
    expect(gamificationEnabled({ gamification: false })).toBe(false)
    expect(gamificationEnabled({ gamification: true })).toBe(true)
  })
})

describe('highestTier', () => {
  it('returns null when nothing is earned', () => {
    expect(highestTier([], 'activity_count')).toBeNull()
    expect(highestTier([unlock('goals_reached', 1)], 'activity_count')).toBeNull()
  })

  it('returns the top earned tier regardless of order', () => {
    const unlocked = [unlock('activity_count', 10), unlock('activity_count', 1)]
    expect(highestTier(unlocked, 'activity_count')).toBe(10)
  })
})

describe('nextTier', () => {
  it('starts at the first tier when nothing is earned', () => {
    expect(nextTier(definition, null)).toBe(1)
  })

  it('advances past the earned tier', () => {
    expect(nextTier(definition, 1)).toBe(10)
    expect(nextTier(definition, 10)).toBe(50)
  })

  it('returns null once every tier is earned', () => {
    expect(nextTier(definition, 50)).toBeNull()
  })
})

describe('tierProgress', () => {
  it('is a clamped fraction of the target', () => {
    expect(tierProgress(5, 10)).toBe(0.5)
    expect(tierProgress(0, 10)).toBe(0)
    expect(tierProgress(25, 10)).toBe(1)
    expect(tierProgress(-3, 10)).toBe(0)
  })

  it('reads as complete rather than dividing by zero', () => {
    expect(tierProgress(5, null)).toBe(1)
    expect(tierProgress(5, 0)).toBe(1)
  })
})

describe('formatTier', () => {
  it('appends the unit', () => {
    expect(formatTier(3, 'hours')).toBe('3 h')
    expect(formatTier(100, 'km')).toBe('100 km')
    expect(formatTier(8848, 'metres')).toBe('8848 m')
    expect(formatTier(90, 'percent')).toBe('90%')
  })

  it('leaves bare counts alone', () => {
    expect(formatTier(10, 'count')).toBe('10')
    expect(formatTier(12, 'weeks')).toBe('12')
  })

  it('does not add trailing noise to whole numbers', () => {
    expect(formatTier(4, 'km')).toBe('4 km')
    expect(formatTier(3.5, 'km')).toBe('3.5 km')
  })
})

describe('byMostRecent', () => {
  it('sorts newest first', () => {
    const unlocked = [
      unlock('a', 1, '2026-01-01'),
      unlock('b', 1, '2026-06-01'),
      unlock('c', 1, '2026-03-01'),
    ]
    expect(byMostRecent(unlocked).map((u) => u.achievement_id)).toEqual(['b', 'c', 'a'])
  })

  it('does not mutate its input', () => {
    const unlocked = [unlock('a', 1, '2026-01-01'), unlock('b', 1, '2026-06-01')]
    byMostRecent(unlocked)
    expect(unlocked[0].achievement_id).toBe('a')
  })
})
