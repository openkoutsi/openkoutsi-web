'use client'

import { useTranslations } from 'next-intl'

import type { TargetMode } from '@/lib/courses'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Props {
  mode: TargetMode
  value: string
  onModeChange: (mode: TargetMode) => void
  onValueChange: (value: string) => void
  disabled?: boolean
  /** Ties an outer `<Label>` to the mode select, which is the first control. */
  id?: string
}

/**
 * Pick what a course is paced to: nothing, a finish time, or an average power
 * (issue #61).
 *
 * One control for both targets rather than two fields, because they are
 * alternatives — the backend clears one when the other is set — and two boxes
 * would invite filling in both and then having one silently discarded. The
 * upload form and the detail editor share it so that "4:30" means the same
 * thing before and after the upload.
 */
export function CourseTargetPicker({
  mode,
  value,
  onModeChange,
  onValueChange,
  disabled,
  id,
}: Props) {
  const t = useTranslations('courses')
  const isPower = mode === 'power'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={mode}
        onValueChange={(v) => onModeChange(v as TargetMode)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-auto min-w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t('target.none')}</SelectItem>
          <SelectItem value="time">{t('target.time')}</SelectItem>
          <SelectItem value="power">{t('target.power')}</SelectItem>
        </SelectContent>
      </Select>

      {mode !== 'none' && (
        <div className="flex items-center gap-1.5">
          <Input
            className="w-28 tabular-nums"
            value={value}
            disabled={disabled}
            inputMode={isPower ? 'numeric' : 'text'}
            aria-label={isPower ? t('target.power') : t('target.time')}
            placeholder={isPower ? t('target.powerPlaceholder') : t('target.timePlaceholder')}
            onChange={(e) => onValueChange(e.target.value)}
          />
          {isPower && (
            <span className="text-sm text-muted-foreground">{t('target.watts')}</span>
          )}
        </div>
      )}
    </div>
  )
}

/** The one-line explanation under the picker, for the mode in force. */
export function targetHelpKey(mode: TargetMode): 'target.noneHelp' | 'target.timeHelp' | 'target.powerHelp' {
  if (mode === 'time') return 'target.timeHelp'
  if (mode === 'power') return 'target.powerHelp'
  return 'target.noneHelp'
}
