'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import { showAdherenceScores } from '@/lib/adherence'
import { showWeeklyLoad } from '@/lib/weeklyLoad'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { useCompleteOnboarding } from '@/components/onboarding/useCompleteOnboarding'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'

interface Props {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

export function Step4Analysis({ onNext, onBack, onSkip }: Props) {
  const t = useTranslations('onboarding')
  const tCommon = useTranslations('common')
  const { athlete, refreshAthlete } = useAuth()
  const completeOnboarding = useCompleteOnboarding()
  const settings = (athlete?.app_settings ?? {}) as Record<string, unknown>
  const [autoAnalyze, setAutoAnalyze] = useState(Boolean(settings.auto_analyze))
  const [adherence, setAdherence] = useState(showAdherenceScores(settings))
  const [weeklyLoad, setWeeklyLoad] = useState(showWeeklyLoad(settings))
  const [saving, setSaving] = useState(false)

  /** PATCH a single app_settings flag, optimistically updating local state. */
  async function saveFlag(
    key: string,
    checked: boolean,
    setLocal: (value: boolean) => void,
  ) {
    setLocal(checked)
    setSaving(true)
    try {
      const existing = (athlete?.app_settings ?? {}) as Record<string, unknown>
      await apiFetch('/api/athlete', {
        method: 'PATCH',
        body: JSON.stringify({ app_settings: { ...existing, [key]: checked } }),
      })
      await refreshAthlete()
    } catch (err) {
      toast({ title: tCommon('error'), description: err instanceof Error ? err.message : tCommon('unknownError'), variant: 'destructive' })
      setLocal(!checked)
    } finally {
      setSaving(false)
    }
  }

  return (
    <WizardShell
      step={4}
      title={t('step4.title')}
      onNext={onNext}
      onBack={onBack}
      onSkip={onSkip}
      onSkipAll={completeOnboarding}
      saving={saving}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('step4.subtitle')}</p>

        <div className="flex items-center gap-3 rounded-md border p-4">
          <Switch
            id="ob-auto-analyze"
            checked={autoAnalyze}
            onCheckedChange={(checked) => saveFlag('auto_analyze', checked, setAutoAnalyze)}
            disabled={saving}
          />
          <div>
            <Label htmlFor="ob-auto-analyze" className="text-sm font-medium cursor-pointer">
              {t('step4.toggle')}
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">{t('step4.toggleDesc')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-md border p-4">
          <Switch
            id="ob-weekly-load"
            checked={weeklyLoad}
            onCheckedChange={(checked) => saveFlag('show_weekly_load', checked, setWeeklyLoad)}
            disabled={saving}
          />
          <div>
            <Label htmlFor="ob-weekly-load" className="text-sm font-medium cursor-pointer">
              {t('step4.weeklyLoadToggle')}
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">{t('step4.weeklyLoadToggleDesc')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-md border p-4">
          <Switch
            id="ob-adherence"
            checked={adherence}
            onCheckedChange={(checked) => saveFlag('show_adherence', checked, setAdherence)}
            disabled={saving}
          />
          <div>
            <Label htmlFor="ob-adherence" className="text-sm font-medium cursor-pointer">
              {t('step4.adherenceToggle')}
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">{t('step4.adherenceToggleDesc')}</p>
          </div>
        </div>
      </div>
    </WizardShell>
  )
}
