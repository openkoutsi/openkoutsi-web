'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { fetcher } from '@/lib/api'
import type { Bike, PaginatedActivities } from '@/lib/types'
import { ActivityCard } from '@/components/activities/ActivityCard'
import { BulkEditDialog } from '@/components/activities/BulkEditDialog'
import { UploadDropzone } from '@/components/activities/UploadDropzone'
import { ManualActivityForm } from '@/components/activities/ManualActivityForm'
import { RpePrompt } from '@/components/activities/RpePrompt'
import { ActivitySearchFilter, EMPTY_FILTERS } from '@/components/activities/ActivitySearchFilter'
import type { ActivityFilters } from '@/components/activities/ActivitySearchFilter'
import { Button } from '@/components/ui/button'
import { CheckSquare, ChevronLeft, ChevronRight, X } from 'lucide-react'

const PAGE_SIZE = 20

function filtersToParams(filters: ActivityFilters, page: number): URLSearchParams {
  const p = new URLSearchParams()
  p.set('page', String(page))
  p.set('page_size', String(PAGE_SIZE))
  if (filters.q) p.set('q', filters.q)
  if (filters.sport_type) p.set('sport_type', filters.sport_type)
  if (filters.workout_category) p.set('workout_category', filters.workout_category)
  if (filters.start) p.set('start', filters.start)
  if (filters.end) p.set('end', filters.end)
  if (filters.min_duration) p.set('min_duration', String(Math.round(Number(filters.min_duration) * 60)))
  if (filters.max_duration) p.set('max_duration', String(Math.round(Number(filters.max_duration) * 60)))
  if (filters.min_distance) p.set('min_distance', String(Number(filters.min_distance) * 1000))
  if (filters.max_distance) p.set('max_distance', String(Number(filters.max_distance) * 1000))
  if (filters.min_tss) p.set('min_tss', filters.min_tss)
  if (filters.max_tss) p.set('max_tss', filters.max_tss)
  if (filters.has_power !== null) p.set('has_power', filters.has_power ? 'true' : 'false')
  filters.labels.forEach((l) => p.append('labels', l))
  filters.exclude_labels.forEach((l) => p.append('exclude_labels', l))
  return p
}

function paramsToFilters(params: URLSearchParams): ActivityFilters {
  const minDurS = params.get('min_duration')
  const maxDurS = params.get('max_duration')
  const minDistM = params.get('min_distance')
  const maxDistM = params.get('max_distance')
  const hasPowerRaw = params.get('has_power')
  return {
    q: params.get('q') ?? '',
    sport_type: params.get('sport_type') ?? '',
    workout_category: params.get('workout_category') ?? '',
    start: params.get('start') ?? '',
    end: params.get('end') ?? '',
    min_duration: minDurS ? String(Math.round(Number(minDurS) / 60)) : '',
    max_duration: maxDurS ? String(Math.round(Number(maxDurS) / 60)) : '',
    min_distance: minDistM ? String(Number(minDistM) / 1000) : '',
    max_distance: maxDistM ? String(Number(maxDistM) / 1000) : '',
    min_tss: params.get('min_tss') ?? '',
    max_tss: params.get('max_tss') ?? '',
    has_power: hasPowerRaw === 'true' ? true : hasPowerRaw === 'false' ? false : null,
    labels: params.getAll('labels'),
    exclude_labels: params.getAll('exclude_labels'),
  }
}

