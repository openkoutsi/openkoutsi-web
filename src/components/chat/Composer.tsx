'use client'

import { useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { AiDisclosure } from '@/components/AiDisclosure'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CoachBoundaryNotice } from './CoachBoundaryNotice'

/**
 * How close to the daily limit before the count is shown at all.
 *
 * A permanently visible counter makes the product feel metered, and for the
 * ordinary athlete who asks two questions a day it would only ever be noise.
 * It appears when it is about to matter, which is the point at which the issue's
 * "surfaced to the user before it bites" is actually doing something.
 */
const SHOW_REMAINING_BELOW = 6

export function Composer({
  onSend,
  disabled,
  busy,
  maxChars,
  remainingToday,
  isFirstMessage,
}: {
  onSend: (message: string) => void
  disabled?: boolean
  busy?: boolean
  maxChars: number
  remainingToday?: number
  isFirstMessage?: boolean
}) {
  const t = useTranslations('chat')
  const [value, setValue] = useState('')

  const trimmed = value.trim()
  const tooLong = trimmed.length > maxChars
  const canSend = trimmed.length > 0 && !tooLong && !disabled && !busy

  function submit() {
    if (!canSend) return
    onSend(trimmed)
    setValue('')
  }

  const showRemaining =
    remainingToday !== undefined && remainingToday <= SHOW_REMAINING_BELOW

  return (
    <div className="flex flex-col gap-2 border-t bg-card px-4 py-3">
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line. A coaching question is
            // usually one sentence, so the common case should not need a click.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={
            isFirstMessage ? t('composerPlaceholder') : t('composerPlaceholderShort')
          }
          disabled={disabled}
          rows={2}
          aria-label={t('composerPlaceholder')}
          className="min-h-[2.75rem] resize-none"
        />
        <Button
          onClick={submit}
          disabled={!canSend}
          size="icon"
          aria-label={t('send')}
          className="shrink-0"
        >
          <SendHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4">
        {/*
         * Both standing notices, stacked. `min-w-0` so their copy wraps rather
         * than squeezing the counter on the right off the row.
         */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/*
           * Withheld until there is a turn to label: the copy is written about
           * text that exists ("Written by a large language model…"), and an
           * empty thread has none. It appears as soon as the first question is
           * sent, the same as on the other surfaces, which show it while the
           * answer is still being written.
           */}
          {!isFirstMessage && <AiDisclosure />}
          <CoachBoundaryNotice />
        </div>
        <div className="shrink-0 text-xs text-muted-foreground text-right">
          {tooLong && (
            <p className="text-destructive">
              {trimmed.length} / {maxChars}
            </p>
          )}
          {!tooLong && showRemaining && (
            <p>
              {remainingToday === 1
                ? t('budget.remainingOne')
                : t('budget.remaining', { count: remainingToday! })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
