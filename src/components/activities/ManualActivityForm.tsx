'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import type { ManualActivityCreate } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { SPORT_TYPES } from '@/components/activities/ActivitySearchFilter'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Parse a numeric input; empty/invalid → undefined. */
function num(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function ManualActivityForm({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations('activities')
  const tCommon = useTranslations('common')

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [sportType, setSportType] = useState('')
  const [date, setDate] = useState(todayIso())
  const [durationMin, setDurationMin] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [avgHr, setAvgHr] = useState('')
  const [maxHr, setMaxHr] = useState('')
  const [avgPower, setAvgPower] = useState('')
  const [avgCadence, setAvgCadence] = useState('')
  const [elevation, setElevation] = useState('')
  const [rpe, setRpe] = useState('')
  const [load, setLoad] = useState('')
  const [name, setName] = useState('')

  function reset() {
    setSportType('')
    setDate(todayIso())
    setDurationMin('')
    setDistanceKm('')
    setAvgHr('')
    setMaxHr('')
    setAvgPower('')
    setAvgCadence('')
    setElevation('')
    setRpe('')
    setLoad('')
    setName('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const durationSec = num(durationMin)
    const distanceM = num(distanceKm)
    const payload: ManualActivityCreate = {
      sport_type: sportType || undefined,
      start_time: date ? new Date(date).toISOString() : undefined,
      duration_s: durationSec !== undefined ? Math.round(durationSec * 60) : undefined,
      distance_m: distanceM !== undefined ? distanceM * 1000 : undefined,
      elevation_m: num(elevation),
      avg_hr: num(avgHr),
      max_hr: num(maxHr),
      avg_power: num(avgPower),
      avg_cadence: num(avgCadence),
      rpe: num(rpe),
      load: num(load),
      name: name.trim() || undefined,
    }

    // Guardrail matching the backend: at least one field must be set.
    if (Object.values(payload).every((v) => v === undefined)) {
      toast({ title: t('manualEntry.emptyError'), variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      await apiFetch('/api/activities', { method: 'POST', body: JSON.stringify(payload) })
      toast({ title: t('manualEntry.created') })
      reset()
      setOpen(false)
      onCreated()
    } catch (err) {
      toast({
        title: tCommon('error'),
        description: err instanceof Error ? err.message : tCommon('unknownError'),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t('manualEntry.addActivity')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('manualEntry.title')}</DialogTitle>
          <DialogDescription>{t('manualEntry.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('manualEntry.sportType')}</Label>
              <Select
                value={sportType || '_none'}
                onValueChange={(v) => setSportType(v === '_none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t('manualEntry.none')}</SelectItem>
                  {SPORT_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma-date">{t('manualEntry.date')}</Label>
              <Input id="ma-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma-duration">{t('manualEntry.duration')}</Label>
              <Input id="ma-duration" type="number" min="0" step="any" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma-distance">{t('manualEntry.distance')}</Label>
              <Input id="ma-distance" type="number" min="0" step="any" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma-avghr">{t('manualEntry.avgHr')}</Label>
              <Input id="ma-avghr" type="number" min="0" step="any" value={avgHr} onChange={(e) => setAvgHr(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma-maxhr">{t('manualEntry.maxHr')}</Label>
              <Input id="ma-maxhr" type="number" min="0" step="any" value={maxHr} onChange={(e) => setMaxHr(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma-avgpower">{t('manualEntry.avgPower')}</Label>
              <Input id="ma-avgpower" type="number" min="0" step="any" value={avgPower} onChange={(e) => setAvgPower(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma-avgcadence">{t('manualEntry.avgCadence')}</Label>
              <Input id="ma-avgcadence" type="number" min="0" step="any" value={avgCadence} onChange={(e) => setAvgCadence(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma-elevation">{t('manualEntry.elevation')}</Label>
              <Input id="ma-elevation" type="number" step="any" value={elevation} onChange={(e) => setElevation(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma-rpe">{t('manualEntry.rpe')}</Label>
              <Input id="ma-rpe" type="number" min="1" max="10" step="1" value={rpe} onChange={(e) => setRpe(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma-load">{t('manualEntry.load')}</Label>
              <Input id="ma-load" type="number" min="0" step="any" value={load} onChange={(e) => setLoad(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ma-name">{t('manualEntry.name')}</Label>
            <Input id="ma-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('manualEntry.namePlaceholder')} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? t('manualEntry.saving') : t('manualEntry.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
