import { describe, it, expect } from 'vitest'
import { totalEnergyKj, weightedPower, rollingAverage } from '@/lib/streamAnalytics'

describe('totalEnergyKj', () => {
  it('returns null when no power stream', () => {
    expect(totalEnergyKj({})).toBeNull()
    expect(totalEnergyKj({ heartrate: [120, 130] })).toBeNull()
  })

  it('returns null for empty power array', () => {
    expect(totalEnergyKj({ power: [] })).toBeNull()
  })

  it('computes correct energy for constant power', () => {
    // 200 W * 3600 s = 720,000 J = 720 kJ
    const power = new Array(3600).fill(200)
    expect(totalEnergyKj({ power })).toBe(720)
  })

  it('rounds to nearest kJ', () => {
    // 1500 W * 1s = 1.5 kJ → rounds to 2
    expect(totalEnergyKj({ power: [1500] })).toBe(2)
  })
})

describe('weightedPower', () => {
  it('returns null when no power stream', () => {
    expect(weightedPower({})).toBeNull()
  })

  it('returns null for streams shorter than 30 seconds', () => {
    expect(weightedPower({ power: new Array(29).fill(300) })).toBeNull()
  })

  it('returns the same value for perfectly constant power', () => {
    // Weighted Power of constant power should equal that power
    const power = new Array(300).fill(250)
    expect(weightedPower({ power })).toBe(250)
  })
})

describe('rollingAverage', () => {
  it('returns same-length array', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const result = rollingAverage(data, 3)
    expect(result).toHaveLength(10)
  })

  it('first (window-1) values are NaN', () => {
    const result = rollingAverage([1, 2, 3, 4, 5], 3)
    expect(isNaN(result[0])).toBe(true)
    expect(isNaN(result[1])).toBe(true)
  })

  it('computes correct steady-state average', () => {
    // [2, 2, 2, 2, 2] with window 3 → [NaN, NaN, 2, 2, 2]
    const result = rollingAverage([2, 2, 2, 2, 2], 3)
    expect(result[2]).toBe(2)
    expect(result[3]).toBe(2)
    expect(result[4]).toBe(2)
  })

  it('computes average of ramp correctly', () => {
    // [1, 2, 3, 4, 5] window 3 → avg of 1+2+3=2, 2+3+4=3, 3+4+5=4
    const result = rollingAverage([1, 2, 3, 4, 5], 3)
    expect(result[2]).toBe(2)
    expect(result[3]).toBe(3)
    expect(result[4]).toBe(4)
  })

  it('returns copy of data for window <= 0', () => {
    const data = [1, 2, 3]
    const result = rollingAverage(data, 0)
    expect(result).toEqual([1, 2, 3])
  })
})

// ── gaps ────────────────────────────────────────────────────────────────────
//
// Streams carry `null` where a sensor recorded nothing. A gap is not a zero:
// reading one as zero lets a dropped strap or a dead power meter lower every
// figure on the panel, which looks to the athlete like a bad ride rather than a
// bad sensor. See `openkoutsi/streams.py` for the backend half of the contract.

describe('gaps are not zeros', () => {
  it('totalEnergyKj skips gaps instead of adding zero joules', () => {
    // 200 W for 10 recorded seconds, whatever else the stream spans.
    expect(totalEnergyKj({ power: [...new Array(10).fill(200), null, null] })).toBe(2)
  })

  it('totalEnergyKj returns null when the whole stream is gaps', () => {
    expect(totalEnergyKj({ power: [null, null, null] })).toBeNull()
  })

  it('weightedPower is unchanged by a dropout', () => {
    const steady = new Array(300).fill(250)
    const gappy = [...steady.slice(0, 150), ...new Array(60).fill(null), ...steady.slice(150)]
    expect(weightedPower({ power: gappy })).toBe(weightedPower({ power: steady }))
  })

  it('weightedPower needs 30 recorded seconds, not 30 slots', () => {
    const mostlyGaps = [...new Array(20).fill(250), ...new Array(50).fill(null)]
    expect(weightedPower({ power: mostlyGaps })).toBeNull()
  })

  it('rollingAverage keeps each sample on its own second', () => {
    // The chart draws this against the clock, so the output must stay
    // index-for-index with the input rather than closing the gap up.
    const result = rollingAverage([2, 2, null, 2, 2], 3)
    expect(result).toHaveLength(5)
  })

  it('rollingAverage averages the samples a window does have', () => {
    // Window [2, null, 2] is 2, not 4/3 — the gap is not a sample worth zero.
    const result = rollingAverage([2, null, 2, 2, 2], 3)
    expect(result[2]).toBe(2)
  })

  it('rollingAverage reports NaN for a window with nothing in it', () => {
    const result = rollingAverage([null, null, null, 2, 2], 3)
    expect(isNaN(result[2])).toBe(true)
  })

  it('rollingAverage passes gaps through as NaN when the window is disabled', () => {
    expect(rollingAverage([1, null, 3], 0).map(isNaN)).toEqual([false, true, false])
  })
})
