'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'
import { parseISO, format } from 'date-fns'
import type { WeeklyZoneBucket } from '@/lib/types'
import { zoneColor } from './ZoneBar'

function formatMinutes(s: number): string {
  const m = Math.round(s / 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const rem = m % 60
    return rem ? `${h}h${rem}m` : `${h}h`
  }
  return `${m}m`
}

interface Props {
  data: WeeklyZoneBucket[]
  kind: 'hr' | 'power'
  title: string
}

// Weekly accumulated time-in-zone as stacked bars (one stack segment per zone,
// cool → warm). Zone → colour is keyed off the numerically-sorted union of zone
// names, so a zone keeps the same colour across every week even if some weeks
// lack it.
export function WeeklyZones({ data, kind, title }: Props) {
  const zoneNames = Array.from(
    new Set(data.flatMap((b) => Object.keys(b[kind] ?? {}))),
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  if (!zoneNames.length) return null

  const rows = data.map((b) => {
    const times = b[kind] ?? {}
    const row: Record<string, number | string> = {
      week: format(parseISO(b.week_start), 'MMM d'),
    }
    for (const name of zoneNames) row[name] = times[name] ?? 0
    return row
  })

  return (
    <div>
      <p className="text-sm font-medium mb-2 text-center">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <XAxis
            dataKey="week"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            tick={({ x, y, payload }) => (
              <g transform={`translate(${x},${y})`}>
                <text
                  x={0}
                  y={0}
                  dy={2}
                  textAnchor="end"
                  fill="currentColor"
                  fontSize={10}
                  transform="rotate(-40)"
                  opacity={0.6}
                >
                  {payload.value}
                </text>
              </g>
            )}
            height={48}
          />
          <YAxis
            tickFormatter={(v: number) => formatMinutes(v)}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(value: number, name: string) => [formatMinutes(value), name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {zoneNames.map((name, i) => (
            <Bar
              key={name}
              dataKey={name}
              stackId="zones"
              fill={zoneColor(i)}
              maxBarSize={48}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
