'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { ApiCodeError, apiFetch } from '@/lib/api'
import { CLAIMABLE_SPORTS, type Bike, type RidingPosition } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'

const POSITIONS: RidingPosition[] = ['tops', 'hoods', 'drops', 'aero']

interface Props {
  /** Omitted when adding. */
  bike?: Bike
  onSaved: () => void
  onCancel: () => void
}

/**
 * Create or edit one bike — everything about it except its history.
 *
 * The claimed sports are checkboxes rather than a multi-select because the
 * server refuses a sport another bike already holds (409): a list the athlete
 * can see all of makes the refusal legible, where a collapsed control would
 * make it arrive out of nowhere.
 */
export function BikeForm({ bike, onSaved, onCancel }: Props) {
  const t = useTranslations('garage')
  const [name, setName] = useState(bike?.name ?? '')
  const [width, setWidth] = useState(
    bike?.tyre_width_mm != null ? String(bike.tyre_width_mm) : '',
  )
  const [position, setPosition] = useState<RidingPosition>(
    bike?.riding_position ?? 'hoods',
  )
  const [base, setBase] = useState(
    bike?.odometer_base_km != null ? String(bike.odometer_base_km) : '',
  )
  const [sports, setSports] = useState<string[]>(bike?.default_sports ?? [])
  const [saving, setSaving] = useState(false)

  function toggleSport(sport: string) {
    setSports((current) =>
      current.includes(sport)
        ? current.filter((s) => s !== sport)
        : [...current, sport],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const parsedWidth = Number(width)
    const parsedBase = Number(base)
    setSaving(true)
    try {
      await apiFetch(bike ? `/api/bikes/${bike.id}` : '/api/bikes', {
        method: bike ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: name.trim(),
          tyre_width_mm: width && Number.isFinite(parsedWidth) ? parsedWidth : null,
          riding_position: position,
          odometer_base_km: base && Number.isFinite(parsedBase) ? parsedBase : null,
          default_sports: sports,
        }),
      })
      onSaved()
    } catch (err) {
      // The 409 names the bike already holding the sport, so the athlete is
      // told what to change rather than just that something was wrong.
      const clash =
        err instanceof ApiCodeError && err.code === 'sport_already_claimed'
          ? (err.detail as { sport?: string; bike_name?: string } | undefined)
          : undefined
      toast({
        title: clash?.sport
          ? t('sports.conflict', {
              sport: t(`sports.${clash.sport}` as never),
              bike: clash.bike_name ?? '',
            })
          : t('saveFailed'),
        description: clash
          ? undefined
          : err instanceof Error
            ? err.message
            : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="bike-name">{t('name')}</Label>
        <Input
          id="bike-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bike-width">{t('tyreWidth')}</Label>
          <Input
            id="bike-width"
            type="number"
            min={10}
            max={80}
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            placeholder="28"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bike-position">{t('ridingPosition')}</Label>
          <Select value={position} onValueChange={(v) => setPosition(v as RidingPosition)}>
            <SelectTrigger id="bike-position">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POSITIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`position.${p}` as never)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t('pacingNote')}</p>

      <div className="space-y-2">
        <Label htmlFor="bike-base">{t('distance.base')}</Label>
        <Input
          id="bike-base"
          type="number"
          min={0}
          step="any"
          value={base}
          onChange={(e) => setBase(e.target.value)}
          placeholder="0"
        />
        <p className="text-xs text-muted-foreground">{t('distance.baseHelp')}</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('sports.title')}</legend>
        <p className="text-xs text-muted-foreground">{t('sports.help')}</p>
        <div className="flex flex-wrap gap-2">
          {CLAIMABLE_SPORTS.map((sport) => {
            const active = sports.includes(sport)
            return (
              <button
                key={sport}
                type="button"
                aria-pressed={active}
                onClick={() => toggleSport(sport)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                }`}
              >
                {t(`sports.${sport}` as never)}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving || !name.trim()}>
          {saving ? t('saving') : t('save')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  )
}
