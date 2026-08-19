import { describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { render, screen } from '@testing-library/react'

// Echoing translator, matching the other component tests here.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { Composer } from '@/components/chat/Composer'

function composer(props: Partial<Parameters<typeof Composer>[0]> = {}) {
  return h(Composer, { onSend: vi.fn(), maxChars: 4000, ...props })
}

describe('Composer notices', () => {
  it('states the AI disclosure once for the whole thread', () => {
    // Issue #41's per-block placement makes a footnote of it on the surfaces
    // that show one answer; in a conversation it stacked under every turn. Here
    // it is one standing line, which is also the one place it cannot scroll away
    // from the answers it applies to.
    render(composer({ isFirstMessage: false }))
    expect(screen.getAllByText('llm.aiGenerated.label')).toHaveLength(1)
  })

  it('withholds it until there is a turn to label', () => {
    // The copy is about text that exists — "Written by a large language model" —
    // and an empty thread has none for it to be about.
    render(composer({ isFirstMessage: true }))
    expect(screen.queryByText('llm.aiGenerated.label')).not.toBeInTheDocument()
  })

  it('keeps the medical boundary standing in both states', () => {
    // Unlike the AI label this one is true before anything is typed, which is
    // when someone deciding whether to ask about a chest pain reads it.
    const { unmount } = render(composer({ isFirstMessage: true }))
    expect(screen.getByText('boundary')).toBeInTheDocument()
    unmount()

    render(composer({ isFirstMessage: false }))
    expect(screen.getByText('boundary')).toBeInTheDocument()
  })

  it('exposes the two as separate notes, not one merged disclaimer', () => {
    // They are different claims — a machine wrote this, and this machine is not
    // a doctor — so a screen reader gets them as two notes rather than a single
    // run-on the second half of which is easy to miss.
    render(composer({ isFirstMessage: false }))
    const notes = screen.getAllByRole('note')
    expect(notes).toHaveLength(2)
    expect(notes[0]).toHaveTextContent('llm.aiGenerated.label')
    expect(notes[1]).toHaveTextContent('boundary')
  })
})
