'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { PlannedWorkout } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { linkedActivityIds } from '@/lib/planUtils'
import {
  adherenceAccentClass,
  adherenceBadgeClass,
  formatAdherence,
  showAdherenceScores,
} from '@/lib/adherence'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const TYPE_COLORS: Record<string, string> = {
  rest: 'bg-gray-100 text-gray-600',
  recovery: 'bg-blue-50 text-blue-700',
  endurance: 'bg-sky-50 text-sky-700',
  tempo: 'bg-yellow-50 text-yellow-700',
  threshold: 'bg-orange-50 text-orange-700',
  vo2max: 'bg-red-50 text-red-700',
  race: 'bg-purple-50 text-purple-700',
  long: 'bg-teal-50 text-teal-700',
  strength: 'bg-emerald-50 text-emerald-700',
  yoga: 'bg-pink-50 text-pink-700',
  'cross-training': 'bg-indigo-50 text-indigo-700',
}

const WORKOUT_TYPE_KEYS = [
  'recovery', 'tempo', 'threshold', 'vo2max', 'endurance',
  'long', 'strength', 'yoga', 'cross-training',
] as const

const SKIP_REASON_KEYS = [
  'illness', 'injury', 'fatigue', 'busy', 'lazy', 'travel', 'weather', 'other',
] as const

interface Props {
  workout: PlannedWorkout
  compact?: boolean
  onClearSkip?: (workout: PlannedWorkout) => Promise<void>
}

export function WorkoutCard({ workout, compact = false, onClearSkip }: Props) {
  const t = useTranslations('app')
  const { athlete } = useAuth()
  const [clearing, setClearing] = useState(false)
  const colorClass = TYPE_COLORS[workout.workout_type] ?? 'bg-muted text-muted-foreground'

  // Adherence display is a per-user preference (default on); the score itself is
  // always computed on the backend.
  const adherenceVisible = showAdherenceScores(athlete?.app_settings)
  const showMatchScore = adherenceVisible && workout.match_score != null

  const linkedCount = linkedActivityIds(workout).length
  const completed = linkedCount > 0

  const typeKey = WORKOUT_TYPE_KEYS.find((k) => k === workout.workout_type)
  const typeLabel = typeKey
    ? t(`plan.generate.workoutTypes.${typeKey}` as never)
    : workout.workout_type

  const handleClearSkip = async () => {
    if (!onClearSkip) return
    setClearing(true)
    try {
      await onClearSkip(workout)
    } finally {
      setClearing(false)
    }
  }

  if (compact) {
    return (
      <div
        className={cn(
          'rounded px-2 py-1 text-xs font-medium truncate',
          colorClass,
          showMatchScore && adherenceAccentClass(workout.match_score),
        )}
        title={showMatchScore ? t('plan.matchScoreLabel') : undefined}
      >
        {typeLabel}
        {workout.skip_reason != null
          ? ` · ${t('plan.skipped')}`
          : workout.target_load != null
            ? ` · ${workout.target_load} Load`
            : null}
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg px-3 py-2 text-sm', colorClass)}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{typeLabel}</span>
        <div className="flex items-center gap-1">
          {workout.duration_min != null && (
            <span className="text-xs opacity-75">{workout.duration_min} min</span>
          )}
          {workout.target_load != null && (
            <Badge variant="outline" className="text-xs h-5">
              {workout.target_load} Load
            </Badge>
          )}
          {completed && (
            <Badge variant="secondary" className="text-xs h-5">
              {t('plan.done')}{linkedCount > 1 ? ` ·${linkedCount}` : ''}
            </Badge>
          )}
          {showMatchScore && (
            <Badge
              className={cn('text-xs h-5 border-transparent', adherenceBadgeClass(workout.match_score))}
              title={t('plan.matchScoreLabel')}
            >
              {formatAdherence(workout.match_score)}
            </Badge>
          )}
          {workout.skip_reason != null && !completed && (
            <Badge className="text-xs h-5 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
              {t('plan.skipped')}
            </Badge>
          )}
        </div>
      </div>
      {workout.description && (
        <p className="text-xs mt-1 opacity-80">{workout.description}</p>
      )}
      {workout.skip_reason != null && !completed && (
        <p className="text-xs mt-1 opacity-70 italic">
          {SKIP_REASON_KEYS.includes(workout.skip_reason as typeof SKIP_REASON_KEYS[number])
            ? t(`plan.skipReasons.${workout.skip_reason}` as never)
            : workout.skip_reason}
        </p>
      )}
      {workout.skip_reason != null && !completed && onClearSkip && (
        <div className="mt-2 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6 px-2 opacity-70 hover:opacity-100"
            disabled={clearing}
            onClick={handleClearSkip}
          >
            {t('plan.clearSkip')}
          </Button>
        </div>
      )}
    </div>
  )
}
