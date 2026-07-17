'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { useTranslations } from 'next-intl'
import type { PowerBestEntry, PowerModelFit } from '@/lib/types'
import { DURATIONS, formatDuration, scaledX, buildXTicks } from './powerCurveScale'
import { MODEL_COLORS, modelCurvePoints } from './powerModels'

// Re-exported for existing consumers that import it from this module.
export { formatDuration }

interface Props {
  bests: PowerBestEntry[]
  unit?: 'w' | 'wkg'
  // Fitted models to overlay (watts only). `visibleModels` selects which of the
  // available models are drawn. Model curves are omitted in W/kg mode.
  models?: PowerModelFit[]
  visibleModels?: Set<string>
  // Localized display name per model key, for the legend.
  modelLabels?: Record<string, string>
  actualLabel?: string
}

interface ChartPoint {
  x: number        // scaledX(duration_s) — what Recharts plots
  duration_s: number
  power_w: number
  weight_kg: number | null
  w_per_kg: number | null
  activity_id: string
  activity_name: string | null
}

// W/kg for a point: prefer the backend-ranked value, else divide locally.
export function pointWkg(
  p: { power_w: number; weight_kg: number | null; w_per_kg: number | null },
): number | null {
  if (p.w_per_kg != null) return p.w_per_kg
  return p.weight_kg && p.weight_kg > 0 ? p.power_w / p.weight_kg : null
}

export function PowerCurveChart({
  bests,
  unit = 'w',
  models = [],
  visibleModels,
  modelLabels = {},
  actualLabel,
}: Props) {
  const t = useTranslations('app')
  // Only rank-1 bests, one per duration
  const rank1 = new Map<number, PowerBestEntry>()
  for (const b of bests) {
    if (b.rank === 1) rank1.set(b.duration_s, b)
  }

  const data: ChartPoint[] = DURATIONS
    .filter((d) => rank1.has(d))
    .map((d) => {
      const b = rank1.get(d)!
      return {
        x: scaledX(d),
        duration_s: d,
        power_w: b.power_w,
        weight_kg: b.weight_kg,
        w_per_kg: b.w_per_kg,
        activity_id: b.activity_id,
        activity_name: b.activity_name,
      }
    })

  // For W/kg mode, filter out points that have no weight data
  const chartData = unit === 'wkg'
    ? data.filter((p) => pointWkg(p) != null)
    : data

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        {data.length === 0 ? t('power.noData') : t('power.noWeightPeriod')}
      </div>
    )
  }

  // Model overlays are watts-based, so only draw them in watts mode.
  const overlayModels = unit === 'w'
    ? models.filter((m) => m.available && (visibleModels?.has(m.model) ?? false))
    : []
  const showLegend = overlayModels.length > 0

  const yDataKey = unit === 'wkg'
    ? (p: ChartPoint) => { const v = pointWkg(p); return v != null ? +v.toFixed(2) : null }
    : (p: ChartPoint) => p.power_w

  const yLabel = unit === 'wkg' ? 'W/kg' : 'Watts'

  // Scale the x-axis to the longest effort present, instead of always to 8h.
  const maxDuration = Math.max(...chartData.map((p) => p.duration_s))
  const { ticks: xTicks, labels: tickLabels } = buildXTicks(maxDuration)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="x"
          type="number"
          scale="linear"
          domain={[scaledX(1), scaledX(maxDuration)]}
          ticks={xTicks}
          tickFormatter={(val: number) => tickLabels.get(val.toFixed(6)) ?? ''}
          tick={{ fontSize: 11 }}
          tickLine={false}
          label={{ value: 'Duration', position: 'insideBottom', offset: -12, fontSize: 12 }}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          width={48}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 12, fontSize: 12 }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload as ChartPoint
            const wkg = pointWkg(p)
            const displayVal = unit === 'wkg' && wkg != null
              ? `${wkg.toFixed(2)} W/kg`
              : `${Math.round(p.power_w)} W`
            return (
              <div className="rounded-md border bg-card px-3 py-2 text-sm shadow">
                <p className="font-semibold">{formatDuration(p.duration_s)}</p>
                <p>{displayVal}</p>
                {p.activity_name && (
                  <p className="text-muted-foreground text-xs truncate max-w-48">
                    {p.activity_name}
                  </p>
                )}
              </div>
            )
          }}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {/* Modeled curves (dashed), one Recharts Line per selected model. */}
        {overlayModels.map((m) => (
          <Line
            key={m.model}
            type="monotone"
            data={modelCurvePoints(m)}
            dataKey="power_w"
            name={modelLabels[m.model] ?? m.model}
            stroke={MODEL_COLORS[m.model] ?? 'hsl(var(--muted-foreground))'}
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        ))}
        <Line
          type="monotone"
          dataKey={yDataKey}
          name={actualLabel ?? t('power.models.actual')}
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 3, fill: 'hsl(var(--primary))' }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
