'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import type { FitnessPoint } from '@/lib/types'
import { formatDate } from '@/lib/utils'

interface Props {
  data: FitnessPoint[]
  /** Projected days from /api/metrics/fitness/forecast, all dated after today. */
  forecast?: FitnessPoint[]
  /** Label on the reference line separating measured days from modeled ones. */
  todayLabel?: string
}

export function FitnessChart({ data, forecast, todayLabel = 'Today' }: Props) {
  const projected = forecast ?? []
  const hasForecast = projected.length > 0
  const lastMeasured = data.length > 0 ? formatDate(data[data.length - 1].date) : null

  const formatted = [
    ...data.map((d, i) => ({
      ...d,
      date: formatDate(d.date),
      // The final measured point also anchors the projected series, so the
      // dashed lines continue from the solid ones instead of starting with a gap.
      ...(hasForecast && i === data.length - 1
        ? {
            fitnessProjected: d.fitness,
            fatigueProjected: d.fatigue,
            formProjected: d.form,
          }
        : {}),
    })),
    ...projected.map((d) => ({
      date: formatDate(d.date),
      projectedLoad: d.daily_load,
      fitnessProjected: d.fitness,
      fatigueProjected: d.fatigue,
      formProjected: d.form,
    })),
  ]

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={formatted} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value: number, name: string) => [
            value == null ? '—' : value.toFixed(1),
            name,
          ]}
        />
        {/* Only the measured series appear in the legend; adding the projected
            ones would double its length. The dashed section to the right of the
            today marker is explained by the caption under the chart. */}
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine yAxisId="left" y={0} stroke="hsl(var(--border))" />
        {hasForecast && lastMeasured && (
          <ReferenceLine
            yAxisId="left"
            x={lastMeasured}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="2 2"
            label={{ value: todayLabel, position: 'insideTopRight', fontSize: 11 }}
          />
        )}
        <Bar yAxisId="right" dataKey="daily_load" name="Load" fill="hsl(var(--muted-foreground))" radius={2} opacity={0.4} />
        <Bar
          yAxisId="right"
          dataKey="projectedLoad"
          name="Planned Load"
          fill="hsl(var(--muted-foreground))"
          radius={2}
          opacity={0.2}
          legendType="none"
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="fitness"
          name="Fitness"
          stroke="hsl(var(--primary))"
          dot={false}
          strokeWidth={2}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="fatigue"
          name="Fatigue"
          stroke="hsl(var(--destructive))"
          dot={false}
          strokeWidth={2}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="form"
          name="Form"
          stroke="hsl(var(--accent-foreground))"
          dot={false}
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
        {/* Projected series. The Form line is already dashed, so the projection
            is distinguished by its lighter stroke and by falling to the right of
            the today marker rather than by dashing alone. */}
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="fitnessProjected"
          name="Fitness (projected)"
          stroke="hsl(var(--primary))"
          dot={false}
          strokeWidth={2}
          strokeDasharray="5 3"
          opacity={0.55}
          legendType="none"
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="fatigueProjected"
          name="Fatigue (projected)"
          stroke="hsl(var(--destructive))"
          dot={false}
          strokeWidth={2}
          strokeDasharray="5 3"
          opacity={0.55}
          legendType="none"
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="formProjected"
          name="Form (projected)"
          stroke="hsl(var(--accent-foreground))"
          dot={false}
          strokeWidth={1.5}
          strokeDasharray="5 3"
          opacity={0.55}
          legendType="none"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
