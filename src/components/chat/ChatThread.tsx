'use client'

import { useEffect, useRef } from 'react'
import { AlertCircle, RotateCcw, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  KoutsiAvatar,
  KoutsiBubble,
  parseMoodAndParagraphs,
  progressText,
  toolLabelText,
  toolNameFromCode,
} from '@/components/koutsi-chat'
import { Button } from '@/components/ui/button'
import { Link } from '@/navigation'
import type { ChatMessage } from '@/lib/types'

/**
 * Which tools, if any, mean the answer is about the athlete's plan.
 *
 * Koutsi can advise but not act — write tools are deferred by issue #42 — so
 * "what should I cut next week?" ends with advice the athlete has to go and
 * apply. Linking to the plan from exactly the turns that consulted it turns a
 * dead end into a next step, without pretending to a capability that isn't
 * there.
 */
const PLAN_TOOLS = new Set(['get_plan_status'])

/** How far off the bottom counts as "reading something else, leave me alone". */
const STICK_TO_BOTTOM_PX = 120

/**
 * Marks the element the thread scrolls inside.
 *
 * Exported so the page that owns the scroll container and the effect that reads
 * it cannot drift apart — the coupling is one grep rather than an assumption
 * about which utility class is doing the scrolling.
 */
export const SCROLLER_ATTR = 'data-chat-scroller'

function UserTurn({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end">
      <p className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed max-w-prose whitespace-pre-wrap">
        {message.content}
      </p>
    </div>
  )
}

