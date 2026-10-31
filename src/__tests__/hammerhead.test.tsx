import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { render, screen } from '@testing-library/react'

/**
 * Hammerhead (Karoo) in the web app (openkoutsi#69). One-way, like Strava and
 * Wahoo: it appears wherever a provider does, and nothing in the app sends
 * anything back to it.
 */

import { SourceBadge } from '@/components/activities/SourceBadge'
import appEn from '../../messages/en/app.json'
import appFi from '../../messages/fi/app.json'

describe('SourceBadge', () => {
  it('names Hammerhead', () => {
    render(h(SourceBadge, { sources: ['hammerhead'] }))
    expect(screen.getByText('Hammerhead')).toBeTruthy()
  })
})

describe('declined consent', () => {
  it.each([['en', appEn], ['fi', appFi]] as const)('has a sentence in %s', (_lang, app) => {
    expect(app.profile.providerDenied).toContain('{name}')
  })
})
