import { describe, expect, it } from 'vitest'

import adminEn from '../../messages/en/admin.json'
import adminFi from '../../messages/fi/admin.json'

// Keys consumed by the MCP instance switch in the admin Settings tab (issue
// #42). A locale that drifts here shows a raw message id where an admin is
// deciding whether AI clients may reach their users' training data — the worst
// possible place for untranslated copy.
const MCP_SETTINGS_KEYS = [
  'allowMcp',
  'allowMcpDesc',
  // Shown only while the switch is off: the endpoint is refused outright,
  // handshake included.
  'allowMcpWarning',
  // Shown only while the switch is on but personal access tokens are off, when
  // the endpoint is published and nothing can hold a credential for it.
  'allowMcpNeedsTokens',
] as const

describe('MCP server toggle i18n', () => {
  it('defines every MCP settings key in both locales', () => {
    for (const key of MCP_SETTINGS_KEYS) {
      expect(adminEn.settings, `en.settings.${key}`).toHaveProperty(key)
      expect(adminFi.settings, `fi.settings.${key}`).toHaveProperty(key)
    }
  })

  it('keeps the admin settings block structurally identical across locales', () => {
    expect(Object.keys(adminFi.settings).sort()).toEqual(
      Object.keys(adminEn.settings).sort(),
    )
  })

  it('describes the endpoint as read-only rather than as access', () => {
    // The switch withdraws an interface, not an exposure — a token reaches the
    // same data over REST either way. Copy that implies otherwise would tell a
    // self-hoster they had closed a door they have not closed.
    const desc = adminEn.settings.allowMcpDesc.toLowerCase()
    expect(desc).toContain('read-only')
    const warning = adminEn.settings.allowMcpWarning.toLowerCase()
    expect(warning).toContain('not an exposure')
  })
})
