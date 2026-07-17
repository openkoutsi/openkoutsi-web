// Pure helpers for overlaying fitted power–duration models on the power curve.
// Kept JSX-free so they can be unit-tested without pulling recharts into the
// test bundle.
import type { PowerModelFit, PowerModelPoint } from '@/lib/types'
import { scaledX } from './powerCurveScale'

// Stable model keys, in display order.
export const MODEL_KEYS = ['cp2', 'cp3', 'exp', 'power_law'] as const
export type ModelKey = (typeof MODEL_KEYS)[number]

// Distinct colours per model, matching the palette used by other charts.
export const MODEL_COLORS: Record<string, string> = {
  cp2: '#22c55e',
  cp3: '#a78bfa',
  exp: '#f59e0b',
  power_law: '#38bdf8',
}

// Models drawn by default when data is available: one CP-family and one
// full-range model, so the overlay is informative without being cluttered.
export const DEFAULT_VISIBLE_MODELS: ModelKey[] = ['cp3', 'power_law']

// The estimated-potential profile rows: an i18n label key and the effort
// duration (seconds) the metric is anchored to.
export const PROFILE_ROWS: { key: string; durationS: number }[] = [
  { key: 'neuromuscular', durationS: 5 },
  { key: 'anaerobic', durationS: 60 },
  { key: 'map', durationS: 300 },
  { key: 'ftp', durationS: 1200 },
]

export interface ModelChartPoint {
  x: number // scaledX(duration_s) — what Recharts plots
  power_w: number
}

// Map a fitted model's sampled curve into chart-space points (x = scaledX).
export function modelCurvePoints(fit: PowerModelFit): ModelChartPoint[] {
  return fit.curve.map((p: PowerModelPoint) => ({
    x: scaledX(p.duration_s),
    power_w: p.power_w,
  }))
}

// The model's predicted power (watts) at a given duration, or null if the model
// does not report a prediction there (e.g. unbounded models in the sprint range).
export function predictionAt(fit: PowerModelFit, durationS: number): number | null {
  const point = fit.predictions.find((p) => p.duration_s === durationS)
  return point ? point.power_w : null
}

// Round a data maximum up to a "nice" axis ceiling (multiple of `step`) with a
// little headroom. Used to pin the power chart's y-axis to the athlete's real
// bests so an overlaid model can't rescale the axis; overshooting model curves
// are then clipped instead of squashing the real curve.
export function axisMax(dataMax: number, step: number): number {
  const safeMax = Math.max(0, dataMax)
  return Math.max(step, Math.ceil((safeMax * 1.08) / step) * step)
}
