'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/navigation'

export function HeroInteractive() {
  const t = useTranslations('landing')

  return (
    <div className="hero-actions">
      <Link href="/login" className="btn btn-primary">
        {t('teamEntry.submit')}
      </Link>
    </div>
  )
}
