import { describe, expect, it } from 'vitest'

import commonEn from '../../messages/en/common.json'
import commonFi from '../../messages/fi/common.json'
import appEn from '../../messages/en/app.json'
import appFi from '../../messages/fi/app.json'
import {
  parseMoodAndParagraphs,
  progressMessageKey,
  progressText,
  toolLabelText,
  toolNameFromCode,
} from '@/components/koutsi-chat'

/**
 * The agentic coach's progress line, and the MOOD contract it must not disturb
 * (issue #43).
 *
 * The backend reports a *code* (`thinking`, `tool.<registry tool name>`) while
 * it is still gathering, because the coaching prompts run in fourteen languages
 * while every tool name is English, and because a code cannot leak tool
 * internals into the bubble. That makes translation this side's job, and makes
 * two things worth pinning: the codes we know are translated in both locales,
 * and a code we *don't* know still renders something an athlete can read.
 */

// The nine tools the backend's registry publishes. A code arrives as
// `tool.<name>`; see `backend/app/services/llm_agent.py:progress_vocabulary`.
const TOOL_CODES = [
  'find_activity',
  'get_activity_detail',
  'get_goal_progress',
  'get_intensity_distribution',
  'get_plan_status',
  'get_power_profile',
  'get_training_status',
  'get_zone_totals',
  'list_recent_activities',
] as const

/** A `useTranslations('common.llm')` stand-in over a real message file. */
function translator(messages: Record<string, unknown>) {
  const lookup = (key: string): unknown =>
    key.split('.').reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      messages,
    )
  const t = (key: string) => {
    const value = lookup(key)
    if (typeof value !== 'string') throw new Error(`missing message: ${key}`)
    return value
  }
  t.has = (key: string) => typeof lookup(key) === 'string'
  return t
}

describe('progressMessageKey', () => {
  it('maps the generic thinking code', () => {
    expect(progressMessageKey('thinking')).toBe('progress.thinking')
  })

  it('maps a tool code to its own key', () => {
    expect(progressMessageKey('tool.get_power_profile')).toBe(
      'progress.tools.get_power_profile',
    )
  })

  it('has no key for an absent code', () => {
    // The non-agentic path reports nothing at all, which is the common case.
    expect(progressMessageKey(null)).toBeNull()
    expect(progressMessageKey(undefined)).toBeNull()
    expect(progressMessageKey('')).toBeNull()
  })

  it('refuses a code that did not come from the registry', () => {
    // Tool names are lowercase snake_case by registry rule. Anything else is
    // not a tool, and must not become a message lookup — or, worse, be shown.
    for (const code of [
      'tool.',
      'tool.Get-Power',
      'tool.ab',
      'tool.../../etc/passwd',
      'tool.<script>',
      'writing',
      'MOOD:cheer',
    ]) {
      expect(progressMessageKey(code), code).toBeNull()
    }
  })
})

describe('progressText', () => {
  const t = translator(commonEn.llm as Record<string, unknown>)

  it('renders a known code', () => {
    expect(progressText(t, 'tool.get_power_profile', 'fallback')).toBe(
      commonEn.llm.progress.tools.get_power_profile,
    )
  })

  it('falls back for a tool this build has never heard of', () => {
    // The contract that lets the backend add a tool without a lockstep frontend
    // release. Rendering `tool.get_something_new` at an athlete would be the
    // alternative.
    expect(progressText(t, 'tool.get_sleep_quality', 'Koutsi is thinking…')).toBe(
      'Koutsi is thinking…',
    )
  })

  it('falls back when there is no code at all', () => {
    expect(progressText(t, null, 'Koutsi is thinking…')).toBe('Koutsi is thinking…')
  })

  it('never renders the raw code', () => {
    for (const code of ['tool.get_sleep_quality', 'tool.<script>', 'nonsense']) {
      expect(progressText(t, code, 'Koutsi is thinking…')).toBe('Koutsi is thinking…')
    }
  })
})

describe('toolNameFromCode', () => {
  it('pulls the registry name out of a tool code', () => {
    expect(toolNameFromCode('tool.get_power_profile')).toBe('get_power_profile')
  })

  it('has no name for anything that is not a tool code', () => {
    for (const code of ['thinking', '', null, undefined, 'tool.', 'tool.<script>']) {
      expect(toolNameFromCode(code), String(code)).toBeNull()
    }
  })
})

