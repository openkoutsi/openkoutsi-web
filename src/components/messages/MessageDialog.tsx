'use client'

import { useTranslations } from 'next-intl'
import { Trophy } from 'lucide-react'
import { Link } from '@/navigation'
import type { Message } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  /** The message to show, or null when the dialog is closed. */
  message: Message | null
  onOpenChange: (open: boolean) => void
}

/**
 * The full text of one inbox message.
 *
 * Renders `title`/`body` straight through: the backend writes them when the
 * message is sent, so there is nothing to look up and no message type this
 * component needs to know about. The one type it does branch on is
 * `achievement_unlocked`, and only to offer a link to the achievements page.
 */
export function MessageDialog({ message, onOpenChange }: Props) {
  const t = useTranslations('messages')
  const isAchievement = message?.type === 'achievement_unlocked'

  return (
    <Dialog open={message !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {message && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6">
                {message.title || t('inbox.legacy')}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t('inbox.received', { date: new Date(message.created_at).toLocaleString() })}
              </DialogDescription>
            </DialogHeader>

            {/* Bodies are multi-line — an achievement batch is one badge per
                line — so newlines have to survive. */}
            {message.body && (
              <p className="text-sm whitespace-pre-line">{message.body}</p>
            )}

            <DialogFooter className="gap-2">
              {isAchievement && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/achievements`} onClick={() => onOpenChange(false)}>
                    <Trophy className="h-4 w-4 mr-2" aria-hidden="true" />
                    {t('inbox.viewAchievements')}
                  </Link>
                </Button>
              )}
              <DialogClose asChild>
                <Button size="sm">{t('inbox.close')}</Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
