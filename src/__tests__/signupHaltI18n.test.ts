import { describe, expect, it } from 'vitest'

import adminEn from '../../messages/en/admin.json'
import adminFi from '../../messages/fi/admin.json'
import authEn from '../../messages/en/auth.json'
import authFi from '../../messages/fi/auth.json'

// The admin console: the switch, its caveat, and the reason field.
const ADMIN_KEYS = [
  'signupsHalted',
  'signupsHaltedDesc',
  'signupsHaltedWarning',
  'signupHaltReason',
  'signupHaltReasonDesc',
  'signupHaltReasonPlaceholder',
] as const

// The page a would-be user lands on.
const AUTH_KEYS = ['onHoldTitle', 'onHoldDesc', 'onHoldReason', 'onHoldContact'] as const

describe('signup halt i18n', () => {
  it('defines every admin settings key in both locales', () => {
    for (const key of ADMIN_KEYS) {
      expect(adminEn.settings, `en.settings.${key}`).toHaveProperty(key)
      expect(adminFi.settings, `fi.settings.${key}`).toHaveProperty(key)
    }
  })

  it('defines every sign-up page key in both locales', () => {
    for (const key of AUTH_KEYS) {
      expect(authEn.signup, `en.signup.${key}`).toHaveProperty(key)
      expect(authFi.signup, `fi.signup.${key}`).toHaveProperty(key)
    }
  })

  it('keeps both blocks structurally identical across locales', () => {
    expect(Object.keys(adminFi.settings).sort()).toEqual(Object.keys(adminEn.settings).sort())
    expect(Object.keys(authFi.signup).sort()).toEqual(Object.keys(authEn.signup).sort())
  })

  it('actually translates the Finnish copy', () => {
    for (const key of ADMIN_KEYS) {
      const en = (adminEn.settings as Record<string, string>)[key]
      const fi = (adminFi.settings as Record<string, string>)[key]
      expect(fi, `fi.settings.${key} is still the English string`).not.toBe(en)
    }
    for (const key of AUTH_KEYS) {
      const en = (authEn.signup as Record<string, string>)[key]
      const fi = (authFi.signup as Record<string, string>)[key]
      expect(fi, `fi.signup.${key} is still the English string`).not.toBe(en)
    }
  })

  it('tells the admin the reason is shown to visitors', () => {
    // The field is published unauthenticated. If this copy ever stops saying
    // so, an admin will eventually put something private in it.
    const desc = adminEn.settings.signupHaltReasonDesc.toLowerCase()
    expect(desc).toMatch(/public|anyone|visitor/)
  })

  it('tells the admin what the pause does not stop', () => {
    // Invitations still redeem and emailed verification links still activate.
    // An admin who believes otherwise is surprised by the next invited user.
    const warning = adminEn.settings.signupsHaltedWarning.toLowerCase()
    expect(warning).toContain('invitation')
    expect(warning).toContain('verification link')
  })

  it('says the pause is temporary rather than a withdrawal', () => {
    // The whole reason this is a second switch and not a flipped policy flag.
    expect(authEn.signup.onHoldDesc.toLowerCase()).toContain('temporary')
    expect(authEn.signup.onHoldDesc).not.toBe(authEn.signup.unavailableDesc)
  })
})
