'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessagesSquare, PanelLeftClose, PanelLeftOpen, Sparkles } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import useSWR from 'swr'

import { ChatThread, SCROLLER_ATTR } from '@/components/chat/ChatThread'
import { Composer } from '@/components/chat/Composer'
import { ConversationList } from '@/components/chat/ConversationList'
import { EmptyThread } from '@/components/chat/EmptyThread'
import { LlmUpsell } from '@/components/LlmUpsell'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { ApiCodeError, apiFetch, fetcher } from '@/lib/api'
import { REFUSAL_KEYS } from './refusals'
import { Link } from '@/navigation'
import type {
  ChatAvailability,
  ChatConversation,
  ChatConversationDetail,
} from '@/lib/types'

const AVAILABILITY_KEY = '/api/chat/availability'
const CONVERSATIONS_KEY = '/api/chat/conversations'

/**
 * Poll cadence while a turn is live.
 *
 * Faster than the dashboard card's 1500 ms, because someone is sitting here
 * watching this one rather than glancing at a card that filled itself in
 * earlier. Slower while `queued`: nothing is being written yet, so a tighter
 * poll would only ask the same question more often.
 *
 * Still polling rather than SSE, and deliberately. Persisting the answer and
 * polling is openkoutsi's standing answer to slow local models, and it is what
 * makes a reload mid-answer resume instead of losing the turn — which matters
 * more for a conversation the athlete may navigate away from than it ever did
 * for a card. A stream would fork the whole streaming layer for one surface and
 * give that up.
 */
const POLL_PENDING_MS = 600
const POLL_QUEUED_MS = 1500


