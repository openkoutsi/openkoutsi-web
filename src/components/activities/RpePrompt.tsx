'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Activity } from '@/lib/types'
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

/**
 * Prompts the athlete to rate the perceived effort (RPE) of recent significant
 * cycling rides (issue #28). Backed by the server-side `rpe-queue`, it works
 * through the whole pending backlog in one sitting: after each Rate/Skip it
 * advances the server-side `rpe_head` cursor and moves to the next ride;
 * "Ask again later" leaves the cursor untouched so the same ride leads the
 * queue next visit.
 *
 * Enabled per-athlete via `app_settings.ask_for_rpe` (default on). Bumping
 * `reloadSignal` re-fetches the queue — used to re-prompt after a manual upload.
 */
export function RpePrompt({ reloadSignal = 0 }: { reloadSignal?: number }) {
  const t = useTranslations('activities')
  const { athlete } = useAuth()
  const enabled = athlete ? athlete.app_settings?.ask_for_rpe !== false : false

  const [queue, setQueue] = useState<Activity[]>([])
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const [rpe, setRpe] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [commute, setCommute] = useState(false)
  const [saving, setSaving] = useState(false)

  const resetForm = useCallback(() => {
    setRpe(null)
    setNotes('')
    setCommute(false)
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    apiFetch<RpeQueueResponse>('/api/activities/rpe-queue')
      .then((data) => {
        if (cancelled || data.items.length === 0) return
        setQueue(data.items)
        setIndex(0)
        resetForm()
        setOpen(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [enabled, reloadSignal, resetForm])

  const current = queue[index]
  const remaining = queue.length - index - 1

  const finish = useCallback(() => {
    setOpen(false)
    setQueue([])
    setIndex(0)
    resetForm()
  }, [resetForm])

  const advance = useCallback(() => {
    if (index + 1 < queue.length) {
      setIndex(index + 1)
      resetForm()
    } else {
      finish()
    }
  }, [index, queue.length, resetForm, finish])

  // Advance the server-side cursor past this ride. The backend merges
  // app_settings, so sending just `rpe_head` preserves the other keys.
  async function advanceHead(activity: Activity) {
    await apiFetch('/api/athlete', {
      method: 'PATCH',
      body: JSON.stringify({ app_settings: { rpe_head: activity.created_at } }),
    })
  }

  function withCommute(activity: Activity): string[] {
    return Array.from(new Set([...(activity.labels ?? []), 'commute']))
  }

  async function handleRate() {
    if (!current || rpe == null) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = { rpe }
      const trimmed = notes.trim()
      if (trimmed) body.notes = trimmed
      if (commute) body.labels = withCommute(current)
      await apiFetch(`/api/activities/${current.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
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
      if (commute) {
        await apiFetch(`/api/activities/${current.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ labels: withCommute(current) }),
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
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={commute}
              onChange={(e) => setCommute(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            {t('rpePrompt.markCommute')}
          </label>
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
