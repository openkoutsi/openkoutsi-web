'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'

import { apiFetch, fetcher } from '@/lib/api'
import type { Bike, CourseDetail } from '@/lib/types'
import { formatKm, profileSeries } from '@/lib/courses'
import { formatTime } from '@/lib/utils'
import { toast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CourseProfileChart } from '@/components/charts/CourseProfileChart'
import { SegmentTable } from './SegmentTable'
import { CoursePlanCard } from './CoursePlanCard'
import { AlertTriangle, Wind } from 'lucide-react'

interface Props {
  courseId: string
  bikes: Bike[]
  onChanged: () => void
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}

export function CourseDetailView({ courseId, bikes, onChanged }: Props) {
  const t = useTranslations('courses')
  const [selected, setSelected] = useState<number | null>(null)
  const [reanalysing, setReanalysing] = useState(false)

  const { data: course, mutate } = useSWR<CourseDetail>(
    `/api/courses/${courseId}`,
    fetcher,
  )

  if (!course) {
    return <div className="text-sm text-muted-foreground">{t('detail.loading')}</div>
  }

  async function reanalyse(body: Record<string, unknown>) {
    setReanalysing(true)
    try {
      await apiFetch(`/api/courses/${courseId}/reanalyze`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      await mutate()
      onChanged()
    } catch (err) {
      toast({
        title: t('detail.reanalyseFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setReanalysing(false)
    }
  }

  const points = profileSeries(course)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={t('detail.distance')} value={formatKm(course.distance_m)} />
        <Stat
          label={t('detail.elevation')}
          value={course.elevation_gain_m == null ? '—' : `${Math.round(course.elevation_gain_m)} m`}
        />
        <Stat
          label={t('detail.predicted')}
          value={
            course.predicted_time_s == null
              ? '—'
              : formatTime(Math.round(course.predicted_time_s))
          }
        />
        <Stat
          label={t('detail.intensity')}
          value={course.intensity == null ? '—' : `${course.intensity.toFixed(2)} × FTP`}
        />
      </div>

      {/* An unreachable target is a result the athlete asked for, so it is
          stated plainly rather than shown as a failed request. */}
      {course.feasible === false && course.refusal_reason && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="text-sm">
            <div className="font-medium">{t('refusal.title')}</div>
            <p className="mt-1 text-muted-foreground">
              {course.refusal_reason === 'target_faster_than_physics'
                ? t('refusal.target_faster_than_physics', {
                    fastest:
                      course.predicted_time_s == null
                        ? '—'
                        : formatTime(Math.round(course.predicted_time_s)),
                  })
                : t('refusal.exceeds_sustainable_power', {
                    required: course.required_intensity
                      ? course.required_intensity.toFixed(2)
                      : '—',
                  })}
            </p>
          </div>
        </div>
      )}

      <CourseProfileChart
        points={points}
        segments={course.segments}
        selectedIndex={selected}
        onSelect={setSelected}
      />

      <SegmentTable
        segments={course.segments}
        ftp={course.ftp_w_used}
        selectedIndex={selected}
        onSelect={setSelected}
      />

      {/* The still-air assumption is surfaced, not buried: a plan that
          silently assumes no wind is exactly the confident-but-unqualified
          output this project avoids elsewhere. */}
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Wind className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t('stillAir')}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('detail.solvedFor')}</span>
        <Select
          value={course.bike_id ?? ''}
          onValueChange={(v) => reanalyse({ bike_id: v })}
          disabled={reanalysing}
        >
          <SelectTrigger className="h-8 w-auto min-w-40">
            <SelectValue placeholder={t('detail.pickBike')} />
          </SelectTrigger>
          <SelectContent>
            {bikes.map((bike) => (
              <SelectItem key={bike.id} value={bike.id}>
                {bike.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {course.target_time_s != null && (
          <Button
            size="sm"
            variant="ghost"
            disabled={reanalysing}
            onClick={() => reanalyse({ target_time_s: null })}
          >
            {t('detail.clearTarget')}
          </Button>
        )}
      </div>

      <CoursePlanCard courseId={courseId} />
    </div>
  )
}