export default function ChatPage() {
  const t = useTranslations('chat')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [sending, setSending] = useState(false)

  const { data: availability, mutate: mutateAvailability } =
    useSWR<ChatAvailability>(AVAILABILITY_KEY, fetcher)
  const { data: conversations, mutate: mutateList } = useSWR<ChatConversation[]>(
    CONVERSATIONS_KEY,
    fetcher,
  )

  const { data: active, mutate: mutateActive } = useSWR<ChatConversationDetail>(
    activeId ? `${CONVERSATIONS_KEY}/${activeId}` : null,
    fetcher,
    {
      refreshInterval: (data) => {
        const last = data?.messages?.[data.messages.length - 1]
        if (last?.status === 'pending') return POLL_PENDING_MS
        if (last?.status === 'queued') return POLL_QUEUED_MS
        return 0
      },
    },
  )

  const messages = useMemo(() => active?.messages ?? [], [active])
  const lastMessage = messages[messages.length - 1]
  const turnInFlight =
    lastMessage?.status === 'pending' || lastMessage?.status === 'queued'

  // Refetch the budget whenever a turn settles. Without this, availability is
  // whatever it was at mount for the whole session — which quietly disables the
  // warning it exists to give: the counter appears at five left and still says
  // five on the last one, then the athlete gets a 429 with no build-up. Tied to
  // *settlement* rather than to sending, because the backend no longer charges
  // for failures that never reached a provider, so the number is only knowable
  // once the turn is over.
  const settledAt = turnInFlight ? null : lastMessage?.id ?? null
  useEffect(() => {
    if (settledAt !== null) mutateAvailability()
  }, [settledAt, mutateAvailability])

  // Safe to read unguarded below: the early return for `undefined` runs before
  // any of this is used for rendering.
  const conversationFull =
    availability !== undefined &&
    messages.filter((m) => m.role === 'assistant').length >=
      availability.max_turns_per_conversation
  const dayFull = availability !== undefined && availability.turns_remaining_today <= 0

  /** Turn a coded refusal into the right sentence, or fall back to a toast. */
  const reportError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiCodeError) {
        const key = REFUSAL_KEYS[error.code]
        toast({
          title: t('title'),
          description: key && t.has(key) ? t(key) : error.message,
          variant: 'destructive',
        })
        return
      }
      toast({
        title: t('title'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    },
    [t],
  )

  const send = useCallback(
    async (message: string) => {
      setSending(true)
      try {
        if (activeId) {
          await apiFetch(`${CONVERSATIONS_KEY}/${activeId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ message, locale }),
          })
          await mutateActive()
        } else {
          // A conversation and its first turn in one round trip, so picking a
          // starter question does not need two.
          const created = await apiFetch<ChatConversationDetail>(CONVERSATIONS_KEY, {
            method: 'POST',
            body: JSON.stringify({ message, locale }),
          })
          setActiveId(created.id)
        }
        await mutateList()
      } catch (error) {
        reportError(error)
      } finally {
        setSending(false)
      }
    },
    [activeId, locale, mutateActive, mutateList, reportError],
  )

  const retry = useCallback(async () => {
    // Re-runs the failed answer *in place* rather than re-asking. Re-posting the
    // text would show the athlete their own question twice, right after
    // something has visibly gone wrong; it would spend a second turn of the
    // budget; and it would send a history ending with the same question twice
    // over, which strict chat templates reject or merge.
    if (!activeId || lastMessage?.status !== 'error') return
    setSending(true)
    try {
      await apiFetch(
        `${CONVERSATIONS_KEY}/${activeId}/messages/${lastMessage.id}/retry`,
        { method: 'POST', body: JSON.stringify({ locale }) },
      )
      await mutateActive()
    } catch (error) {
      reportError(error)
    } finally {
      setSending(false)
    }
  }, [activeId, locale, lastMessage, mutateActive, reportError])

  const remove = useCallback(
    async (id: string) => {
      try {
        await apiFetch(`${CONVERSATIONS_KEY}/${id}`, { method: 'DELETE' })
        if (id === activeId) setActiveId(null)
        await mutateList()
      } catch (error) {
        reportError(error)
      }
    },
    [activeId, mutateList, reportError],
  )

  // ── The states where chat cannot be used at all ─────────────────────────
  //
  // Answered before the athlete types, rather than discovered as a failed turn.
  // Chat is the one LLM surface with no single-shot prompt behind it, so a model
  // that cannot call tools is a permanent fact about their setup — and learning
  // that *after* composing a question is a bad way to learn it.
  //
  // Which is exactly why this waits for the answer rather than assuming yes.
  // Every gate below reads `availability`, so while the fetch is in flight they
  // all fall through to the full chat UI — handing the athlete a working-looking
  // composer and then replacing it with "your model can't do this". A flash of
  // empty state would be untidy; a flash of *an invitation to do the thing that
  // will not work* is the failure this whole section exists to prevent.
  if (availability === undefined) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="mb-4 text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
      </div>
    )
  }

  if (!availability.enabled) {
    return (
      <Unavailable
        title={t('unavailable.disabledTitle')}
        body={t('unavailable.disabledBody')}
        href="/profile"
        linkLabel={t('unavailable.disabledLink')}
      />
    )
  }

  if (!availability.entitled) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="mb-4 text-2xl font-semibold">{t('title')}</h1>
        <LlmUpsell />
      </div>
    )
  }

  if (!availability.tools_supported) {
    return (
      <Unavailable
        title={t('unavailable.toolsTitle')}
        body={t('unavailable.toolsBody')}
        href="/settings"
        linkLabel={t('unavailable.toolsLink')}
      />
    )
  }

  const composerDisabled = sending || turnInFlight || dayFull || conversationFull

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col md:flex-row">
      {/* Conversation rail: a column on desktop, a toggled panel on mobile. */}
      <aside
        className={`${listOpen ? 'block' : 'hidden'} border-b p-3 md:block md:w-64 md:shrink-0 md:border-b-0 md:border-r`}
      >
        <ConversationList
          conversations={conversations ?? []}
          activeId={activeId}
          onSelect={(id) => {
            setActiveId(id)
            setListOpen(false)
          }}
          onNew={() => {
            setActiveId(null)
            setListOpen(false)
          }}
          onDelete={remove}
        />
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setListOpen((open) => !open)}
            aria-label={listOpen ? t('closeConversations') : t('openConversations')}
          >
            {listOpen ? (
              <PanelLeftClose className="h-4 w-4" aria-hidden />
            ) : (
              <PanelLeftOpen className="h-4 w-4" aria-hidden />
            )}
          </Button>
          <MessagesSquare className="hidden h-5 w-5 text-primary md:block" aria-hidden />
          <div className="min-w-0">
            <h1 className="truncate font-semibold leading-tight">
              {active?.title || t('title')}
            </h1>
            <p className="hidden truncate text-xs text-muted-foreground md:block">
              {t('subtitle')}
            </p>
          </div>
        </header>

        {/* The marker `ChatThread` looks for; see `SCROLLER_ATTR`. */}
        <div className="flex-1 overflow-y-auto px-4 py-4" {...{ [SCROLLER_ATTR]: true }}>
          {messages.length === 0 ? (
            <EmptyThread />
          ) : (
            <ChatThread messages={messages} onRetry={retry} />
          )}

          {conversationFull && (
            <Notice
              title={t('budget.conversationFullTitle')}
              body={t('budget.conversationFullBody')}
            />
          )}
          {!conversationFull && dayFull && (
            <Notice title={t('budget.spentTitle')} body={t('budget.spentBody')} />
          )}
        </div>

        <Composer
          onSend={send}
          disabled={composerDisabled}
          busy={sending}
          maxChars={availability?.max_message_chars ?? 4000}
          remainingToday={availability?.turns_remaining_today}
          isFirstMessage={messages.length === 0}
        />
      </section>
    </div>
  )
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 text-sm" role="status">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground">{body}</p>
    </div>
  )
}

function Unavailable({
  title,
  body,
  href,
  linkLabel,
}: {
  title: string
  body: string
  href: string
  linkLabel: string
}) {
  const t = useTranslations('chat')
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">{t('title')}</h1>
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm" role="status">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">{title}</p>
            <p className="text-muted-foreground">{body}</p>
            <Link
              href={href}
              className="mt-1 inline-block font-medium text-primary hover:underline"
            >
              {linkLabel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
