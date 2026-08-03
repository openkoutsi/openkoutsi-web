import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/** Format a duration in seconds as hours and minutes, always: 2700 → "0h 45m", 45296 → "12h 34m" */
export function formatHoursMinutes(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${meters.toFixed(0)} m`
}

export function formatPower(watts: number | null | undefined): string {
  if (watts == null) return '—'
  return `${Math.round(watts)} W`
}

export function formatHR(bpm: number | null | undefined): string {
  if (bpm == null) return '—'
  return `${Math.round(bpm)} bpm`
}

/** Efficiency factor (weighted power per heartbeat): 1.5238 → "1.52 W/bpm" */
export function formatEfficiencyFactor(ef: number | null | undefined): string {
  if (ef == null) return '—'
  return `${ef.toFixed(2)} W/bpm`
}

/** Variability index (weighted ÷ average power), unitless: 1.067 → "1.07" */
export function formatVariabilityIndex(vi: number | null | undefined): string {
  if (vi == null) return '—'
  return vi.toFixed(2)
}

/**
 * Aerobic decoupling as a signed percentage: 3.42 → "+3.4 %", -1.2 → "−1.2 %".
 * The sign carries the meaning — positive is heart-rate drift, negative means
 * the second half was the more efficient one — so it is always shown.
 */
export function formatDecoupling(pct: number | null | undefined): string {
  if (pct == null) return '—'
  const sign = pct < 0 ? '−' : '+'
  return `${sign}${Math.abs(pct).toFixed(1)} %`
}

/** W′ balance in joules shown as kilojoules: 15000 → "15.0 kJ" */
export function formatWPrime(joules: number | null | undefined): string {
  if (joules == null) return '—'
  return `${(joules / 1000).toFixed(1)} kJ`
}

/** Format a distance in metres as a human-readable label: 1000 → "1 km", 10000 → "10 km" */
export function formatDistanceLabel(metres: number): string {
  return `${metres / 1000} km`
}

/**
 * Pick a round tick interval (in minutes) that gives roughly 6–10 ticks
 * for the given total duration.
 */
export function niceTickStepMinutes(totalMinutes: number): number {
  if (totalMinutes <= 20)  return 5
  if (totalMinutes <= 60)  return 10
  if (totalMinutes <= 120) return 15
  if (totalMinutes <= 240) return 30
  return 60
}

/** Format a minute value for chart x-axis tick labels: <60 → "45m", ≥60 → "1h 30m" */
export function formatChartTime(minutes: number): string {
  const m = Math.round(minutes)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`
}

/** Format average speed in km/h derived from distance (m) and time (s) */
export function formatSpeedKmh(distance_m: number, time_s: number): string {
  const kmh = (distance_m / time_s) * 3.6
  return `${kmh.toFixed(1)} km/h`
}

/** How long ago something happened, at the coarsest unit that still says it. */
export type RelativeAge =
  | { unit: 'now' }
  | { unit: 'minutes'; value: number }
  | { unit: 'hours'; value: number }

/**
 * Bucket the age of a timestamp for display: under a minute reads as "now",
 * under an hour in whole minutes, beyond that in whole hours.
 *
 * The unit is returned rather than a string so the caller can pick a
 * translated message for it.
 */
export function relativeAge(timestampMs: number, nowMs: number = Date.now()): RelativeAge {
  const elapsedMinutes = Math.floor(Math.max(0, nowMs - timestampMs) / 60_000)
  if (elapsedMinutes < 1) return { unit: 'now' }
  if (elapsedMinutes < 60) return { unit: 'minutes', value: elapsedMinutes }
  return { unit: 'hours', value: Math.floor(elapsedMinutes / 60) }
}

/** Format a number of seconds as mm:ss or h:mm:ss */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
