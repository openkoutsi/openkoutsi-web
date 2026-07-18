import { Trash2, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Zone } from '@/lib/types'
import { validateZones, isBlank, type ZoneErrorCode } from '@/lib/zoneValidation'

interface Props {
  zones: Zone[]
  unit: string         // e.g. "bpm" or "W"
  onChange: (zones: Zone[]) => void
}

export function ZoneEditor({ zones, unit, onChange }: Props) {
  const t = useTranslations('app')

  const errors = validateZones(zones)
  function errorFor(index: number, field: 'low' | 'high'): ZoneErrorCode | undefined {
    return errors.find((e) => e.index === index && e.field === field)?.code
  }

  function update(index: number, field: keyof Zone, raw: string) {
    const next = zones.map((z, i) => {
      if (i !== index) return z
      if (field === 'name') return { ...z, name: raw }
      // An empty field is kept as NaN so the input can be cleared completely;
      // save-time validation reports it as required.
      if (raw.trim() === '') return { ...z, [field]: NaN }
      const n = parseInt(raw, 10)
      return { ...z, [field]: isNaN(n) ? z[field] : n }
    })
    onChange(next)
  }

  function add() {
    const last = zones[zones.length - 1]
    const lastHigh = last && !isBlank(last.high) ? last.high : 0
    onChange([
      ...zones,
      { name: `Z${zones.length + 1}`, low: last ? lastHigh : 0, high: last ? lastHigh + 50 : 100 },
    ])
  }

  function remove(index: number) {
    onChange(zones.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {zones.length > 0 && (
        <div className="grid grid-cols-[1fr_80px_80px_32px] gap-2 text-xs text-muted-foreground px-1">
          <span>{t('profile.zoneEditor.name')}</span>
          <span>{t('profile.zoneEditor.low', { unit })}</span>
          <span>{t('profile.zoneEditor.high', { unit })}</span>
          <span />
        </div>
      )}

      {zones.map((zone, i) => {
        const lowError = errorFor(i, 'low')
        const highError = errorFor(i, 'high')
        return (
          <div key={i} className="space-y-1">
            <div className="grid grid-cols-[1fr_80px_80px_32px] gap-2 items-center">
              <Input
                value={zone.name}
                onChange={(e) => update(i, 'name', e.target.value)}
                placeholder={`Z${i + 1}`}
                className="h-8 text-sm"
              />
              <Input
                type="number"
                inputMode="numeric"
                value={isBlank(zone.low) ? '' : zone.low}
                onChange={(e) => update(i, 'low', e.target.value)}
                aria-invalid={lowError ? true : undefined}
                className={cn('h-8 text-sm', lowError && 'border-destructive focus-visible:ring-destructive')}
              />
              <Input
                type="number"
                inputMode="numeric"
                value={isBlank(zone.high) ? '' : zone.high}
                onChange={(e) => update(i, 'high', e.target.value)}
                aria-invalid={highError ? true : undefined}
                className={cn('h-8 text-sm', highError && 'border-destructive focus-visible:ring-destructive')}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => remove(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {(lowError || highError) && (
              <p className="text-xs text-destructive px-1">
                {t(`profile.zoneEditor.errors.${lowError ?? highError}`)}
              </p>
            )}
          </div>
        )
      })}

      <Button type="button" variant="outline" size="sm" className="mt-1" onClick={add}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        {t('profile.zoneEditor.addZone')}
      </Button>
    </div>
  )
}
