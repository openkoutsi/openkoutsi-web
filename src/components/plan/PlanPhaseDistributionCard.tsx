'use client'

import { useTranslations } from 'next-intl'
import { addDays, format, parseISO } from 'date-fns'
import type { TrainingPlan } from '@/lib/types'
import { IntensityDistributionCard } from '@/components/charts/IntensityDistributionCard'

interface Props {
  plan: TrainingPlan
  /** 1-based week the plan is currently on. */
  currentWeek: number
}

/**
 * What the plan's current phase actually produced (issue #38).
 *
 * This is where the measurement earns its keep: a base phase is *supposed* to
 * be mostly easy, and the only way to find out whether it was is to look at the
 * block rather than at one week. The phase window is derived here from
 * `week_meta` and passed to the endpoint as explicit dates, so the metrics API
 * stays free of any plan coupling.
 */
export function PlanPhaseDistributionCard({ plan, currentWeek }: Props) {
  const t = useTranslations('app')
  const phase = currentPhase(plan, currentWeek)
  if (!phase) return null

  return (
    <div className="mt-4">
      <IntensityDistributionCard
        title={t('plan.phaseDistribution.title')}
        start={phase.start}
        end={phase.end}
      />
    </div>
  )
}

/**
 * The run of consecutive same-type weeks containing `currentWeek`, clipped to
 * weeks that have actually happened.
 *
 * A "phase" is not a stored concept — `week_meta` only marks each week as
 * build, recovery or taper. A run of like weeks is the closest thing the plan
 * carries to a phase, and it is the unit a coach would ask about.
 */
export function currentPhase(
  plan: TrainingPlan,
  currentWeek: number,
): { start: string; end: string } | null {
  const meta = plan.week_meta
  if (!plan.start_date || !meta?.length) return null

  const byNumber = new Map(meta.map((m) => [m.week_number, m]))
  const type = byNumber.get(currentWeek)?.week_type
  if (!type) return null

  let first = currentWeek
  while (byNumber.get(first - 1)?.week_type === type) first -= 1
  let last = currentWeek
  while (byNumber.get(last + 1)?.week_type === type) last += 1

  const planStart = parseISO(plan.start_date)
  const start = addDays(planStart, (first - 1) * 7)
  // Only completed and in-progress days can have produced any training, so the
  // window never runs past today — a phase with three weeks still to come must
  // not look like it under-delivered.
  const phaseEnd = addDays(planStart, last * 7 - 1)
  const today = new Date()
  const end = phaseEnd < today ? phaseEnd : today
  if (end < start) return null

  return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') }
}
