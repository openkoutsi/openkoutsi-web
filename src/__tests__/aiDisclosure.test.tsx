import { describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { render, screen } from '@testing-library/react'

import commonEn from '../../messages/en/common.json'
import commonFi from '../../messages/fi/common.json'

// A translator that echoes keys, matching the other component tests here.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { AiDisclosure } from '@/components/AiDisclosure'

describe('AiDisclosure', () => {
  it('renders the label and the notice together', () => {
    render(h(AiDisclosure))
    expect(screen.getByText('llm.aiGenerated.label')).toBeInTheDocument()
    expect(screen.getByText(/llm\.aiGenerated\.notice/)).toBeInTheDocument()
  })

  it('is exposed to assistive technology as a note', () => {
    // The disclosure is small, muted print next to the coaching prose. Without
    // a role a screen-reader user gets the model's text with no hint that a
    // model wrote it — the exact gap issue #41 is about.
    render(h(AiDisclosure))
    expect(screen.getByRole('note')).toBeInTheDocument()
  })

  it('passes extra classes through for per-surface spacing', () => {
    render(h(AiDisclosure, { className: 'mt-3' }))
    expect(screen.getByRole('note')).toHaveClass('mt-3')
  })
})

describe('AI disclosure i18n', () => {
  it('defines the disclosure copy in both locales', () => {
    for (const messages of [commonEn, commonFi]) {
      expect(messages.llm).toHaveProperty('aiGenerated')
      expect(messages.llm.aiGenerated.label).toBeTruthy()
      expect(messages.llm.aiGenerated.notice).toBeTruthy()
    }
  })

  it('keeps the llm block structurally identical across locales', () => {
    expect(Object.keys(commonFi.llm).sort()).toEqual(Object.keys(commonEn.llm).sort())
  })

  it('names the generating system, not just "AI"', () => {
    // "AI-assisted" or a bare sparkle icon is what the EU rules are meant to
    // rule out: the reader has to be able to tell a machine wrote the text.
    expect(commonEn.llm.aiGenerated.notice.toLowerCase()).toContain('large language model')
    expect(commonFi.llm.aiGenerated.notice.toLowerCase()).toContain('kielimalli')
  })

  it('warns that the output can be wrong', () => {
    expect(commonEn.llm.aiGenerated.notice.toLowerCase()).toContain('can be wrong')
    expect(commonFi.llm.aiGenerated.notice.toLowerCase()).toContain('virheellinen')
  })
})
