import { describe, expect, it } from 'vitest'

import chatEn from '../../messages/en/chat.json'
import chatFi from '../../messages/fi/chat.json'
import commonEn from '../../messages/en/common.json'
import commonFi from '../../messages/fi/common.json'
import { REFUSAL_KEYS } from '@/app/[locale]/(session)/(app)/chat/refusals'

/** Codes `backend/app/api/chat.py` raises as `{code, message}` refusals. */
const REFUSAL_CODES = [
  'chat_disabled',
  'chat_tools_unsupported',
  'chat_daily_budget',
  'chat_conversation_budget',
  'chat_turn_in_flight',
  // Answering an offer Koutsi made (issue #72). `proposal_stale` is the one
  // that matters: the backend re-runs every invariant at apply time, so it
  // fires when the athlete's plans moved after the card was drawn.
  'proposal_expired',
  'proposal_decided',
  'proposal_stale',
] as const

/**
 * Error codes `services/llm_agent.py` can put on a failed chat turn, plus the
 * one `settle_stuck_turns` writes.
 *
 * Chat is the only LLM surface with nothing to degrade to, so a failure here is
 * a sentence the athlete reads rather than an invisible fallback — and a missing
 * translation would show a raw key at exactly the moment something has already
 * gone wrong.
 */
const ERROR_CODES = [
  'busy',
  'tools_unsupported',
  'no_answer',
  'upstream',
  'unreachable',
  'stalled',
  // The fallback the UI uses for any code this build predates.
  'unavailable',
] as const

function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  if (Array.isArray(value)) return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    keysOf(v, prefix ? `${prefix}.${k}` : k),
  )
}

