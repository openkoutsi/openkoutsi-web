'use client'

import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Link } from '@/navigation'

/**
 * Shared upsell shown when an AI feature is denied on a gated instance
 * (issue #9). The typed `LlmSubscriptionRequiredError` from the API layer is the
 * trigger; pages catch it and render this. Phase 1 shows static "contact the
 * administrator" copy and a link to the AI settings (where BYOK lives).
 */
export function LlmUpsell({ className }: { className?: string }) {
  const t = useTranslations('common')
  return (
    <div
      className={`rounded-lg border border-border bg-muted/40 p-4 text-sm ${className ?? ''}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium">{t('llm.upsellTitle')}</p>
          <p className="text-muted-foreground">{t('llm.upsellBody')}</p>
          <p className="text-muted-foreground">{t('llm.upsellContactAdmin')}</p>
          <Link
            href="/settings"
            className="mt-1 inline-block font-medium text-primary hover:underline"
          >
            {t('llm.upsellSettingsLink')}
          </Link>
        </div>
      </div>
    </div>
  )
}
