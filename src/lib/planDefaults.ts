/**
 * Suggested plan-structure defaults per self-reported experience level, and
 * helpers to read the athlete's saved weekly-hours availability. Mirrors the
 * backend's EXPERIENCE_PLAN_DEFAULTS / plan_schema so the create/regenerate
 * dialog prefills consistently (issue #29).
 */

export interface PlanStructureDefaults {
  weekly_progression_pct: number
  build_weeks: number
  intensity_preference: string
}

const EXPERIENCE_PLAN_DEFAULTS: Record<string, PlanStructureDefaults> = {
  novice: { weekly_progression_pct: 5, build_weeks: 2, intensity_preference: 'low' },
  intermediate: { weekly_progression_pct: 7, build_weeks: 3, intensity_preference: 'moderate' },
  experienced: { weekly_progression_pct: 9, build_weeks: 3, intensity_preference: 'high' },
  'semi-pro': { weekly_progression_pct: 10, build_weeks: 3, intensity_preference: 'high' },
  elite: { weekly_progression_pct: 10, build_weeks: 3, intensity_preference: 'high' },
}

const FALLBACK = EXPERIENCE_PLAN_DEFAULTS.intermediate

/** Suggested structure defaults for an experience level (falls back to intermediate). */
export function planDefaultsForLevel(level: string | null | undefined): PlanStructureDefaults {
  if (level && EXPERIENCE_PLAN_DEFAULTS[level]) {
    return { ...EXPERIENCE_PLAN_DEFAULTS[level] }
  }
  return { ...FALLBACK }
}

/** Read the experience level stored in the athlete's app_settings. */
export function experienceLevelFrom(appSettings: Record<string, unknown> | undefined | null): string | null {
  const level = appSettings?.experience_level
  return typeof level === 'string' && level ? level : null
}

/** Read the athlete's saved weekly training-hours range from app_settings. */
export function weeklyHoursFrom(
  appSettings: Record<string, unknown> | undefined | null,
): { min: string; max: string } {
  const min = appSettings?.weekly_hours_min
  const max = appSettings?.weekly_hours_max
  return {
    min: typeof min === 'number' ? String(min) : '',
    max: typeof max === 'number' ? String(max) : '',
  }
}
