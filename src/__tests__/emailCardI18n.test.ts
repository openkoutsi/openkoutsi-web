import { describe, expect, it } from 'vitest'

import appEn from '../../messages/en/app.json'
import appFi from '../../messages/fi/app.json'
import authEn from '../../messages/en/auth.json'
import authFi from '../../messages/fi/auth.json'

// Keys consumed by EmailCard (issue #62) — a locale that drifts here shows a
// raw message id on the profile page instead of copy.
const EMAIL_KEYS = [
  'title',
  'current',
  'none',
  'usernameOnly',
  'changeDesc',
  'setDesc',
  'changeBtn',
  'setBtn',
  'dialogTitle',
  'dialogTitleSet',
  'dialogDesc',
  'newLabel',
  'newPlaceholder',
  'passwordLabel',
  'passwordPlaceholder',
  'passwordHint',
  'submit',
  'sending',
  'requestedTitle',
  'requestedDesc',
  'requestFailed',
  'pending',
  'pendingHint',
  'cancel',
  'cancelling',
  'cancelled',
] as const

// Keys consumed by the confirm-email-change page, which a user reaches from a
// link in their mailbox — a missing key here is the first thing they see.
const CONFIRM_KEYS = [
  'confirmingTitle',
  'confirmingDesc',
  'successTitle',
  'successDesc',
  'errorTitle',
  'missingDesc',
  'errorHelp',
  'failed',
  'backToSignIn',
] as const

// Placeholders are part of the contract: a locale that drops one renders the
// literal braces, and one that renames it renders nothing.
const PLACEHOLDERS: Record<string, string> = {
  usernameOnly: 'username',
  pending: 'email',
}

describe('email address i18n', () => {
  it('defines every profile-card key in both locales', () => {
    for (const key of EMAIL_KEYS) {
      expect(appEn.profile.email, `en.profile.email.${key}`).toHaveProperty(key)
      expect(appFi.profile.email, `fi.profile.email.${key}`).toHaveProperty(key)
    }
  })

  it('defines every confirmation-page key in both locales', () => {
    for (const key of CONFIRM_KEYS) {
      expect(authEn.confirmEmailChange, `en.confirmEmailChange.${key}`).toHaveProperty(key)
      expect(authFi.confirmEmailChange, `fi.confirmEmailChange.${key}`).toHaveProperty(key)
    }
  })

  it('keeps the interpolation placeholders in both locales', () => {
    for (const [key, placeholder] of Object.entries(PLACEHOLDERS)) {
      const en = (appEn.profile.email as Record<string, string>)[key]
      const fi = (appFi.profile.email as Record<string, string>)[key]
      expect(en, `en.profile.email.${key}`).toContain(`{${placeholder}}`)
      expect(fi, `fi.profile.email.${key}`).toContain(`{${placeholder}}`)
    }
  })

  it('has no untranslated copy left in the Finnish locale', () => {
    // Placeholder-only values would pass the key checks above while showing
    // English on a Finnish page.
    for (const key of EMAIL_KEYS) {
      const en = (appEn.profile.email as Record<string, string>)[key]
      const fi = (appFi.profile.email as Record<string, string>)[key]
      if (key === 'newPlaceholder') continue // an example address, not prose
      expect(fi, `fi.profile.email.${key} still reads as English`).not.toBe(en)
    }
  })
})
