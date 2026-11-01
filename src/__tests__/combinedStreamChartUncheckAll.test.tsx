import { describe, expect, it, vi } from 'vitest'
import { cloneElement, createElement as h, type ReactElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import type { Interval, StreamMap } from '@/lib/types'

// Echo keys so assertions read as key names, matching the pattern used by
// other component tests that don't care about the translated copy itself.
vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { raw: () => ({}) }),
}))

// jsdom's `getBoundingClientRect` reports 0x0, and recharts' real
// ResponsiveContainer renders nothing (`validateWidthHeight` fails) for a
// zero-size container — which would make this test pass regardless of the
// bug, since the chart tree it's meant to exercise never mounts. Give it a
// real size instead of trying to coax jsdom's layout engine into one.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      cloneElement(children, { width: 600, height: 300 }),
  }
})

import { CombinedStreamChart } from '@/components/charts/CombinedStreamChart'

// A ride with no power stream at all (e.g. a GPX import, or a device with no
// power meter) and at least one interval past the start of the ride — the
// two conditions that, together with unchecking every stream checkbox, used
// to crash the whole app (ReferenceLine/ReferenceArea were pinned to a
// hard-coded 'power' y-axis id that only exists when a power stream is
// actually present).
const streams: StreamMap = {
  time: [0, 30, 60, 90],
  heartrate: [120, 128, 135, 130],
}

const intervals: Interval[] = [
  {
    interval_number: 1,
    start_offset_s: 60,
    duration_s: 30,
    distance_m: null,
    avg_hr: null,
    avg_power: null,
    avg_speed_ms: null,
    avg_cadence: null,
    is_auto_split: false,
  },
]

describe('CombinedStreamChart — unchecking every stream', () => {
  it('does not throw when the last visible stream is a power-less activity with intervals', () => {
    render(h(CombinedStreamChart, { streams, intervals }))

    // Only 'heartrate' has data, so it's the only checkbox rendered, and it
    // starts checked (heartrate is in DEFAULT_VISIBLE).
    const heartrateCheckbox = screen.getByRole('checkbox')
    expect(heartrateCheckbox).toBeChecked()

    expect(() => fireEvent.click(heartrateCheckbox)).not.toThrow()
    expect(heartrateCheckbox).not.toBeChecked()
  })
})
