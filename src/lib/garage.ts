import type { Bike, MaintenanceEntry } from '@/lib/types'

/**
 * Kilometres, as the garage prints them. Distinct from `formatKm` in
 * `lib/courses`, which takes metres: every figure the garage handles arrives
 * from the API already in kilometres, and converting one to the other just to
 * format it is a rounding error waiting to be introduced.
 */
export function formatGarageKm(km: number | null | undefined, digits = 0): string {
  if (km == null) return '—'
  return `${km.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} km`
}

/** Bikes still ridden — what a picker for a *future* ride should offer. */
export function activeBikes(bikes: Bike[]): Bike[] {
  return bikes.filter((b) => !b.retired_at)
}

/**
 * The maintenance log grouped by component, newest first within each group.
 *
 * The API already sorts the log and marks the current entry per component; this
 * only regroups it, so the "these tyres have done 1 800 km" line sits with the
 * tyre history rather than scattered through a single chronological list.
 */
export function byComponent(
  entries: MaintenanceEntry[],
): { component: string; entries: MaintenanceEntry[] }[] {
  const groups = new Map<string, MaintenanceEntry[]>()
  for (const entry of entries) {
    const bucket = groups.get(entry.component)
    if (bucket) bucket.push(entry)
    else groups.set(entry.component, [entry])
  }
  return [...groups.entries()]
    .map(([component, grouped]) => ({ component, entries: grouped }))
    .sort((a, b) => a.component.localeCompare(b.component))
}
