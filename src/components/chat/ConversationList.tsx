'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ChatConversation } from '@/lib/types'

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: ChatConversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}) {
  const t = useTranslations('chat')
  // Deletion is confirmed because a coaching thread is not trivially
  // recreatable — the answers came from data as it stood on the day, and
  // re-asking gets a different one.
  const [pendingDelete, setPendingDelete] = useState<ChatConversation | null>(null)

  return (
    <div className="flex h-full flex-col gap-2">
      <Button onClick={onNew} variant="outline" className="w-full justify-start gap-2">
        <Plus className="h-4 w-4" aria-hidden />
        {t('newConversation')}
      </Button>

      {conversations.length === 0 ? (
        <p className="px-2 py-4 text-sm text-muted-foreground">{t('noConversations')}</p>
      ) : (
        <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {conversations.map((conversation) => (
            <li key={conversation.id} className="group relative">
              <button
                type="button"
                onClick={() => onSelect(conversation.id)}
                aria-current={conversation.id === activeId ? 'true' : undefined}
                className={cn(
                  'w-full truncate rounded-md py-2 pl-3 pr-9 text-left text-sm hover:bg-muted',
                  conversation.id === activeId && 'bg-muted font-medium',
                )}
              >
                {conversation.title || t('untitled')}
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(conversation)}
                aria-label={t('delete')}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteCancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              {t('deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
