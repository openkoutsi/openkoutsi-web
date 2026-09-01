'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'

import { apiFetch, fetcher } from '@/lib/api'
import type { Bike, CourseDetail } from '@/lib/types'
import type { TargetMode } from '@/lib/courses'
import {
  formatKm,
  formatSectorLength,
  formatTargetTime,
  hasSurfaceData,
  isSurfacePending,
  profileSeries,
  ribbonBands,
  roughSectors,
  surfaceColor,
  surfaceCoverage,
  targetModeOf,
  targetReanalyzeBody,
} from '@/lib/courses'
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
import { CourseTargetPicker, targetHelpKey } from './CourseTargetPicker'
import { AlertTriangle, Loader2, Mountain, Wind } from 'lucide-react'

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

/**
 * Set, switch or clear what this course is paced to (issue #61).
 *
 * The stored target is the source of truth: the fields reset to it whenever it
 * changes, so the editor never shows a target the table below was not solved
 * for. Its own component because `CourseDetailView` returns early while the
 * course loads, and hooks cannot live behind that.
 */
function CourseTargetEditor({
  course,
  busy,
  onApply,
}: {
  course: CourseDetail
  busy: boolean
  onApply: (body: Record<string, unknown>) => void
}) {
  const t = useTranslations('courses')
  const storedMode = targetModeOf(course)
  const storedValue =
    storedMode === 'time'
      ? formatTargetTime(course.target_time_s)
      : storedMode === 'power'
        ? String(course.target_power_w ?? '')
        : ''

  const [mode, setMode] = useState<TargetMode>(storedMode)
  const [value, setValue] = useState(storedValue)

  useEffect(() => {
    setMode(storedMode)
    setValue(storedValue)
  }, [storedMode, storedValue])

  const dirty = mode !== storedMode || value.trim() !== storedValue

  function apply() {
    const body = targetReanalyzeBody(mode, value)
    // A value that does not parse is said out loud rather than sent: dropping
    // it would silently re-solve for something the athlete did not ask for.
    if (body == null) {
      toast({
        title: mode === 'power' ? t('target.badPower') : t('target.badTime'),
        description: mode === 'power' ? t('target.badPowerDesc') : t('target.badTimeDesc'),
        variant: 'destructive',
      })
      return
    }
    onApply(body)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('target.label')}</span>
        <CourseTargetPicker
          mode={mode}
          value={value}
          onModeChange={(next) => {
            setMode(next)
            setValue(next === storedMode ? storedValue : '')
          }}
          onValueChange={setValue}
          disabled={busy}
        />
        <Button size="sm" disabled={busy || !dirty} onClick={apply}>
          {busy ? t('target.applying') : t('target.apply')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t(targetHelpKey(mode))}</p>
    </div>
  )
}


/**
 * What is under the road, and how much of it is a guess (issue #56).
 *
 * Two things are deliberately said in words rather than left to the chart: how
 * much of the course is unconfirmed, and every sharp surface change with its
 * distance. A colour on a profile is missable; "mud and loose surface, 130 m
 * from km 41.2" is not, and a rider who expected 40 km of tarmac needs that
 * before the day rather than during it.
 */
function SurfacePanel({
  course,
  onMatch,
  matching,
}: {
  course: CourseDetail
  onMatch: () => void
  matching: boolean
}) {
  const t = useTranslations('courses.surface')
  const matched = hasSurfaceData(course)
  const pending = isSurfacePending(course.surface_status)
  const sectors = roughSectors(course.rough_sectors)

  if (pending) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('pending')}
      </p>
    )
  }

  // Absent rather than broken: an instance with no matcher, or a course
  // uploaded before there was one, simply has no surface — the Stage 1 plan
  // below it is complete and is not missing anything it promised.
  if (!matched) {
    if (!course.surface_matching_available) return null
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={matching} onClick={onMatch}>
          {matching ? t('matching') : t('add')}
        </Button>
        <span className="text-xs text-muted-foreground">{t('addHelp')}</span>
      </div>
    )
  }

  const coverage = surfaceCoverage(course.segments)
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {coverage.byClass.map(({ surface, metres }) => (
          <span key={surface} className="flex items-center gap-1.5 text-sm">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: surfaceColor(surface) }}
            />
            {t(`class.${surface}`)}
            <span className="tabular-nums text-muted-foreground">
              {formatKm(metres)}
            </span>
          </span>
        ))}
      </div>

      {/* The distance worth naming is the one the match is unsure about, not
          every metre that happens to read `inferred`: see `markedInferredM`. */}
      {coverage.markedInferredM > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('unconfirmed', { distance: formatKm(coverage.markedInferredM) })}
        </p>
      )}

      {/* The asphalt caveat, made once and as a statement about the class,
          because that is what it is: openkoutsi cannot tell smooth tarmac from
          a road nobody has tagged, so no asphalt anywhere is ever confirmed.
          Repeating it per row said the same thing N times and drowned the
          rows where confidence actually varies. */}
      {coverage.byClass.some(({ surface }) => surface === 'asphalt') && (
        <p className="text-xs text-muted-foreground">{t('asphaltNote')}</p>
      )}

      {sectors.length > 0 && (
        <ul className="space-y-1 border-t border-border pt-2">
          {sectors.map((sector, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Mountain className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
              <span>
                {t('sector', {
                  surface: t(`class.${sector.surface}`),
                  length: formatSectorLength(sector.lengthM),
                  km: sector.startKm.toFixed(1),
                })}
                {sector.confidence === 'inferred' && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    {t('sectorInferred')}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function CourseDetailView({ courseId, bikes, onChanged }: Props) {
  const t = useTranslations('courses')
  const [selected, setSelected] = useState<number | null>(null)
  const [reanalysing, setReanalysing] = useState(false)
  const [matching, setMatching] = useState(false)

  const { data: course, mutate } = useSWR<CourseDetail>(
    `/api/courses/${courseId}`,
    fetcher,
    {
      // The surface match runs in the background, so poll while it does —
      // and stop the moment it settles, however it settled.
      refreshInterval: (latest) =>
        isSurfacePending(latest?.surface_status) ? 3000 : 0,
    },
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

  async function requestSurface() {
    setMatching(true)
    try {
      await apiFetch(`/api/courses/${courseId}/surface`, { method: 'POST' })
      await mutate()
    } catch (err) {
      toast({
        title: t('surface.failed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setMatching(false)
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
            <div className="font-medium">
              {course.target_power_w != null ? t('refusal.powerTitle') : t('refusal.title')}
            </div>
            <p className="mt-1 text-muted-foreground">
              {course.refusal_reason === 'target_faster_than_physics'
                ? t('refusal.target_faster_than_physics', {
                    fastest:
                      course.predicted_time_s == null
                        ? '—'
                        : formatTime(Math.round(course.predicted_time_s)),
                  })
                : course.target_power_w != null
                  ? // A power target that is too much to hold still has a full
                    // set of splits, so this says how long the athlete would be
                    // holding it rather than pretending there is no plan.
                    t('refusal.power_exceeds_sustainable', {
                      required: course.required_intensity
                        ? course.required_intensity.toFixed(2)
                        : '—',
                      duration:
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
        surfaceBands={ribbonBands(course.surface_ribbon)}
        selectedIndex={selected}
        onSelect={setSelected}
      />

      <SurfacePanel course={course} onMatch={requestSurface} matching={matching} />

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
        {hasSurfaceData(course) ? t('stillAirMatched') : t('stillAir')}
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
      </div>

      <CourseTargetEditor course={course} busy={reanalysing} onApply={reanalyse} />

      <CoursePlanCard courseId={courseId} />
    </div>
  )
}
