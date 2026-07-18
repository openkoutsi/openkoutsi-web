'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import type { PlanAdherencePoint } from '@/lib/types'
import { formatDate } from '@/lib/utils'

interface Props {
  data: PlanAdherencePoint[]
  label: string
}

/** Trend of a plan's "so far" adherence score (0–100) over time. Same chart
 *  family as the Fitness/Fatigue/Form charts (issue #26). */
export function AdherenceChart({ data, label }: Props) {
  const formatted = data
    .filter((d) => d.score != null)
    .map((d) => ({ date: formatDate(d.date), score: d.score }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={32}
          tickFormatter={(v: number) => `${v}`}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value: number) => [`${Math.round(value)}%`, label]}
        />
        <ReferenceLine y={100} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <Line
          type="monotone"
          dataKey="score"
          name={label}
          stroke="hsl(var(--primary))"
          dot={false}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
