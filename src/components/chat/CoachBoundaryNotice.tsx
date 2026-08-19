'use client'

import { Stethoscope } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

/**
 * The medical boundary, stated permanently rather than per message (issue #44).
 *
 * The obvious design was a marker on the answer itself — a `BAND:` line beside
 * the existing `MOOD:` one — so a medical redirect could render differently. It
 * was rejected, and the reasoning is worth keeping: that would be one more
 * leading-format rule for the model to obey, and issue #43 measured exactly
 * these degrading on turns that follow tool results, on exactly the small local
 * models BYOK users run. The disclosure would then be missing from the answers
 * most likely to need it.
 *
 * A standing notice by the composer costs nothing, cannot degrade, and is true
 * before the athlete has typed anything — which is when someone deciding
 * whether to ask about a chest pain actually needs to read it.
 *
 * Distinct from `AiDisclosure`, which stands beside it in the composer for a
 * reason of its own — a thread is too many blocks of prose to label one by one.
 * The two are not variants: that one says *a machine wrote this*, this one says
 * *this machine is not a doctor*, and they are different claims.
 */
export function CoachBoundaryNotice({ className }: { className?: string }) {
  const t = useTranslations('chat')
  return (
    <p
      className={cn('flex items-start gap-1.5 text-xs text-muted-foreground', className)}
      role="note"
    >
      <Stethoscope className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      <span>{t('boundary')}</span>
    </p>
  )
}
