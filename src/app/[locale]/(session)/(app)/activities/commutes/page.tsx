'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { useLocale, useTranslations } from 'next-intl'

import { apiFetch, fetcher } from '@/lib/api'
import { suggestionRuleId } from '@/lib/sports'
import type { Activity, PaginatedActivities } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'

const PAGE_SIZE = 50

/**
 * Working through a backlog of suggested commutes (issue #63).
 *
 * The surface that makes the history scan worth running: after a scan an
 * imported season can leave hundreds of rides awaiting an answer, and answering
 * them one activity page at a time is not something anybody will finish.
 *
 * Only *pending* suggestions appear — the server's `?suggested_label=` filter
 * excludes answered ones — so the list empties as it is worked through and a
 * dismissal never comes back.
 */
export default function CommuteReviewPage() {
  const t = useTranslations('activities')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [busy, setBusy] = useState(false)

  const { data, mutate, isLoading } = useSWR<PaginatedActivities>(
    `/api/activities?suggested_label=commute&page_size=${PAGE_SIZE}`,
    fetcher,
  )
  const items = data?.items ?? []

  async function answer(activity: Activity, state: 'accepted' | 'dismissed') {
    // Optimistic: the row is gone from the pending set the moment it is
    // answered, and a list that lags behind the tap feels broken when you are
    // working through two hundred of them.
    await mutate(
      (prev) =>
        prev && {
          ...prev,
          items: prev.items.filter((a) => a.id !== activity.id),
          total: Math.max(0, prev.total - 1),
        },
      { revalidate: false },
    )
    try {
      await apiFetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ label_answers: { commute: state } }),
      })
    } catch {
      toast({ title: t('commuteReview.answerFailed'), variant: 'destructive' })
      await mutate()
    }
  }

  /**
   * Answer everything on this page at once.
   *
   * Sequential rather than a bulk endpoint: there is no bulk write on the API,
   * and inventing one for a screen an athlete visits a handful of times would
   * be a lot of surface for very little. Revalidated once at the end rather
   * than per request.
   */
  async function answerAll(state: 'accepted' | 'dismissed') {
    setBusy(true)
    try {
      for (const activity of items) {
        await apiFetch(`/api/activities/${activity.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ label_answers: { commute: state } }),
        })
      }
    } catch {
      toast({ title: t('commuteReview.answerFailed'), variant: 'destructive' })
    } finally {
      setBusy(false)
      await mutate()
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold">{t('commuteReview.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('commuteReview.desc')}</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>}

      {!isLoading && items.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center space-y-2">
            <p className="text-sm text-muted-foreground">{t('commuteReview.empty')}</p>
            <Link
              href={`/${locale}/settings`}
              className="text-sm text-primary underline underline-offset-4"
            >
              {t('commuteReview.editRules')}
            </Link>
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {t('commuteReview.pending', { count: data?.total ?? items.length })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => answerAll('accepted')}>
                  {t('commuteReview.acceptAll', { count: items.length })}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => answerAll('dismissed')}
                >
                  {t('commuteReview.dismissAll', { count: items.length })}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t('commuteReview.bulkHint')}</p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {items.map((activity) => {
              const ruleId = suggestionRuleId(activity.label_suggestions?.commute ?? null)
              return (
                <div
                  key={activity.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/${locale}/activities/${activity.id}`}
                      className="text-sm font-medium hover:underline block truncate"
                    >
                      {activity.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.start_time).toLocaleString(locale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                      {activity.distance_m != null &&
                        ` · ${(activity.distance_m / 1000).toFixed(1)} km`}
                      {activity.duration_s != null &&
                        ` · ${Math.round(activity.duration_s / 60)} min`}
                      {ruleId && ` · ${t('commuteReview.byRule', { rule: ruleId })}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => answer(activity, 'accepted')}>
                      {t('detail.labels.accept')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => answer(activity, 'dismissed')}
                    >
                      {t('detail.labels.dismiss')}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
