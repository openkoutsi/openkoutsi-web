import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Zone } from '@/lib/types'
import { validateZones, isBlank, type ZoneErrorCode } from '@/lib/zoneValidation'

interface Props {
  zones: Zone[]
  unit: string         // e.g. "bpm" or "W"
  /** How many zones this model has — 5 for HR, 7 for power. */
  count: number
  /** Canonical zone names for this model, used as the fixed row labels. */
  names: string[]
  onChange: (zones: Zone[]) => void
}

/**
 * Editor for one zone model.
 *
 * The row count and the zone names are fixed (issue #38). Zones used to be a
 * free-form list of any length with editable names, which meant nothing built
 * on top of them could tell what a given zone was supposed to represent — the
 * three-band intensity mapping reads zones by position, so "Z3" has to be the
 * third zone of seven and not the top zone of three. Only the boundaries are
 * the athlete's to set.
 */
export function ZoneEditor({ zones, unit, count, names, onChange }: Props) {
  const t = useTranslations('app')

  const errors = validateZones(zones, count)
  function errorFor(index: number, field: 'low' | 'high'): ZoneErrorCode | undefined {
    return errors.find((e) => e.index === index && e.field === field)?.code
  }

  function update(index: number, field: 'low' | 'high', raw: string) {
    const next = zones.map((z, i) => {
      if (i !== index) return z
      // An empty field is kept as NaN so the input can be cleared completely;
      // save-time validation reports it as required.
      if (raw.trim() === '') return { ...z, [field]: NaN }
      const n = parseInt(raw, 10)
      return { ...z, [field]: isNaN(n) ? z[field] : n }
    })
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_80px_80px] gap-2 text-xs text-muted-foreground px-1">
        <span>{t('profile.zoneEditor.name')}</span>
        <span>{t('profile.zoneEditor.low', { unit })}</span>
        <span>{t('profile.zoneEditor.high', { unit })}</span>
      </div>

      {zones.map((zone, i) => {
        const lowError = errorFor(i, 'low')
        const highError = errorFor(i, 'high')
        return (
          <div key={i} className="space-y-1">
            <div className="grid grid-cols-[1fr_80px_80px] gap-2 items-center">
              <span className="text-sm truncate" title={names[i] ?? zone.name}>
                {names[i] ?? zone.name}
              </span>
              <Input
                type="number"
                inputMode="numeric"
                value={isBlank(zone.low) ? '' : zone.low}
                onChange={(e) => update(i, 'low', e.target.value)}
                aria-invalid={lowError ? true : undefined}
                aria-label={`${names[i] ?? zone.name} ${t('profile.zoneEditor.low', { unit })}`}
                className={cn('h-8 text-sm', lowError && 'border-destructive focus-visible:ring-destructive')}
              />
              <Input
                type="number"
                inputMode="numeric"
                value={isBlank(zone.high) ? '' : zone.high}
                onChange={(e) => update(i, 'high', e.target.value)}
                aria-invalid={highError ? true : undefined}
                aria-label={`${names[i] ?? zone.name} ${t('profile.zoneEditor.high', { unit })}`}
                className={cn('h-8 text-sm', highError && 'border-destructive focus-visible:ring-destructive')}
              />
            </div>
            {(lowError || highError) && (
              <p className="text-xs text-destructive px-1">
                {t(`profile.zoneEditor.errors.${lowError ?? highError}`)}
              </p>
            )}
          </div>
        )
      })}

      <p className="text-xs text-muted-foreground px-1">
        {t('profile.zoneEditor.fixedCount', { count })}
      </p>
    </div>
  )
}
