'use client'

import { useTranslations } from 'next-intl'

import { KoutsiAvatar } from '@/components/koutsi-chat'

/**
 * What an athlete sees before they have asked anything (issue #44).
 *
 * A greeting and one line about what Koutsi can reach. It used to also offer
 * example questions to tap, drawn from the coaching and adjacent bands, on the
 * reasoning that a bare text box says nothing about where Koutsi's scope ends —
 * those are gone.
 *
 * The scope boundary is still stated where it matters most: `CoachBoundaryNotice`
 * sits permanently under the composer, so the one part of the boundary that is a
 * safety property rather than a nicety is in front of the athlete while they
 * type, not only before they start.
 */
export function EmptyThread() {
  const t = useTranslations('chat')

  return (
    <div className="flex items-start gap-3 py-8">
      <KoutsiAvatar mood="cheer" />
      <div className="space-y-1">
        <p className="font-medium">{t('empty.greeting')}</p>
        <p className="max-w-prose text-sm text-muted-foreground">{t('empty.hint')}</p>
      </div>
    </div>
  )
}
