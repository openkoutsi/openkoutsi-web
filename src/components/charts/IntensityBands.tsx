'use client'

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import type { IntensityBand } from '@/lib/types'
import { bandColor, formatPct } from '@/lib/intensityDistribution'

interface Props {
  bands: IntensityBand[]
  /** Already-translated short label per band, in ascending band order. */
  labels: string[]
  /** Already-translated tooltip unit, e.g. "of time" or "of sessions". */
  unitLabel: string
}

// The three intensity bands as horizontal bars — easy at the top, hard at the
// bottom. Horizontal rather than stacked because the shape of a distribution is
// the comparison between the three numbers, and a single stacked bar makes the
// small top band impossible to read.
export function IntensityBands({ bands, labels, unitLabel }: Props) {
  if (!bands.length || bands.every((b) => b.pct === 0)) return null

  const rows = bands.map((band, i) => ({
    band: band.band,
    label: labels[i] ?? `${band.band}`,
    pct: band.pct,
  }))

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 4 }}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value: number) => [`${formatPct(value)} ${unitLabel}`, '']}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="pct" maxBarSize={28} radius={[0, 4, 4, 0]} label={renderPct}>
          {rows.map((row) => (
            <Cell key={row.band} fill={bandColor(row.band)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// Percentages sit just outside the bar end, so the smallest band is still
// readable when its bar is only a few pixels wide.
function renderPct({ x, y, width, height, value }: {
  x?: number; y?: number; width?: number; height?: number; value?: number
}) {
  if (x == null || y == null || width == null || height == null || value == null) return <g />
  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      dominantBaseline="middle"
      fontSize={11}
      fill="currentColor"
      opacity={0.7}
    >
      {formatPct(value)}
    </text>
  )
}