describe('toolLabelText', () => {
  const t = translator(commonEn.llm as Record<string, unknown>)

  it('names a finished lookup as a thing, not as a status', () => {
    // The step is in the thread's record of what happened, above the answer it
    // fed. "Koutsi is checking your power curve…" is the *live* line and reads
    // as a lie once the lookup is behind us.
    expect(toolLabelText(t, 'get_power_profile')).toBe(
      commonEn.llm.progress.toolLabels.get_power_profile,
    )
  })

  it('falls back for a tool this build has never heard of', () => {
    // Same contract the progress codes have: the backend can publish a tenth
    // tool without a lockstep frontend release, and the athlete must not be
    // shown `get_sleep_quality`.
    expect(toolLabelText(t, 'get_sleep_quality')).toBe(
      commonEn.llm.progress.toolLabelUnknown,
    )
  })

  it('never renders a name that did not come from the registry', () => {
    for (const name of ['', 'ab', 'Get-Power', '../../etc/passwd', '<script>']) {
      expect(toolLabelText(t, name), name).toBe(commonEn.llm.progress.toolLabelUnknown)
    }
  })
})

describe('progress strings', () => {
  it('translates every published tool in both locales', () => {
    for (const name of TOOL_CODES) {
      expect(commonEn.llm.progress.tools, `en ${name}`).toHaveProperty(name)
      expect(commonFi.llm.progress.tools, `fi ${name}`).toHaveProperty(name)
      // The other half of the vocabulary: the live sentence *and* the label the
      // thread shows once the lookup is a step in the record.
      expect(commonEn.llm.progress.toolLabels, `en label ${name}`).toHaveProperty(name)
      expect(commonFi.llm.progress.toolLabels, `fi label ${name}`).toHaveProperty(name)
    }
    expect(commonEn.llm.progress).toHaveProperty('thinking')
    expect(commonFi.llm.progress).toHaveProperty('thinking')
    expect(commonEn.llm.progress).toHaveProperty('toolLabelUnknown')
    expect(commonFi.llm.progress).toHaveProperty('toolLabelUnknown')
  })

  it('keeps the two locales structurally identical', () => {
    expect(Object.keys(commonFi.llm.progress.tools).sort()).toEqual(
      Object.keys(commonEn.llm.progress.tools).sort(),
    )
    expect(Object.keys(commonFi.llm.progress.toolLabels).sort()).toEqual(
      Object.keys(commonEn.llm.progress.toolLabels).sort(),
    )
  })

  it('says what Koutsi is doing rather than naming the tool', () => {
    // These are read by an athlete watching a card, not by a developer. A line
    // that leaked `get_intensity_distribution` would be the tool internals the
    // code vocabulary exists to keep out.
    for (const [name, line] of Object.entries(commonEn.llm.progress.tools)) {
      expect(line, name).not.toContain('_')
      expect(line, name).toMatch(/^Koutsi is /)
    }
  })

  it('labels a finished step without leaking the tool name', () => {
    // Same rule as the sentences, for the same reason — these sit in the thread
    // under the athlete's own question, not in a developer's log.
    for (const [name, label] of Object.entries(commonEn.llm.progress.toolLabels)) {
      expect(label, name).not.toContain('_')
    }
  })

  it('offers the agentic opt-in in both locales', () => {
    for (const messages of [appEn, appFi]) {
      expect(messages.settings.analysis).toHaveProperty('agenticKoutsi')
      expect(messages.settings.analysis).toHaveProperty('agenticKoutsiDesc')
    }
  })

  it('warns in the opt-in copy that it costs more', () => {
    // The athlete is choosing to spend 4-6x the calls per analysis; the toggle
    // should not read as free.
    const desc = appEn.settings.analysis.agenticKoutsiDesc.toLowerCase()
    expect(desc).toContain('slower')
    expect(desc).toContain('falls back')
  })
})

describe('the MOOD contract still holds', () => {
  // Issue #43 changes where the prose comes from, not what it looks like. The
  // parser is shared by the dashboard card, the activity page and the goal
  // guidance card, which is exactly why progress lives in its own field rather
  // than in an envelope inside the text this reads.
  it('reads a MOOD line written after tool results like any other', () => {
    const { mood, paragraphs } = parseMoodAndParagraphs(
      'MOOD:stern\n\nYou skipped the threshold session.\n\nGet it done tomorrow.',
    )
    expect(mood).toBe('stern')
    expect(paragraphs).toEqual([
      'You skipped the threshold session.',
      'Get it done tomorrow.',
    ])
  })

  it('defaults the avatar when the model dropped the MOOD line', () => {
    // Models obey a leading-format rule less reliably on a turn that follows
    // tool results, so this is the case the agentic path makes more likely —
    // and it must degrade to the default avatar, not leak the token.
    const { mood, paragraphs } = parseMoodAndParagraphs('Your form is holding up well.')
    expect(mood).toBe('knowing')
    expect(paragraphs).toEqual(['Your form is holding up well.'])
    expect(paragraphs.join('\n')).not.toContain('MOOD:')
  })

  it('defaults the avatar for a mood it does not recognise, without leaking it', () => {
    const { mood, paragraphs } = parseMoodAndParagraphs('MOOD:delighted\n\nGreat ride.')
    expect(mood).toBe('knowing')
    expect(paragraphs).toEqual(['Great ride.'])
  })
})
