/**
 * Rolling windows for the admin console's active-users table.
 *
 * The backend counts a user active on a **UTC** day once they load the
 * dashboard, so the windows are UTC dates too: computing them in the viewer's
 * local zone would shift "today" by a day for part of every day.
 */
export const ACTIVE_USER_WINDOWS = [
  { key: 'daily', days: 1 },
  { key: 'weekly', days: 7 },
  { key: 'monthly', days: 30 },
] as const

export type ActiveUserWindow = (typeof ACTIVE_USER_WINDOWS)[number]['key']

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Inclusive `from`/`to` UTC dates covering the last `days` days, today included. */
export function activeUsersRange(days: number, now: Date = new Date()): { from: string; to: string } {
  const start = new Date(now.getTime())
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return { from: isoDay(start), to: isoDay(now) }
}

export function activeUsersUrl(days: number, now: Date = new Date()): string {
  const { from, to } = activeUsersRange(days, now)
  return `/api/admin/active-users/summary?group_by=day&from=${from}&to=${to}`
}
