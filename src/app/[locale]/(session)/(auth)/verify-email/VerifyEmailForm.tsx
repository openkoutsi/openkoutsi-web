'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/navigation'
import { useAuth } from '@/lib/auth'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

type Status = 'verifying' | 'success' | 'error' | 'missing'

export function VerifyEmailForm() {
  const t = useTranslations('auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const { verifyEmail } = useAuth()

  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'missing')
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    verifyEmail(token)
      .then(() => {
        setStatus('success')
        // The account is now activated and logged in; continue to onboarding.
        setTimeout(() => router.replace(`/onboarding?step=0`), 1200)
      })
      .catch((err) => {
        setStatus('error')
        setError(err instanceof Error ? err.message : t('verifyEmail.failed'))
      })
  }, [token, verifyEmail, router, t])

  const title =
    status === 'success'
      ? t('verifyEmail.successTitle')
      : status === 'verifying'
        ? t('verifyEmail.verifyingTitle')
        : t('verifyEmail.errorTitle')
  const desc =
    status === 'success'
      ? t('verifyEmail.successDesc')
      : status === 'verifying'
        ? t('verifyEmail.verifyingDesc')
        : status === 'missing'
          ? t('verifyEmail.missingDesc')
          : (error ?? t('verifyEmail.failed'))

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      {(status === 'error' || status === 'missing') && (
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('verifyEmail.errorHelp')}</p>
        </CardContent>
      )}
      {status !== 'verifying' && (
        <CardFooter>
          <Link href={`/login`} className="text-sm underline underline-offset-4 hover:text-primary">
            {t('verifyEmail.backToSignIn')}
          </Link>
        </CardFooter>
      )}
    </Card>
  )
}
