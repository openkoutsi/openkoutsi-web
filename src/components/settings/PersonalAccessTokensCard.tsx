'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'

import { apiFetch, fetcher } from '@/lib/api'
import type {
  InstanceInfoResponse,
  PersonalAccessTokenCreated,
  PersonalAccessTokenResponse,
  TokenScopesResponse,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

/**
 * Create → show-once → list → revoke.
 *
 * The secret is returned exactly once, at creation, so the create dialog
 * reuses the copy-once shape the invitation dialog already established: the
 * form is replaced by the value and a copy button, and closing the dialog is
 * the point of no return.
 *
 * Scopes and expiry are read-only on an existing token because a token is
 * immutable — widening one means revoking it and issuing a new one, which keeps
 * a token id a stable answer to "what could this credential do?".
 */
function CreateTokenDialog({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations('app')
  const tCommon = useTranslations('common')
  const { data: vocabulary } = useSWR<TokenScopesResponse>('/api/tokens/scopes', fetcher)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [days, setDays] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<PersonalAccessTokenCreated | null>(null)
  const [copied, setCopied] = useState(false)

  const lifetimes = vocabulary?.allowed_lifetime_days ?? []
  const chosenDays = days ?? vocabulary?.default_lifetime_days ?? 90
  const ordinary = vocabulary?.scopes.filter((s) => !s.sensitive) ?? []
  const sensitive = vocabulary?.scopes.filter((s) => s.sensitive) ?? []

  function toggleScope(scope: string) {
    setSelected((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    )
  }

  async function handleCreate() {
    setLoading(true)
    try {
      const res = await apiFetch<PersonalAccessTokenCreated>('/api/tokens', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          scopes: selected,
          expires_in_days: chosenDays,
        }),
      })
      setCreated(res)
      onCreated()
    } catch (err) {
      toast({
        title: t('settings.tokens.createFailed'),
        description: err instanceof Error ? err.message : tCommon('unknownError'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!created) return
    await navigator.clipboard.writeText(created.token)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleClose() {
    setOpen(false)
    setCreated(null)
    setCopied(false)
    setName('')
    setSelected([])
    setDays(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button size="sm">{t('settings.tokens.create')}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {created ? t('settings.tokens.createdTitle') : t('settings.tokens.createTitle')}
          </DialogTitle>
        </DialogHeader>

        {created ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('settings.tokens.copyOnce')}</p>
            <div className="flex gap-2">
              <Input value={created.token} readOnly className="font-mono text-xs" />
              <Button size="sm" onClick={handleCopy}>
                {copied ? t('settings.tokens.copied') : t('settings.tokens.copy')}
              </Button>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {t('settings.tokens.copyOnceWarning')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token-name">{t('settings.tokens.name')}</Label>
              <Input
                id="token-name"
                placeholder={t('settings.tokens.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('settings.tokens.scopes')}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.tokens.scopesDesc')}</p>
              <div className="space-y-1">
                {ordinary.map((scope) => (
                  <label
                    key={scope.name}
                    className="flex items-start gap-2 rounded-md border border-input p-2 cursor-pointer hover:border-foreground/40"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.includes(scope.name)}
                      onChange={() => toggleScope(scope.name)}
                    />
                    <span className="space-y-0.5">
                      <span className="block font-mono text-xs">{scope.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {scope.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {sensitive.length > 0 && (
              <div className="space-y-2">
                {/* Presented apart from the ordinary read scopes: one call that
                    returns the whole record deserves a deliberate tick. */}
                <Label>{t('settings.tokens.sensitiveScopes')}</Label>
                <div className="space-y-1">
                  {sensitive.map((scope) => (
                    <label
                      key={scope.name}
                      className="flex items-start gap-2 rounded-md border border-amber-500/60 bg-amber-500/5 p-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected.includes(scope.name)}
                        onChange={() => toggleScope(scope.name)}
                      />
                      <span className="space-y-0.5">
                        <span className="block font-mono text-xs">{scope.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {scope.description}
                        </span>
                        <span className="block text-xs text-amber-600 dark:text-amber-500">
                          {t('settings.tokens.exportWarning')}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('settings.tokens.expiry')}</Label>
              <div className="flex gap-2 flex-wrap">
                {lifetimes.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDays(value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      chosenDays === value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-muted text-muted-foreground hover:border-foreground'
                    }`}
                  >
                    {t('settings.tokens.days', { days: value })}
                  </button>
                ))}
              </div>
              {/* There is no "never": a credential that never dies outlives the
                  integration it was made for. */}
              <p className="text-xs text-muted-foreground">{t('settings.tokens.expiryDesc')}</p>
            </div>
          </div>
        )}

        <DialogFooter>
          {created ? (
            <Button onClick={handleClose}>{t('settings.tokens.done')}</Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={loading || !name.trim() || selected.length === 0}
            >
              {loading ? t('settings.tokens.creating') : t('settings.tokens.createSubmit')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TokenRow({
  token,
  onRevoke,
}: {
  token: PersonalAccessTokenResponse
  onRevoke: (id: string) => void
}) {
  const t = useTranslations('app')
  const dead = token.status !== 'active'

  return (
    <div
      className={`rounded-md border border-input p-3 space-y-2 ${dead ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-medium truncate">{token.name}</p>
          <p className="text-xs text-muted-foreground">
            {token.status === 'revoked'
              ? t('settings.tokens.revokedOn', { date: formatDate(token.revoked_at) })
              : token.status === 'expired'
                ? t('settings.tokens.expiredOn', { date: formatDate(token.expires_at) })
                : t('settings.tokens.expiresOn', { date: formatDate(token.expires_at) })}
            {' · '}
            {token.last_used_at
              ? t('settings.tokens.lastUsed', { date: formatDate(token.last_used_at) })
              : t('settings.tokens.neverUsed')}
          </p>
        </div>
        {!dead && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive">
                {t('settings.tokens.revoke')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('settings.tokens.revokeConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('settings.tokens.revokeConfirmDesc', { name: token.name })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('settings.tokens.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={() => onRevoke(token.id)}>
                  {t('settings.tokens.revoke')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {/* Scopes are read-only: a token cannot be edited, only replaced. */}
      <div className="flex flex-wrap gap-1">
        {token.scopes.map((scope) => (
          <span
            key={scope}
            className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
          >
            {scope}
          </span>
        ))}
      </div>
    </div>
  )
}

export function PersonalAccessTokensCard() {
  const t = useTranslations('app')
  const tCommon = useTranslations('common')
  const { data: instanceInfo } = useSWR<InstanceInfoResponse>(
    '/api/public/instance-info',
    fetcher,
  )
  // The instance switch may be off — a self-hoster is entitled to forbid
  // long-lived credentials on their box, and then this card should not exist.
  const enabled = instanceInfo?.allow_personal_access_tokens ?? false

  const { data: tokens, mutate } = useSWR<PersonalAccessTokenResponse[]>(
    enabled ? '/api/tokens' : null,
    fetcher,
  )

  async function revoke(id: string) {
    try {
      await apiFetch(`/api/tokens/${id}`, { method: 'DELETE' })
      mutate()
      toast({ title: t('settings.tokens.revoked') })
    } catch (err) {
      toast({
        title: t('settings.tokens.revokeFailed'),
        description: err instanceof Error ? err.message : tCommon('unknownError'),
        variant: 'destructive',
      })
    }
  }

  if (!enabled) return null

  const active = tokens?.filter((token) => token.status === 'active') ?? []
  const dead = tokens?.filter((token) => token.status !== 'active') ?? []

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base">{t('settings.tokens.title')}</CardTitle>
            <CardDescription>{t('settings.tokens.desc')}</CardDescription>
          </div>
          <CreateTokenDialog onCreated={mutate} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!tokens ? (
          <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('settings.tokens.empty')}</p>
        ) : (
          <>
            {active.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">{t('settings.tokens.active')}</h4>
                {active.map((token) => (
                  <TokenRow key={token.id} token={token} onRevoke={revoke} />
                ))}
              </div>
            )}
            {/* Dead tokens are kept rather than deleted, so this list is the
                user's own record of what they issued. */}
            {dead.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">{t('settings.tokens.inactive')}</h4>
                {dead.map((token) => (
                  <TokenRow key={token.id} token={token} onRevoke={revoke} />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
