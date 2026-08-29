import { describe, expect, it } from 'vitest'

import adminEn from '../../messages/en/admin.json'
import adminFi from '../../messages/fi/admin.json'

// Keys consumed by the admin console's per-row email confirmation badge. A
// locale that drifts here shows a raw message id in the users table instead of
// a status — worse than no badge, since the row then says nothing legible about
// an account that may not be able to sign in.
const KEYS = ['emailConfirmed', 'emailConfirmedOn', 'emailUnconfirmed'] as const

describe('admin email confirmation i18n', () => {
  it('defines every badge key in both locales', () => {
    for (const key of KEYS) {
      expect(adminEn.users, `en.users.${key}`).toHaveProperty(key)
      expect(adminFi.users, `fi.users.${key}`).toHaveProperty(key)
    }
  })

  it('keeps the {date} placeholder the badge title passes', () => {
    // Dropped in one locale, the tooltip silently loses the confirmation date.
    expect(adminEn.users.emailConfirmedOn).toContain('{date}')
    expect(adminFi.users.emailConfirmedOn).toContain('{date}')
  })

  it('keeps the two locales structurally identical', () => {
    expect(Object.keys(adminFi.users).sort()).toEqual(
      Object.keys(adminEn.users).sort(),
    )
  })
})
