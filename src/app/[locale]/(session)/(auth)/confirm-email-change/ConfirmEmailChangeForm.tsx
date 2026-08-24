'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/navigation'
import { apiFetch } from '@/lib/api'
import type { EmailChangeConfirmResponse } from '@/lib/types'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

type Status = 'confirming' | 'success' | 'partial' | 'error' | 'missing'

/**
 * Approve one side of an email-address change (issue #62).
 *
 * Serves both links a change sends: the one to the address being claimed and the
 * one to the address being left. Which side this token is, the server works out.
 *
 * Sits in the unauthenticated shell on purpose — these links are opened in
 * whichever mailbox they were sent to, routinely on a different device from the
 * one that asked. The token is the proof, so no session is needed, and unlike
 * signup verification this issues no tokens and logs nobody in.
 *
 * The half-done outcome needs saying out loud. A confirmation that lands
 * correctly but still waits on the other mailbox is a success, and if the page
 * doesn't say so the first person through reads "nothing happened" and either
 * gives up or asks for the change again, which invalidates the link the other
 * side is holding.
 */
export function ConfirmEmailChangeForm() {
  const t = useTranslations('auth')
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [status, setStatus] = useState<Status>(token ? 'confirming' : 'missing')
  const [error, setError] = useState<string | null>(null)
  // Which mailbox is still outstanding, so the page can name it.
  const [awaiting, setAwaiting] = useState<string | null>(null)
  // React 18 runs effects twice in development; the token is single-use, so a
  // second call would report the first one's success as a failure.
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    apiFetch<EmailChangeConfirmResponse>('/api/auth/confirm-email-change', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        setAwaiting(res.awaiting ?? null)
        setStatus(res.complete ? 'success' : 'partial')
      })
      .catch((err) => {
        setStatus('error')
        setError(err instanceof Error ? err.message : t('confirmEmailChange.failed'))
      })
  }, [token, t])

  const title =
    status === 'success'
      ? t('confirmEmailChange.successTitle')
      : status === 'partial'
        ? t('confirmEmailChange.partialTitle')
        : status === 'confirming'
          ? t('confirmEmailChange.confirmingTitle')
          : t('confirmEmailChange.errorTitle')
  const desc =
    status === 'success'
      ? t('confirmEmailChange.successDesc')
      : status === 'partial'
        ? awaiting === 'new'
          ? t('confirmEmailChange.partialAwaitingNew')
          : t('confirmEmailChange.partialAwaitingOld')
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
      {status === 'partial' && (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('confirmEmailChange.partialHelp')}
          </p>
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
