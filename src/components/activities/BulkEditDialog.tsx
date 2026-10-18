'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/api'
import type { Bike } from '@/lib/types'
import {
  buildBulkPayload,
  CLEAR,
  EMPTY_CHOICES,
  hasChanges,
  KEEP,
  type BulkEditChoices,
  type BulkUpdateResult,
  type LabelChange,
} from '@/lib/bulkEdit'
import { ACTIVITY_LABELS } from '@/components/activities/ActivitySearchFilter'
import { ALL_CATEGORIES } from '@/components/activities/WorkoutCategoryBadge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  activityIds: string[]
  bikes: Bike[]
  /** Called after a successful apply, with what the server reported. */
  onApplied: (result: BulkUpdateResult) => void
}

/**
 * One edit for every selected activity: labels to add or remove, the bike, the
 * workout category. Every picker starts at "leave as is", and Apply stays off
 * until something is chosen — the dialog is also the confirmation, so its
 * button names how many activities it will change.
 */
export function BulkEditDialog({ open, onOpenChange, activityIds, bikes, onApplied }: Props) {
  const t = useTranslations('activities.bulk')
  const tDetail = useTranslations('activities.detail')
  const [choices, setChoices] = useState<BulkEditChoices>(EMPTY_CHOICES)
  const [saving, setSaving] = useState(false)
  const count = activityIds.length

  function handleOpenChange(next: boolean) {
    if (!next) setChoices(EMPTY_CHOICES)
    onOpenChange(next)
  }

  async function handleApply() {
    setSaving(true)
    try {
      const result = await apiFetch<BulkUpdateResult>('/api/activities/bulk', {
        method: 'POST',
        body: JSON.stringify(buildBulkPayload(activityIds, choices)),
      })
      toast({ title: t('done', { count: result.updated }) })
      setChoices(EMPTY_CHOICES)
      onApplied(result)
    } catch (err) {
      toast({
        title: t('failed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Active bikes first; a retired one is still offered, since moving old rides
  // onto the bike they were really done on is a large part of why this exists.
  const sortedBikes = [...bikes].sort(
    (a, b) => Number(Boolean(a.retired_at)) - Number(Boolean(b.retired_at)),
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title', { count })}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {ACTIVITY_LABELS.map((label) => (
            <div key={label} className="grid grid-cols-[8rem_1fr] items-center gap-3">
              <Label>{tDetail(`labels.${label}` as never)}</Label>
              <Select
                value={choices.labels[label] ?? 'keep'}
                onValueChange={(value) =>
                  setChoices((c) => ({
                    ...c,
                    labels: { ...c.labels, [label]: value as LabelChange },
                  }))
                }
              >
                <SelectTrigger aria-label={tDetail(`labels.${label}` as never)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">{t('keep')}</SelectItem>
                  <SelectItem value="add">{t('addLabel')}</SelectItem>
                  <SelectItem value="remove">{t('removeLabel')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}

          <div className="grid grid-cols-[8rem_1fr] items-center gap-3">
            <Label>{t('bike')}</Label>
            <Select
              value={choices.bike}
              onValueChange={(bike) => setChoices((c) => ({ ...c, bike }))}
            >
              <SelectTrigger aria-label={t('bike')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>{t('keep')}</SelectItem>
                <SelectItem value={CLEAR}>{t('noBike')}</SelectItem>
                {sortedBikes.map((bike) => (
                  <SelectItem key={bike.id} value={bike.id}>
                    {bike.retired_at ? t('retiredBike', { name: bike.name }) : bike.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[8rem_1fr] items-center gap-3">
            <Label>{tDetail('category.label')}</Label>
            <Select
              value={choices.category}
              onValueChange={(category) => setChoices((c) => ({ ...c, category }))}
            >
              <SelectTrigger aria-label={tDetail('category.label')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>{t('keep')}</SelectItem>
                <SelectItem value={CLEAR}>{tDetail('category.none')}</SelectItem>
                {ALL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {tDetail(`category.${cat}` as never)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {choices.bike !== KEEP && (
            <p className="text-xs text-muted-foreground">{t('bikeHelp')}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button onClick={handleApply} disabled={saving || !hasChanges(choices) || count === 0}>
            {saving ? t('applying') : t('apply', { count })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
