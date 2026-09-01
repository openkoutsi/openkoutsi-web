import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import {
  formatSectorLength,
  hasSurfaceData,
  isRoughSurface,
  isSurfacePending,
  ribbonBands,
  roughSectors,
  surfaceColor,
  surfaceCoverage,
  SURFACE_COLORS,
} from '@/lib/courses'
import type {
  CourseSegment,
  RoughSectorEntry,
  SurfaceClass,
  SurfaceRibbonEntry,
} from '@/lib/types'
import { SegmentTable } from '@/components/courses/SegmentTable'
import messages from '../../messages/en/courses.json'

function seg(over: Partial<CourseSegment> = {}): CourseSegment {
  return {
    segment_index: 0,
    start_distance_m: 0,
    end_distance_m: 1000,
    length_m: 1000,
    avg_gradient: 0,
    elevation_change_m: 0,
    segment_type: 'flat',
    power_w: 200,
    speed_ms: 9,
    duration_s: 111,
    start_offset_s: 0,
    speed_capped: false,
    surface: null,
    surface_confidence: null,
    surface_raw: null,
    crr_used: null,
    ...over,
  }
}

const ALL_CLASSES: SurfaceClass[] = [
  'asphalt',
  'paved',
  'compacted',
  'cobbles',
  'gravel',
  'dirt',
  'grass',
  'unknown',
]

describe('surfaceColor', () => {
  it.each(ALL_CLASSES)('has a colour for %s', (klass) => {
    expect(surfaceColor(klass)).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('falls back to the unknown colour rather than to nothing', () => {
    expect(surfaceColor(null)).toBe(SURFACE_COLORS.unknown)
    expect(surfaceColor(undefined)).toBe(SURFACE_COLORS.unknown)
  })

  it('gives every class its own colour', () => {
    const colours = ALL_CLASSES.map((c) => SURFACE_COLORS[c])
    expect(new Set(colours).size).toBe(colours.length)
  })
})

describe('isRoughSurface', () => {
  it('counts hardpack and worse', () => {
    expect(isRoughSurface('compacted')).toBe(true)
    expect(isRoughSurface('gravel')).toBe(true)
    expect(isRoughSurface('dirt')).toBe(true)
  })

  it('does not count tarmac, paving stones, or a surface it does not know', () => {
    expect(isRoughSurface('asphalt')).toBe(false)
    expect(isRoughSurface('paved')).toBe(false)
    // Warning about a surface we could not identify would be inventing one.
    expect(isRoughSurface('unknown')).toBe(false)
    expect(isRoughSurface(null)).toBe(false)
  })
})

describe('surfaceCoverage', () => {
  it('adds up the distance per class, biggest first', () => {
    const coverage = surfaceCoverage([
      seg({ surface: 'asphalt', surface_confidence: 'inferred', length_m: 5000 }),
      seg({ surface: 'gravel', surface_confidence: 'confirmed', length_m: 2000 }),
      seg({ surface: 'gravel', surface_confidence: 'confirmed', length_m: 1000 }),
    ])
    expect(coverage.byClass).toEqual([
      { surface: 'asphalt', metres: 5000 },
      { surface: 'gravel', metres: 3000 },
    ])
    expect(coverage.totalM).toBe(8000)
  })

  it('splits confirmed from inferred, which is the number that matters', () => {
    const coverage = surfaceCoverage([
      seg({ surface: 'gravel', surface_confidence: 'confirmed', length_m: 3000 }),
      seg({ surface: 'asphalt', surface_confidence: 'inferred', length_m: 1000 }),
    ])
    expect(coverage.confirmedM).toBe(3000)
    expect(coverage.inferredM).toBe(1000)
  })

  it('ignores unmatched segments entirely', () => {
    const coverage = surfaceCoverage([seg(), seg()])
    expect(coverage.byClass).toEqual([])
    expect(coverage.totalM).toBe(0)
  })
})

describe('hasSurfaceData', () => {
  it('is false for a course no matcher has touched', () => {
    expect(hasSurfaceData({ segments: [seg(), seg()] })).toBe(false)
  })

  it('is true as soon as one segment carries a class', () => {
    expect(hasSurfaceData({ segments: [seg(), seg({ surface: 'gravel' })] })).toBe(true)
  })
})

describe('isSurfacePending', () => {
  it('is true only while the background match is running', () => {
    expect(isSurfacePending('pending')).toBe(true)
    for (const settled of ['done', 'unavailable', null, undefined]) {
      expect(isSurfacePending(settled)).toBe(false)
    }
  })
})

describe('ribbonBands', () => {
  it('converts stored metres into chart kilometres', () => {
    const ribbon: SurfaceRibbonEntry[] = [
      [0, 5000, 'asphalt', 'inferred', 0],
      [5000, 5130, 'dirt', 'confirmed', 5],
    ]
    expect(ribbonBands(ribbon)).toEqual([
      { startKm: 0, endKm: 5, surface: 'asphalt', confidence: 'inferred' },
      { startKm: 5, endKm: 5.13, surface: 'dirt', confidence: 'confirmed' },
    ])
  })

  it('keeps a band far shorter than a pacing segment', () => {
    // The whole reason the ribbon is stored separately: 130 m of mud has to
    // stay drawable even where the segment table folds it into a longer row.
    const [band] = ribbonBands([[5000, 5130, 'dirt', 'confirmed', 5]])
    expect(band.endKm - band.startKm).toBeCloseTo(0.13)
  })

  it('is empty when nothing has been matched', () => {
    expect(ribbonBands(null)).toEqual([])
    expect(ribbonBands(undefined)).toEqual([])
  })
})

describe('roughSectors', () => {
  it('orders them along the course', () => {
    const sectors: RoughSectorEntry[] = [
      [41200, 130, 'dirt', 'confirmed', 5],
      [1000, 2000, 'gravel', 'confirmed', 4],
    ]
    expect(roughSectors(sectors).map((s) => s.startKm)).toEqual([1, 41.2])
  })

  it('is empty when nothing has been matched', () => {
    expect(roughSectors(null)).toEqual([])
  })
})

describe('formatSectorLength', () => {
  it('reads a short sector in metres, which is how a rider thinks of it', () => {
    expect(formatSectorLength(130)).toBe('130 m')
  })

  it('switches to kilometres once that stops being useful', () => {
    expect(formatSectorLength(2400)).toBe('2.4 km')
  })
})

// ── the visible distinction ─────────────────────────────────────────────────

function renderTable(segments: CourseSegment[]) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ courses: messages } as Record<string, unknown>}
    >
      <SegmentTable segments={segments} ftp={250} selectedIndex={null} onSelect={() => {}} />
    </NextIntlClientProvider>,
  )
}

