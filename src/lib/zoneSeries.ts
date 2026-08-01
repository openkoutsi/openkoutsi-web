import { HR_ZONE_NAMES, POWER_ZONE_NAMES } from '@/lib/zoneDefaults'

/**
 * Turning frozen `zone_times` snapshots into chart series.
 *
 * Snapshots are keyed by the zone's *name* as it was when the activity was
 * processed, and history carries two generations of them: bare `Z1`…`Z7` from
 * provider sync, and the canonical `Z1 Recovery`…`Z7 Neuromuscular` the API has
 * normalised names to since issue #38. Snapshots are frozen, so both live on
 * side by side forever. Keying a chart off the raw names therefore drew one
 * series per *name* rather than per *zone* — the same zone twice, in two
 * unrelated colours, splitting a week's time between two legend entries.
 *
 * The server already reads position out of the number leading the name (see
 * `openkoutsi/intensity_distribution.py`), which is why the intensity
 * distribution never showed the split. This does the same for the charts.
 *
 * It lives in `lib` rather than in the chart because charts in this repo are
 * dumb and untested by design.
 */

export type ZoneBasis = 'hr' | 'power'

const CANONICAL_NAMES: Record<ZoneBasis, string[]> = {
  hr: HR_ZONE_NAMES,
  power: POWER_ZONE_NAMES,
}

// Anchored deliberately, matching the server's parser. An unanchored `\d+`
// takes the first digit run anywhere in the name, and names were free-form
// before the model was fixed: `VO2max` would read as zone 2 and `Sweet Spot
// 88-94%` as zone 88. Anchoring accepts `Z1 Recovery`, `Zone 1`, `1 Recovery`
// and `Z1`, and refuses the rest.
const ZONE_NUMBER = /^\s*(?:zone\s*|z\s*)?(\d+)/i

// A number this far above the canonical count is not a zone number — it's a
// percentage or a wattage that happened to lead the name.
const MAX_ZONE_NUMBER_FACTOR = 2

/** The 1-based zone number leading `name`, or `null` if it carries none. */
export function zoneNumber(name: string, basis: ZoneBasis): number | null {
  const match = ZONE_NUMBER.exec(name)
  if (!match) return null
  const number = Number(match[1])
  if (number < 1 || number > CANONICAL_NAMES[basis].length * MAX_ZONE_NUMBER_FACTOR) {
    return null
  }
  return number
}

/**
 * The key both naming generations of one zone collapse onto. Names with no
 * parseable number keep their own key: they are unplaceable, and dropping them
 * would quietly shrink the totals a chart reports.
 */
export function zoneKey(name: string, basis: ZoneBasis): string {
  const number = zoneNumber(name, basis)
  return number === null ? name.trim() : `Z${number}`
}

/** One zone's series in a chart, after both generations have been merged. */
export interface ZoneSeries {
  /** Merged key, i.e. the `dataKey` of the rows built by `zoneRow`. */
  key: string
  /** What the legend and tooltip show. */
  label: string
  /** 1-based zone number, or `null` when the name carried none. */
  zone: number | null
}

/**
 * Sum one snapshot's `{name: seconds}` onto merged keys, so a week holding both
 * `Z1: 600` and `Z1 Recovery: 300` reports `Z1: 900` rather than two zones.
 */
export function zoneRow(times: Record<string, number> | undefined, basis: ZoneBasis) {
  const row: Record<string, number> = {}
  for (const [name, seconds] of Object.entries(times ?? {})) {
    const key = zoneKey(name, basis)
    row[key] = (row[key] ?? 0) + (seconds || 0)
  }
  return row
}

/**
 * The zones present across `rows`, ascending, each labelled with the canonical
 * name for its position. The label is derived from the number rather than
 * carried over from whichever name happened to be seen first, so a week of
 * provider-synced rides reads the same as a week of freshly processed ones.
 *
 * Numbers past the canonical list are labelled `Zn`: they come from snapshots
 * frozen when zone lists were still free-length, and there is no canonical name
 * to give them.
 */
export function zoneSeries(rows: Record<string, number>[], basis: ZoneBasis): ZoneSeries[] {
  const keys = new Set(rows.flatMap((row) => Object.keys(row)))
  const names = CANONICAL_NAMES[basis]

  return Array.from(keys)
    .map((key) => {
      const zone = zoneNumber(key, basis)
      return {
        key,
        label: zone === null ? key : (names[zone - 1] ?? key),
        zone,
      }
    })
    .sort((a, b) => {
      // Unnumbered names sort last; nothing is derived from their position,
      // they only need a stable order.
      if (a.zone === null || b.zone === null) {
        if (a.zone === b.zone) return a.key.localeCompare(b.key)
        return a.zone === null ? 1 : -1
      }
      return a.zone - b.zone
    })
}
