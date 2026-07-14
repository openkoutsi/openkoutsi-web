'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations, useLocale } from 'next-intl'

import { fetcher, apiFetch, LlmSubscriptionRequiredError } from '@/lib/api'
import type { GoalGuidance } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { parseMoodAndParagraphs, KoutsiAvatar, KoutsiBubble } from '@/components/koutsi-chat'
import { LlmUpsell } from '@/components/LlmUpsell'
import { Sparkles, RefreshCw } from 'lucide-react'

const isPending = (status: string | null | undefined) => status === 'pending'

// A goal's realism verdict drives both the badge colour and which Koutsi mood
// the guidance is delivered in (a cheerful nod, a knowing nudge, a stern warning).
const VERDICT_MOOD: Record<string, string> = {
  realistic: 'cheer',
  ambitious: 'knowing',
  unrealistic: 'stern',
}

const VERDICT_BADGE: Record<string, string> = {
  realistic: 'bg-green-100 text-green-800',
  ambitious: 'bg-yellow-100 text-yellow-800',
  unrealistic: 'bg-red-100 text-red-800',
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const t = useTranslations('app')
  const cls = VERDICT_BADGE[verdict] ?? 'bg-gray-100 text-gray-800'
  const label = t.has(`goals.guidance.verdict.${verdict}` as never)
    ? t(`goals.guidance.verdict.${verdict}` as never)
    : verdict
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

/**
 * Per-goal AI guidance section (issue #17). Mirrors the dashboard's
 * `TrainingStatusCard`: a "Get AI guidance" trigger POSTs, then SWR polls the
 * persisted result while it's pending and renders the streamed prose in the
 * Koutsi voice with a realism badge. A gated instance surfaces the shared
 * upsell instead of failing silently.
 */
export function GoalGuidanceCard({ goalId }: { goalId: string }) {
  const t = useTranslations('app')
  const locale = useLocale()
  const [showUpsell, setShowUpsell] = useState(false)

  const { data, mutate } = useSWR<GoalGuidance>(
    `/api/goals/${goalId}/guidance`,
    fetcher,
    { refreshInterval: (d) => (isPending(d?.status) ? 1500 : 0) },
  )

  async function handleGenerate() {
    setShowUpsell(false)
    try {
      await apiFetch(`/api/goals/${goalId}/guidance`, {
        method: 'POST',
        body: JSON.stringify({ locale }),
      })
      mutate()
    } catch (err) {
      if (err instanceof LlmSubscriptionRequiredError) {
        setShowUpsell(true)
        return
      }
      throw err
    }
  }

  const status = data?.status ?? null
  const verdict = data?.verdict ?? null
  const guidance = data?.guidance ?? null
  const pending = isPending(status)

  if (showUpsell) {
    return <LlmUpsell className="mt-3" />
  }

  if (status === 'error') {
    return (
      <div className="mt-3 border-t border-border pt-3">
        <div className="flex items-start gap-3">
          <KoutsiAvatar mood="stern" />
          <div className="flex flex-col gap-2 flex-1">
            <KoutsiBubble text={t('goals.guidance.error')} />
            <Button size="sm" variant="outline" className="self-start" onClick={handleGenerate}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              {t('goals.guidance.refresh')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (pending || guidance) {
    const { paragraphs } = guidance
      ? parseMoodAndParagraphs(guidance)
      : { paragraphs: [] as string[] }
    const mood = verdict ? (VERDICT_MOOD[verdict] ?? 'knowing') : 'knowing'

    return (
      <div className="mt-3 border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('goals.guidance.title')}
          </span>
          {verdict && !pending && <VerdictBadge verdict={verdict} />}
        </div>
        {pending && paragraphs.length === 0 ? (
          <div className="flex items-start gap-3">
            <KoutsiAvatar mood="knowing" />
            <KoutsiBubble text={t('goals.guidance.thinking')} isPartial />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {paragraphs.map((para, i) => {
              const isLast = i === paragraphs.length - 1
              return (
                <div key={i} className="flex items-start gap-3">
                  <KoutsiAvatar mood={mood} />
                  <KoutsiBubble text={para} isPartial={pending && isLast} />
                </div>
              )
            })}
            {pending && paragraphs.length > 0 && (
              <div className="flex items-start gap-3">
                <KoutsiAvatar mood={mood} />
                <KoutsiBubble text="" isPartial />
              </div>
            )}
            {!pending && (
              <Button size="sm" variant="ghost" className="self-start h-7 px-2" onClick={handleGenerate}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">{t('goals.guidance.refresh')}</span>
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <Button size="sm" variant="outline" onClick={handleGenerate}>
        <Sparkles className="h-3.5 w-3.5 mr-1" />
        {t('goals.guidance.getGuidance')}
      </Button>
    </div>
  )
}
