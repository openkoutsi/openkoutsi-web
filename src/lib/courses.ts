/**
 * Course recon presentation logic (issue #55).
 *
 * The charts in this repo are deliberately dumb, so everything here is the
 * arithmetic and vocabulary they render: how a gradient becomes a colour, how
 * a segment's numbers are worded, the shape the profile chart consumes, and
 * how a pacing target is read off the athlete and written back (issue #61) —
 * shared, because the upload form and the detail editor have to agree on what
 * "4:30" and "210" mean.
 */
import type {
  CourseDetail,
  CourseSegment,
  CourseSummary,
  RoughSectorEntry,
  SegmentType,
  SurfaceClass,
  SurfaceConfidence,
  SurfaceRibbonEntry,
} from './types'

/**
 * What a course is being paced to. The two targets are alternatives — the
 * backend clears one when the other is set — so this is a single mode rather
 * than two independent fields, and the UI asks for it that way.
 */
export type TargetMode = 'none' | 'time' | 'power'

export function targetModeOf(
  course: Pick<CourseSummary, 'target_time_s' | 'target_power_w'>,
): TargetMode {
  if (course.target_power_w != null) return 'power'
  if (course.target_time_s != null) return 'time'
  return 'none'
}

/**
 * The seconds behind "4:30:00" or "4:30". Null when it is not a time at all.
 *
 * Two parts are read as **hours and minutes**, not minutes and seconds: a
 * course target is a finish time, and finish times for something worth
 * uploading a GPX of are hours. The field says so, so that "45:00" is not
 * quietly read as forty-five minutes by one of us and forty-five hours by the
 * other.
 */
