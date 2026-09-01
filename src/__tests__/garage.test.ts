import { describe, expect, it } from 'vitest'

import garageEn from '../../messages/en/garage.json'
import garageFi from '../../messages/fi/garage.json'
import coursesEn from '../../messages/en/courses.json'
import coursesFi from '../../messages/fi/courses.json'
import commonEn from '../../messages/en/common.json'
import commonFi from '../../messages/fi/common.json'
import { CLAIMABLE_SPORTS, MAINTENANCE_COMPONENTS, type Bike, type MaintenanceEntry } from '@/lib/types'
import { activeBikes, byComponent, formatGarageKm } from '@/lib/garage'

function bike(overrides: Partial<Bike> = {}): Bike {
  return {
    id: 'b1',
    name: 'Road bike',
    tyre_width_mm: 28,
    riding_position: 'hoods',
    odometer_base_km: null,
    default_sports: [],
    retired_at: null,
    tracked_km: 0,
    lifetime_km: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function entry(overrides: Partial<MaintenanceEntry> = {}): MaintenanceEntry {
  return {
    id: 'm1',
    bike_id: 'b1',
    performed_on: '2026-01-01',
    component: 'tyres',
    odometer_km: 1000,
    note: null,
    previous_component_km: null,
    km_since: null,
    is_current: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('formatGarageKm', () => {
  it('prints kilometres, not metres', () => {
    // Distinct from `formatKm` in lib/courses, which takes metres. Every garage
    // figure arrives from the API already in kilometres.
    expect(formatGarageKm(4200)).toBe('4,200 km')
  })

  it('shows an em dash rather than zero for an absent figure', () => {
    expect(formatGarageKm(null)).toBe('—')
    expect(formatGarageKm(undefined)).toBe('—')
    expect(formatGarageKm(0)).toBe('0 km')
  })
})

describe('activeBikes', () => {
  it('drops retired bikes from a picker for a future ride', () => {
    const kept = bike({ id: 'kept' })
    const sold = bike({ id: 'sold', retired_at: '2026-01-01T00:00:00Z' })
    expect(activeBikes([kept, sold]).map((b) => b.id)).toEqual(['kept'])
  })
})

describe('byComponent', () => {
  it('groups the log so a component sits with its own history', () => {
    const grouped = byComponent([
      entry({ id: '1', component: 'tyres' }),
      entry({ id: '2', component: 'chain' }),
      entry({ id: '3', component: 'tyres' }),
    ])
    expect(grouped.map((g) => g.component)).toEqual(['chain', 'tyres'])
    expect(grouped.find((g) => g.component === 'tyres')?.entries.map((e) => e.id)).toEqual([
      '1',
      '3',
    ])
  })

  it('keeps the order the API returned within a component', () => {
    // The server sorts newest-first and marks the current entry; regrouping
    // must not reshuffle that, or the "fitted N km ago" badge moves rows.
    const grouped = byComponent([
      entry({ id: 'new', is_current: true }),
      entry({ id: 'old' }),
    ])
    expect(grouped[0].entries.map((e) => e.id)).toEqual(['new', 'old'])
  })

  it('is empty for an empty log', () => {
    expect(byComponent([])).toEqual([])
  })
})

describe('garage translations', () => {
  const locales = { en: garageEn, fi: garageFi }

  it('names every component the picker offers, in both languages', () => {
    // The vocabulary is advisory server-side, but every key the UI *offers* is
    // one it must be able to print — a missing one shows a raw key in the
    // dropdown itself.
    for (const [locale, messages] of Object.entries(locales)) {
      for (const component of MAINTENANCE_COMPONENTS) {
        expect(
          messages.maintenance[`component_${component}` as keyof typeof messages.maintenance],
          `${locale}: component_${component}`,
        ).toBeTruthy()
      }
    }
  })

  it('names every claimable sport, in both languages', () => {
    for (const [locale, messages] of Object.entries(locales)) {
      for (const sport of CLAIMABLE_SPORTS) {
        expect(
          messages.sports[sport as keyof typeof messages.sports],
          `${locale}: sports.${sport}`,
        ).toBeTruthy()
      }
    }
  })

  it('names both assignment sources, in both languages', () => {
    // The badge saying *who* chose the bike is the whole point of showing the
    // source: an untranslated one would print `auto` at the moment the app is
    // telling the athlete their correction stuck.
    for (const [locale, messages] of Object.entries(locales)) {
      for (const source of ['auto', 'manual'] as const) {
        expect(
          messages.activity[source],
          `${locale}: activity.${source}`,
        ).toBeTruthy()
      }
    }
  })

  it('has the same keys in both languages', () => {
    const keys = (value: unknown, prefix = ''): string[] =>
      typeof value === 'object' && value !== null
        ? Object.entries(value).flatMap(([k, v]) => [
            prefix + k,
            ...keys(v, `${prefix}${k}.`),
          ])
        : []
    expect(keys(garageFi).sort()).toEqual(keys(garageEn).sort())
  })

  it('gives the nav entry a label in both languages', () => {
    expect(commonEn.nav.garage).toBeTruthy()
    expect(commonFi.nav.garage).toBeTruthy()
  })

  it('keeps the courses page pointing at the garage in both languages', () => {
    // `BikeManager` shrank to a picker that links out (issue #64). Its link
    // needs a label, or the way out of the dialog is a blank button.
    expect(coursesEn.bikes.openGarage).toBeTruthy()
    expect(coursesFi.bikes.openGarage).toBeTruthy()
  })
})
