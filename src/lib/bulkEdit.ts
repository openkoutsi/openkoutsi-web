/**
 * The bulk edit on the activities list: what the dialog's choices mean as a
 * `POST /api/activities/bulk` body.
 *
 * Kept apart from the dialog so the one rule that matters — "leave as is" is
 * *omitted*, while "none" is an explicit `null` — is a pure function a test can
 * pin down. Sending `null` for a field the athlete did not touch would clear it
 * on every selected ride.
 */

/** "Leave as is" in every bulk-edit picker. */
export const KEEP = '__keep__'
/** "None" / "No bike" — clears the field. */
export const CLEAR = '__clear__'

export type LabelChange = 'keep' | 'add' | 'remove'

export interface BulkEditChoices {
  labels: Record<string, LabelChange>
  /** `KEEP`, `CLEAR`, or a bike id. */
  bike: string
  /** `KEEP`, `CLEAR`, or a workout category. */
  category: string
}

export interface BulkUpdatePayload {
  activity_ids: string[]
  add_labels: string[]
  remove_labels: string[]
  bike_id?: string | null
  workout_category?: string | null
}

export interface BulkUpdateResult {
  updated: number
  not_found: string[]
}

export const EMPTY_CHOICES: BulkEditChoices = { labels: {}, bike: KEEP, category: KEEP }

export function buildBulkPayload(ids: string[], choices: BulkEditChoices): BulkUpdatePayload {
  const entries = Object.entries(choices.labels)
  const payload: BulkUpdatePayload = {
    activity_ids: ids,
    add_labels: entries.filter(([, c]) => c === 'add').map(([l]) => l),
    remove_labels: entries.filter(([, c]) => c === 'remove').map(([l]) => l),
  }
  if (choices.bike !== KEEP) payload.bike_id = choices.bike === CLEAR ? null : choices.bike
  if (choices.category !== KEEP) {
    payload.workout_category = choices.category === CLEAR ? null : choices.category
  }
  return payload
}

/** Whether the choices would change anything — the dialog's Apply gate. */
export function hasChanges(choices: BulkEditChoices): boolean {
  return (
    Object.values(choices.labels).some((c) => c !== 'keep') ||
    choices.bike !== KEEP ||
    choices.category !== KEEP
  )
}
