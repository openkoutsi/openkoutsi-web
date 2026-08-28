import { Activity, LabelSuggestion } from '@/lib/types'

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

/**
 * The unanswered commute suggestion on this ride, if there is one (issue #63).
 *
 * Deliberately *not* folded into `isCommute`: a suggestion is what openkoutsi
 * thinks, and everything that reads `isCommute` — the aerobic-metrics card, the
 * badge count — is asking what the athlete has confirmed. The two must not blur.
 */
export function pendingCommuteSuggestion(
  activity: Pick<Activity, 'label_suggestions'>,
): LabelSuggestion | null {
  const entry = activity.label_suggestions?.[COMMUTE_LABEL]
  return entry?.state === 'pending' ? entry : null
}

/**
 * The rule id behind a suggestion, or null when it came from somewhere else.
 * Lets a surface link the athlete to the rule that needs fixing.
 */
export function suggestionRuleId(suggestion: LabelSuggestion | null): string | null {
  const source = suggestion?.source
  return source?.startsWith('rule:') ? source.slice('rule:'.length) : null
}
