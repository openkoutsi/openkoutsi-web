'use client'

import { useTranslations } from 'next-intl'

import type { CourseSegment } from '@/lib/types'
import {
  formatGradient,
  formatKm,
  formatPercentFtp,
  formatSpeedFromMs,
  gradientColor,
  marksInferred,
  surfaceColor,
} from '@/lib/courses'
import { formatTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props {
  segments: CourseSegment[]
  /** The FTP the analysis was solved from, for the %FTP column. */
  ftp: number | null
  selectedIndex: number | null
  onSelect: (index: number | null) => void
}

export function SegmentTable({ segments, ftp, selectedIndex, onSelect }: Props) {
  const t = useTranslations('courses.segments')

  if (segments.length === 0) return null

  const hasSurface = segments.some((s) => s.surface != null)
  const anyInferred = segments.some((s) =>
    marksInferred(s.surface, s.surface_confidence),
  )

  return (
    <div className="space-y-2">
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('start')}</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('length')}</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('gradient')}</th>
            <th className="hidden sm:table-cell px-3 py-2 text-right font-medium text-muted-foreground">{t('power')}</th>
            <th className="hidden sm:table-cell px-3 py-2 text-right font-medium text-muted-foreground">{t('speed')}</th>
            {hasSurface && (
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                {t('surface')}
              </th>
            )}
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('split')}</th>
            <th className="hidden md:table-cell px-3 py-2 text-right font-medium text-muted-foreground">{t('elapsed')}</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((seg) => {
            const selected = seg.segment_index === selectedIndex
            const percent = formatPercentFtp(seg.power_w, ftp)
            return (
              <tr
                key={seg.segment_index}
                onClick={() => onSelect(selected ? null : seg.segment_index)}
                className={cn(
                  'cursor-pointer border-b border-border last:border-0 hover:bg-muted/20',
                  selected && 'bg-accent',
                )}
              >
                <td className="px-3 py-2 text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-3 w-1 rounded-sm"
                      style={{ backgroundColor: gradientColor(seg.avg_gradient) }}
                    />
                    {seg.segment_index + 1}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatKm(seg.start_distance_m)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatKm(seg.length_m, 2)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatGradient(seg.avg_gradient)}
                </td>
                <td className="hidden sm:table-cell px-3 py-2 text-right tabular-nums">
                  {seg.power_w == null || seg.power_w === 0 ? (
                    // A descent the speed cap bound: the time here is set by
                    // braking and corners, not by watts, so a wattage would be
                    // a number pretending to be advice.
                    <span className="text-muted-foreground">
                      {seg.speed_capped ? t('coast') : '—'}
                    </span>
                  ) : (
                    <>
                      {Math.round(seg.power_w)} W
                      {percent && (
                        <span className="ml-1 text-xs text-muted-foreground">{percent}</span>
                      )}
                    </>
                  )}
                </td>
                <td className="hidden sm:table-cell px-3 py-2 text-right tabular-nums">
                  {formatSpeedFromMs(seg.speed_ms)}
                </td>
                {hasSurface && (
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: surfaceColor(seg.surface) }}
                      />
                      <span>{t(`class.${seg.surface ?? 'unknown'}`)}</span>
                      {/* Confidence is a visible word, not a shade or a
                          tooltip: a guess shown beside a fact at equal weight
                          is worse than showing neither. Shown only where it
                          could have read otherwise — on asphalt it never can,
                          so the mark there would be a constant wearing the
                          costume of a warning. That caveat is made once, above
                          this table, where the coverage claim is made. */}
                      {marksInferred(seg.surface, seg.surface_confidence) && (
                        <span className="rounded-sm border border-amber-500/50 px-1 py-px text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-500">
                          {t('inferred')}
                        </span>
                      )}
                    </span>
                  </td>
                )}
                <td className="px-3 py-2 text-right tabular-nums">
                  {seg.duration_s == null ? '—' : formatTime(Math.round(seg.duration_s))}
                </td>
                <td className="hidden md:table-cell px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {seg.start_offset_s == null
                    ? '—'
                    : formatTime(Math.round(seg.start_offset_s + (seg.duration_s ?? 0)))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    {/* Said once, plainly, rather than left to be inferred from a badge —
        "inferred" means openkoutsi could not confirm a tag, which is not the
        same claim as "this road is untagged". */}
    {anyInferred && (
      <p className="text-xs text-muted-foreground">{t('inferredLegend')}</p>
    )}
    </div>
  )
}
