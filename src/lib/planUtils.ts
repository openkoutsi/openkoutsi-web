import { addDays, startOfWeek, format } from 'date-fns'
import type { FitnessPoint, PlannedWorkout, TrainingPlan } from './types'

/** Computes the calendar Date of a planned workout.
 *  day_of_week: 1=Monday … 7=Sunday (matches backend schema) */
export function workoutDate(planStartDate: string, weekNumber: number, dayOfWeek: number): Date {
  const base = new Date(planStartDate)
  return addDays(base, (weekNumber - 1) * 7 + (dayOfWeek - 1))
}

/** Returns 'yyyy-MM-dd' of the Monday of the ISO week containing `date`. */
export function weekKey(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

/**
 * Aggregates target_load from active plans into a Map of weekKey → total planned Load.
 * Plans with status !== 'active' and workouts with null target_load are skipped.
 */
export function aggregatePlannedLoadByWeek(plans: TrainingPlan[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const plan of plans) {
    if (plan.status !== 'active') continue
    for (const workout of plan.workouts) {
      if (workout.target_load == null) continue
      const date = workoutDate(plan.start_date, workout.week_number, workout.day_of_week)
      const key = weekKey(date)
      map.set(key, (map.get(key) ?? 0) + workout.target_load)
    }
  }
  return map
}

export type PlannedWorkoutStatus = 'completed' | 'skipped' | 'planned'

/** Returns the activity ids linked to a workout, tolerating older payloads
 *  that only carried the single `completed_activity_id`. */
export function linkedActivityIds(workout: PlannedWorkout): string[] {
  if (workout.linked_activity_ids && workout.linked_activity_ids.length > 0) {
    return workout.linked_activity_ids
  }
  return workout.completed_activity_id != null ? [workout.completed_activity_id] : []
}

/** Derives the status of a planned workout.
 *  Any linked activity marks the workout completed and takes precedence over a
 *  skip reason. */
export function plannedWorkoutStatus(workout: PlannedWorkout): PlannedWorkoutStatus {
  if (linkedActivityIds(workout).length > 0) return 'completed'
  if (workout.skip_reason != null) return 'skipped'
  return 'planned'
}

/** Editable workout fields as held in form state (all strings for inputs). */
export interface WorkoutFormValues {
  workout_type: string
  description: string
  duration_min: string
  target_load: string
}

/** Converts a workout edit/add form's string values into an API payload,
 *  coercing blank numeric inputs to null. */
export function workoutFormToPayload(values: WorkoutFormValues): {
  workout_type: string
  description: string | null
  duration_min: number | null
  target_load: number | null
} {
  const toInt = (s: string): number | null => {
    const trimmed = s.trim()
    if (trimmed === '') return null
    const n = parseInt(trimmed, 10)
    return Number.isNaN(n) ? null : n
  }
  return {
    workout_type: values.workout_type,
    description: values.description.trim() || null,
    duration_min: toInt(values.duration_min),
    target_load: toInt(values.target_load),
  }
}

/** Default week-over-week ramp when a plan's config doesn't carry one.
 *  Mirrors the backend's PlanConfig.weekly_progression_pct default. */
const DEFAULT_PROGRESSION_PCT = 7

/** How far above the configured band the projected ramp must sit before it is
 *  worth flagging. The configured percentage governs the week-over-week *Load*
 *  ramp, whereas the forecast reports the resulting *Fitness* ramp — related,
 *  but not the same number — so an exact comparison would cry wolf. The margin
 *  makes this a "this looks aggressive" hint rather than a spec violation. */
const RAMP_TOLERANCE_PCT = 3

export interface RampWeek {
  /** Monday of the projected week (yyyy-MM-dd). */
  weekStart: string
  /** Week-over-week rise in projected Fitness, as a percentage. */
  risePct: number
}

export interface RampCheck {
  /** The plan's configured week-over-week progression, in percent. */
  configuredPct: number
  /** The threshold actually applied (configured + tolerance). */
  thresholdPct: number
  /** Projected weeks whose Fitness rise exceeds the threshold. */
  weeks: RampWeek[]
}

/** Read the configured week-over-week progression from a plan's config. */
export function progressionPctOf(plan: TrainingPlan): number {
  const pct = plan.config?.weekly_progression_pct
  return typeof pct === 'number' && pct > 0 ? pct : DEFAULT_PROGRESSION_PCT
}

/**
 * Flags projected weeks where Fitness ramps faster than the plan intends.
 *
 * Buckets the forecast into Monday-based weeks that fall inside the plan's date
 * range, takes each week's last projected Fitness value, and compares the
 * week-over-week rise against the plan's configured `weekly_progression_pct`
 * plus a tolerance (see `RAMP_TOLERANCE_PCT` for why the comparison is not
 * exact). Weeks starting from a near-zero base are skipped — a percentage rise
 * off ~0 Fitness is arbitrarily large and says nothing useful about the plan.
 */
export function checkProjectedRamp(
  plan: TrainingPlan,
  forecast: FitnessPoint[] | undefined,
): RampCheck {
  const configuredPct = progressionPctOf(plan)
  const thresholdPct = configuredPct + RAMP_TOLERANCE_PCT
  const result: RampCheck = { configuredPct, thresholdPct, weeks: [] }
  if (!forecast || forecast.length === 0 || plan.status !== 'active') return result

  const planStart = new Date(plan.start_date)
  const planEnd = plan.end_date ? new Date(plan.end_date) : null

  // Last projected Fitness of each week inside the plan window, in week order.
  const lastOfWeek = new Map<string, number>()
  for (const point of forecast) {
    const day = new Date(point.date)
    if (day < planStart) continue
    if (planEnd && day > planEnd) continue
    lastOfWeek.set(weekKey(day), point.fitness)
  }

  const weeks = [...lastOfWeek.entries()].sort(([a], [b]) => a.localeCompare(b))
  for (let i = 1; i < weeks.length; i++) {
    const [, previous] = weeks[i - 1]
    const [weekStart, current] = weeks[i]
    if (previous < 1) continue
    const risePct = ((current - previous) / previous) * 100
    if (risePct > thresholdPct) result.weeks.push({ weekStart, risePct })
  }
  return result
}

/** Groups workouts of the active plan by date key (yyyy-MM-dd). */
export function groupPlannedWorkoutsByDate(plan: TrainingPlan | undefined): Map<string, PlannedWorkout[]> {
  const map = new Map<string, PlannedWorkout[]>()
  if (!plan || plan.status !== 'active') return map

  for (const workout of plan.workouts) {
    if (workout.workout_type === 'rest') continue
    const key = format(workoutDate(plan.start_date, workout.week_number, workout.day_of_week), 'yyyy-MM-dd')
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(workout)
  }

  return map
}
