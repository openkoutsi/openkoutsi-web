'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/navigation'
import { apiFetch } from '@/lib/api'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

type Status = 'confirming' | 'success' | 'error' | 'missing'

/**
 * Finish an email-address change from the link mailed to the new address (issue #62).
 *
 * Sits in the unauthenticated shell on purpose: this link is opened in the new
 * mailbox, which is routinely a different device from the one that asked for the
 * change. The token is the proof, so no session is needed — and unlike signup
 * verification, confirming here issues no tokens and logs nobody in. It changes
 * an identifier on an account that already exists; the next sign-in just uses
 * the new address.
 */
export function ConfirmEmailChangeForm() {
  const t = useTranslations('auth')
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [status, setStatus] = useState<Status>(token ? 'confirming' : 'missing')
  const [error, setError] = useState<string | null>(null)
  // React 18 runs effects twice in development; the token is single-use, so a
  // second call would report the first one's success as a failure.
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    apiFetch('/api/auth/confirm-email-change', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error')
        setError(err instanceof Error ? err.message : t('confirmEmailChange.failed'))
      })
  }, [token, t])

  const title =
    status === 'success'
      ? t('confirmEmailChange.successTitle')
      : status === 'confirming'
        ? t('confirmEmailChange.confirmingTitle')
        : t('confirmEmailChange.errorTitle')
  const desc =
    status === 'success'
      ? t('confirmEmailChange.successDesc')
      : status === 'confirming'
        ? t('confirmEmailChange.confirmingDesc')
        : status === 'missing'
          ? t('confirmEmailChange.missingDesc')
          : (error ?? t('confirmEmailChange.failed'))

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      {(status === 'error' || status === 'missing') && (
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('confirmEmailChange.errorHelp')}</p>
        </CardContent>
      )}
      {status !== 'confirming' && (
        <CardFooter>
          <Link href={`/login`} className="text-sm underline underline-offset-4 hover:text-primary">
            {t('confirmEmailChange.backToSignIn')}
          </Link>
        </CardFooter>
      )}
    </Card>
  )
}
