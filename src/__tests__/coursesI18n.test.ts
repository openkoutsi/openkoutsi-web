import { describe, expect, it } from 'vitest'

import coursesEn from '../../messages/en/courses.json'
import coursesFi from '../../messages/fi/courses.json'
import commonEn from '../../messages/en/common.json'
import commonFi from '../../messages/fi/common.json'

/**
 * Reason codes `backend/app/api/courses.py` returns as `{code, message}` when
 * a course cannot be analysed. Each one is shown to the athlete instead of a
 * status, so each one needs a sentence in both languages.
 */
const UPLOAD_REASON_CODES = [
  'no_elevation_data',
  'course_too_short',
  'missing_rider_data',
] as const

/**
 * The refusals `openkoutsi/course.py` can return for a target it cannot
 * honour. A refusal is a result the athlete asked for, so it is rendered
 * rather than swallowed — a missing translation would show a raw key at the
 * moment the app is explaining itself.
 *
 * `power_exceeds_sustainable` is the same refusal reached from a *power*
 * target, which needs its own sentence: that one keeps its splits, so it says
 * how long the athlete would be holding the number rather than describing a
 * plan built around something else.
 */
const REFUSAL_REASONS = [
  'target_faster_than_physics',
  'exceeds_sustainable_power',
  'power_exceeds_sustainable',
] as const

/** The modes the target picker offers, each with a label and a help line. */
const TARGET_MODES = ['none', 'time', 'power'] as const

/** The riding positions the backend's `Bike.RIDING_POSITIONS` accepts. */
const RIDING_POSITIONS = ['tops', 'hoods', 'drops', 'aero'] as const

function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  if (Array.isArray(value)) return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    keysOf(v, prefix ? `${prefix}.${k}` : k),
  )
}

describe('courses translations', () => {
  it('has the same keys in both languages', () => {
    expect(keysOf(coursesFi).sort()).toEqual(keysOf(coursesEn).sort())
  })

  it.each(UPLOAD_REASON_CODES)('explains the %s reason code', (code) => {
    for (const messages of [coursesEn, coursesFi]) {
      expect(messages.upload.reason).toHaveProperty(code)
    }
  })

  it.each(REFUSAL_REASONS)('explains the %s refusal', (reason) => {
    for (const messages of [coursesEn, coursesFi]) {
      expect(messages.refusal).toHaveProperty(reason)
    }
  })

  it.each(TARGET_MODES)('names and explains the %s target mode', (mode) => {
    for (const messages of [coursesEn, coursesFi]) {
      expect(messages.target).toHaveProperty(mode)
      expect(messages.target).toHaveProperty(`${mode}Help`)
    }
  })

  it('keeps the placeholders the refusal sentences interpolate', () => {
    for (const messages of [coursesEn, coursesFi]) {
      expect(messages.refusal.target_faster_than_physics).toContain('{fastest}')
      expect(messages.refusal.exceeds_sustainable_power).toContain('{required}')
      // The power refusal names the duration too — the number that makes an
      // average power unsustainable rather than merely hard.
      expect(messages.refusal.power_exceeds_sustainable).toContain('{required}')
      expect(messages.refusal.power_exceeds_sustainable).toContain('{duration}')
    }
  })

  it.each(RIDING_POSITIONS)('names the %s riding position', (position) => {
    for (const messages of [coursesEn, coursesFi]) {
      expect(messages.bikes.position).toHaveProperty(position)
    }
  })

  it('states the still-air assumption in both languages', () => {
    // The one caveat the issue asks to surface rather than bury: a plan that
    // silently assumes no wind is confident-but-unqualified output.
    expect(coursesEn.stillAir).toMatch(/still air/i)
    expect(coursesFi.stillAir).toMatch(/tyyne/i)
  })

  it('has a navigation label in both languages', () => {
    expect(commonEn.nav).toHaveProperty('courses')
    expect(commonFi.nav).toHaveProperty('courses')
  })
})
