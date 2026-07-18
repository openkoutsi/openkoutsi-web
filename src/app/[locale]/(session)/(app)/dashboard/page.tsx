'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth'
import { fetcher, apiFetch } from '@/lib/api'
import type { FitnessPoint, FitnessCurrent, TrainingPlan, TrainingStatus, ActivitySummary, WeeklyZoneBucket, Page } from '@/lib/types'
import { formatHoursMinutes, formatDistance } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FitnessChart } from '@/components/charts/FitnessChart'
import { WeeklyLoadBar } from '@/components/charts/WeeklyLoadBar'
import { WeeklyZones } from '@/components/charts/WeeklyZones'
import { PlanAdherenceCard } from '@/components/plan/PlanAdherenceCard'
import { showAdherenceScores } from '@/lib/adherence'
import { ActivityCalendar } from '@/components/activities/ActivityCalendar'
import { aggregatePlannedLoadByWeek } from '@/lib/planUtils'
import { parseMoodAndParagraphs, KoutsiAvatar, KoutsiBubble } from '@/components/koutsi-chat'
import { HelpCircle, RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const PERIOD_OPTIONS = [
  { label: '1W',  days: 7 },
  { label: '1M',  days: 30 },
  { label: '3M',  days: 90 },
  { label: '6M',  days: 180 },
  { label: '1Y',  days: 365 },
  { label: '2Y',  days: 730 },
  { label: '5Y',  days: 1825 },
] as const

const GLOSSARY_KEYS = ['fitness', 'fatigue', 'form', 'ftp', 'load'] as const

function MetricsGlossaryDialog() {
  const t = useTranslations('dashboard')
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t('explainMetrics')}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('glossaryTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {GLOSSARY_KEYS.map((key) => (
            <div key={key}>
              <p className="text-sm font-semibold">
                {t(`glossary.${key}.term` as never)}
                {t.has(`glossary.${key}.aka` as never) && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    · {t(`glossary.${key}.aka` as never)}
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t(`glossary.${key}.description` as never)}
              </p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TrainingStatusCard() {
  const t = useTranslations('dashboard')
  const isPending = (status: string | null | undefined) => status === 'pending'

  const { data, mutate } = useSWR<TrainingStatus>(
    '/api/athlete/training-status',
    fetcher,
    { refreshInterval: (data) => (isPending(data?.status) ? 1500 : 0) },
  )

  async function handleRefresh() {
    await apiFetch('/api/athlete/training-status', { method: 'POST' })
    mutate()
  }

  const status = data?.status ?? null
  const feedback = data?.feedback ?? null
  const pending = isPending(status)

  let content: React.ReactNode

  if (status === 'error') {
    content = (
      <div className="flex items-start gap-3">
        <KoutsiAvatar mood="stern" />
        <div className="flex flex-col gap-2">
          <KoutsiBubble text={t('trainingStatus.error')} />
        </div>
      </div>
    )
  } else if (pending || feedback) {
    const parsed = feedback ? parseMoodAndParagraphs(feedback) : { mood: 'knowing', paragraphs: [] }
    const { mood, paragraphs } = parsed

    if (pending && paragraphs.length === 0) {
      content = (
        <div className="flex items-start gap-3">
          <KoutsiAvatar mood="knowing" />
          <KoutsiBubble text={t('trainingStatus.thinking')} isPartial />
        </div>
      )
    } else {
      content = (
        <div className="flex flex-col gap-3">
          {paragraphs.map((para, i) => {
            const isLast = i === paragraphs.length - 1
            return (
              <div key={i} className="flex items-start gap-3">
                <KoutsiAvatar mood={mood} />
                <KoutsiBubble text={para} isPartial={pending && isLast} />
              </div>
            )
          })}
          {pending && paragraphs.length > 0 && (
            <div className="flex items-start gap-3">
              <KoutsiAvatar mood={mood} />
              <KoutsiBubble text="" isPartial />
            </div>
          )}
        </div>
      )
    }
  } else {
    content = (
      <div className="flex items-start gap-3">
        <KoutsiAvatar mood="neutral" />
        <div className="flex flex-col gap-2 flex-1">
          <KoutsiBubble text={t('trainingStatus.noFeedback')} />
          <Button size="sm" variant="outline" className="self-start" onClick={handleRefresh}>
            {t('trainingStatus.getFeedback')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{t('trainingStatus.title')}</CardTitle>
        {!pending && (
          <Button size="sm" variant="ghost" onClick={handleRefresh} className="h-7 px-2">
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="ml-1 text-xs">{t('trainingStatus.refreshFeedback')}</span>
          </Button>
        )}
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}

function FormBadge({ form }: { form: FitnessCurrent['form_label'] }) {
  const colors: Record<FitnessCurrent['form_label'], string> = {
    peak: 'bg-green-100 text-green-800',
    fresh: 'bg-blue-100 text-blue-800',
    neutral: 'bg-gray-100 text-gray-800',
    tired: 'bg-yellow-100 text-yellow-800',
    overreached: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${colors[form]}`}>
      {form}
    </span>
  )
}

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const { athlete } = useAuth()
  const [days, setDays] = useState(90)
  const [zoneKind, setZoneKind] = useState<'power' | 'hr'>('power')
  const { data: current, mutate: mutateCurrent } = useSWR<FitnessCurrent>('/api/metrics/fitness/current', fetcher)
  const { data: history, mutate: mutateHistory } = useSWR<FitnessPoint[]>(
    `/api/metrics/fitness?days=${days}`,
    fetcher,
  )
  const { data: summary } = useSWR<ActivitySummary>(
    `/api/metrics/activity-summary?days=${days}`,
    fetcher,
  )
  const { data: weeklyZones } = useSWR<WeeklyZoneBucket[]>(
    `/api/metrics/zones/weekly?days=${days}`,
    fetcher,
  )
  const { data: plansPage } = useSWR<Page<TrainingPlan>>('/api/plans', fetcher)
  const plans = plansPage?.items
  const activePlans = plans?.filter((p) => p.status === 'active') ?? []
  const _rawPlanned = plans ? aggregatePlannedLoadByWeek(plans) : undefined
  const plannedByWeek = _rawPlanned?.size ? _rawPlanned : undefined

  // Automatically fill missing DailyMetric rows (e.g. after a new day begins)
  useEffect(() => {
    apiFetch<{ updated: boolean }>('/api/metrics/catch-up', { method: 'POST' })
      .then(({ updated }) => {
        if (updated) {
          mutateCurrent()
          mutateHistory()
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        {athlete?.name && (
          <p className="text-muted-foreground">{t('welcomeBack', { name: athlete.name })}</p>
        )}
      </div>

      {/* Current metrics */}
      <div>
      <div className="flex items-center gap-1.5 mb-3">
        <p className="text-sm font-medium text-muted-foreground">{t('currentFitness')}</p>
        <MetricsGlossaryDialog />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { labelKey: 'metrics.fitness' as const, value: current?.fitness.toFixed(0) ?? '—', isForm: false },
          { labelKey: 'metrics.fatigue' as const, value: current?.fatigue.toFixed(0) ?? '—', isForm: false },
          { labelKey: 'metrics.form' as const, value: current?.form.toFixed(0) ?? '—', isForm: true },
          { labelKey: 'metrics.ftp' as const, value: athlete?.ftp ? `${athlete.ftp} W` : '—', isForm: false },
        ].map(({ labelKey, value, isForm }) => (
          <Card key={labelKey}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{t(labelKey)}</p>
              <p className="text-2xl font-bold mt-1">{value}</p>
              {isForm && current?.form_label && (
                <FormBadge form={current.form_label} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      </div>

      {/* Fitness history chart */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2">
          <CardTitle className="text-base">{t('fitnessHistory')}</CardTitle>
          <div className="flex items-center rounded-md border overflow-hidden text-xs self-start sm:self-auto">
            {PERIOD_OPTIONS.map(({ label, days: d }) => (
              <button
                key={label}
                className={`px-2.5 py-1.5 transition-colors ${days === d ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                onClick={() => setDays(d)}
              >
                {label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {history && history.length > 0 ? (
            <FitnessChart data={history} />
          ) : (
            <p className="text-sm text-muted-foreground py-12 text-center">
              {t('noHistory')}
            </p>
          )}
          {summary && (
            <div className="mt-4 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                    <th className="px-3 py-2 text-right font-medium">{t('activitySummary.numActivities')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('activitySummary.activeTime')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('activitySummary.distance')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-2 text-right tabular-nums">{summary.num_activities}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatHoursMinutes(summary.total_duration_s)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatDistance(summary.total_distance_m)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Load */}
      {history && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('weeklyLoad')}</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyLoadBar data={history} weeks={Math.min(Math.ceil(days / 7), 52)} plannedByWeek={plannedByWeek} />
          </CardContent>
        </Card>
      )}

      {/* Accumulated time in zones (issue #27) */}
      {(() => {
        const hasPower = weeklyZones?.some((w) => Object.keys(w.power).length) ?? false
        const hasHr = weeklyZones?.some((w) => Object.keys(w.hr).length) ?? false
        if (!weeklyZones || (!hasPower && !hasHr)) return null
        // Power is the default; fall back to whichever kind actually has data.
        const shownKind = zoneKind === 'power' ? (hasPower ? 'power' : 'hr') : hasHr ? 'hr' : 'power'
        return (
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2">
              <CardTitle className="text-base">{t('timeInZones')}</CardTitle>
              {hasPower && hasHr && (
                <div className="flex items-center rounded-md border overflow-hidden text-xs self-start sm:self-auto">
                  <button
                    className={`px-2.5 py-1.5 transition-colors ${shownKind === 'power' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    onClick={() => setZoneKind('power')}
                  >
                    {t('timeInZonesPower')}
                  </button>
                  <button
                    className={`px-2.5 py-1.5 transition-colors ${shownKind === 'hr' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    onClick={() => setZoneKind('hr')}
                  >
                    {t('timeInZonesHr')}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <WeeklyZones
                data={weeklyZones}
                kind={shownKind}
                title={shownKind === 'power' ? t('timeInZonesPower') : t('timeInZonesHr')}
              />
            </CardContent>
          </Card>
        )
      })()}

      {/* Plan adherence (deterministic, always computed; display is opt-out) */}
      {showAdherenceScores(athlete?.app_settings) &&
        activePlans
          .filter((p) => p.adherence_score != null)
          .map((p) => <PlanAdherenceCard key={p.id} plan={p} />)}

      {/* Activity calendar */}
      <ActivityCalendar activePlans={activePlans} />

      {/* Daily training status feedback */}
      <TrainingStatusCard />
    </div>
  )
}
