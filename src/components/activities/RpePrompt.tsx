'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { useTranslations, useLocale } from 'next-intl'
import { apiFetch, fetcher } from '@/lib/api'
import { useAppResume } from '@/lib/appResume'
import { scheduleReanalyze } from '@/lib/reanalyze'
import { useAuth } from '@/lib/auth'
import type { Activity } from '@/lib/types'
import { pendingCommuteSuggestion } from '@/lib/sports'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'

interface RpeQueueResponse {
  items: Activity[]
  rpe_head: string | null
}

const RPE_VALUES = Array.from({ length: 10 }, (_, i) => i + 1)

// How often the pending queue is re-checked while the page is open, matching the
// interval the dashboard's own panels poll on. A ride that syncs while the app
// sits in the foreground should not have to wait for a navigation to be noticed.
const RPE_POLL_MS = 60_000

/**
 * Prompts the athlete to rate the perceived effort (RPE) of recent significant
 * cycling rides (issue #28). Backed by the server-side `rpe-queue`, it works
 * through the whole pending backlog in one sitting: after each Rate/Skip it
 * advances the server-side `rpe_head` cursor and moves to the next ride;
 * "Ask again later" leaves the cursor untouched so the same ride leads the
 * queue next visit.
 *
 * The queue is an SWR key rather than a one-shot fetch so that it keeps up with
 * rides that arrive after the page was rendered. Three things can open the
 * prompt, and they differ only in how insistent they are:
 *
 * - The **poll** opens it only when a ride appears that was not in the queue
 *   last time we looked, so a prompt dismissed with "Ask again later" is not
 *   thrown straight back at the athlete a minute later.
 * - A **resume** — the app coming back from the background — counts as a fresh
 *   visit and opens whatever is pending, the same way navigating back to the
 *   dashboard does. This is the case an interval cannot cover: iOS suspends the
 *   page entirely, so nothing polls while the app is away and nothing remounts
 *   when it returns (issue #66).
 * - A bump of **`reloadSignal`** is likewise treated as a fresh visit; it marks
 *   an upload, a manual entry, or a tap on the dashboard's refresh button.
 *
 * None of them disturb a prompt that is already open or a save in flight.
 *
 * Enabled per-athlete via `app_settings.ask_for_rpe` (default on).
 */
