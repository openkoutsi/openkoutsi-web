import { describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { render, screen } from '@testing-library/react'

import type { ChatMessage } from '@/lib/types'

// Echoing translator, matching the other component tests here. `has` reports
// every key as present so the fallback branches are exercised separately below.
vi.mock('next-intl', () => {
  const t = Object.assign((key: string) => key, {
    has: (key: string) => !key.includes('__missing__'),
    raw: (key: string) => [key],
  })
  return { useTranslations: () => t }
})

vi.mock('@/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) =>
    h('a', { href }, children),
}))

import { ChatThread } from '@/components/chat/ChatThread'

let counter = 0
function message(partial: Partial<ChatMessage>): ChatMessage {
  return {
    id: `m${counter++}`,
    role: 'assistant',
    content: '',
    status: 'complete',
    created_at: '2026-08-11T09:00:00Z',
    ...partial,
  }
}

describe('ChatThread', () => {
  it('shows the athlete their own question immediately', () => {
    render(
      h(ChatThread, {
        messages: [message({ role: 'user', status: null, content: 'How is my form?' })],
      }),
    )
    expect(screen.getByText('How is my form?')).toBeInTheDocument()
  })

  it('explains a queued turn as waiting, not as thinking', () => {
    // Queued means no agent slot has been claimed yet, so there is no progress
    // code and nothing is being written. Showing the generic "thinking" line
    // here would claim work that has not started.
    render(h(ChatThread, { messages: [message({ status: 'queued' })] }))
    expect(screen.getByText('status.queued')).toBeInTheDocument()
  })

  it('shows the progress code once the run is gathering', () => {
    render(
      h(ChatThread, {
        messages: [message({ status: 'pending', progress: 'tool.get_training_status' })],
      }),
    )
    expect(
      screen.getByText('progress.tools.get_training_status'),
    ).toBeInTheDocument()
  })

  it('renders a finished answer as bubbles, without the MOOD line', () => {
    render(
      h(ChatThread, {
        messages: [
          message({
            content: 'MOOD:stern\n\nYou missed two sessions.\n\nFix the Tuesday one.',
          }),
        ],
      }),
    )
    expect(screen.getByText('You missed two sessions.')).toBeInTheDocument()
    expect(screen.getByText('Fix the Tuesday one.')).toBeInTheDocument()
    expect(screen.queryByText(/MOOD:/)).not.toBeInTheDocument()
  })

  it('shows each lookup where it happened: above the answer it fed', () => {
    // The loop gathers and *then* writes — prose that turns out to precede a
    // tool call is discarded by the backend as a preamble — so the lookups
    // belong ahead of the answer. As a footer they read as an afterthought
    // about a turn that had apparently answered instantly.
    const { container } = render(
      h(ChatThread, {
        messages: [
          message({
            status: 'complete',
            content: 'MOOD:knowing\n\nDone.',
            tool_names: ['get_training_status', 'get_goal_progress'],
          }),
        ],
      }),
    )
    const steps = screen.getByRole('list')
    expect(steps).toHaveAccessibleName('stepsLabel')
    expect(
      Array.from(steps.querySelectorAll('li')).map((li) => li.textContent),
    ).toEqual([
      'progress.toolLabels.get_training_status',
      'progress.toolLabels.get_goal_progress',
    ])
    // Ahead of the prose in the document, which is the whole point.
    expect(
      steps.compareDocumentPosition(screen.getByText('Done.')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(container).toBeTruthy()
  })

  it('shows the steps already taken while the next one is still running', () => {
    // Without this the timeline is empty for the whole slow part and then three
    // steps land at once with the answer. The running lookup is the live line,
    // not a step: the backend appends its name as soon as it dispatches, so the
    // last entry is the one the progress code is already describing.
    render(
      h(ChatThread, {
        messages: [
          message({
            status: 'pending',
            progress: 'tool.get_goal_progress',
            tool_names: ['get_training_status', 'get_goal_progress'],
          }),
        ],
      }),
    )
    expect(
      Array.from(screen.getByRole('list').querySelectorAll('li')).map(
        (li) => li.textContent,
      ),
    ).toEqual(['progress.toolLabels.get_training_status'])
    expect(screen.getByText('progress.tools.get_goal_progress')).toBeInTheDocument()
  })

  it('counts the last lookup as done once the answer has started', () => {
    // The backend does not clear the progress code when prose starts, so
    // trusting it here would hide the final step for the whole of the answer.
    render(
      h(ChatThread, {
        messages: [
          message({
            status: 'pending',
            progress: 'tool.get_goal_progress',
            content: 'MOOD:knowing\n\nPartial…',
            tool_names: ['get_training_status', 'get_goal_progress'],
          }),
        ],
      }),
    )
    expect(
      Array.from(screen.getByRole('list').querySelectorAll('li')).map(
        (li) => li.textContent,
      ),
    ).toEqual([
      'progress.toolLabels.get_training_status',
      'progress.toolLabels.get_goal_progress',
    ])
  })

  it('keeps the steps a failed turn got through', () => {
    // "It read your plan and then fell over" is a different event from "it never
    // got going", and the athlete deciding whether to retry wants to know which.
    render(
      h(ChatThread, {
        messages: [
          message({ status: 'error', error_code: 'upstream', tool_names: ['get_plan_status'] }),
        ],
      }),
    )
    expect(screen.getByText('progress.toolLabels.get_plan_status')).toBeInTheDocument()
    expect(screen.getByText('errors.upstream')).toBeInTheDocument()
  })

  it('shows no step list at all for a turn that looked nothing up', () => {
    // "What does TSB actually mean?" is answered straight off. An empty list
    // header would invent a gathering phase that never happened.
    render(
      h(ChatThread, {
        messages: [message({ status: 'complete', content: 'MOOD:knowing\n\nIt is form.' })],
      }),
    )
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('links to the plan when the answer consulted it', () => {
    // Koutsi can advise but not act — write tools are deferred by #42 — so the
    // turns that are about the plan hand the athlete somewhere to go.
    render(
      h(ChatThread, {
        messages: [
          message({ content: 'MOOD:knowing\n\nCut Thursday.', tool_names: ['get_plan_status'] }),
        ],
      }),
    )
    expect(screen.getByText('planLink')).toHaveAttribute('href', '/plan')
  })

  it('does not link to the plan when the answer was about something else', () => {
    render(
      h(ChatThread, {
        messages: [
          message({ content: 'MOOD:knowing\n\nYour curve is fine.', tool_names: ['get_power_profile'] }),
        ],
      }),
    )
    expect(screen.queryByText('planLink')).not.toBeInTheDocument()
  })

  it('offers a retry on a failure that could go differently', () => {
    const onRetry = vi.fn()
    render(
      h(ChatThread, { messages: [message({ status: 'error', error_code: 'busy' })], onRetry }),
    )
    expect(screen.getByText('errors.busy')).toBeInTheDocument()
    expect(screen.getByText('retry')).toBeInTheDocument()
  })

  it('does not offer a retry when the model simply cannot do this', () => {
    // `tools_unsupported` is a settled property of the athlete's model, so a
    // retry would fail identically. Offering one would be a lie about the fix.
    const onRetry = vi.fn()
    render(
      h(ChatThread, {
        messages: [message({ status: 'error', error_code: 'tools_unsupported' })],
        onRetry,
      }),
    )
    expect(screen.getByText('errors.tools_unsupported')).toBeInTheDocument()
    expect(screen.queryByText('retry')).not.toBeInTheDocument()
  })

  it('falls back to generic copy for a failure code it does not know', () => {
    // Same contract the progress codes have: the backend can learn a new
    // failure mode without a frontend release, and an older build must not show
    // a raw key at the athlete.
    render(
      h(ChatThread, { messages: [message({ status: 'error', error_code: '__missing__' })] }),
    )
    expect(screen.getByText('errors.unavailable')).toBeInTheDocument()
  })

  it('marks a failed turn as an alert for assistive technology', () => {
    render(h(ChatThread, { messages: [message({ status: 'error', error_code: 'upstream' })] }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('offers retry only on the newest turn', () => {
    // `retry()` in the page always acts on the last message, so a button on an
    // older error bubble would look live and re-run something else. Reachable
    // the ordinary way: fail, then rephrase instead of retrying.
    const onRetry = vi.fn()
    render(
      h(ChatThread, {
        messages: [
          message({ role: 'user', status: null, content: 'first' }),
          message({ status: 'error', error_code: 'upstream' }),
          message({ role: 'user', status: null, content: 'rephrased' }),
          message({ status: 'complete', content: 'MOOD:knowing\n\nHere you go.' }),
        ],
        onRetry,
      }),
    )
    // The old failure is still shown — it is part of the record — but without
    // an action that would do the wrong thing.
    expect(screen.getByText('errors.upstream')).toBeInTheDocument()
    expect(screen.queryByText('retry')).not.toBeInTheDocument()
  })

  it('still offers retry when the failure is the newest turn', () => {
    const onRetry = vi.fn()
    render(
      h(ChatThread, {
        messages: [
          message({ role: 'user', status: null, content: 'q' }),
          message({ status: 'error', error_code: 'upstream' }),
        ],
        onRetry,
      }),
    )
    expect(screen.getByText('retry')).toBeInTheDocument()
  })

  it('leaves the AI disclosure to the composer instead of repeating it', () => {
    // Issue #41 labels Koutsi's prose wherever it is shown, and on the
    // single-block surfaces that is one footnote under one answer. A thread is
    // many blocks: the same sentence under every turn stops being read by the
    // third one, so it stands once by the composer. Nothing else in the thread
    // is a `note` — the lookups are a labelled list and a failure is an alert —
    // so an empty count is the exact assertion.
    render(
      h(ChatThread, {
        messages: [
          message({ role: 'user', status: null, content: 'How is my form?' }),
          message({ status: 'complete', content: 'MOOD:knowing\n\nSharp.' }),
          message({ role: 'user', status: null, content: 'And next week?' }),
          message({ status: 'complete', content: 'MOOD:stern\n\nEasier.' }),
        ],
      }),
    )
    expect(screen.queryAllByRole('note')).toHaveLength(0)
  })
})
