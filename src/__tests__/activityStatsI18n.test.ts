import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import en from '../../messages/en/activities.json'
import fi from '../../messages/fi/activities.json'

const pageSource = readFileSync(
  resolve(__dirname, '../app/[locale]/(session)/(app)/activities/[id]/page.tsx'),
  'utf8',
)

/** The `detail.stats.*` keys the summary tiles actually ask for. */
function referencedStatKeys(): string[] {
  const matches = pageSource.matchAll(/t\('detail\.stats\.(\w+)'\)/g)
  return [...new Set([...matches].map((m) => m[1]))]
}

describe('activity summary tiles i18n', () => {
  it('labels every tile the page renders, in both locales', () => {
    const keys = referencedStatKeys()
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) {
      expect(en.detail.stats, `en.detail.stats.${key}`).toHaveProperty(key)
      expect(fi.detail.stats, `fi.detail.stats.${key}`).toHaveProperty(key)
    }
  })

  it('shows average speed among them', () => {
    // The tile is the point of the field: `avg_speed_ms` reaching the client is
    // invisible unless the summary asks for it by name.
    expect(referencedStatKeys()).toContain('avgSpeed')
  })

  it('keeps the stats block structurally identical across locales', () => {
    expect(Object.keys(fi.detail.stats).sort()).toEqual(
      Object.keys(en.detail.stats).sort(),
    )
  })

  it('translates the Finnish labels rather than copying the English ones', () => {
    const enStats = en.detail.stats as Record<string, string>
    const fiStats = fi.detail.stats as Record<string, string>
    for (const key of Object.keys(enStats)) {
      expect(fiStats[key], `fi.detail.stats.${key}`).not.toBe(enStats[key])
    }
  })
})
