import { describe, it, expect } from 'vitest'
import { buildXTicks, formatDuration, scaledX } from '@/components/charts/powerCurveScale'

const labelOf = (labels: Map<string, string>, d: number) =>
  labels.get(scaledX(d).toFixed(6))

describe('buildXTicks', () => {
  it('ends the axis at the largest data point, not always 8h', () => {
    const { ticks } = buildXTicks(2400) // 40 min activity
    expect(ticks[ticks.length - 1]).toBe(scaledX(2400))
    // no tick extends beyond the max duration
    expect(Math.max(...ticks)).toBe(scaledX(2400))
  })

  it('labels the endpoint tick with the max duration', () => {
    const { labels } = buildXTicks(2400)
    expect(labelOf(labels, 2400)).toBe(formatDuration(2400))
  })

  it('keeps only standard ticks within range', () => {
    const { labels } = buildXTicks(2400)
    // 15m (900s) is in range and labelled…
    expect(labelOf(labels, 900)).toBe(formatDuration(900))
    // …but 1h (3600s) and beyond are dropped
    expect(labelOf(labels, 3600)).toBeUndefined()
    expect(labelOf(labels, 28800)).toBeUndefined()
  })

  it('does not duplicate a tick when max equals a standard duration', () => {
    const { ticks } = buildXTicks(3600)
    const unique = new Set(ticks)
    expect(unique.size).toBe(ticks.length)
    expect(ticks[ticks.length - 1]).toBe(scaledX(3600))
  })

  it('drops the last standard tick when it would crowd the endpoint', () => {
    // 1000s sits just past the 900s (15m) tick; the endpoint should absorb it.
    const { labels } = buildXTicks(1000)
    expect(labelOf(labels, 900)).toBeUndefined()
    expect(labelOf(labels, 1000)).toBe(formatDuration(1000))
  })

  it('still reaches 8h for a full all-time curve', () => {
    const { ticks } = buildXTicks(28800)
    expect(ticks[ticks.length - 1]).toBe(scaledX(28800))
  })
})
