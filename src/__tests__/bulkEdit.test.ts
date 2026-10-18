import { describe, expect, it } from 'vitest'

import { buildBulkPayload, CLEAR, EMPTY_CHOICES, hasChanges, KEEP } from '@/lib/bulkEdit'
import activitiesEn from '../../messages/en/activities.json'
import activitiesFi from '../../messages/fi/activities.json'

describe('buildBulkPayload', () => {
  it('omits every field left as is', () => {
    expect(buildBulkPayload(['a'], EMPTY_CHOICES)).toEqual({
      activity_ids: ['a'],
      add_labels: [],
      remove_labels: [],
    })
  })

  it('splits label choices into adds and removes', () => {
    const payload = buildBulkPayload(['a', 'b'], {
      ...EMPTY_CHOICES,
      labels: { commute: 'add', race: 'remove' },
    })
    expect(payload.add_labels).toEqual(['commute'])
    expect(payload.remove_labels).toEqual(['race'])
  })

  it('sends null for "none" and never for "leave as is"', () => {
    const cleared = buildBulkPayload(['a'], { labels: {}, bike: CLEAR, category: CLEAR })
    expect(cleared).toHaveProperty('bike_id', null)
    expect(cleared).toHaveProperty('workout_category', null)

    const kept = buildBulkPayload(['a'], { labels: {}, bike: KEEP, category: KEEP })
    expect(kept).not.toHaveProperty('bike_id')
    expect(kept).not.toHaveProperty('workout_category')
  })

  it('passes a chosen bike and category through', () => {
    const payload = buildBulkPayload(['a'], { labels: {}, bike: 'bike-1', category: 'tempo' })
    expect(payload.bike_id).toBe('bike-1')
    expect(payload.workout_category).toBe('tempo')
  })
})

describe('hasChanges', () => {
  it('is false until something is chosen', () => {
    expect(hasChanges(EMPTY_CHOICES)).toBe(false)
    expect(hasChanges({ ...EMPTY_CHOICES, labels: { race: 'keep' } })).toBe(false)
    expect(hasChanges({ ...EMPTY_CHOICES, labels: { race: 'add' } })).toBe(true)
    expect(hasChanges({ ...EMPTY_CHOICES, bike: CLEAR })).toBe(true)
    expect(hasChanges({ ...EMPTY_CHOICES, category: 'tempo' })).toBe(true)
  })
})

describe('bulk edit i18n', () => {
  it('keeps the bulk block identical across locales', () => {
    expect(Object.keys(activitiesFi.bulk).sort()).toEqual(Object.keys(activitiesEn.bulk).sort())
  })
})