export default function ActivitiesPage() {
  const t = useTranslations('activities')
  const router = useRouter()
  const searchParams = useSearchParams()

  const [filters, setFilters] = useState<ActivityFilters>(() => paramsToFilters(searchParams))
  const [page, setPage] = useState(() => Number(searchParams.get('page') ?? '1'))
  // Bumped after an upload/manual entry to re-prompt for RPE on new rides.
  const [rpeSignal, setRpeSignal] = useState(0)
  // Bulk edit. The selection is a set of ids rather than of rows so it
  // survives paging and filtering: "every commute this spring" is several pages
  // of results, picked a page at a time.
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [bulkOpen, setBulkOpen] = useState(false)

  const apiParams = filtersToParams(filters, page)
  const apiUrl = `/api/activities?${apiParams.toString()}`
  const { data, mutate, isLoading } = useSWR<PaginatedActivities>(apiUrl, fetcher)
  // One request for the whole garage, shared with every card on the page.
  // An activity carries `bike_id` but not the bike's name, and a per-card
  // lookup would be one request per row for a handful of rows the page can
  // fetch once (issue #64).
  const { data: bikes } = useSWR<Bike[]>('/api/bikes', fetcher)
  const bikeNames = Object.fromEntries((bikes ?? []).map((b) => [b.id, b.name]))

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1

  // "No activities at all", not "no activities matching this filter" — the
  // first-run import prompt is for someone who has never uploaded anything.
  const hasFilters =
    filtersToParams(filters, 1).toString() !== filtersToParams(EMPTY_FILTERS, 1).toString()
  const hasNoActivities = !isLoading && data?.total === 0 && !hasFilters

  const handleFiltersChange = useCallback((next: ActivityFilters) => {
    setFilters(next)
    setPage(1)
    const urlParams = filtersToParams(next, 1)
    router.replace(`?${urlParams.toString()}`, { scroll: false })
  }, [router])

  const handlePageChange = useCallback((next: number) => {
    setPage(next)
    const urlParams = filtersToParams(filters, next)
    router.replace(`?${urlParams.toString()}`, { scroll: false })
  }, [filters, router])

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const pageIds = data?.items.map((a) => a.id) ?? []
  const pageAllSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (pageAllSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  function stopSelecting() {
    setSelecting(false)
    setSelected(new Set())
  }

  // Keep state in sync when browser back/forward navigates
  useEffect(() => {
    setFilters(paramsToFilters(searchParams))
    setPage(Number(searchParams.get('page') ?? '1'))
  }, [searchParams])

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          {!hasNoActivities && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
            >
              {selecting ? (
                <X className="mr-1 h-4 w-4" />
              ) : (
                <CheckSquare className="mr-1 h-4 w-4" />
              )}
              {selecting ? t('bulk.finish') : t('bulk.select')}
            </Button>
          )}
          <ManualActivityForm onCreated={() => { mutate(); setRpeSignal((n) => n + 1) }} />
        </div>
      </div>

      {/* An athlete with nothing here yet is being asked the hardest question
          of adopting openkoutsi — how do I get my history in? — so that is the
          moment to answer it, rather than leaving a dashed box to imply it
          (issue #36). Keyed off the unfiltered total so a filter that matches
          nothing does not turn the page back into onboarding. */}
      <UploadDropzone
        variant={hasNoActivities ? 'firstRun' : 'compact'}
        onUploaded={() => { mutate(); setRpeSignal((n) => n + 1) }}
      />

      <RpePrompt reloadSignal={rpeSignal} />

      <ActivitySearchFilter filters={filters} onChange={handleFiltersChange} />

      {selecting && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-md border bg-background p-2 shadow-sm">
          <span className="text-sm font-medium">
            {t('bulk.selected', { count: selected.size })}
          </span>
          <Button variant="ghost" size="sm" onClick={togglePage} disabled={pageIds.length === 0}>
            {pageAllSelected ? t('bulk.deselectPage') : t('bulk.selectPage')}
          </Button>
          {selected.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              {t('bulk.clear')}
            </Button>
          )}
          <Button
            size="sm"
            className="ml-auto"
            disabled={selected.size === 0}
            onClick={() => setBulkOpen(true)}
          >
            {t('bulk.edit')}
          </Button>
        </div>
      )}

      <BulkEditDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        activityIds={[...selected]}
        bikes={bikes ?? []}
        onApplied={() => {
          setBulkOpen(false)
          stopSelecting()
          mutate()
        }}
      />

      <div className="space-y-2">
        {isLoading && (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        )}
        {data?.items.map((a) => (
          <ActivityCard
            key={a.id}
            activity={a}
            bikeNames={bikeNames}
            selected={selecting ? selected.has(a.id) : undefined}
            onToggleSelect={selecting ? () => toggleSelected(a.id) : undefined}
          />
        ))}
        {!isLoading && data?.items.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('noActivities')}</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="icon"
            disabled={page === 1}
            onClick={() => handlePageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page === totalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