export function parseTargetTime(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parts = trimmed.split(':').map((p) => Number(p))
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

/**
 * A stored target time back in the notation the field accepts, so opening the
 * editor on an existing target shows what was asked for rather than an empty
 * box: 16200 → "4:30:00".
 */
export function formatTargetTime(seconds: number | null | undefined): string {
  if (seconds == null) return ''
  const whole = Math.round(seconds)
  const h = Math.floor(whole / 3600)
  const m = Math.floor((whole % 3600) / 60)
  const s = whole % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * The watts behind "210" or "210 W". Null when it is not a usable power —
 * which includes zero and anything negative, both of which the API rejects.
 */
export function parseTargetPower(value: string): number | null {
  const trimmed = value.trim().replace(/\s*w$/i, '')
  if (!trimmed || !/^\d+$/.test(trimmed)) return null
  const watts = Number(trimmed)
  return watts > 0 ? watts : null
}

/**
 * The re-analysis body for a picked target, or `null` when the field does not
 * hold a usable value and the caller should say so instead of sending it.
 *
 * Only the target being *set* is sent: the backend clears the other one, which
 * is what makes switching a course from a time to a power one request. Only
 * `none` names both, because clearing has to say which.
 */
export function targetReanalyzeBody(
  mode: TargetMode,
  value: string,
): { target_time_s?: number | null; target_power_w?: number | null } | null {
  if (mode === 'none') return { target_time_s: null, target_power_w: null }
  if (mode === 'time') {
    const seconds = parseTargetTime(value)
    return seconds == null ? null : { target_time_s: seconds }
  }
  const watts = parseTargetPower(value)
  return watts == null ? null : { target_power_w: watts }
}

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


// ── Road surface (issue #56) ────────────────────────────────────────────────

/**
 * Surface colours, smooth through loose — the same ordering the rolling
 * resistance table induces, so "rougher" and "slower" read the same way.
 *
 * Deliberately a different hue family from `GRADIENT_BANDS`: the two are drawn
 * on the same chart, and a rider should never have to work out which of them a
 * given colour belongs to.
 */
export const SURFACE_COLORS: Record<SurfaceClass, string> = {
  asphalt: '#475569',   // slate — the road you assumed
  paved: '#78716c',     // stone
  compacted: '#a8a29e', // warm grey
  cobbles: '#a16207',   // dark amber
  gravel: '#ca8a04',    // amber
  dirt: '#92400e',      // brown
  grass: '#4d7c0f',     // olive
  unknown: '#cbd5e1',   // pale — no claim being made
}

export function surfaceColor(surface: SurfaceClass | null | undefined): string {
  return SURFACE_COLORS[surface ?? 'unknown']
}

/** Which classes are rough enough to warn about. Mirrors the backend. */
const ROUGH: SurfaceClass[] = ['compacted', 'cobbles', 'gravel', 'dirt', 'grass']

export function isRoughSurface(surface: SurfaceClass | null | undefined): boolean {
  return surface != null && ROUGH.includes(surface)
}

/**
 * The classes for which `confirmed` is not reachable at all.
 *
 * The matcher returns `paved_smooth` both for smooth tarmac and for a way
 * carrying no surface information whatsoever — it is the zero value of the
 * routing engine's three-bit surface field — and that is the only value that
 * becomes `asphalt`. `unknown` is the same story from the other end: a point
 * the matcher could not classify is unconfirmed by definition.
 *
 * So `inferred` on either of these is a constant, and a constant is not a
 * signal. It repeats what the class name already says, and it crowds out the
 * rows where confidence genuinely varies — which is the whole reason the mark
 * exists. The caveat itself is real and is not dropped: it moves to the
 * coverage panel, said once, as the statement about the class that it is.
 */
const NEVER_CONFIRMED: SurfaceClass[] = ['asphalt', 'unknown']

/**
 * Does `inferred` here say something the class name did not already say?
 *
 * This is the test for showing the mark, not `confidence === 'inferred'`. A
 * `gravel` segment reading `inferred` means the match was mixed or two
 * overlapping chunks disagreed — a real fact about *that stretch*. An
 * `asphalt` one means nothing at all, because it could not have read anything
 * else.
 */
export function marksInferred(
  surface: SurfaceClass | null | undefined,
  confidence: SurfaceConfidence | null | undefined,
): boolean {
  return (
    confidence === 'inferred' && !NEVER_CONFIRMED.includes(surface ?? 'unknown')
  )
}

export interface SurfaceCoverage {
  /** Metres per class, biggest first. Only classes actually present appear. */
  byClass: { surface: SurfaceClass; metres: number }[]
  confirmedM: number
  inferredM: number
  /**
   * The inferred distance that is about the *match* rather than about the
   * class — the stretches `marksInferred` marks.
   *
   * This, not `inferredM`, is the figure worth putting in a sentence. On an
   * all-asphalt course `inferredM` is the entire course and could never have
   * been anything else, so reporting it tells a rider nothing while sounding
   * like a warning.
   */
  markedInferredM: number
  totalM: number
}

/**
 * How much of the course is what, and how much of that is a guess.
 *
 * The confirmed/inferred split is computed here rather than shown per row only,
 * because "38 km of gravel, 12 km of it unconfirmed" is the sentence that tells
 * an athlete how much to trust the plan — and it is exactly the figure that
 * would be lost by rendering confidence as a subtle colour and nothing else.
 */
export function surfaceCoverage(segments: CourseSegment[]): SurfaceCoverage {
  const metres = new Map<SurfaceClass, number>()
  let confirmedM = 0
  let inferredM = 0
  let markedInferredM = 0
  let totalM = 0
  for (const seg of segments) {
    if (!seg.surface) continue
    metres.set(seg.surface, (metres.get(seg.surface) ?? 0) + seg.length_m)
    totalM += seg.length_m
    if (seg.surface_confidence === 'confirmed') confirmedM += seg.length_m
    else inferredM += seg.length_m
    if (marksInferred(seg.surface, seg.surface_confidence)) {
      markedInferredM += seg.length_m
    }
  }
  return {
    byClass: [...metres.entries()]
      .map(([surface, m]) => ({ surface, metres: m }))
      .sort((a, b) => b.metres - a.metres),
    confirmedM,
    inferredM,
    markedInferredM,
    totalM,
  }
}

/** Has this course been matched at all? Drives every surface affordance. */
export function hasSurfaceData(
  course: Pick<CourseDetail, 'segments'>,
): boolean {
  return course.segments.some((s) => s.surface != null)
}

/** Is the background match still running? Polling can stop once it isn't. */
export function isSurfacePending(status: string | null | undefined): boolean {
  return status === 'pending'
}

export interface RibbonBand {
  startKm: number
  endKm: number
  surface: SurfaceClass
  confidence: SurfaceConfidence
}

/**
 * The stored ribbon as bands for the profile chart.
 *
 * Drawn from the ribbon rather than from the segments on purpose: the segment
 * table has a minimum row length and this has none, so a 130 m sector of mud
 * gets a visible stripe at its true extent even where the pacing rows quite
 * reasonably fold it into a longer one.
 */
export function ribbonBands(
  ribbon: SurfaceRibbonEntry[] | null | undefined,
): RibbonBand[] {
  if (!ribbon) return []
  return ribbon.map(([startM, endM, surface, confidence]) => ({
    startKm: startM / 1000,
    endKm: endM / 1000,
    surface,
    confidence,
  }))
}

export interface RoughSector {
  startKm: number
  lengthM: number
  surface: SurfaceClass
  confidence: SurfaceConfidence
}

export function roughSectors(
  sectors: RoughSectorEntry[] | null | undefined,
): RoughSector[] {
  if (!sectors) return []
  return sectors
    .map(([startM, lengthM, surface, confidence]) => ({
      startKm: startM / 1000,
      lengthM,
      surface,
      confidence,
    }))
    .sort((a, b) => a.startKm - b.startKm)
}

/** A sector length in the unit that reads best: "130 m", "2.4 km". */
export function formatSectorLength(metres: number): string {
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`
}
