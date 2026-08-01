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
import { zoneRow, zoneSeries } from '@/lib/zoneSeries'
import { ZONE_COLORS, zoneColor } from './ZoneBar'

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
// cool → warm).
//
// Both generations of zone name are merged onto one series per zone first (see
// `lib/zoneSeries`) — a week can hold snapshots keyed `Z1` and others keyed
// `Z1 Recovery`, and drawing those separately split one zone across two legend
// entries and two colours. Colour comes from the zone's own number rather than
// its place in the series list, so a zone keeps its colour across every week
// even when some weeks lack it, and the ramp still means intensity.
export function WeeklyZones({ data, kind, title }: Props) {
  const zoneRows = data.map((b) => zoneRow(b[kind], kind))
  const series = zoneSeries(zoneRows, kind)

  if (!series.length) return null

  const rows = data.map((b, i) => {
    const times = zoneRows[i]
    const row: Record<string, number | string> = {
      week: format(parseISO(b.week_start), 'MMM d'),
    }
    for (const { key } of series) row[key] = times[key] ?? 0
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
          {series.map(({ key, label, zone }) => (
            <Bar
              key={key}
              dataKey={key}
              name={label}
              stackId="zones"
              // An unplaceable name gets the top colour rather than a slot in
              // the ramp, which it has no claim to.
              fill={zoneColor(zone === null ? ZONE_COLORS.length : zone - 1)}
              maxBarSize={48}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
