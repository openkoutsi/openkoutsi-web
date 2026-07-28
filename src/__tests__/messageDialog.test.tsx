import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { render, screen } from '@testing-library/react'

import type { Message } from '@/lib/types'

// A minimal translator that echoes keys, so assertions read as key names.
const t = ((key: string) => key) as (k: string) => string

vi.mock('next-intl', () => ({
  useTranslations: () => t,
  useLocale: () => 'en',
}))

vi.mock('@/navigation', () => ({
  Link: ({ children, ...props }: { children?: unknown }) => h('a', props, children as never),
}))

import { MessageDialog } from '@/components/messages/MessageDialog'

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    type: 'achievement_unlocked',
    data: {},
    title: 'Achievement unlocked',
    body: 'You earned Getting started — 1 activity.',
    locale: 'en',
    read_at: null,
    created_at: '2026-07-01T10:00:00Z',
    ...overrides,
  }
}

describe('MessageDialog', () => {
  it('renders nothing when there is no message', () => {
    render(h(MessageDialog, { message: null, onOpenChange: vi.fn() }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the backend-rendered title and body', () => {
    render(h(MessageDialog, { message: message(), onOpenChange: vi.fn() }))
    expect(screen.getByText('Achievement unlocked')).toBeInTheDocument()
    expect(screen.getByText('You earned Getting started — 1 activity.')).toBeInTheDocument()
  })

  it('keeps every line of a multi-badge body', () => {
    const body = 'You earned:\n• Getting started — 1 activity\n• Long hauler — 6 h'
    render(h(MessageDialog, { message: message({ body }), onOpenChange: vi.fn() }))
    // Matched without Testing Library's whitespace normalisation: the newlines
    // are the point — `whitespace-pre-line` is what turns them into lines.
    expect(
      screen.getByText(body, { normalizer: (s) => s }),
    ).toBeInTheDocument()
  })

  it('offers a link to the achievements page for achievement messages', () => {
    render(h(MessageDialog, { message: message(), onOpenChange: vi.fn() }))
    expect(screen.getByText('inbox.viewAchievements')).toBeInTheDocument()
  })

  it('does not offer that link for other message types', () => {
    const m = message({ type: 'invite_used', title: 'Invite used', body: 'ana joined.' })
    render(h(MessageDialog, { message: m, onOpenChange: vi.fn() }))
    expect(screen.queryByText('inbox.viewAchievements')).not.toBeInTheDocument()
  })

  it('names messages that predate messages carrying their own text', () => {
    const m = message({ title: null, body: null, locale: null })
    render(h(MessageDialog, { message: m, onOpenChange: vi.fn() }))
    expect(screen.getByText('inbox.legacy')).toBeInTheDocument()
  })
})
