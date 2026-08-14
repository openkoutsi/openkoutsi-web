/**
 * Pure signal processing functions for activity streams.
 *
 * Streams are 1 Hz series on one shared clock — index `i` is second `i` — with
 * `null` where a channel recorded nothing. A gap is not a zero, and these
 * functions read past gaps rather than summing them in: a heart-rate strap or a
 * power meter that dropped out for two minutes is not evidence the athlete
 * coasted for two minutes, and treating it as such lowers every figure here in
 * a way that looks like a bad ride rather than a bad sensor.
 *
 * The counterpart rule, for anything added later: a metric whose answer is a
 * *time* (a fastest kilometre, an integration over the ride) has to count a gap
 * as a second, because those seconds really elapsed. The backend draws the same
 * line — see `openkoutsi/streams.py`.
 */
import type { StreamMap, StreamSample } from './types'

/** The samples that exist, in order, with gaps dropped. */
function recorded(stream: StreamSample[] | undefined): number[] {
  if (!stream) return []
  return stream.filter((v): v is number => v !== null && v !== undefined && !isNaN(v))
}

export function totalEnergyKj(streams: StreamMap): number | null {
  const power = recorded(streams['power'])
  if (power.length === 0) return null
  // Each recorded sample = 1 second; energy = Σ P*1s, convert J → kJ
  const joules = power.reduce((sum, p) => sum + p, 0)
  return Math.round(joules / 1000)
}

export function weightedPower(streams: StreamMap): number | null {
  // Gaps are closed up before the rolling window, so the average is taken over
  // 30 recorded seconds rather than over a window a dropout partly emptied.
  const power = recorded(streams['power'])
  if (power.length < 30) return null

  // 30-second rolling average, then raise to 4th power, mean, 4th root
  const windowSize = 30
  const smoothed: number[] = []
  for (let i = windowSize - 1; i < power.length; i++) {
    let sum = 0
    for (let j = i - windowSize + 1; j <= i; j++) sum += power[j]
    smoothed.push(sum / windowSize)
  }
  const mean4th = smoothed.reduce((sum, v) => sum + v ** 4, 0) / smoothed.length
  return Math.round(mean4th ** 0.25)
}

/**
 * Rolling mean over `windowSeconds`, keeping each sample on its own second.
 *
 * Unlike the two above this is drawn on a chart against the activity's clock,
 * so the result has to stay index-for-index with its input. A window that
 * contains a gap averages the samples it does have; a window with nothing in it
 * comes back as NaN, which the chart renders as a break rather than a dive.
 */
export function rollingAverage(
  data: StreamSample[],
  windowSeconds: number,
): number[] {
  if (windowSeconds <= 0 || data.length === 0) {
    return data.map((v) => (v === null || v === undefined ? NaN : v))
  }
  const result = new Array<number>(data.length).fill(NaN)
  for (let i = windowSeconds - 1; i < data.length; i++) {
    let sum = 0
    let count = 0
    for (let j = i - windowSeconds + 1; j <= i; j++) {
      const v = data[j]
      if (v === null || v === undefined || isNaN(v)) continue
      sum += v
      count++
    }
    if (count > 0) result[i] = Math.round((sum / count) * 10) / 10
  }
  return result
}
