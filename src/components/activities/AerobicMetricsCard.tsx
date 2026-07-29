'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  formatDecoupling,
  formatEfficiencyFactor,
  formatVariabilityIndex,
  formatWPrime,
} from '@/lib/utils'
import { ActivityDetail } from '@/lib/types'

/**
 * Aerobic response metrics for a single activity (issue #37).
 *
 * These get their own card rather than joining the stats grid because each one
 * needs a sentence of context to be read correctly — and because decoupling has
 * a genuine "not applicable" state that a dash in a stat tile would misrepresent
 * as missing data rather than as a deliberate refusal to show a misleading
 * number.
 */
export function AerobicMetricsCard({ activity }: { activity: ActivityDetail }) {
  const t = useTranslations('activities')

  const hasDecoupling = activity.decoupling_pct != null
  // The backend sends a reason code whenever it withheld a figure; fall back to
  // the generic line if it ever sends one this build doesn't know about.
  const reasonKey = activity.decoupling_reason
  const reasonPath = `detail.aerobic.decouplingReasons.${reasonKey}` as never
  const reasonText =
    reasonKey && t.has(reasonPath)
      ? t(reasonPath)
      : t('detail.aerobic.decouplingReasons.unknown')

  // Nothing to say at all — no power and no heart rate.
  if (
    activity.efficiency_factor == null &&
    activity.variability_index == null &&
    !hasDecoupling &&
    !reasonKey
  ) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('detail.aerobic.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Metric
            label={t('detail.aerobic.efficiencyFactor')}
            value={formatEfficiencyFactor(activity.efficiency_factor)}
            hint={t('detail.aerobic.efficiencyFactorHint')}
          />
          <Metric
            label={t('detail.aerobic.variabilityIndex')}
            value={formatVariabilityIndex(activity.variability_index)}
            hint={t('detail.aerobic.variabilityIndexHint')}
          />
          <Metric
            label={t('detail.aerobic.decoupling')}
            value={hasDecoupling ? formatDecoupling(activity.decoupling_pct) : '—'}
            hint={hasDecoupling ? t('detail.aerobic.decouplingHint') : reasonText}
          />
        </div>

        {hasDecoupling && (
          <p className="text-xs text-muted-foreground">
            {t('detail.aerobic.decouplingCaveat')}
          </p>
        )}

        {activity.cp_w != null && (
          <p className="text-xs text-muted-foreground">
            {t('detail.aerobic.wBalBasis', {
              cp: Math.round(activity.cp_w),
              wPrime: formatWPrime(activity.w_prime_j),
            })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold mt-0.5">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  )
}
