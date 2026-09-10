import { describe, expect, it } from 'vitest'

import adminEn from '../../messages/en/admin.json'
import adminFi from '../../messages/fi/admin.json'

// Keys consumed by the Usage tab's three new cards (issue #66). A locale that
// drifts here shows a raw message id on the panel an admin reads to decide
// whether a big import is safe to start.
const QUOTA_KEYS = [
  'title', 'desc', 'empty',
  // Staleness: headroom is a *now* number that is only as fresh as our last
  // call, so the age travels with it and "never called" is its own answer.
  'noObservation', 'observed', 'neverCalled', 'noQuotaPublished',
  'ageSeconds', 'ageMinutes', 'ageHours', 'ageDays',
  // Window rollover: the label that stops the panel reporting last window's
  // number against a window that is actually empty.
  'windowReset',
  'usedOfLimit', 'remaining', 'resetsAt', 'lastThrottled',
  'window', 'scope',
] as const

const API_KEYS = [
  'title', 'desc', 'empty', 'calls', 'ok', 'errors', 'throttled', 'avgMs', 'group',
] as const

const WEBHOOK_KEYS = [
  'title', 'desc', 'empty', 'count', 'provider', 'outcome',
  // An unreachable bridge is named rather than counted as zero.
  'unavailable',
  'group', 'outcomes',
] as const

const API_GROUPS = [
  'service', 'endpoint', 'status', 'outcome', 'user', 'day', 'week', 'month',
] as const
const WEBHOOK_GROUPS = ['day', 'week', 'month', 'provider', 'outcome'] as const
// Every outcome the two bridges can write. A missing one renders a raw id in
// the table rather than a word.
const WEBHOOK_OUTCOMES = [
  'accepted', 'duplicate', 'ignored', 'rejected', 'verification', 'unknown',
] as const

describe('third-party API usage i18n', () => {
  it('defines every quota-headroom key in both locales', () => {
    for (const key of QUOTA_KEYS) {
      expect(adminEn.usage.quota, `en.usage.quota.${key}`).toHaveProperty(key)
      expect(adminFi.usage.quota, `fi.usage.quota.${key}`).toHaveProperty(key)
    }
  })

  it('defines every API-usage key in both locales', () => {
    for (const key of API_KEYS) {
      expect(adminEn.usage.api, `en.usage.api.${key}`).toHaveProperty(key)
      expect(adminFi.usage.api, `fi.usage.api.${key}`).toHaveProperty(key)
    }
  })

  it('defines every webhook-usage key in both locales', () => {
    for (const key of WEBHOOK_KEYS) {
      expect(adminEn.usage.webhooks, `en.usage.webhooks.${key}`).toHaveProperty(key)
      expect(adminFi.usage.webhooks, `fi.usage.webhooks.${key}`).toHaveProperty(key)
    }
  })

  it('covers every group-by option the selects offer', () => {
    for (const g of API_GROUPS) {
      expect(adminEn.usage.api.group, `en api group ${g}`).toHaveProperty(g)
      expect(adminFi.usage.api.group, `fi api group ${g}`).toHaveProperty(g)
    }
    for (const g of WEBHOOK_GROUPS) {
      expect(adminEn.usage.webhooks.group, `en webhook group ${g}`).toHaveProperty(g)
      expect(adminFi.usage.webhooks.group, `fi webhook group ${g}`).toHaveProperty(g)
    }
  })

  it('covers every webhook outcome the bridges can record', () => {
    for (const o of WEBHOOK_OUTCOMES) {
      expect(adminEn.usage.webhooks.outcomes, `en outcome ${o}`).toHaveProperty(o)
      expect(adminFi.usage.webhooks.outcomes, `fi outcome ${o}`).toHaveProperty(o)
    }
  })

  it('names both quota windows and both scopes', () => {
    for (const messages of [adminEn, adminFi]) {
      expect(Object.keys(messages.usage.quota.window).sort()).toEqual(['daily', 'short'])
      // The read quota is shown apart from the overall one: a backfill is all
      // reads, so it is the ceiling that runs out first.
      expect(Object.keys(messages.usage.quota.scope).sort()).toEqual(['overall', 'read'])
    }
  })

  it('keeps the usage block structurally identical across locales', () => {
    expect(Object.keys(adminFi.usage).sort()).toEqual(Object.keys(adminEn.usage).sort())
    expect(Object.keys(adminFi.usage.quota).sort()).toEqual(
      Object.keys(adminEn.usage.quota).sort(),
    )
    expect(Object.keys(adminFi.usage.api).sort()).toEqual(
      Object.keys(adminEn.usage.api).sort(),
    )
    expect(Object.keys(adminFi.usage.webhooks).sort()).toEqual(
      Object.keys(adminEn.usage.webhooks).sort(),
    )
  })

  it('keeps every interpolation placeholder identical across locales', () => {
    // A placeholder that exists in one locale and not the other throws at
    // render time in next-intl, so a mismatch is a crash rather than odd copy.
    const placeholders = (s: string) =>
      (s.match(/\{(\w+)\}/g) ?? []).sort()

    for (const section of ['quota', 'api', 'webhooks'] as const) {
      const en = adminEn.usage[section] as Record<string, unknown>
      const fi = adminFi.usage[section] as Record<string, unknown>
      for (const [key, value] of Object.entries(en)) {
        if (typeof value !== 'string') continue
        expect(placeholders(fi[key] as string), `${section}.${key}`).toEqual(
          placeholders(value),
        )
      }
    }
  })

  it('states plainly that a reset window shows zero', () => {
    // The single most misleading thing this panel could do is show last
    // window's usage against a window that has since emptied.
    expect(adminEn.usage.quota.windowReset.toLowerCase()).toContain('reset')
    expect(adminEn.usage.quota.windowReset).toContain('0')
  })

  it('says the quota belongs to the application, not the athlete', () => {
    // One athlete's backfill throttles everyone on the instance; an admin
    // reading this panel needs to know that before blaming a user.
    expect(adminEn.usage.quota.desc.toLowerCase()).toContain('application')
  })
})
