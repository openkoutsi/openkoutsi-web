import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import en from '../../messages/en/dashboard.json'
import fi from '../../messages/fi/dashboard.json'

/** Series names rendered in the fitness chart's legend and tooltip. */
const SERIES_KEYS = [
  ['metrics', 'fitness'],
  ['metrics', 'fatigue'],
  ['metrics', 'form'],
  ['chart', 'load'],
  ['chart', 'plannedLoad'],
  ['chart', 'fitnessProjected'],
  ['chart', 'fatigueProjected'],
  ['chart', 'formProjected'],
] as const

const chartSource = readFileSync(
  resolve(__dirname, '../components/charts/FitnessChart.tsx'),
  'utf8',
)

describe('fitness chart i18n', () => {
  it('names every series in both locales', () => {
    for (const [group, key] of SERIES_KEYS) {
      expect(en[group], `en.${group}.${key}`).toHaveProperty(key)
      expect(fi[group], `fi.${group}.${key}`).toHaveProperty(key)
    }
  })

  it('keeps the chart block structurally identical across locales', () => {
    expect(Object.keys(fi.chart).sort()).toEqual(Object.keys(en.chart).sort())
  })

  it('translates the Finnish series names rather than copying the English ones', () => {
    for (const [group, key] of SERIES_KEYS) {
      const enValue = (en[group] as Record<string, string>)[key]
      const fiValue = (fi[group] as Record<string, string>)[key]
      expect(fiValue, `fi.${group}.${key}`).not.toBe(enValue)
    }
  })

  it('takes no series name as a literal string', () => {
    // Recharts takes the legend label from each series' `name` prop, so a
    // literal there shows English inside an otherwise Finnish dashboard — the
    // bug this test guards. Every `name` must come from a translation call.
    const literals = chartSource.match(/name="[^"]*"/g) ?? []
    expect(literals).toEqual([])
  })
})
