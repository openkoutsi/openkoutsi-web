'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/navigation'
import { apiFetch, fetcher } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { InstanceInfoResponse } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export function ResetPasswordForm() {
  const t = useTranslations('auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!token) {
    return <NoTokenCard />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError(t('resetPassword.passwordMismatch'))
      return
    }
    setError(null)
    setLoading(true)
    try {
      await apiFetch(
        `/api/auth/reset-password`,
        {
          method: 'POST',
          body: JSON.stringify({ token, new_password: password }),
        },
        false,
      )
      router.replace(`/login`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('resetPassword.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">{t('resetPassword.setTitle')}</CardTitle>
        <CardDescription>{t('resetPassword.setDesc')}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">{t('resetPassword.newPassword')}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">{t('resetPassword.confirm')}</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('resetPassword.hint')}
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('resetPassword.submitting') : t('resetPassword.submit')}
          </Button>
          <Link
            href={`/login`}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
          >
            {t('resetPassword.backToSignIn')}
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}

function NoTokenCard() {
  const { data } = useSWR<InstanceInfoResponse>('/api/public/instance-info', fetcher)
  // When email is configured, offer the self-serve "email me a link" form;
  // otherwise fall back to the admin-contact message.
  if (data?.email_enabled) {
    return <RequestResetCard />
  }
  return <ContactAdminCard adminContact={data?.admin_contact ?? null} />
}

function RequestResetCard() {
  const t = useTranslations('auth')
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await requestPasswordReset(email)
    } catch {
      // Endpoint is non-enumerating and always succeeds; ignore transport errors
      // so we never reveal whether an account exists.
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  if (sent) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{t('forgotPassword.sentTitle')}</CardTitle>
          <CardDescription>{t('forgotPassword.sentDesc')}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href={`/login`} className="text-sm underline underline-offset-4 hover:text-primary">
            {t('resetPassword.backToSignIn')}
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">{t('forgotPassword.title')}</CardTitle>
        <CardDescription>{t('forgotPassword.description')}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('forgotPassword.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('forgotPassword.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
          </Button>
          <Link
            href={`/login`}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
          >
            {t('resetPassword.backToSignIn')}
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}

function ContactAdminCard({ adminContact }: { adminContact: string | null }) {
  const t = useTranslations('auth')

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">{t('resetPassword.noTokenTitle')}</CardTitle>
        <CardDescription>{t('resetPassword.noTokenDesc')}</CardDescription>
      </CardHeader>
      {adminContact && (
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('resetPassword.adminContact')}</p>
          <p className="text-sm font-medium mt-1">{adminContact}</p>
        </CardContent>
      )}
      <CardFooter>
        <Link
          href={`/login`}
          className="text-sm underline underline-offset-4 hover:text-primary"
        >
          {t('resetPassword.backToSignIn')}
        </Link>
      </CardFooter>
    </Card>
  )
}
