'use client'

import {
  Bar,
  BarChart,
  Cell,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTranslations } from 'next-intl'

import type { CourseSegment } from '@/lib/types'
import {
  elevationFloor,
  formatGradient,
  surfaceColor,
  type ProfilePoint,
  type RibbonBand,
} from '@/lib/courses'

interface Props {
  points: ProfilePoint[]
  segments: CourseSegment[]
  /**
   * The road surface at full run resolution (issue #56), drawn as a ribbon
   * under the profile. Taken from the stored ribbon rather than derived from
   * the segments on purpose: the segment table has a minimum row length and
   * this does not, so a 130 m sector of mud gets a visible stripe at its true
   * extent even where the pacing rows fold it into a longer one.
   */
  surfaceBands?: RibbonBand[]
  selectedIndex: number | null
  onSelect: (index: number | null) => void
}

/**
 * The elevation profile, shaded by gradient (issue #55).
 *
 * Drawn as a dense bar chart rather than an area: an area takes one fill for
 * the whole series, and the point of this chart is that the *colour* is the
 * terrain — a `<Cell>` per point is what lets each metre of road carry its own
 * gradient. Bars are drawn floor-anchored so the silhouette still reads as a
 * profile rather than as a histogram.
 *
 * Dumb by design, like every chart here: the bucketing, the colours and the
 * axis floor are computed in `lib/courses.ts`, which is what the tests cover.
 */
export function CourseProfileChart({
  points,
  segments,
  surfaceBands = [],
  selectedIndex,
  onSelect,
}: Props) {
  const t = useTranslations('courses.profile')

  if (points.length === 0) return null

  const floor = elevationFloor(points)
  // The ribbon occupies the bottom sliver of the y range, below every bar,
  // so it reads as ground under the profile rather than as another series.
  const _RIBBON_HEIGHT =
    Math.max(...points.map((p) => p.elevation - floor)) * 0.06 || 1
  const selected = segments.find((s) => s.segment_index === selectedIndex)
  const data = points.map((p) => ({ ...p, height: p.elevation - floor }))

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
          barCategoryGap={0}
          barGap={0}
          onClick={(state: { activeTooltipIndex?: number }) => {
            const point = points[state?.activeTooltipIndex ?? -1]
            if (!point) return
            const hit = segments.find(
              (s) =>
                point.km * 1000 >= s.start_distance_m &&
                point.km * 1000 <= s.end_distance_m,
            )
            onSelect(hit && hit.segment_index !== selectedIndex ? hit.segment_index : null)
          }}
        >
          <XAxis
            dataKey="km"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(km: number) => `${km.toFixed(0)}`}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            label={{ value: t('km'), position: 'insideBottomRight', offset: -2, fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(h: number) => `${Math.round(h + floor)}`}
            width={44}
            label={{ value: t('metres'), angle: -90, position: 'insideLeft', fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
            }}
            labelFormatter={(km: number) => `${Number(km).toFixed(1)} km`}
            formatter={(_value, _name, entry) => {
              const p = entry?.payload as ProfilePoint | undefined
              if (!p) return ['', '']
              return [`${Math.round(p.elevation)} m · ${formatGradient(p.gradient)}`, '']
            }}
          />
          {/* One hatch pattern per class: an inferred stripe is drawn striped
              rather than merely paler, so the distinction survives a glance,
              a projector and a colour-blind reader. */}
          <defs>
            {surfaceBands
              .filter((b) => b.confidence === 'inferred')
              .map((b) => b.surface)
              .filter((s, i, all) => all.indexOf(s) === i)
              .map((surface) => (
                <pattern
                  key={surface}
                  id={`surface-hatch-${surface}`}
                  width={6}
                  height={6}
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width={6} height={6} fill={surfaceColor(surface)} opacity={0.35} />
                  <line
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={6}
                    stroke={surfaceColor(surface)}
                    strokeWidth={3}
                  />
                </pattern>
              ))}
          </defs>
          {surfaceBands.map((band, i) => (
            <ReferenceArea
              key={`surface-${i}`}
              x1={band.startKm}
              x2={band.endKm}
              y1={0}
              y2={_RIBBON_HEIGHT}
              fill={
                band.confidence === 'inferred'
                  ? `url(#surface-hatch-${band.surface})`
                  : surfaceColor(band.surface)
              }
              fillOpacity={1}
              ifOverflow="extendDomain"
            />
          ))}
          {selected && (
            <ReferenceArea
              x1={selected.start_distance_m / 1000}
              x2={selected.end_distance_m / 1000}
              fill="hsl(var(--primary))"
              fillOpacity={0.18}
            />
          )}
          <Bar dataKey="height" isAnimationActive={false}>
            {data.map((p, i) => (
              <Cell key={i} fill={p.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
