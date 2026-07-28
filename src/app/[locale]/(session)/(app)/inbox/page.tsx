'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import useSWR, { mutate as globalMutate } from 'swr'
import { Trash2 } from 'lucide-react'
import { apiFetch, fetcher } from '@/lib/api'
import type { Message, Page } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MessageDialog } from '@/components/messages/MessageDialog'
import { toast } from '@/components/ui/use-toast'

const UNREAD_KEY = '/api/messages/unread-count'

export default function InboxPage() {
  const t = useTranslations('messages')
  const { data: messagesPage, mutate } = useSWR<Page<Message>>('/api/messages?page_size=100', fetcher)
  const messages = messagesPage?.items
  const [selected, setSelected] = useState<Message | null>(null)

  async function markRead(id: string) {
    try {
      await apiFetch(`/api/messages/${id}/read`, { method: 'POST' })
      mutate()
      globalMutate(UNREAD_KEY)
    } catch {
      // best-effort
    }
  }

  /** Opening a message is what reads it — unread ones flip on the way in. */
  function open(message: Message) {
    setSelected(message)
    if (!message.read_at) markRead(message.id)
  }

  async function markAllRead() {
    try {
      await apiFetch('/api/messages/read-all', { method: 'POST' })
      mutate()
      globalMutate(UNREAD_KEY)
    } catch {
      // best-effort
    }
  }

  async function remove(id: string) {
    try {
      await apiFetch(`/api/messages/${id}`, { method: 'DELETE' })
      mutate()
      globalMutate(UNREAD_KEY)
    } catch (err) {
      toast({
        title: t('inbox.deleteFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  if (!messages) return <p className="text-sm text-muted-foreground py-4">Loading…</p>

  const hasUnread = messages.some((m) => !m.read_at)

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('inbox.title')}</h1>
        {hasUnread && (
          <Button size="sm" variant="outline" onClick={markAllRead}>
            {t('inbox.markAllRead')}
          </Button>
        )}
      </div>

      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('inbox.empty')}</p>
      ) : (
        <div className="space-y-2">
          {messages.map((m) => {
            // Messages sent before they carried their own text have none to
            // show. Rather than a blank card, name them for what they are.
            const title = m.title || t('inbox.legacy')
            return (
              <Card
                key={m.id}
                className={`p-4 cursor-pointer ${m.read_at ? 'opacity-70' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={t('inbox.open', { title })}
                onClick={() => open(m)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    open(m)
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {!m.read_at && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      )}
                      <p className="text-sm font-medium">{title}</p>
                    </div>
                    {m.body && (
                      // Bodies can run to several lines (one per badge in an
                      // achievement batch); the popup shows all of it.
                      <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-line">
                        {m.body}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t('inbox.delete')}
                    onClick={(e) => {
                      e.stopPropagation()
                      remove(m.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <MessageDialog message={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  )
}
