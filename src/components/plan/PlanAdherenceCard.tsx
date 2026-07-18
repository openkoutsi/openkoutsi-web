'use client'

import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { fetcher } from '@/lib/api'
import type { PlanAdherencePoint, TrainingPlan } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AdherenceChart } from '@/components/charts/AdherenceChart'
import { adherenceBadgeClass, formatAdherence } from '@/lib/adherence'
import { cn } from '@/lib/utils'

interface Props {
  plan: TrainingPlan
}

/** Dashboard indicator + trend chart for a single active plan's adherence
 *  (issue #26). The score is deterministic and always available — no LLM. */
export function PlanAdherenceCard({ plan }: Props) {
  const t = useTranslations('dashboard')
  const { data: series } = useSWR<PlanAdherencePoint[]>(
    `/api/plans/${plan.id}/adherence`,
    fetcher,
  )

  const summary = plan.adherence_summary
  const hasTrend = (series?.filter((p) => p.score != null).length ?? 0) > 1

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base truncate">
          {t('adherence.title', { name: plan.name })}
        </CardTitle>
        <span
          className={cn(
            'text-sm rounded-full px-2.5 py-0.5 font-semibold shrink-0 tabular-nums',
            adherenceBadgeClass(plan.adherence_score),
          )}
        >
          {formatAdherence(plan.adherence_score)}
        </span>
      </CardHeader>
      <CardContent>
        {summary && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
            <span>{t('adherence.completed', { count: summary.completed })}</span>
            <span>{t('adherence.notMarked', { count: summary.missed })}</span>
            <span>{t('adherence.skipped', { count: summary.skipped })}</span>
          </div>
        )}
        {hasTrend ? (
          <AdherenceChart data={series!} label={t('adherence.chartLabel')} />
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {t('adherence.noTrend')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
