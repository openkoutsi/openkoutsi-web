'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations, useLocale } from 'next-intl'

import { fetcher, apiFetch, LlmSubscriptionRequiredError } from '@/lib/api'
import type { CoursePlan } from '@/lib/types'
import { isPlanPending } from '@/lib/courses'
import { Button } from '@/components/ui/button'
import { parseMoodAndParagraphs, KoutsiAvatar, KoutsiBubble } from '@/components/koutsi-chat'
import { AiDisclosure } from '@/components/AiDisclosure'
import { LlmUpsell } from '@/components/LlmUpsell'
import { Sparkles, RefreshCw } from 'lucide-react'

/**
 * The written pacing plan for a course (issue #55).
 *
 * The same trigger → poll → prose shape as `GoalGuidanceCard`: the backend
 * streams the plan into the row and this polls it, because there is no SSE
 * anywhere in this app by design.
 */
export function CoursePlanCard({ courseId }: { courseId: string }) {
  const t = useTranslations('courses.plan')
  const locale = useLocale()
  const [showUpsell, setShowUpsell] = useState(false)

  const { data, mutate } = useSWR<CoursePlan>(
    `/api/courses/${courseId}/plan`,
    fetcher,
    { refreshInterval: (d) => (isPlanPending(d?.status) ? 1500 : 0) },
  )

  async function handleGenerate() {
    setShowUpsell(false)
    try {
      await apiFetch(`/api/courses/${courseId}/plan`, {
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
  const plan = data?.plan ?? null
  const pending = isPlanPending(status)

  if (showUpsell) return <LlmUpsell className="mt-3" />

  if (status === 'error') {
    return (
      <div className="mt-4 border-t border-border pt-4">
        <div className="flex items-start gap-3">
          <KoutsiAvatar mood="stern" />
          <div className="flex flex-1 flex-col gap-2">
            <KoutsiBubble text={t('error')} />
            <Button size="sm" variant="outline" className="self-start" onClick={handleGenerate}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              {t('retry')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (pending || plan) {
    const { mood, paragraphs } = plan
      ? parseMoodAndParagraphs(plan)
      : { mood: 'knowing', paragraphs: [] as string[] }

    return (
      <div className="mt-4 border-t border-border pt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('title')}
          </span>
        </div>
        {pending && paragraphs.length === 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <KoutsiAvatar mood="knowing" />
              <KoutsiBubble text={t('thinking')} isPartial />
            </div>
            <AiDisclosure />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {paragraphs.map((para, i) => (
              <div key={i} className="flex items-start gap-3">
                <KoutsiAvatar mood={mood} />
                <KoutsiBubble
                  text={para}
                  isPartial={pending && i === paragraphs.length - 1}
                />
              </div>
            ))}
            {pending && paragraphs.length > 0 && (
              <div className="flex items-start gap-3">
                <KoutsiAvatar mood={mood} />
                <KoutsiBubble text="" isPartial />
              </div>
            )}
            {/* Issue #41: the plan above is model output — say so wherever it shows. */}
            <AiDisclosure />
            {!pending && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 self-start px-2"
                onClick={handleGenerate}
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                <span className="text-xs">{t('refresh')}</span>
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <Button size="sm" variant="outline" onClick={handleGenerate}>
        <Sparkles className="mr-1 h-3.5 w-3.5" />
        {t('getPlan')}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">{t('getPlanHelp')}</p>
    </div>
  )
}