describe('chat i18n', () => {
  it('defines a message for every backend error code', () => {
    for (const code of ERROR_CODES) {
      expect(chatEn.errors, `en.errors.${code}`).toHaveProperty(code)
      expect(chatFi.errors, `fi.errors.${code}`).toHaveProperty(code)
    }
  })

  it('keeps the whole namespace structurally identical across locales', () => {
    expect(keysOf(chatFi).sort()).toEqual(keysOf(chatEn).sort())
  })

  it('has a nav label in both locales', () => {
    expect(commonEn.nav).toHaveProperty('chat')
    expect(commonFi.nav).toHaveProperty('chat')
  })

  it('greets and explains what Koutsi can reach, in both locales', () => {
    // What is left of the empty state after the tappable example questions were
    // removed. The structural-parity test above would not catch a locale that
    // kept the keys and emptied the strings.
    for (const chat of [chatEn, chatFi]) {
      expect(chat.empty.greeting.trim()).not.toBe('')
      expect(chat.empty.hint.trim()).not.toBe('')
    }
    // The starters are gone; nothing should reintroduce them on one side only.
    expect(chatEn.empty).not.toHaveProperty('starters')
    expect(chatFi.empty).not.toHaveProperty('starters')
  })

  it('states the medical boundary in both locales', () => {
    // The one piece of copy that is a safety property rather than a nicety.
    // It is a standing notice rather than a per-message marker precisely so it
    // cannot degrade — but that only helps if it says the thing.
    expect(chatEn.boundary.toLowerCase()).toContain('doctor')
    expect(chatEn.boundary.toLowerCase()).toContain('not a clinician')
    expect(chatFi.boundary.toLowerCase()).toContain('lääkäri')
  })

  it('explains the queued state as waiting rather than as an error', () => {
    // `queued` has no equivalent anywhere else in the app: the turn is accepted
    // and waiting for an agent slot. Copy that read like a failure would
    // misrepresent a turn that is about to run perfectly well.
    expect(chatEn.status.queued.toLowerCase()).not.toContain('error')
    expect(chatEn.status.queued.toLowerCase()).not.toContain('failed')
  })

  it('has copy for every coded refusal the API can return', () => {
    // These reach the athlete as a toast rather than a styled panel, so an
    // unmapped one shows the backend's own English sentence inside a translated
    // UI. `chat_disabled` is the one that matters: the API raises it on every
    // POST, not only at page load, so it is reachable by turning the agentic
    // coach off in another tab and coming back.
    for (const key of Object.values(REFUSAL_KEYS)) {
      const [group, name] = key.split('.')
      expect(chatEn[group as keyof typeof chatEn], `en.${key}`).toHaveProperty(name)
      expect(chatFi[group as keyof typeof chatFi], `fi.${key}`).toHaveProperty(name)
    }
  })

  it('maps every refusal code the API documents', () => {
    for (const code of REFUSAL_CODES) {
      expect(REFUSAL_KEYS, code).toHaveProperty(code)
    }
  })

  it('says on the card that nothing has happened yet', () => {
    // The card *is* the prompt: the athlete answers with a button, and the one
    // thing they must not be left guessing about is whether Koutsi has already
    // done the thing it is describing.
    for (const chat of [chatEn, chatFi]) {
      expect(chat.proposal.nothingYet.trim()).not.toBe('')
    }
    expect(chatEn.proposal.nothingYet.toLowerCase()).toContain('nothing has changed')
  })

  it('warns, in both locales, that accepting archives overlapping plans', () => {
    // The load-bearing copy on the card. Creating a plan files away every
    // active plan whose dates overlap it, and a yes given without knowing that
    // is not consent to what actually happens.
    expect(chatEn.proposal.archiveTitle.toLowerCase()).toContain('archive')
    expect(chatFi.proposal.archiveTitle.toLowerCase()).toContain('arkistoi')
    // And says the recovery path, because the warning without it reads as final.
    expect(chatEn.proposal.archiveUndo.toLowerCase()).toContain('back')
    expect(chatFi.proposal.archiveUndo.toLowerCase()).toContain('palauttaa')
  })

  it('warns about sessions a shortened plan would strand, in both locales', () => {
    // They are not deleted and they keep scoring as missed, so a plan the
    // athlete shortened costs them adherence unless they clear those days.
    expect(chatEn.proposal.stranded.toLowerCase()).toContain('missed')
    expect(chatEn.proposal.stranded).toContain('{count}')
    expect(chatFi.proposal.stranded).toContain('{count}')
  })

  it('has copy for every state an offer can settle into', () => {
    for (const chat of [chatEn, chatFi]) {
      for (const state of ['applied', 'declined', 'expired', 'superseded']) {
        expect(chat.proposal.status, state).toHaveProperty(state)
      }
    }
  })

  it('offers a yes and a no for every kind of change', () => {
    // Never a typed "yes": the answer is a button, because a typed one would
    // put the decision back inside the thing being gated.
    for (const chat of [chatEn, chatFi]) {
      for (const kind of ['create_plan', 'update_plan', 'update_workout']) {
        expect(chat.proposal.title, kind).toHaveProperty(kind)
        expect(chat.proposal.approve, kind).toHaveProperty(kind)
      }
      expect(chat.proposal.decline.trim()).not.toBe('')
    }
  })

  it('names the week roles rather than leaving them as backend keys', () => {
    // The backend deliberately sends `week_type` as a machine key and no prose,
    // so the preview reads the same in Finnish as in English. That only works
    // if this side actually translates the keys.
    for (const chat of [chatEn, chatFi]) {
      for (const role of ['build', 'recovery', 'taper']) {
        expect(chat.proposal.weekType, role).toHaveProperty(role)
      }
      for (const day of ['1', '2', '3', '4', '5', '6', '7']) {
        expect(chat.proposal.days, day).toHaveProperty(day)
      }
    }
  })

  it('tells the athlete a full conversation loses no context', () => {
    // Koutsi looks its facts up fresh each turn, so starting a new conversation
    // costs nothing but the thread. Without saying so, the cap reads as losing
    // your coach's memory.
    expect(chatEn.budget.conversationFullBody.toLowerCase()).toContain('looks it up')
  })
})
