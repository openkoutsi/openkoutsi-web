'use client'

import { useState } from 'react'
import {
  experienceLevelFrom,
  planDefaultsForLevel,
  weeklyHoursFrom,
} from '@/lib/planDefaults'

/**
 * Shared state for the plan-structure controls used by the create and
 * regenerate dialogs (issue #29): periodization, intensity, week-over-week
 * progression, build/recovery cadence, weekly base Load and available-hours
 * range. Seeds sensible defaults from the athlete's experience level and saved
 * weekly-hours availability, and can be prefilled from an existing plan config.
 */
export function usePlanStructureState(appSettings: Record<string, unknown> | undefined | null) {
  const level = experienceLevelFrom(appSettings)
  const defaults = planDefaultsForLevel(level)
  const savedHours = weeklyHoursFrom(appSettings)

  const [periodization, setPeriodization] = useState('base_building')
  const [intensityPref, setIntensityPref] = useState(defaults.intensity_preference)
  const [progressionPct, setProgressionPct] = useState(String(defaults.weekly_progression_pct))
  const [buildWeeks, setBuildWeeks] = useState(String(defaults.build_weeks))
  const [baseLoad, setBaseLoad] = useState('')
  const [hoursMin, setHoursMin] = useState(savedHours.min)
  const [hoursMax, setHoursMax] = useState(savedHours.max)

  /** Reset every field to the experience-derived defaults. */
  function resetToDefaults() {
    setPeriodization('base_building')
    setIntensityPref(defaults.intensity_preference)
    setProgressionPct(String(defaults.weekly_progression_pct))
    setBuildWeeks(String(defaults.build_weeks))
    setBaseLoad('')
    setHoursMin(savedHours.min)
    setHoursMax(savedHours.max)
  }

  /** Prefill from an existing plan config (regenerate); missing keys keep defaults. */
  function applyConfig(cfg: Record<string, unknown> | null | undefined) {
    if (!cfg) return
    if (typeof cfg.periodization === 'string') setPeriodization(cfg.periodization)
    if (typeof cfg.intensity_preference === 'string') setIntensityPref(cfg.intensity_preference)
    if (cfg.weekly_progression_pct != null) setProgressionPct(String(cfg.weekly_progression_pct))
    if (cfg.build_weeks != null) setBuildWeeks(String(cfg.build_weeks))
    if (cfg.weekly_base_load != null) setBaseLoad(String(cfg.weekly_base_load))
    if (cfg.weekly_hours_min != null) setHoursMin(String(cfg.weekly_hours_min))
    if (cfg.weekly_hours_max != null) setHoursMax(String(cfg.weekly_hours_max))
  }

  /** The structure parameters to merge into the posted plan config. */
  function toConfigParams(): Record<string, unknown> {
    const params: Record<string, unknown> = {
      periodization,
      intensity_preference: intensityPref,
    }
    const pct = parseFloat(progressionPct)
    if (!Number.isNaN(pct)) params.weekly_progression_pct = pct
    const bw = parseInt(buildWeeks)
    if (!Number.isNaN(bw)) params.build_weeks = bw
    const bl = parseInt(baseLoad)
    if (!Number.isNaN(bl)) params.weekly_base_load = bl
    const hmin = parseFloat(hoursMin)
    const hmax = parseFloat(hoursMax)
    if (!Number.isNaN(hmin)) params.weekly_hours_min = hmin
    if (!Number.isNaN(hmax)) params.weekly_hours_max = hmax
    return params
  }

  return {
    periodization,
    setPeriodization,
    intensityPref,
    setIntensityPref,
    progressionPct,
    setProgressionPct,
    buildWeeks,
    setBuildWeeks,
    baseLoad,
    setBaseLoad,
    hoursMin,
    setHoursMin,
    hoursMax,
    setHoursMax,
    resetToDefaults,
    applyConfig,
    toConfigParams,
  }
}
