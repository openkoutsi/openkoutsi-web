'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { apiFetch } from '@/lib/api'
import { MAINTENANCE_COMPONENTS, type MaintenanceEntry } from '@/lib/types'
import { byComponent, formatGarageKm } from '@/lib/garage'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { Plus, Trash2 } from 'lucide-react'

interface Props {
  bikeId: string
  entries: MaintenanceEntry[]
  onChanged: () => void
}

/**
 * A bike's maintenance log, grouped by component (issue #64).
 *
 * Grouped rather than one flat chronological list because the question the log
 * exists to answer — "how long did these tyres last?" — is about consecutive
 * entries *of the same component*, and a single stream interleaves them with
 * every chain and bleed in between. The server computes both spans; this only
 * arranges them so the answer sits next to the question.
 */
export function MaintenanceLog({ bikeId, entries, onChanged }: Props) {
  const t = useTranslations('garage.maintenance')
  // The shared verbs (save / cancel) live at the top of the namespace so a
  // translator writes them once rather than once per section.
  const tg = useTranslations('garage')
  const [adding, setAdding] = useState(false)
  const [performedOn, setPerformedOn] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [component, setComponent] = useState<string>('tyres')
  const [odometer, setOdometer] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const groups = byComponent(entries)

  function componentLabel(key: string) {
    // The vocabulary is advisory: the server stores whatever it is given, so a
    // component this build has no string for is shown as the athlete typed it
    // rather than as a missing-translation key.
    return (MAINTENANCE_COMPONENTS as readonly string[]).includes(key)
      ? t(`component_${key}` as never)
      : key
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const parsed = Number(odometer)
    setSaving(true)
    try {
      await apiFetch(`/api/bikes/${bikeId}/maintenance`, {
        method: 'POST',
        body: JSON.stringify({
          performed_on: performedOn,
          component,
          odometer_km: odometer && Number.isFinite(parsed) ? parsed : null,
          note: note.trim() || null,
        }),
      })
      setOdometer('')
      setNote('')
      setAdding(false)
      onChanged()
    } catch (err) {
      toast({
        title: t('saveFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(entry: MaintenanceEntry) {
    try {
      await apiFetch(`/api/bikes/${bikeId}/maintenance/${entry.id}`, { method: 'DELETE' })
      onChanged()
    } catch (err) {
      toast({
        title: t('deleteFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t('title')}</h3>
        {!adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t('add')}
          </Button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="maint-date">{t('date')}</Label>
              <Input
                id="maint-date"
                type="date"
                value={performedOn}
                onChange={(e) => setPerformedOn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maint-component">{t('component')}</Label>
              <Select value={component} onValueChange={setComponent}>
                <SelectTrigger id="maint-component">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAINTENANCE_COMPONENTS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`component_${c}` as never)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maint-odometer">{t('odometer')}</Label>
              <Input
                id="maint-odometer"
                type="number"
                min={0}
                step="any"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('odometerHelp')}</p>
          <div className="space-y-2">
            <Label htmlFor="maint-note">{t('note')}</Label>
            <Input
              id="maint-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('notePlaceholder')}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? tg('saving') : t('add')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAdding(false)}
            >
              {tg('cancel')}
            </Button>
          </div>
        </form>
      )}

      {groups.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      )}

      {groups.map(({ component: key, entries: grouped }) => (
        <div key={key} className="rounded-lg border border-border">
          <div className="border-b border-border px-3 py-2 text-sm font-medium">
            {componentLabel(key)}
          </div>
          <ul className="divide-y divide-border">
            {grouped.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>{formatDate(entry.performed_on)}</span>
                    <span className="text-muted-foreground">
                      {entry.odometer_km != null
                        ? formatGarageKm(entry.odometer_km)
                        : t('unknown')}
                    </span>
                    {entry.is_current && entry.km_since != null && (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {t('current', { km: formatGarageKm(entry.km_since) })}
                      </Badge>
                    )}
                    {entry.previous_component_km != null && (
                      <Badge variant="outline" className="text-xs font-normal">
                        {t('lasted', { km: formatGarageKm(entry.previous_component_km) })}
                      </Badge>
                    )}
                  </div>
                  {entry.note && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {entry.note}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('delete')}
                  onClick={() => handleDelete(entry)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