describe('SegmentTable surface column', () => {
  it('is absent entirely on a course with no surface data', () => {
    renderTable([seg({ segment_index: 0 })])
    expect(screen.queryByText('Surface')).toBeNull()
  })

  it('marks an inferred segment visibly, not just by colour', () => {
    // "Legible at a glance, not buried in a tooltip" — the badge is a word in
    // the row, so it survives a screen reader and a black-and-white printout.
    renderTable([
      seg({
        segment_index: 0,
        surface: 'asphalt',
        surface_confidence: 'inferred',
      }),
    ])
    expect(screen.getByText('Surface')).toBeTruthy()
    expect(screen.getByText('Asphalt')).toBeTruthy()
    expect(screen.getByText('inferred')).toBeTruthy()
  })

  it('leaves a confirmed segment unqualified', () => {
    renderTable([
      seg({
        segment_index: 0,
        surface: 'gravel',
        surface_confidence: 'confirmed',
      }),
    ])
    expect(screen.getByText('Gravel')).toBeTruthy()
    expect(screen.queryByText('inferred')).toBeNull()
  })

  it('explains what inferred means once, under the table', () => {
    renderTable([
      seg({ segment_index: 0, surface: 'asphalt', surface_confidence: 'inferred' }),
    ])
    expect(screen.getByText(/could not confirm a surface tag/i)).toBeTruthy()
  })

  it('shows a confirmed and an inferred row as different things', () => {
    renderTable([
      seg({
        segment_index: 0,
        surface: 'gravel',
        surface_confidence: 'confirmed',
        start_distance_m: 0,
        end_distance_m: 1000,
      }),
      seg({
        segment_index: 1,
        surface: 'asphalt',
        surface_confidence: 'inferred',
        start_distance_m: 1000,
        end_distance_m: 2000,
      }),
    ])
    expect(screen.getByText('Gravel')).toBeTruthy()
    expect(screen.getByText('Asphalt')).toBeTruthy()
    // Exactly one of the two rows carries the qualifier.
    expect(screen.getAllByText('inferred')).toHaveLength(1)
  })
})
