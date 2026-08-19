'use client'

import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

/**
 * Transparency notice for prose a language model wrote (issue #41).
 *
 * Koutsi's coaching text is rendered in the same chat bubbles whether it comes
 * from the instance's model or the athlete's own, and nothing in the bubble
 * itself says a machine produced it. EU AI Act Article 50 asks for that
 * disclosure at the point the content is shown, so every surface that renders
 * Koutsi's prose — the activity analysis, the daily feedback, the per-goal
 * guidance — puts this line directly beneath the bubbles it applies to.
 *
 * Chat is the exception, and the reason is the shape of the surface rather than
 * a different reading of the rule. Those three show one block of prose per
 * screen, so "beneath the block" is one footnote; a thread is many blocks, and
 * the same sentence under every turn stops being read by the third one. There
 * it stands once by the composer instead — see `Composer`, which is also where
 * `CoachBoundaryNotice` lives, and where it cannot scroll away from the answers
 * it applies to.
 *
 * It is deliberately quiet (muted, extra-small) so it reads as a footnote
 * rather than a warning, but it stays visible in every state where generated
 * text is on screen, including while the answer is still streaming in.
 */
export function AiDisclosure({ className }: { className?: string }) {
  const t = useTranslations('common')
  return (
    <p
      className={cn('flex items-start gap-1.5 text-xs text-muted-foreground', className)}
      role="note"
    >
      <Sparkles className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      <span>
        <span className="font-medium">{t('llm.aiGenerated.label')}</span>
        {' — '}
        {t('llm.aiGenerated.notice')}
      </span>
    </p>
  )
}
