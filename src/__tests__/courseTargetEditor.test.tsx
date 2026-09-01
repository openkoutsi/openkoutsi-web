import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SWRConfig } from 'swr'

import type { Bike, CourseDetail } from '@/lib/types'

// vi.mock factories are hoisted, so shared state is created via vi.hoisted.
const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  fetcher: vi.fn(),
  toast: vi.fn(),
}))

// A translator that echoes keys, so assertions read as key names. This suite is
// about behaviour, not copy — coursesI18n.test.ts covers the strings.
vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
  useLocale: () => 'en',
}))

vi.mock('@/lib/api', () => ({
  apiFetch: mocks.apiFetch,
  fetcher: mocks.fetcher,
}))

vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }))

// The chart and the written plan are not what this suite is about, and both
// pull in machinery (a responsive container, its own polling fetch) that only
// slows the render down.
vi.mock('@/components/charts/CourseProfileChart', () => ({
  CourseProfileChart: () => null,
}))
vi.mock('@/components/courses/CoursePlanCard', () => ({
  CoursePlanCard: () => null,
}))

import { CourseDetailView } from '@/components/courses/CourseDetailView'

// Radix Select drives itself with pointer-capture APIs jsdom does not implement.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

const BIKE: Bike = {
  id: 'b1',
  name: 'Road bike',
  tyre_width_mm: 28,
  riding_position: 'hoods',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function course(overrides: Partial<CourseDetail> = {}): CourseDetail {
  return {
    id: 'c1',
    name: 'Test course',
    goal_id: null,
    bike_id: 'b1',
    status: 'ready',
    distance_m: 15000,
    elevation_gain_m: 180,
    target_time_s: null,
    target_power_w: null,
    start_time: null,
    predicted_time_s: 2100,
    feasible: true,
    refusal_reason: null,
    plan_status: null,
    created_at: '2026-01-01T00:00:00Z',
    error: null,
    ftp_w_used: 250,
    weight_kg_used: 75,
    elevation_loss_m: 90,
    min_elevation_m: 100,
    max_elevation_m: 240,
    intensity: 0.8,
    required_intensity: 0.8,
    profile: null,
    segments: [],
    // Unmatched, which is what a course looks like on any instance without a
    // surface matcher — including every course that predates issue #56.
    surface_status: null,
    surface_updated_at: null,
    surface_matching_available: false,
    surface_ribbon: null,
    rough_sectors: null,
    ...overrides,
  }
}

function mount(detail: CourseDetail) {
  mocks.fetcher.mockImplementation(async (url: string) => {
    if (url === `/api/courses/${detail.id}`) return detail
    throw new Error(`unexpected fetch: ${url}`)
  })
  mocks.apiFetch.mockResolvedValue(detail)
  return render(
    h(
      SWRConfig,
      { value: { provider: () => new Map(), dedupingInterval: 0 } },
      h(CourseDetailView, {
        courseId: detail.id,
        bikes: [BIKE],
        onChanged: () => {},
      }),
    ),
  )
}

/** Pick a mode from the target select, which Radix renders into a portal. */
async function pickMode(user: ReturnType<typeof userEvent.setup>, key: string) {
  const trigger = screen.getAllByRole('combobox').at(-1)!
  await user.click(trigger)
  await user.click(await screen.findByRole('option', { name: key }))
}

function targetField() {
  return screen.getByLabelText(/courses\.target\.(time|power)/)
}

function applyButton() {
  return screen.getByRole('button', { name: 'courses.target.apply' })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('the course target editor', () => {
  it('opens on the target the course is actually solved for', async () => {
    mount(course({ target_time_s: 4 * 3600 + 30 * 60 }))

    // The stored seconds come back as the notation the field accepts, so the
    // athlete sees what they asked for rather than an empty box.
    await waitFor(() => expect(targetField()).toHaveValue('4:30:00'))
    // Nothing has changed yet, so there is nothing to apply.
    expect(applyButton()).toBeDisabled()
  })

  it('switches a time target to a power target in one request', async () => {
    const user = userEvent.setup()
    mount(course({ target_time_s: 3600 }))
    await screen.findByText('courses.target.label')

    await pickMode(user, 'courses.target.power')
    await user.type(targetField(), '210')
    await user.click(applyButton())

    // Only the target being set is sent: the backend clears the other one.
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith('/api/courses/c1/reanalyze', {
        method: 'POST',
        body: JSON.stringify({ target_power_w: 210 }),
      }),
    )
  })

  it('clears both targets when the athlete picks no target', async () => {
    const user = userEvent.setup()
    mount(course({ target_power_w: 210 }))
    await screen.findByText('courses.target.label')

    await pickMode(user, 'courses.target.none')
    await user.click(applyButton())

    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith('/api/courses/c1/reanalyze', {
        method: 'POST',
        body: JSON.stringify({ target_time_s: null, target_power_w: null }),
      }),
    )
  })

  it('says a value is unusable instead of quietly sending it', async () => {
    const user = userEvent.setup()
    mount(course())
    await screen.findByText('courses.target.label')

    await pickMode(user, 'courses.target.power')
    await user.type(targetField(), 'hard')
    await user.click(applyButton())

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'courses.target.badPower' }),
      ),
    )
    expect(mocks.apiFetch).not.toHaveBeenCalled()
  })

  it('explains an unsustainable power in its own words, not the time refusal', async () => {
    mount(
      course({
        target_power_w: 300,
        feasible: false,
        refusal_reason: 'exceeds_sustainable_power',
        required_intensity: 1.2,
      }),
    )

    expect(await screen.findByText('courses.refusal.powerTitle')).toBeTruthy()
    expect(screen.queryByText('courses.refusal.title')).toBeNull()
  })
})
