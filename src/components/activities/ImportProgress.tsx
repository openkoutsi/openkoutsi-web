'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Copy, X } from 'lucide-react'

import { fetcher } from '@/lib/api'
import { importProgress, isFinished } from '@/lib/imports'
import type { ImportFileResult, ImportJob } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const POLL_MS = 2000

interface Props {
  jobId: string
  /** Called once the job stops moving, so the caller can refresh its lists. */
  onFinished?: () => void
  onDismiss?: () => void
}

/**
 * Live progress and the per-file outcome of one bulk import (issue #36).
 *
 * The result list is the reason this is a panel rather than a toast. "847 of
 * 900 imported" is not something an athlete can act on; the 53 that did not,
 * each with the reason the backend gave, is. Successes are collapsed by default
 * — nine hundred lines saying "imported" would bury the ones that matter.
 */
export function ImportProgress({ jobId, onFinished, onDismiss }: Props) {
  const t = useTranslations('activities.import')
  const [showAll, setShowAll] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [notified, setNotified] = useState(false)

  const { data: job } = useSWR<ImportJob>(
    `/api/activities/imports/${jobId}`,
    fetcher,
    {
      // Stops on its own once the job settles: `refreshInterval` accepts a
      // function, so the polling ends without an effect that has to remember to
      // clear itself.
      refreshInterval: (latest) => (isFinished(latest) ? 0 : POLL_MS),
    },
  )

  const finished = isFinished(job)
  if (finished && !notified) {
    setNotified(true)
    onFinished?.()
  }

  const notable = useMemo(
    () => (job?.results ?? []).filter((r) => r.outcome !== 'imported'),
    [job?.results],
  )
  const shown = showAll ? job?.results ?? [] : notable

  if (!job) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        {t('starting')}
      </div>
    )
  }

  const fraction = importProgress(job)

  return (
    <div className="rounded-lg border">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium truncate">
            {job.source_name ?? t('title')}
          </p>
          <p className="text-sm text-muted-foreground">
            {job.status === 'failed'
              ? t('jobFailed')
              : finished
                ? t('summary', {
                    imported: job.imported,
                    skipped: job.skipped_duplicate,
                    failed: job.failed,
                  })
                : job.total_files
                  ? t('progress', { processed: job.processed, total: job.total_files })
                  : t('reading')}
          </p>
          {job.error && (
            <p className="text-sm text-destructive flex items-start gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{job.error}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {finished && job.status !== 'failed' && (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
          )}
          {finished && onDismiss && (
            <Button variant="ghost" size="icon" onClick={onDismiss} aria-label={t('dismiss')}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {!finished && (
        <div
          className="mx-4 mb-4 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={job.total_files || undefined}
          aria-valuenow={fraction === null ? undefined : job.processed}
          aria-label={t('title')}
        >
          <div
            className={cn(
              'h-full bg-primary transition-all',
              fraction === null && 'w-1/3 animate-pulse',
            )}
            style={fraction === null ? undefined : { width: `${Math.round(fraction * 100)}%` }}
          />
        </div>
      )}

      {finished && (job.results?.length ?? 0) > 0 && (
        <div className="border-t">
          <button
            type="button"
            className="flex w-full items-center gap-1.5 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {notable.length === 0
              ? t('allImported', { count: job.imported })
              : t('needsAttention', { count: notable.length })}
          </button>

          {expanded && (
            <div className="max-h-72 overflow-y-auto border-t">
              <ul className="divide-y text-sm">
                {shown.map((result, index) => (
                  <ResultRow key={`${result.filename}-${index}`} result={result} />
                ))}
              </ul>
              {notable.length > 0 && job.imported > 0 && (
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll ? t('showOnlyNotable') : t('showAll', { count: job.imported })}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultRow({ result }: { result: ImportFileResult }) {
  const t = useTranslations('activities.import')
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-2">
      <div className="min-w-0">
        <p className="truncate font-mono text-xs" title={result.filename}>
          {result.filename}
        </p>
        {result.reason && (
          <p className="text-xs text-muted-foreground">{result.reason}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {result.format && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
            {result.format}
          </span>
        )}
        <span
          className={cn(
            'text-xs whitespace-nowrap',
            result.outcome === 'failed' && 'text-destructive',
            result.outcome === 'skipped_duplicate' && 'text-muted-foreground',
            result.outcome === 'imported' && 'text-emerald-600 dark:text-emerald-500',
          )}
        >
          {result.outcome === 'imported' && result.activity_id ? (
            <Link href={`/activities/${result.activity_id}`} className="hover:underline">
              {t('outcome.imported')}
            </Link>
          ) : (
            t(`outcome.${result.outcome}`)
          )}
        </span>
        {result.outcome === 'skipped_duplicate' && result.activity_id && (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        )}
      </div>
    </li>
  )
}
