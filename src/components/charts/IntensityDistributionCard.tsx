'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { fetcher } from '@/lib/api'
import type { IntensityBasis, IntensityDistribution, IntensityMethod } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IntensityBands } from '@/components/charts/IntensityBands'
import {
  bandLabelKey,
  coverageIsPartial,
  hasData,
  orderedBands,
} from '@/lib/intensityDistribution'

interface Props {
  title: string
  /** Window length in days. Ignored when `start` is given. */
  days?: number
  /** Explicit window, e.g. a training plan's phase. */
  start?: string
  end?: string
}

/**
 * Intensity distribution over a block, with its shape (issue #38).
 *
 * Both counting methods are offered because they genuinely disagree: time in
 * zones dumps warm-ups and coast-downs into the easy band and pulls almost
 * everyone toward pyramidal, while session counting takes each ride whole. The
 * method is always on screen — a distribution without its method stated does
 * not mean anything.
 */
export function IntensityDistributionCard({ title, days, start, end }: Props) {
  const t = useTranslations('dashboard')
  const [method, setMethod] = useState<IntensityMethod>('time')
  const [basis, setBasis] = useState<IntensityBasis>('power')

  const params = new URLSearchParams()
  if (start) {
    params.set('start', start)
    if (end) params.set('end', end)
  } else if (days) {
    params.set('days', String(days))
  }
  params.set('method', method)
  if (method === 'time') params.set('basis', basis)

  const { data, isLoading } = useSWR<IntensityDistribution>(
    `/api/metrics/intensity-distribution?${params.toString()}`,
    fetcher,
  )

  if (!isLoading && !hasData(data)) return null

  const bands = orderedBands(data)
  const labels = bands.map((b) => t(`intensity.${bandLabelKey(b.band)}` as never))
  const coverage = data?.coverage

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center rounded-md border overflow-hidden text-xs">
            <button
              className={toggleClass(method === 'time')}
              onClick={() => setMethod('time')}
            >
              {t('intensity.methodTime')}
            </button>
            <button
              className={toggleClass(method === 'session')}
              onClick={() => setMethod('session')}
            >
              {t('intensity.methodSession')}
            </button>
          </div>
          {method === 'time' && (
            <div className="flex items-center rounded-md border overflow-hidden text-xs">
              <button
                className={toggleClass(basis === 'power')}
                onClick={() => setBasis('power')}
              >
                {t('timeInZonesPower')}
              </button>
              <button
                className={toggleClass(basis === 'hr')}
                onClick={() => setBasis('hr')}
              >
                {t('timeInZonesHr')}
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            {t('intensity.loading')}
          </div>
        ) : (
          <>
            {data?.classification && (
              <p className="text-sm">
                <span className="font-semibold">
                  {t(`intensity.shape.${data.classification}` as never)}
                </span>
                <span className="text-muted-foreground">
                  {' — '}
                  {t(`intensity.shapeHint.${data.classification}` as never)}
                </span>
              </p>
            )}

            <IntensityBands
              bands={bands}
              labels={labels}
              unitLabel={
                method === 'session' ? t('intensity.unitSessions') : t('intensity.unitTime')
              }
            />

            <p className="text-xs text-muted-foreground">
              {method === 'session'
                ? t('intensity.explainSession')
                : t('intensity.explainTime')}
            </p>

            {coverage && coverageIsPartial(data) && (
              <p className="text-xs text-muted-foreground">
                {t('intensity.coverage', {
                  used: coverage.activities_used,
                  total: coverage.activities_total,
                })}
              </p>
            )}

            {data?.zone_definitions_changed && (
              <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{t('intensity.zonesChanged')}</span>
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function toggleClass(active: boolean): string {
  return `px-2.5 py-1.5 transition-colors ${
    active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
  }`
}
