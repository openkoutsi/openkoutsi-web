/**
 * Shared helpers for achievements and streaks (issue #33).
 */

import type { AchievementDefinition, AchievementUnlock } from './types'

/**
 * Whether the UI should surface achievements and streaks, from the athlete's
 * `app_settings.gamification` preference. Defaults to **on** (an unset
 * preference shows them), mirroring `ask_for_rpe`.
 *
 * The preference is offered in the onboarding wizard as well as in settings, so
 * an athlete who finds badges off-putting can decline before the first one ever
 * appears. Every consumer reads the flag through here so the default lives in
 * exactly one place.
 */
export function gamificationEnabled(
  appSettings: Record<string, unknown> | null | undefined,
): boolean {
  return appSettings?.gamification !== false
}

/** Highest tier earned for an achievement, or null when none is. */
export function highestTier(
  unlocked: AchievementUnlock[],
  achievementId: string,
): number | null {
  const tiers = unlocked
    .filter((u) => u.achievement_id === achievementId)
    .map((u) => u.tier)
  return tiers.length ? Math.max(...tiers) : null
}

/**
 * The next tier the athlete is working toward, or null once every tier is
 * earned. Tiers arrive ascending from the API.
 */
export function nextTier(
  definition: AchievementDefinition,
  earned: number | null,
): number | null {
  const next = definition.tiers.find((t) => earned === null || t > earned)
  return next ?? null
}

/**
 * Progress toward `target` as a 0–1 fraction, clamped. A missing or zero target
 * reads as complete rather than dividing by zero.
 */
export function tierProgress(current: number, target: number | null): number {
  if (target === null || target <= 0) return 1
  return Math.max(0, Math.min(1, current / target))
}

/**
 * Format a tier as a bare number, without its unit. Values are rendered
 * without trailing noise — 8848, not 8848.0.
 *
 * This is what belongs in the `items.*.description` copy: those sentences
 * spell the unit out in their own words ("Cover {tier} km in one ride.",
 * "Aja {tier} tuntia yhdellä lenkillä."), so interpolating a formatted tier
 * doubles it — "160 km km", "500 h tuntia".
 */
export function formatTierValue(tier: number): string {
  return Number.isInteger(tier) ? tier.toString() : tier.toFixed(1)
}

/**
 * Format a tier for display in the achievement's own unit, for the places that
 * show a value on its own — the tier label, the progress readout — rather than
 * inside a sentence that already names the unit.
 */
export function formatTier(tier: number, unit: string): string {
  const n = formatTierValue(tier)
  switch (unit) {
    case 'hours':
      return `${n} h`
    case 'km':
      return `${n} km`
    case 'metres':
      return `${n} m`
    case 'percent':
      return `${n}%`
    default:
      // count, load, weeks, months — the label carries the noun.
      return n
  }
}

/**
 * Interpolation values for an achievement's `items.<id>.description`.
 *
 * `tier` is the tier the athlete is working toward, or the top one once every
 * tier is earned — as a bare number, because the copy names the unit itself.
 * `threshold` is what makes a streak period qualify; it comes from the API so
 * the rule shown can't drift from the rule enforced.
 */
export function descriptionValues(
  definition: AchievementDefinition,
  target: number | null,
): { tier: string; threshold: number | null } {
  const tier = target ?? definition.tiers[definition.tiers.length - 1]
  return { tier: formatTierValue(tier), threshold: definition.threshold }
}

/**
 * Sort unlocks newest-first by the day the criterion was met. Used for the
 * "recently earned" strip on the dashboard.
 */
export function byMostRecent(unlocked: AchievementUnlock[]): AchievementUnlock[] {
  return [...unlocked].sort((a, b) => b.achieved_on.localeCompare(a.achieved_on))
}