export function RpePrompt({ reloadSignal = 0 }: { reloadSignal?: number }) {
  const t = useTranslations('activities')
  const locale = useLocale()
  const { athlete } = useAuth()
  const enabled = athlete ? athlete.app_settings?.ask_for_rpe !== false : false

  const [queue, setQueue] = useState<Activity[]>([])
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const [rpe, setRpe] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [commute, setCommute] = useState(false)
  const [saving, setSaving] = useState(false)

  // Reset for the *next* ride in the queue. The commute box is seeded from that
  // ride's own suggestion rather than cleared (issue #63): the whole point of
  // detection is that the athlete confirms rather than remembers to tick.
  const resetForm = useCallback((next?: Activity) => {
    setRpe(null)
    setNotes('')
    setCommute(next ? pendingCommuteSuggestion(next) !== null : false)
  }, [])

  const { data, mutate } = useSWR<RpeQueueResponse>(
    enabled ? '/api/activities/rpe-queue' : null,
    fetcher,
    { refreshInterval: RPE_POLL_MS },
  )

  // `open` and `saving` are read from callbacks that must not be rebuilt as the
  // athlete fills the form in, so they are mirrored into refs.
  const openRef = useRef(open)
  const savingRef = useRef(saving)
  useEffect(() => {
    openRef.current = open
    savingRef.current = saving
  })

  // The rides in the queue as we last saw it. What makes a poll able to tell a
  // genuinely new ride from the one that was just dismissed.
  const seenIdsRef = useRef<Set<string>>(new Set())

  /**
   * Take a freshly fetched queue and decide whether to put it in front of the
   * athlete. `force` marks the callers that count as a fresh visit; the poll
   * passes `false` and so only interrupts for a ride it has not seen before.
   */
  const applyQueue = useCallback(
    (items: Activity[], { force }: { force: boolean }) => {
      // A prompt in use is never disturbed: resetting the queue under it would
      // throw away a rating the athlete is in the middle of giving.
      if (openRef.current || savingRef.current) return

      const hasNew = items.some((a) => !seenIdsRef.current.has(a.id))
      seenIdsRef.current = new Set(items.map((a) => a.id))

      if (items.length === 0) return
      if (!force && !hasNew) return

      setQueue(items)
      setIndex(0)
      resetForm(items[0])
      setOpen(true)
    },
    [resetForm],
  )

  // The poll, and the first load: on the first pass nothing has been seen yet,
  // so everything counts as new. SWR keeps the previous object when a refetch
  // is deeply equal, so an unchanged queue does not even re-run this.
  useEffect(() => {
    if (!data) return
    applyQueue(data.items, { force: false })
  }, [data, applyQueue])

  /** Re-check the queue now and prompt for whatever is pending. */
  const refreshNow = useCallback(() => {
    // Awaiting the refetch rather than reacting to `data`: an unchanged queue
    // leaves the cached object untouched, and that must still re-prompt here.
    mutate()
      .then((fresh) => {
        if (fresh) applyQueue(fresh.items, { force: true })
      })
      .catch(() => {})
  }, [mutate, applyQueue])

  useAppResume(refreshNow)

  // The initial value is not a bump — the first load above covers that.
  const lastSignalRef = useRef(reloadSignal)
  useEffect(() => {
    if (reloadSignal === lastSignalRef.current) return
    lastSignalRef.current = reloadSignal
    refreshNow()
  }, [reloadSignal, refreshNow])

  const current = queue[index]
  const remaining = queue.length - index - 1

  const finish = useCallback(() => {
    setOpen(false)
    setQueue([])
    setIndex(0)
    resetForm()
    // Make the cache authoritative again now that the dialog is down and
    // `applyQueue` will act on what comes back.
    mutate().catch(() => {})
  }, [resetForm, mutate])

  const advance = useCallback(() => {
    if (index + 1 < queue.length) {
      setIndex(index + 1)
      resetForm(queue[index + 1])
    } else {
      finish()
    }
  }, [index, queue, resetForm, finish])

  // Advance the server-side cursor past this ride. The backend merges
  // app_settings, so sending just `rpe_head` preserves the other keys.
  async function advanceHead(activity: Activity) {
    await apiFetch('/api/athlete', {
      method: 'PATCH',
      body: JSON.stringify({ app_settings: { rpe_head: activity.created_at } }),
    })

    // Take the ride out of the cached queue as well (issue #86). Without this
    // the cache still holds it, and the next mount — navigating away from the
    // dashboard and back — is served that stale queue synchronously while
    // `seenIdsRef` starts empty, so an already-rated ride reads as new and the
    // prompt re-opens on it. The revalidation that would correct it arrives to
    // find the dialog open and backs off, leaving it up. Revalidating is left
    // to `finish`: it must not race the next ride into view.
    seenIdsRef.current.add(activity.id)
    mutate(
      (prev) =>
        prev && { ...prev, items: prev.items.filter((a) => a.id !== activity.id) },
      { revalidate: false },
    ).catch(() => {})
  }

  /**
   * What to send for the commute box, given what the athlete left it on.
   *
   * When a suggestion is pending, both answers matter and both are sent: a tick
   * accepts it, an untick *dismisses* it. Dismissing is the half that is easy to
   * miss and the half that matters most — without it the same ride is proposed
   * again after every reprocess, and the athlete's "no" means nothing.
   *
   * With no suggestion in play, ticking is an ordinary hand-labelling and
   * unticking is a no-op, so nothing is sent unless the box is on.
   */
  function commuteBody(activity: Activity): Record<string, unknown> {
    const suggested = pendingCommuteSuggestion(activity) !== null
    if (commute) {
      return suggested
        ? { label_answers: { commute: 'accepted' } }
        : { labels: Array.from(new Set([...(activity.labels ?? []), 'commute'])) }
    }
    return suggested ? { label_answers: { commute: 'dismissed' } } : {}
  }

  async function handleRate() {
    if (!current || rpe == null) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = { rpe, ...commuteBody(current) }
      const trimmed = notes.trim()
      if (trimmed) body.notes = trimmed
      await apiFetch(`/api/activities/${current.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      // Issue #32: re-run analysis (if enabled) now that the athlete has rated
      // this ride from the dashboard feedback prompt.
      scheduleReanalyze(current.id, {
        enabled: Boolean(athlete?.app_settings?.auto_analyze),
        locale,
      })
      await advanceHead(current)
      advance()
    } catch {
      toast({ title: t('rpePrompt.saveFailed'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleSkip() {
    if (!current) return
    setSaving(true)
    try {
      const body = commuteBody(current)
      if (Object.keys(body).length > 0) {
        await apiFetch(`/api/activities/${current.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      }
      await advanceHead(current)
      advance()
    } catch {
      toast({ title: t('rpePrompt.saveFailed'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // "Ask again later": dismiss without touching the cursor, so this same ride
  // leads the queue on the next visit.
  function handleAskLater() {
    finish()
  }

  if (!enabled || !current) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleAskLater()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('rpePrompt.title')}</DialogTitle>
          <DialogDescription>
            {current.name}
            {remaining > 0 && ` · ${t('rpePrompt.remaining', { count: remaining })}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{t('rpePrompt.scaleLow')}</span>
              <span>{t('rpePrompt.scaleHigh')}</span>
            </div>
            <div className="grid grid-cols-10 gap-1">
              {RPE_VALUES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRpe(n)}
                  className={`h-9 rounded-md text-sm font-medium border transition-colors ${
                    rpe === n
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            value={notes}
            placeholder={t('rpePrompt.notesPlaceholder')}
            rows={2}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={commute}
                onChange={(e) => setCommute(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {t('rpePrompt.markCommute')}
            </label>
            {/* Why the box arrived ticked (issue #63). A pre-ticked box with no
                explanation reads as a bug; with one it reads as the app having
                noticed something. Unticking is a real answer, not just undoing
                a default — see `commuteBody`. */}
            {pendingCommuteSuggestion(current) && (
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                {t('rpePrompt.commuteSuggested', {
                  distance: current.distance_m
                    ? (current.distance_m / 1000).toFixed(1)
                    : '?',
                  time: new Date(current.start_time).toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={handleAskLater} disabled={saving}>
            {t('rpePrompt.askLater')}
          </Button>
          <Button variant="outline" onClick={handleSkip} disabled={saving}>
            {t('rpePrompt.skip')}
          </Button>
          <Button onClick={handleRate} disabled={saving || rpe == null}>
            {t('rpePrompt.rate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
