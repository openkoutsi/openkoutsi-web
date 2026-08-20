/**
 * Course recon presentation logic (issue #55).
 *
 * The charts in this repo are deliberately dumb, so everything here is the
 * arithmetic and vocabulary they render: how a gradient becomes a colour, how
 * a segment's numbers are worded, and the shape the profile chart consumes.
 */
import type { CourseDetail, CourseSegment, SegmentType } from './types'

/**
 * Gradient bands and their colours, cool through warm.
 *
 * The bands are the ones a rider already thinks in — false flat, a proper
 * drag, steep, and the stuff you get out of the saddle for — rather than an
 * even split of the range, which would put every Finnish course in one colour
 * and every alpine one in another.
 */
export const GRADIENT_BANDS: { min: number; color: string }[] = [
  { min: 0.15, color: '#7f1d1d' },  // ≥15% — wall
  { min: 0.10, color: '#dc2626' },  // 10–15%
  { min: 0.07, color: '#f97316' },  // 7–10%
  { min: 0.04, color: '#facc15' },  // 4–7%
  { min: 0.02, color: '#a3e635' },  // 2–4% — a drag
  { min: -0.02, color: '#94a3b8' }, // flat, either way
  { min: -0.07, color: '#60a5fa' }, // gentle descent
  { min: -Infinity, color: '#2563eb' }, // steep descent
]

/** The colour for one gradient, as a fraction (0.072 is 7.2%). */
export function gradientColor(gradient: number): string {
  for (const band of GRADIENT_BANDS) {
    if (gradient >= band.min) return band.color
  }
  return GRADIENT_BANDS[GRADIENT_BANDS.length - 1].color
}

/** Which of climb / flat / descent a gradient counts as. Mirrors the backend. */
export function segmentTypeOf(gradient: number): SegmentType {
  if (gradient >= 0.02) return 'climb'
  if (gradient <= -0.02) return 'descent'
  return 'flat'
}

/**
 * A gradient as a signed percentage: 0.072 → "+7.2 %", -0.031 → "−3.1 %".
 * The sign carries the meaning, so it is always shown — same convention as
 * `formatDecoupling`, including the real minus sign.
 */
export function formatGradient(gradient: number | null | undefined): string {
  if (gradient == null) return '—'
  const sign = gradient < 0 ? '−' : '+'
  return `${sign}${Math.abs(gradient * 100).toFixed(1)} %`
}

/** Distance along a course in kilometres: 4200 → "4.2 km". */
export function formatKm(metres: number | null | undefined, digits = 1): string {
  if (metres == null) return '—'
  return `${(metres / 1000).toFixed(digits)} km`
}

/** Speed from metres per second: 9.85 → "35.5 km/h". */
export function formatSpeedFromMs(speedMs: number | null | undefined): string {
  if (speedMs == null) return '—'
  return `${(speedMs * 3.6).toFixed(1)} km/h`
}

/** A power target as a share of FTP: (210, 250) → "84%". */
export function formatPercentFtp(
  watts: number | null | undefined,
  ftp: number | null | undefined,
): string | null {
  if (!watts || !ftp) return null
  return `${Math.round((watts / ftp) * 100)}%`
}

/** Is this course's plan still being written? Polling can stop once it isn't. */
export function isPlanPending(status: string | null | undefined): boolean {
  return status === 'pending'
}

/**
 * The chart series for a course profile.
 *
 * One point per stored profile entry, carrying the distance in kilometres (the
 * x axis), the elevation, and the colour its gradient earns. The backend has
 * already capped the profile at 400 points, so there is nothing to downsample.
 */
export interface ProfilePoint {
  km: number
  elevation: number
  gradient: number
  color: string
}

export function profileSeries(course: Pick<CourseDetail, 'profile'>): ProfilePoint[] {
  if (!course.profile) return []
  return course.profile.map(([distance_m, elevation_m, gradient]) => ({
    km: distance_m / 1000,
    elevation: elevation_m,
    gradient,
    color: gradientColor(gradient),
  }))
}

/**
 * The elevation floor for the profile chart's y axis.
 *
 * Starting the axis at zero flattens every course that is not at sea level
 * into a straight line; starting it at the minimum makes a 20 m rise look
 * like a mountain. A tenth of the range below the low point keeps the shape
 * honest and keeps the fill anchored to something.
 */
export function elevationFloor(points: Pick<ProfilePoint, 'elevation'>[]): number {
  if (points.length === 0) return 0
  const elevations = points.map((p) => p.elevation)
  const min = Math.min(...elevations)
  const max = Math.max(...elevations)
  const range = max - min
  return Math.floor(min - (range > 0 ? range * 0.1 : 10))
}

/** The segment covering a distance in kilometres, if any. */
export function segmentAtKm(
  segments: CourseSegment[],
  km: number,
): CourseSegment | undefined {
  const metres = km * 1000
  return segments.find(
    (s) => metres >= s.start_distance_m && metres <= s.end_distance_m,
  )
}
