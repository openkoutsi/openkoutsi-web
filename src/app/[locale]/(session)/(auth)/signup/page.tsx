'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { Link } from '@/navigation'
import { useAuth } from '@/lib/auth'
import { fetcher } from '@/lib/api'
import type { InstanceInfoResponse } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignupPage() {
  const t = useTranslations('auth')
  const { signup } = useAuth()
  const { data: instanceInfo, isLoading, error: infoError } = useSWR<InstanceInfoResponse>(
    '/api/public/instance-info',
    fetcher,
  )

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError(t('signup.passwordMismatch'))
      return
    }
    setError(null)
    setLoading(true)
    try {
      await signup(email, password)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('signup.failed'))
    } finally {
      setLoading(false)
    }
  }

  // A successful submit always lands on the "check your email" state.
  if (sent) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{t('signup.checkEmailTitle')}</CardTitle>
          <CardDescription>{t('signup.checkEmailDesc', { email })}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href={`/login`} className="text-sm underline underline-offset-4 hover:text-primary">
            {t('signup.backToSignIn')}
          </Link>
        </CardFooter>
      </Card>
    )
  }

  // Don't render anything until we can determine availability, so the form never
  // flashes before the gate resolves.
  if (isLoading) {
    return null
  }

  // Fail closed: show the form only once signup is positively confirmed enabled.
  // An SWR error or an explicit `false` both land here (the backend enforces the
  // real gate regardless).
  if (infoError || !instanceInfo?.allow_self_signup) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{t('signup.unavailableTitle')}</CardTitle>
          <CardDescription>{t('signup.unavailableDesc')}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href={`/login`} className="text-sm underline underline-offset-4 hover:text-primary">
            {t('signup.backToSignIn')}
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">{t('signup.title')}</CardTitle>
        <CardDescription>{t('signup.description')}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="email">{t('signup.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('signup.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('signup.password')}</Label>
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
            <Label htmlFor="confirm">{t('signup.confirm')}</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('signup.hint')}</p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('signup.submitting') : t('signup.submit')}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            {t('signup.hasAccount')}{' '}
            <Link href={`/login`} className="underline underline-offset-4 hover:text-primary">
              {t('signup.signIn')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
