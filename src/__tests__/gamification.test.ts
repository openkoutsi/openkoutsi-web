import { describe, expect, it } from 'vitest'

import en from '../../messages/en/app.json'
import fi from '../../messages/fi/app.json'

import {
  byMostRecent,
  descriptionValues,
  formatTier,
  formatTierValue,
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
  // Not a streak: the tiers count activities outright, with no per-period bar
  // to clear.
  threshold: null,
  threshold_unit: null,
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

describe('streak rule copy', () => {
  const streakIds = Object.keys(en.achievements.items).filter((id) =>
    id.startsWith('streak_'),
  )

  it('covers every streak achievement in both locales', () => {
    // The streak card renders `rules.<id>`; a streak shipped without one would
    // show a raw i18n key. This is what breaks when the second catalogue wave
    // adds streak_plan_weeks and streak_logged_weeks.
    expect(streakIds.length).toBeGreaterThan(0)
    for (const id of streakIds) {
      expect(en.achievements.rules, `en is missing ${id}`).toHaveProperty(id)
      expect(fi.achievements.rules, `fi is missing ${id}`).toHaveProperty(id)
    }
  })

  it('has no rule for an achievement that is not a streak', () => {
    expect(Object.keys(en.achievements.rules).sort()).toEqual(streakIds.sort())
    expect(Object.keys(fi.achievements.rules).sort()).toEqual(streakIds.sort())
  })

  it('states a maintenance rule rather than a badge target', () => {
    // `items.*.description` is written for the badge and interpolates {tier} —
    // how many periods it takes. A rule describes keeping the streak alive, so
    // it must never mention a tier.
    for (const id of streakIds) {
      const rule = (en.achievements.rules as Record<string, string>)[id]
      expect(rule).not.toContain('{tier}')
      expect(rule.length).toBeGreaterThan(0)
    }
  })

  it('never hardcodes a qualifying threshold', () => {
    // The threshold comes from the API, which reads it from the backend's own
    // constants. A number written into the copy would silently disagree with
    // the engine the day that constant changes — the exact drift this
    // interpolation exists to prevent.
    const suspicious = /\b(5|100|1000|2)\b/
    for (const locale of [en, fi]) {
      for (const id of streakIds) {
        const rule = (locale.achievements.rules as Record<string, string>)[id]
        const description = (
          locale.achievements.items as Record<string, { description: string }>
        )[id].description
        expect(rule, `${id} rule hardcodes a number`).not.toMatch(suspicious)
        expect(description, `${id} description hardcodes a number`).not.toMatch(
          suspicious,
        )
      }
    }
  })
})

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

describe('formatTierValue', () => {
  it('renders a bare number, whatever the unit means', () => {
    expect(formatTierValue(500)).toBe('500')
    expect(formatTierValue(8848)).toBe('8848')
    expect(formatTierValue(80)).toBe('80')
  })

  it('does not add trailing noise to whole numbers', () => {
    expect(formatTierValue(4)).toBe('4')
    expect(formatTierValue(3.5)).toBe('3.5')
  })
})

describe('descriptionValues', () => {
  /** What the backend's catalogue says each badge's tiers mean. */
  const UNITS: Record<string, string> = {
    long_activity: 'hours',
    total_hours: 'hours',
    single_ride_distance: 'km',
    total_distance: 'km',
    single_ride_elevation: 'metres',
    total_elevation: 'metres',
    everesting: 'metres',
    total_load: 'load',
    plan_adherence: 'percent',
  }

  /** A tier big enough that its digits can't be confused with the copy. */
  const TIER = 160

  function define(id: string): AchievementDefinition {
    return {
      id,
      category: 'volume',
      tiers: [TIER],
      unit: UNITS[id] ?? 'count',
      requires: null,
      // Streak copy interpolates this; the value itself is the API's.
      threshold: 5,
      threshold_unit: 'hours',
    }
  }

  function render(template: string, id: string): string {
    const values = descriptionValues(define(id), TIER)
    return template
      .replaceAll('{tier}', values.tier)
      .replaceAll('{threshold}', String(values.threshold))
  }

  it('interpolates the tier as a bare number', () => {
    expect(descriptionValues(define('single_ride_distance'), TIER).tier).toBe('160')
    expect(descriptionValues(define('plan_adherence'), TIER).tier).toBe('160')
  })

  it('falls back to the top tier once every tier is earned', () => {
    const definition = { ...define('total_hours'), tiers: [10, 100, 500] }
    expect(descriptionValues(definition, null).tier).toBe('500')
  })

  it('passes the threshold through untouched', () => {
    expect(descriptionValues(define('streak_volume_weeks'), TIER).threshold).toBe(5)
  })

  it('never doubles a unit the copy already names', () => {
    // The descriptions spell the unit out in their own words — "Cover {tier}
    // km", "Aja {tier} tuntia" — so a formatted tier read "160 km km",
    // "500 h tuntia", "80 % %:n" on the achievements page.
    const doubled = [/\bkm\s+km\b/, /\bh\s+(h|hours|tuntia)\b/, /\bm\s+m\b/, /%\s*%/]
    for (const locale of [en, fi]) {
      const items = locale.achievements.items as Record<string, { description: string }>
      for (const [id, item] of Object.entries(items)) {
        const text = render(item.description, id)
        for (const pattern of doubled) {
          expect(text, `${id}: "${text}"`).not.toMatch(pattern)
        }
      }
    }
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
