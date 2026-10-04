import { describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { ChatMessage, ChatProposal, PlanProposalSummary } from '@/lib/types'

// Echoing translator, matching the other component tests here. `has` reports
// every key as present so the fallback branches are exercised separately below.
//
// Keys come back relative to the *message file* rather than to the namespace
// asked for, so `useTranslations('chat.proposal')('decline')` echoes
// `proposal.decline` — which is what the key is called in `messages/en/chat.json`
// and therefore what these assertions can be read against. Without that, a
// component reaching for a sub-namespace would echo bare `decline` and the test
// would be pinning a string that exists nowhere.
const MESSAGE_FILES = ['common.llm', 'common', 'chat']

vi.mock('next-intl', () => {
  const translator = (namespace?: string) => {
    let prefix = namespace ? `${namespace}.` : ''
    for (const file of MESSAGE_FILES) {
      if (namespace === file) {
        prefix = ''
        break
      }
      if (namespace?.startsWith(`${file}.`)) {
        prefix = `${namespace.slice(file.length + 1)}.`
        break
      }
    }
    return Object.assign((key: string) => `${prefix}${key}`, {
      has: (key: string) => !key.includes('__missing__'),
      raw: (key: string) => [`${prefix}${key}`],
    })
  }
  return { useTranslations: translator }
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

function summary(partial: Partial<PlanProposalSummary> = {}): PlanProposalSummary {
  return {
    kind: 'create_plan',
    built_by: 'llm',
    fallback_reason: null,
    plan_name: 'October gran fondo build',
    goal: 'Hilly gran fondo',
    start_date: '2026-09-01',
    end_date: '2026-10-26',
    weeks: 8,
    weekly: [
      { week_number: 1, week_type: 'build', sessions: 4, total_load: 310, total_duration_min: 360 },
      { week_number: 2, week_type: 'recovery', sessions: 3, total_load: 210, total_duration_min: 240 },
    ],
    first_week: [
      { day_of_week: 1, workout_type: 'rest', description: null, duration_min: null, target_load: null },
      { day_of_week: 2, workout_type: 'threshold', description: '2x12 min at threshold', duration_min: 60, target_load: 80 },
    ],
    remaining_weeks: 7,
    changes: [],
    target_plan_id: null,
    target_workout_id: null,
    target_date: null,
    target_label: null,
    reopens_plan: false,
    archives: [],
    archives_omitted: 0,
    weeks_omitted: 0,
    stranded_sessions: 0,
    ...partial,
  }
}

function proposal(partial: Partial<ChatProposal> = {}): ChatProposal {
  return {
    id: 'prop-1',
    kind: 'create_plan',
    status: 'pending',
    built_by: 'llm',
    summary: summary(),
    created_at: '2026-08-11T09:00:00Z',
    expires_at: '2026-08-12T09:00:00Z',
    decided_at: null,
    applied_plan_id: null,
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

  it('says so when a draft was attempted but no offer came of it', () => {
    // A refused propose call leaves no proposal, yet the prose may still say
    // "accept the card below". The thread must not leave that standing.
    render(
      h(ChatThread, {
        messages: [
          message({
            content: 'MOOD:knowing\n\nAccept the card below.',
            tool_names: ['get_plan_status', 'propose_plan_change'],
          }),
        ],
      }),
    )
    expect(screen.getByText('noOffer')).toBeInTheDocument()
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

  // ── The offer Koutsi made (issue #72) ─────────────────────────────────────

  it('puts the offer under the answer that describes it, with both answers', () => {
    // The card *is* the prompt. There is no typed "yes" anywhere in the thread,
    // because a typed one would put the decision back inside the very thing
    // being gated — the model can draft, and only this click writes.
    render(
      h(ChatThread, {
        messages: [
          message({
            content: 'MOOD:knowing\n\nEight weeks for October.',
            proposal: proposal(),
          }),
        ],
      }),
    )
    expect(screen.getByText('proposal.approve.create_plan')).toBeInTheDocument()
    expect(screen.getByText('proposal.decline')).toBeInTheDocument()
    expect(screen.getByText('proposal.nothingYet')).toBeInTheDocument()
    expect(screen.getByText('October gran fondo build')).toBeInTheDocument()
  })

  it('names the plans an approval would archive, as an alert', () => {
    // The load-bearing bit of the card: creating a plan files away every active
    // plan whose dates overlap it. A yes given without seeing this is not
    // consent to what actually happens.
    render(
      h(ChatThread, {
        messages: [
          message({
            content: 'MOOD:knowing\n\nDone.',
            proposal: proposal({
              summary: summary({
                archives: [
                  {
                    plan_id: 'plan-spring',
                    name: 'Summer maintenance',
                    start_date: '2026-06-01',
                    end_date: '2026-10-04',
                  },
                ],
              }),
            }),
          }),
        ],
      }),
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('proposal.archiveTitle')
    expect(alert).toHaveTextContent('Summer maintenance')
    // And the recovery path, so the warning does not read as final.
    expect(alert).toHaveTextContent('proposal.archiveUndo')
  })

  it('shows no archive warning when an approval would file nothing away', () => {
    render(
      h(ChatThread, {
        messages: [message({ content: 'MOOD:knowing\n\nDone.', proposal: proposal() })],
      }),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    ['applied', 'proposal.status.applied'],
    ['declined', 'proposal.status.declined'],
    ['expired', 'proposal.status.expired'],
    ['superseded', 'proposal.status.superseded'],
  ] as const)('renders a %s offer as settled, with no buttons', (status, key) => {
    // A turn that carried an offer should still read as one afterwards — and an
    // offer that has lapsed must not sit there looking live.
    render(
      h(ChatThread, {
        messages: [
          message({
            content: 'MOOD:knowing\n\nDone.',
            proposal: proposal({ status }),
          }),
        ],
      }),
    )
    expect(screen.getByText(key)).toBeInTheDocument()
    expect(screen.queryByText('proposal.approve.create_plan')).not.toBeInTheDocument()
    expect(screen.queryByText('proposal.decline')).not.toBeInTheDocument()
  })

  it('sends the athlete to the plan once they have accepted', () => {
    render(
      h(ChatThread, {
        messages: [
          message({
            content: 'MOOD:knowing\n\nDone.',
            proposal: proposal({ status: 'applied', applied_plan_id: 'plan-9' }),
          }),
        ],
      }),
    )
    expect(screen.getByText('proposal.openPlan')).toHaveAttribute('href', '/plan')
  })

  it('reports the decision with the turn it belongs to', async () => {
    const onDecide = vi.fn()
    render(
      h(ChatThread, {
        messages: [
          message({ id: 'answer-1', content: 'MOOD:knowing\n\nDone.', proposal: proposal() }),
        ],
        onDecide,
      }),
    )
    await userEvent.click(screen.getByText('proposal.approve.create_plan'))
    expect(onDecide).toHaveBeenCalledWith('answer-1', 'approve')
    await userEvent.click(screen.getByText('proposal.decline'))
    expect(onDecide).toHaveBeenCalledWith('answer-1', 'decline')
  })

  it('keeps an older offer answerable after a follow-up question', () => {
    // Unlike retry, which only ever acts on the newest turn: an athlete who
    // asked "what would that do to my Saturdays?" before deciding must still be
    // able to come back and click yes. The backend agrees — a proposal is
    // superseded only by another proposal, never by an ordinary question.
    const onDecide = vi.fn()
    render(
      h(ChatThread, {
        messages: [
          message({ id: 'answer-1', content: 'MOOD:knowing\n\nEight weeks.', proposal: proposal() }),
          message({ role: 'user', status: null, content: 'What about my Saturdays?' }),
          message({ content: 'MOOD:knowing\n\nThey stay long.' }),
        ],
        onDecide,
      }),
    )
    expect(screen.getByText('proposal.approve.create_plan')).toBeInTheDocument()
  })

  it('does not ask for a decision while the answer is still being written', () => {
    // A card under a half-written answer would be asking the athlete to decide
    // on something still being explained to them.
    render(
      h(ChatThread, {
        messages: [
          message({ status: 'pending', content: 'MOOD:knowing\n\nEight we', proposal: proposal() }),
        ],
      }),
    )
    expect(screen.queryByText('proposal.approve.create_plan')).not.toBeInTheDocument()
  })

  it('warns that shortening a plan leaves sessions that still score as missed', () => {
    // The write matches what the plan page has always done, so this is not a
    // new hazard — but a card showing "4 weeks → 1" and nothing else would let
    // the athlete find out afterwards why their adherence fell, which is the
    // uninformed yes the whole card exists to prevent.
    render(
      h(ChatThread, {
        messages: [
          message({
            content: 'MOOD:knowing\n\nOne week it is.',
            proposal: proposal({
              kind: 'update_plan',
              summary: summary({
                kind: 'update_plan',
                changes: [{ field: 'weeks', before: '4', after: '1' }],
                stranded_sessions: 2,
                weekly: [],
                first_week: [],
                remaining_weeks: 0,
              }),
            }),
          }),
        ],
      }),
    )
    expect(screen.getByText('proposal.stranded')).toBeInTheDocument()
  })

  it('says nothing about stranded sessions when a change strands none', () => {
    render(
      h(ChatThread, {
        messages: [message({ content: 'MOOD:knowing\n\nDone.', proposal: proposal() })],
      }),
    )
    expect(screen.queryByText('proposal.stranded')).not.toBeInTheDocument()
  })

  it('says when the weeks came from the builder rather than from Koutsi', () => {
    // A fallback is a different thing to be offered, not a worse version of the
    // same thing, so the card says so rather than passing it off.
    render(
      h(ChatThread, {
        messages: [
          message({
            content: 'MOOD:knowing\n\nDone.',
            proposal: proposal({
              built_by: 'rule_based',
              summary: summary({ built_by: 'rule_based', fallback_reason: 'x' }),
            }),
          }),
        ],
      }),
    )
    expect(screen.getByText('proposal.ruleBased')).toBeInTheDocument()
  })

  it('shows a change as the fields it would move', () => {
    render(
      h(ChatThread, {
        messages: [
          message({
            content: 'MOOD:knowing\n\nThursday, easier.',
            proposal: proposal({
              kind: 'update_workout',
              summary: summary({
                kind: 'update_workout',
                plan_name: 'Spring base',
                target_label: "Thursday's threshold",
                changes: [{ field: 'duration_min', before: '75', after: '55' }],
                weekly: [],
                first_week: [],
                remaining_weeks: 0,
              }),
            }),
          }),
        ],
      }),
    )
    expect(screen.getByText('proposal.title.update_workout')).toBeInTheDocument()
    expect(screen.getByText('proposal.field.duration_min')).toBeInTheDocument()
    expect(screen.getByText('proposal.changeArrow')).toBeInTheDocument()
    expect(screen.getByText('proposal.approve.update_workout')).toBeInTheDocument()
  })

  it('does not offer the plan link beside a card that already leads somewhere', () => {
    // Two next steps under one turn, one of which invites the athlete to go and
    // do by hand the thing they are being asked to approve.
    render(
      h(ChatThread, {
        messages: [
          message({
            content: 'MOOD:knowing\n\nDone.',
            tool_names: ['get_plan_status', 'propose_training_plan'],
            proposal: proposal(),
          }),
        ],
      }),
    )
    expect(screen.queryByText('planLink')).not.toBeInTheDocument()
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
