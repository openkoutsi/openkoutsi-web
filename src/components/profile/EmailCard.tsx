'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'

import { apiFetch, fetcher } from '@/lib/api'
import type { AccountResponse, InstanceInfoResponse } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'

/**
 * The account's email address: what it is, and how to move it (issue #62).
 *
 * Two shapes, because two kinds of account arrive here. One signed up by email
 * and is *changing* an address; the other was created from an invite, has none
 * at all, and is *setting* one — which is what gets it self-serve password reset
 * and login-by-email. The copy switches on that; the request is the same.
 *
 * Nothing here reports whether the new address was accepted, and it can't: the
 * endpoint answers identically whether the address is free or already someone
 * else's, so that a signed-in user can't use this form to ask who has an account
 * on the instance. The honest thing to show is what we actually know — that if
 * the address can be used, a link is on its way to it.
 */
export function EmailCard() {
  const t = useTranslations('app')
  const tCommon = useTranslations('common')

  const { data: instanceInfo } = useSWR<InstanceInfoResponse>(
    '/api/public/instance-info',
    fetcher,
  )
  const { data: account, mutate } = useSWR<AccountResponse>('/api/auth/account', fetcher)

  const [open, setOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // Confirming a new address means opening a link we email to it. With no
  // provider configured there is no way to do that, and the backend refuses the
  // request outright — so offering the form would only produce a 404.
  if (!instanceInfo?.email_enabled) return null

  const hasEmail = Boolean(account?.email)
  const pending = account?.pending_email ?? null

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await apiFetch('/api/auth/change-email', {
        method: 'POST',
        body: JSON.stringify({ new_email: newEmail, password }),
      })
      setOpen(false)
      setNewEmail('')
      setPassword('')
      toast({
        title: t('profile.email.requestedTitle'),
        description: t('profile.email.requestedDesc'),
      })
      mutate()
    } catch (err) {
      toast({
        title: t('profile.email.requestFailed'),
        description: err instanceof Error ? err.message : tCommon('unknownError'),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel() {
    setCancelling(true)
    try {
      await apiFetch('/api/auth/cancel-email-change', { method: 'POST' })
      toast({ title: t('profile.email.cancelled') })
      mutate()
    } catch (err) {
      toast({
        title: tCommon('error'),
        description: err instanceof Error ? err.message : tCommon('unknownError'),
        variant: 'destructive',
      })
    } finally {
      setCancelling(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('profile.email.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {hasEmail ? t('profile.email.current') : t('profile.email.none')}
          </p>
          {hasEmail && <p className="text-sm font-medium break-all">{account?.email}</p>}
          {!hasEmail && account?.username && (
            <p className="text-sm text-muted-foreground">
              {t('profile.email.usernameOnly', { username: account.username })}
            </p>
          )}
        </div>

        {pending && (
          <div className="rounded-md border border-dashed p-3 space-y-2">
            <p className="text-sm">
              {t('profile.email.pending', { email: pending })}
            </p>
            <p className="text-xs text-muted-foreground">{t('profile.email.pendingHint')}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? t('profile.email.cancelling') : t('profile.email.cancel')}
            </Button>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {hasEmail ? t('profile.email.changeDesc') : t('profile.email.setDesc')}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setNewEmail('')
            setPassword('')
            setOpen(true)
          }}
        >
          {hasEmail ? t('profile.email.changeBtn') : t('profile.email.setBtn')}
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {hasEmail ? t('profile.email.dialogTitle') : t('profile.email.dialogTitleSet')}
            </DialogTitle>
            <DialogDescription>{t('profile.email.dialogDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-email">{t('profile.email.newLabel')}</Label>
              <Input
                id="new-email"
                type="email"
                autoComplete="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={t('profile.email.newPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current-password">{t('profile.email.passwordLabel')}</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('profile.email.passwordPlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newEmail && password) handleSubmit()
                }}
              />
              <p className="text-xs text-muted-foreground">
                {t('profile.email.passwordHint')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={!newEmail || !password || submitting}>
              {submitting ? t('profile.email.sending') : t('profile.email.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
