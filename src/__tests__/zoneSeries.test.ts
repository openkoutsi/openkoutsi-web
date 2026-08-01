import { describe, it, expect } from 'vitest'
import { zoneKey, zoneNumber, zoneRow, zoneSeries } from '@/lib/zoneSeries'

describe('zoneNumber', () => {
  it('reads the number out of both naming generations', () => {
    expect(zoneNumber('Z1', 'power')).toBe(1)
    expect(zoneNumber('Z1 Recovery', 'power')).toBe(1)
    expect(zoneNumber('Zone 3', 'power')).toBe(3)
    expect(zoneNumber('3 Tempo', 'power')).toBe(3)
  })

  it('refuses a name whose number does not lead it', () => {
    expect(zoneNumber('VO2max', 'power')).toBeNull()
    expect(zoneNumber('Recovery', 'power')).toBeNull()
  })

  it('refuses a leading number too large to be a zone', () => {
    // `Sweet Spot 88-94%` is a real free-form name; 88 is not zone 88.
    expect(zoneNumber('88-94% Sweet Spot', 'power')).toBeNull()
  })

  it('allows a number past the canonical count but within the ceiling', () => {
    // Snapshots frozen while zone lists were still free-length.
    expect(zoneNumber('Z8', 'power')).toBe(8)
    expect(zoneNumber('Z8', 'hr')).toBe(8)
  })

  it('applies a ceiling scaled to the basis', () => {
    expect(zoneNumber('Z14', 'power')).toBe(14)
    expect(zoneNumber('Z15', 'power')).toBeNull()
    expect(zoneNumber('Z11', 'hr')).toBeNull()
  })
})

describe('zoneKey', () => {
  it('collapses both generations of one zone onto the same key', () => {
    expect(zoneKey('Z4 Threshold', 'power')).toBe(zoneKey('Z4', 'power'))
  })

  it('keeps an unnumbered name as its own key', () => {
    expect(zoneKey('  Sweet Spot ', 'power')).toBe('Sweet Spot')
  })
})

describe('zoneRow', () => {
  it('sums the two generations of a zone into one entry', () => {
    expect(zoneRow({ Z1: 600, 'Z1 Recovery': 300, 'Z2 Endurance': 60 }, 'power')).toEqual({
      Z1: 900,
      Z2: 60,
    })
  })

  it('preserves the snapshot total', () => {
    const times = { Z1: 600, 'Z1 Recovery': 300, Z3: 120, 'Z3 Tempo': 45 }
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)
    expect(sum(zoneRow(times, 'power'))).toBe(sum(times))
  })

  it('handles a missing snapshot', () => {
    expect(zoneRow(undefined, 'hr')).toEqual({})
  })
})

describe('zoneSeries', () => {
  it('returns one series per zone across weeks that name zones differently', () => {
    const rows = [
      zoneRow({ Z1: 600, Z3: 120 }, 'power'),
      zoneRow({ 'Z1 Recovery': 900, 'Z4 Threshold': 300 }, 'power'),
    ]
    expect(zoneSeries(rows, 'power').map((s) => s.key)).toEqual(['Z1', 'Z3', 'Z4'])
  })

  it('labels a zone canonically whichever generation it came from', () => {
    const series = zoneSeries([zoneRow({ Z1: 600, Z5: 60 }, 'power')], 'power')
    expect(series.map((s) => s.label)).toEqual(['Z1 Recovery', 'Z5 VO2max'])
  })

  it('labels by basis', () => {
    expect(zoneSeries([{ Z5: 60 }], 'hr')[0].label).toBe('Z5 VO2max')
    expect(zoneSeries([{ Z6: 60 }], 'hr')[0].label).toBe('Z6')
  })

  it('orders zones numerically, not alphabetically', () => {
    const series = zoneSeries([{ Z10: 1, Z2: 1, Z1: 1 }], 'power')
    expect(series.map((s) => s.zone)).toEqual([1, 2, 10])
  })

  it('sorts unplaceable names last and keeps them visible', () => {
    const series = zoneSeries([zoneRow({ Recovery: 600, Z2: 60 }, 'power')], 'power')
    expect(series.map((s) => s.key)).toEqual(['Z2', 'Recovery'])
    expect(series[1].zone).toBeNull()
    expect(series[1].label).toBe('Recovery')
  })

  it('is empty when no week has any zone time', () => {
    expect(zoneSeries([{}, {}], 'power')).toEqual([])
  })
})
