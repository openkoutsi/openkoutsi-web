'use client'

import { useTranslations } from 'next-intl'

import { KoutsiAvatar } from '@/components/koutsi-chat'

/**
 * What an athlete sees before they have asked anything (issue #44).
 *
 * This carries more weight than an empty state normally would. Koutsi's scope is
 * bounded — a coach and nothing else — and an empty text box tells the athlete
 * nothing about where that boundary is, so they discover it by hitting it. Every
 * out-of-band question asked is a refusal the guardrails have to get exactly
 * right, and every one avoided is a refusal that never has to happen.
 *
 * The starters are drawn from the coaching and adjacent bands, so they teach
 * the shape of a good question by example rather than by listing rules. Static
 * strings from the locale file, not derived from the athlete's data: that would
 * cost an endpoint and possibly a model call to decorate a screen the athlete
 * spends four seconds on. Data-derived suggestions are a better version of this,
 * and a later one.
 */
export function EmptyThread({ onPick }: { onPick: (question: string) => void }) {
  const t = useTranslations('chat')
  const starters = t.raw('empty.starters') as string[]

  return (
    <div className="flex flex-col items-start gap-4 py-8">
      <div className="flex items-start gap-3">
        <KoutsiAvatar mood="cheer" />
        <div className="space-y-1">
          <p className="font-medium">{t('empty.greeting')}</p>
          <p className="max-w-prose text-sm text-muted-foreground">{t('empty.hint')}</p>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-2 pl-13">
        {starters.map((starter) => (
          <li key={starter}>
            <button
              type="button"
              onClick={() => onPick(starter)}
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-sm hover:border-primary/40 hover:bg-muted"
            >
              {starter}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
