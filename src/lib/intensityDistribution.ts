import type { IntensityBand, IntensityDistribution } from '@/lib/types'

/**
 * Presentation helpers for the three-band intensity distribution (issue #38).
 *
 * The maths lives on the server; this is only about turning the response into
 * something a chart and a caption can use. It sits in `lib` rather than in the
 * chart component because charts in this repo are dumb and untested by design.
 */

export const BANDS = [1, 2, 3] as const
export type BandNumber = (typeof BANDS)[number]

/** Translation key suffix for a band's short label, under `dashboard.intensity`. */
export function bandLabelKey(band: number): string {
  switch (band) {
    case 1:
      return 'bandLow'
    case 2:
      return 'bandModerate'
    default:
      return 'bandHigh'
  }
}

/**
 * Band colours, taken from the shared zone palette so the bands read as a
 * coarser view of the same thing: blue easy, yellow moderate, red hard.
 */
export const BAND_COLORS: Record<number, string> = {
  1: '#60a5fa',
  2: '#facc15',
  3: '#f87171',
}

export function bandColor(band: number): string {
  return BAND_COLORS[band] ?? BAND_COLORS[3]
}

/** Bands in ascending order, with any missing band filled in as empty. */
export function orderedBands(distribution: IntensityDistribution | undefined): IntensityBand[] {
  const byBand = new Map((distribution?.bands ?? []).map((b) => [b.band, b]))
  return BANDS.map(
    (band) => byBand.get(band) ?? { band, seconds: 0, pct: 0, sessions: null },
  )
}

/** Whether there is anything worth drawing. */
export function hasData(distribution: IntensityDistribution | undefined): boolean {
  return !!distribution && distribution.bands.some((b) => b.pct > 0)
}

/**
 * Fraction of the window's activities that reached the distribution, 0–1.
 * Returns null when the window is empty, so callers can distinguish "no rides"
 * from "no usable rides".
 */
export function coverageRatio(distribution: IntensityDistribution | undefined): number | null {
  const total = distribution?.coverage.activities_total ?? 0
  if (!total) return null
  return distribution!.coverage.activities_used / total
}

/**
 * Whether the coverage is thin enough to warn about. A distribution computed
 * from a fraction of the block should say so rather than presenting a
 * confident-looking chart.
 */
export function coverageIsPartial(distribution: IntensityDistribution | undefined): boolean {
  const ratio = coverageRatio(distribution)
  return ratio !== null && ratio < 1
}

export function formatPct(pct: number): string {
  return `${Math.round(pct)}%`
}

export function formatHours(seconds: number): string {
  const hours = seconds / 3600
  if (hours >= 10) return `${Math.round(hours)}h`
  if (hours >= 1) return `${hours.toFixed(1)}h`
  return `${Math.round(seconds / 60)}m`
}
