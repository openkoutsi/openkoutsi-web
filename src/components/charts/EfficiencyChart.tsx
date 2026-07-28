'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'
import type { EfficiencyPoint } from '@/lib/types'
import { formatDate } from '@/lib/utils'

interface Props {
  data: EfficiencyPoint[]
  efficiencyLabel: string
  decouplingLabel: string
}

/**
 * Aerobic efficiency over time, one point per steady endurance ride
 * (issue #37). Rising efficiency at a constant training load is the aerobic
 * progress that fitness alone doesn't show, which is why the *trend* matters
 * more here than any single ride's number.
 *
 * Decoupling shares the chart on its own axis as scattered points rather than a
 * line: it is only measured on qualifying rides, so joining the dots would draw
 * a trend through gaps that aren't there.
 */
export function EfficiencyChart({ data, efficiencyLabel, decouplingLabel }: Props) {
  const formatted = data.map((d) => ({
    date: formatDate(d.date),
    efficiency: d.efficiency_factor,
    decoupling: d.decoupling_pct,
  }))
  const hasDecoupling = formatted.some((d) => d.decoupling != null)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={formatted} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis
          yAxisId="ef"
          domain={['auto', 'auto']}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(v: number) => v.toFixed(2)}
        />
        {hasDecoupling && (
          <YAxis
            yAxisId="decoupling"
            orientation="right"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v: number) => `${Math.round(v)}%`}
          />
        )}
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value: number, name: string) =>
            name === decouplingLabel
              ? [`${value.toFixed(1)} %`, name]
              : [`${value.toFixed(2)} W/bpm`, name]
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          yAxisId="ef"
          type="monotone"
          dataKey="efficiency"
          name={efficiencyLabel}
          stroke="hsl(var(--primary))"
          dot={{ r: 2 }}
          strokeWidth={2}
          connectNulls
        />
        {hasDecoupling && (
          <Scatter
            yAxisId="decoupling"
            dataKey="decoupling"
            name={decouplingLabel}
            fill="hsl(var(--destructive))"
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
