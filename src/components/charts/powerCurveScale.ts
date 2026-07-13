// Pure helpers for the power-duration (MMP) curve x-axis. Kept JSX-free so they can be
// unit-tested without pulling recharts into the test bundle.

// All standard durations in seconds
export const DURATIONS = [
  1, 3, 5, 10, 15, 30, 45, 60, 120, 180, 300, 480, 600,
  900, 1200, 1800, 2700, 3600, 7200, 10800, 14400,
  18000, 21600, 25200, 28800,
]

export function formatDuration(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) {
    const m = s / 60
    return Number.isInteger(m) ? `${m}m` : `${Math.round(m)}m`
  }
  const h = s / 3600
  return Number.isInteger(h) ? `${h}h` : `${(h).toFixed(1)}h`
}

// Squared-log scale: position ∝ (ln x)²
// This compresses the short-effort end more aggressively than plain log.
// Approximate axis proportions vs plain log:
//   1s–30s  : 11% of width  (vs 33% with log)
//   1s–5m   : 31% of width  (vs 55% with log)
//   1s–1h   : 64% of width  (vs 80% with log)
export function scaledX(s: number): number {
  const v = Math.log(Math.max(s, 1))
  return v * v
}

// Candidate tick positions for the x-axis
const X_TICK_DURATIONS = [1, 15, 60, 300, 900, 3600, 7200, 21600, 28800]

// Build the x-axis ticks and their labels for a curve that ends at `maxDuration`.
// Only standard ticks up to the max are kept, and the max itself is always shown as
// the final tick so the axis end stays labelled. The last standard tick is dropped if
// it would crowd that endpoint label.
export function buildXTicks(maxDuration: number): { ticks: number[]; labels: Map<string, string> } {
  const domainMax = scaledX(maxDuration)
  const minGap = (domainMax - scaledX(1)) * 0.06
  const durations = X_TICK_DURATIONS.filter((d) => d < maxDuration)
  while (
    durations.length > 0 &&
    domainMax - scaledX(durations[durations.length - 1]) < minGap
  ) {
    durations.pop()
  }
  durations.push(maxDuration)
  return {
    ticks: durations.map(scaledX),
    labels: new Map(durations.map((d) => [scaledX(d).toFixed(6), formatDuration(d)])),
  }
}
