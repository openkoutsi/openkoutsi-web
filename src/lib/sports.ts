import { Activity } from '@/lib/types'

/**
 * Sport types that count as cycling.
 *
 * Mirrors `CYCLING_SPORT_TYPES` in the backend's `openkoutsi/sport_matching.py`,
 * which is what every server-side cycling-only query filters on. Kept lowercase
 * and matched case-insensitively so a provider that hands us `ride` instead of
 * Strava's `Ride` doesn't silently fall out of the cycling set. `cycling` itself
 * is accepted for the same reason.
 */
const CYCLING_SPORT_TYPES = new Set([
  'ride',
  'virtualride',
  'gravelride',
  'mountainbikeride',
  'ebikeride',
  'ebikesport',
  'handcycle',
  'cycling',
])

/** The athlete label marking a ride as transport rather than training. */
export const COMMUTE_LABEL = 'commute'

export function isCyclingSport(sportType: string | null | undefined): boolean {
  if (!sportType) return false
  return CYCLING_SPORT_TYPES.has(sportType.toLowerCase())
}

export function isCommute(activity: Pick<Activity, 'labels'>): boolean {
  return activity.labels?.includes(COMMUTE_LABEL) ?? false
}