function ErrorTurn({
  message,
  onRetry,
}: {
  message: ChatMessage
  onRetry?: () => void
}) {
  const t = useTranslations('chat')
  // An unknown code falls back to generic copy rather than showing nothing —
  // the same contract the progress codes have, so the backend can learn a new
  // failure mode without a frontend release.
  const key = `errors.${message.error_code ?? 'unavailable'}`
  const body = t.has(key) ? t(key) : t('errors.unavailable')
  // `tools_unsupported` is a settled property of the athlete's model, not a
  // transient failure, so it is the one cause a retry would repeat verbatim.
  const retryable = message.error_code !== 'tools_unsupported'

  // A failure keeps the steps it got through. "It read your plan and your goals
  // and *then* fell over" is a different event from "it never got going", and
  // the athlete deciding whether to retry is the one who wants to know which.
  const tools = message.tool_names ?? []

  return (
    <div className="flex items-start gap-3">
      <KoutsiAvatar mood="stern" />
      <div className="flex flex-col items-start gap-2">
        {tools.length > 0 && <ToolSteps names={tools} indent={false} />}
        <p
          className="flex items-start gap-2 rounded-2xl rounded-tl-sm border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm leading-relaxed max-w-prose"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <span>{body}</span>
        </p>
        {retryable && onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('retry')}
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * The lookups this turn has already finished, in the order it made them.
 *
 * Rendered *above* the answer rather than under it, because that is where they
 * happened: the loop gathers first and writes afterwards — prose that turns out
 * to precede a tool call is discarded as a preamble by the backend, so an answer
 * never interleaves with its own lookups. A footer put the record of the slow
 * part after the thing it produced, and read as an afterthought about a turn
 * that had apparently answered instantly.
 */
function ToolSteps({
  names,
  // Off the avatar column by default, so the steps line up with the bubbles they
  // led to rather than with the faces. A failure nests them inside that column
  // already and passes `false`.
  indent = true,
}: {
  names: string[]
  indent?: boolean
}) {
  const t = useTranslations('chat')
  const tLlm = useTranslations('common.llm')

  return (
    <ul
      aria-label={t('stepsLabel')}
      className={`flex flex-col gap-1 ${indent ? 'pl-13' : ''}`}
    >
      {names.map((name, i) => (
        // Keyed by position as well as name: a turn may consult the same tool
        // twice with different arguments, and those are two steps.
        <li
          key={`${name}-${i}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Search className="h-3 w-3 shrink-0" aria-hidden />
          <span>{toolLabelText(tLlm, name)}</span>
        </li>
      ))}
    </ul>
  )
}

function AssistantTurn({
  message,
  onRetry,
}: {
  message: ChatMessage
  onRetry?: () => void
}) {
  const t = useTranslations('chat')
  const tLlm = useTranslations('common.llm')

  if (message.status === 'error') {
    return <ErrorTurn message={message} onRetry={onRetry} />
  }

  const queued = message.status === 'queued'
  const pending = message.status === 'pending' || queued
  const { mood, paragraphs } = message.content
    ? parseMoodAndParagraphs(message.content)
    : { mood: 'knowing', paragraphs: [] as string[] }

  // Nothing written yet. On the agentic path the first rounds are tool calls
  // producing no prose at all, so without this the thread would sit blank
  // through the whole gathering phase and then jump to a finished answer.
  // `queued` is earlier still: no slot has been claimed, so there is not even a
  // progress code to show — just an honest sentence about the wait.
  const gathering = pending && paragraphs.length === 0

  const tools = message.tool_names ?? []
  // The lookup currently running is the live line, not a finished step: the
  // backend appends its name the moment the call is dispatched, so the last
  // entry duplicates what the progress code is already saying. Only while
  // `gathering` — the code is *not* cleared when prose starts, and by then that
  // last lookup is genuinely behind us.
  const running = gathering ? toolNameFromCode(message.progress) : null
  const done =
    running !== null && tools[tools.length - 1] === running
      ? tools.slice(0, -1)
      : tools
  const showPlanLink =
    message.status === 'complete' && tools.some((name) => PLAN_TOOLS.has(name))

  return (
    <div className="flex flex-col gap-3">
      {done.length > 0 && <ToolSteps names={done} />}
      {gathering ? (
        <div className="flex items-start gap-3">
          <KoutsiAvatar mood="knowing" />
          <KoutsiBubble
            text={
              queued
                ? t('status.queued')
                : progressText(tLlm, message.progress, t('status.thinking'))
            }
            isPartial
          />
        </div>
      ) : (
        paragraphs.map((paragraph, i) => {
          const isLast = i === paragraphs.length - 1
          return (
            <div key={i} className="flex items-start gap-3">
              <KoutsiAvatar mood={mood} />
              <KoutsiBubble text={paragraph} isPartial={pending && isLast} />
            </div>
          )
        })
      )}
      {showPlanLink && (
        <Link
          href="/plan"
          className="pl-13 text-xs font-medium text-primary hover:underline"
        >
          {t('planLink')}
        </Link>
      )}
    </div>
  )
}

export function ChatThread({
  messages,
  onRetry,
}: {
  messages: ChatMessage[]
  onRetry?: () => void
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const lastId = messages[messages.length - 1]?.id
  const lastContentLength = messages[messages.length - 1]?.content.length ?? 0

  // Follow the answer as it streams. Keyed on the last message's id *and* its
  // length so it also tracks growth within a turn, not only new turns.
  useEffect(() => {
    // Feature-checked rather than called blind: `scrollIntoView` is absent in
    // jsdom, and following the answer down the page is a nicety — it must never
    // be the thing that stops the thread rendering.
    const end = endRef.current
    if (typeof end?.scrollIntoView !== 'function') return

    // Only follow an athlete who is already at the bottom. This effect fires on
    // every poll while an answer streams, so scrolling up to re-read something
    // earlier would otherwise drag them back down twice a second — the page
    // fighting the reader, in a view whose entire purpose is reading.
    //
    // Found by an explicit marker rather than by the Tailwind class that happens
    // to make it scroll: reworking those classes would leave `closest` returning
    // null, the guard skipped, and the fighting silently back — with nothing
    // failing and no test noticing.
    const scroller = end.closest(`[${SCROLLER_ATTR}]`)
    if (scroller instanceof HTMLElement) {
      const distanceFromBottom =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
      if (distanceFromBottom > STICK_TO_BOTTOM_PX) return
    }
    end.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [lastId, lastContentLength])

  return (
    <div className="flex flex-col gap-6">
      {messages.map((message, index) =>
        message.role === 'user' ? (
          <UserTurn key={message.id} message={message} />
        ) : (
          <AssistantTurn
            key={message.id}
            message={message}
            // Only the newest turn offers a retry, because that is the only one
            // the page's `retry()` acts on. A button on an older error bubble
            // would look live and re-run something else entirely — reachable in
            // the ordinary way, by rephrasing after a failure instead of
            // retrying it.
            onRetry={index === messages.length - 1 ? onRetry : undefined}
          />
        ),
      )}
      <div ref={endRef} />
    </div>
  )
}
