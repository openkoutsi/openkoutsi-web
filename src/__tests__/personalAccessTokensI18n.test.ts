import { describe, expect, it } from 'vitest'

import appEn from '../../messages/en/app.json'
import appFi from '../../messages/fi/app.json'
import adminEn from '../../messages/en/admin.json'
import adminFi from '../../messages/fi/admin.json'

// Keys consumed by PersonalAccessTokensCard (issue #46) — a locale that drifts
// here shows a raw message id in the settings page instead of copy.
const TOKEN_KEYS = [
  'title',
  'desc',
  'create',
  'createTitle',
  'createSubmit',
  'creating',
  'createFailed',
  'createdTitle',
  'copyOnce',
  'copyOnceWarning',
  'copy',
  'copied',
  'done',
  'name',
  'namePlaceholder',
  'scopes',
  'scopesDesc',
  'sensitiveScopes',
  'exportWarning',
  'expiry',
  'expiryDesc',
  'days',
  'active',
  'inactive',
  'empty',
  'expiresOn',
  'expiredOn',
  'revokedOn',
  'lastUsed',
  'neverUsed',
  'revoke',
  'revoked',
  'revokeFailed',
  'revokeConfirmTitle',
  'revokeConfirmDesc',
  'cancel',
] as const

// Keys consumed by the admin console's per-user token dialog and the instance
// toggle beside `allow_self_signup`.
const ADMIN_USER_KEYS = [
  'tokens',
  'tokensTitle',
  'tokensDesc',
  'tokensEmpty',
  'tokenStatus',
  'tokenCreated',
  'tokenExpires',
  'tokenLastUsed',
  'tokenNeverUsed',
  'tokenRevoke',
  'tokenRevoked',
  'tokenRevokeFailed',
  'tokenRevokeConfirmTitle',
  'tokenRevokeConfirmDesc',
] as const

const ADMIN_SETTINGS_KEYS = [
  'allowTokens',
  'allowTokensDesc',
  'allowTokensWarning',
] as const

describe('personal access tokens i18n', () => {
  it('defines every settings-card key in both locales', () => {
    for (const key of TOKEN_KEYS) {
      expect(appEn.settings.tokens, `en.settings.tokens.${key}`).toHaveProperty(key)
      expect(appFi.settings.tokens, `fi.settings.tokens.${key}`).toHaveProperty(key)
    }
  })

  it('defines the expiry-email opt-out in both locales', () => {
    for (const key of ['patExpiryEmails', 'patExpiryEmailsDesc']) {
      expect(appEn.settings.analysis, `en.${key}`).toHaveProperty(key)
      expect(appFi.settings.analysis, `fi.${key}`).toHaveProperty(key)
    }
  })

  it('defines every admin token key in both locales', () => {
    for (const key of ADMIN_USER_KEYS) {
      expect(adminEn.users, `en.users.${key}`).toHaveProperty(key)
      expect(adminFi.users, `fi.users.${key}`).toHaveProperty(key)
    }
    for (const key of ADMIN_SETTINGS_KEYS) {
      expect(adminEn.settings, `en.settings.${key}`).toHaveProperty(key)
      expect(adminFi.settings, `fi.settings.${key}`).toHaveProperty(key)
    }
  })

  it('translates every token status the API can return', () => {
    for (const status of ['active', 'expired', 'revoked']) {
      expect(adminEn.users.tokenStatus).toHaveProperty(status)
      expect(adminFi.users.tokenStatus).toHaveProperty(status)
    }
  })

  it('keeps the two locales structurally identical', () => {
    expect(Object.keys(appFi.settings.tokens).sort()).toEqual(
      Object.keys(appEn.settings.tokens).sort(),
    )
  })

  it('offers no "never expires" option anywhere in the copy', () => {
    // The lifetimes come from the API, but the surrounding copy must not
    // promise something the server refuses to issue.
    const blob = JSON.stringify(appEn.settings.tokens).toLowerCase()
    expect(blob).not.toContain('never expires')
    expect(blob).toContain('every token expires')
  })
})
