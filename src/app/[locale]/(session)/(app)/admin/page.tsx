'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/navigation'
import useSWR from 'swr'
import { useAuth } from '@/lib/auth'
import { apiFetch, fetcher } from '@/lib/api'
import type {
  AdminPersonalAccessTokenResponse,
  UserResponse,
  InvitationResponse,
  InstanceSettingsResponse,
  InstanceSettingsPatch,
  LlmUsageSummaryResponse,
  Page,
} from '@/lib/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

// Roles available in the single-instance model. The `coach` role no longer exists.
const ALL_ROLES = ['administrator', 'user'] as const

/**
 * Whether the account's email address has been confirmed, shown in the users
 * table under the identifier it is about.
 *
 * A self-serve signup writes the account row before the address is confirmed,
 * so one nobody finished leaves a row that can never sign in — login by email
 * requires the stamp — while listing exactly like a working account. This is
 * the only place an admin can tell the two apart, and it changes what they do:
 * an unconfirmed row wants a fresh signup or a delete, not a password reset.
 *
 * Renders nothing when there is no address, because then there is nothing to
 * confirm: an invite-created account is reached by username, and labelling it
 * "not confirmed" would invent a problem it does not have.
 */
function EmailConfirmationBadge({ user }: { user: UserResponse }) {
  const t = useTranslations('admin')
  if (!user.email) return null
  if (!user.email_verified_at) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-500">
        {t('users.emailUnconfirmed')}
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400"
      title={t('users.emailConfirmedOn', {
        date: new Date(user.email_verified_at).toLocaleDateString(),
      })}
    >
      {t('users.emailConfirmed')}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const color =
    role === 'administrator'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
      : 'bg-muted text-muted-foreground'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {role}
    </span>
  )
}

// ── A user's personal access tokens (issue #46) ─────────────────────────────
//
// Narrow on purpose, and it follows from the audit log rather than being a
// separate ambition: once rate limits and audit records are keyed by token id,
// an admin investigating a runaway integration is staring at a token id with no
// proportionate way to act on it. So: list and revoke, and nothing else.
//
// Metadata only — the API never returns a token's name, because names are
// user-written free text and revealing on their own. Revocation needs the id.
// There is no issue-on-behalf counterpart: an admin-minted token would be
// indistinguishable from one the user created. Every revocation is audited and
// lands in the user's inbox.

/**
 * Set or clear a user's email address — the recovery path (issue #62).
 *
 * A user changing their own address needs approval from the address being left
 * as well as the one being claimed, which is what stops somebody holding only
 * the password from moving the account's password-reset target. That same rule
 * strands anyone whose old mailbox is simply gone, and this is their way out.
 *
 * It is blunt on purpose, so the dialog says so before you use it: the account
 * may be in the wrong hands, so saving signs out every session and revokes every
 * access token the user holds.
 */
function UserEmailDialog({
  user,
  onSave,
}: {
  user: UserResponse
  onSave: (userId: string, email: string | null) => Promise<void>
}) {
  const t = useTranslations('admin')
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(user.email ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(email: string | null) {
    setSaving(true)
    setError(null)
    try {
      await onSave(user.id, email)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('users.updateFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setValue(user.email ?? '')
          setError(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {t('users.email')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('users.emailTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">{t('users.emailDesc')}</p>
          <Input
            type="email"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('users.emailPlaceholder')}
          />
          <p className="text-xs text-muted-foreground">{t('users.emailWarning')}</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {user.email && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={saving}
              onClick={() => save(null)}
            >
              {t('users.emailClear')}
            </Button>
          )}
          <Button disabled={saving || !value.trim()} onClick={() => save(value.trim())}>
            {saving ? t('users.emailSaving') : t('users.emailSave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


function UserTokensDialog({ user }: { user: UserResponse }) {
  const t = useTranslations('admin')
  const [open, setOpen] = useState(false)
  const { data: tokens, mutate } = useSWR<AdminPersonalAccessTokenResponse[]>(
    open ? `/api/admin/users/${user.id}/tokens` : null,
    fetcher,
  )

  async function revoke(tokenId: string) {
    try {
      await apiFetch(`/api/admin/users/${user.id}/tokens/${tokenId}`, { method: 'DELETE' })
      toast({ title: t('users.tokenRevoked') })
      mutate()
    } catch (err) {
      toast({
        title: t('users.tokenRevokeFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">{t('users.tokens')}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('users.tokensTitle', { username: user.email ?? user.username ?? user.id })}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{t('users.tokensDesc')}</p>
        {!tokens ? (
          <p className="text-sm text-muted-foreground py-2">…</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{t('users.tokensEmpty')}</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <div
                key={token.id}
                className={`rounded-md border border-input p-3 space-y-2 ${
                  token.status === 'active' ? '' : 'opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="font-mono text-xs truncate">{token.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {t(`users.tokenStatus.${token.status}`)}
                      {' · '}
                      {t('users.tokenCreated', {
                        date: new Date(token.created_at).toLocaleDateString(),
                      })}
                      {' · '}
                      {t('users.tokenExpires', {
                        date: new Date(token.expires_at).toLocaleDateString(),
                      })}
                      {' · '}
                      {token.last_used_at
                        ? t('users.tokenLastUsed', {
                            date: new Date(token.last_used_at).toLocaleDateString(),
                          })
                        : t('users.tokenNeverUsed')}
                    </p>
                  </div>
                  {token.status === 'active' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">{t('users.tokenRevoke')}</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('users.tokenRevokeConfirmTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('users.tokenRevokeConfirmDesc')}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('users.cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => revoke(token.id)}
                          >
                            {t('users.tokenRevoke')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
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
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Users tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const t = useTranslations('admin')
  const { data: usersPage, mutate } = useSWR<Page<UserResponse>>(
    '/api/admin/users?page_size=100',
    fetcher,
  )
  const users = usersPage?.items
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftRoles, setDraftRoles] = useState<string[]>([])

  function startEdit(user: UserResponse) {
    setEditingId(user.id)
    setDraftRoles([...user.roles])
  }

  function toggleRole(role: string) {
    setDraftRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
  }

  async function saveRoles(userId: string) {
    try {
      await apiFetch(`/api/admin/users/${userId}/roles`, {
        method: 'PATCH',
        body: JSON.stringify({ roles: draftRoles }),
      })
      toast({ title: t('users.rolesUpdated') })
      setEditingId(null)
      mutate()
    } catch (err) {
      toast({
        title: t('users.updateFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  async function removeUser(userId: string) {
    try {
      await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      mutate()
    } catch (err) {
      toast({
        title: t('users.removeFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  async function setEntitlement(userId: string, status: 'active' | 'revoked') {
    try {
      await apiFetch(`/api/admin/users/${userId}/llm-entitlement`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      toast({ title: t('users.llmEntitlementUpdated') })
      mutate()
    } catch (err) {
      toast({
        title: t('users.updateFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  async function setUserEmail(userId: string, email: string | null) {
    await apiFetch(`/api/admin/users/${userId}/email`, {
      method: 'PATCH',
      body: JSON.stringify({ email }),
    })
    toast({ title: t('users.emailUpdated') })
    mutate()
  }

  async function generatePasswordReset(userId: string) {
    try {
      const res = await apiFetch<{ reset_url: string }>(
        `/api/admin/users/${userId}/password-reset`,
        { method: 'POST' },
      )
      await navigator.clipboard.writeText(res.reset_url)
      toast({ title: t('users.passwordResetDone') })
    } catch (err) {
      toast({
        title: t('users.passwordResetFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  if (!users) return <p className="text-sm text-muted-foreground py-4">Loading…</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">{t('users.account')}</th>
            <th className="pb-2 pr-4 font-medium">{t('users.roles')}</th>
            <th className="pb-2 pr-4 font-medium">{t('users.llmAccess')}</th>
            <th className="hidden sm:table-cell pb-2 pr-4 font-medium">{t('users.registeredAt')}</th>
            <th className="hidden sm:table-cell pb-2 pr-4 font-medium">{t('users.consent')}</th>
            <th className="pb-2 font-medium">{t('users.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b last:border-0">
              <td className="py-3 pr-4">
                <div className="space-y-1">
                  <p className="font-mono">{u.email ?? u.username ?? u.id}</p>
                  <EmailConfirmationBadge user={u} />
                </div>
              </td>
              <td className="py-3 pr-4">
                {editingId === u.id ? (
                  <div className="flex flex-wrap gap-1">
                    {ALL_ROLES.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium border transition-colors ${
                          draftRoles.includes(role)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-muted text-muted-foreground hover:border-foreground'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <RoleBadge key={r} role={r} />
                    ))}
                  </div>
                )}
              </td>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-2">
                  {u.llm_entitlement?.active ? (
                    <>
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                        {t('users.llmGranted')}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => setEntitlement(u.id, 'revoked')}>
                        {t('users.llmRevoke')}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEntitlement(u.id, 'active')}>
                      {t('users.llmGrant')}
                    </Button>
                  )}
                </div>
              </td>
              <td className="hidden sm:table-cell py-3 pr-4 text-muted-foreground">
                {new Date(u.created_at).toLocaleDateString()}
              </td>
              <td className="hidden sm:table-cell py-3 pr-4 text-muted-foreground">
                {u.consented_at
                  ? new Date(u.consented_at).toLocaleDateString()
                  : <span className="text-destructive/70">{t('users.noConsent')}</span>
                }
              </td>
              <td className="py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {editingId === u.id ? (
                    <>
                      <Button size="sm" onClick={() => saveRoles(u.id)}>
                        {t('users.saveRoles')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        {t('users.cancel')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => startEdit(u)}>
                        {t('users.editRoles')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generatePasswordReset(u.id)}
                      >
                        {t('users.passwordReset')}
                      </Button>
                      <UserTokensDialog user={u} />
                      <UserEmailDialog user={u} onSave={setUserEmail} />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            {t('users.remove')}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('users.removeConfirmTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('users.removeConfirmDesc', { username: u.email ?? u.username ?? u.id })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('users.cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => removeUser(u.id)}
                            >
                              {t('users.removeConfirmAction')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Invitations tab ────────────────────────────────────────────────────────────

function GenerateInviteDialog({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations('admin')
  const [open, setOpen] = useState(false)
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['user'])
  const [expiryDays, setExpiryDays] = useState<string>('7')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
  }

  async function handleGenerate() {
    setLoading(true)
    try {
      const body: { roles: string[]; expires_in_days?: number | null; note?: string } = {
        roles: selectedRoles,
        expires_in_days: expiryDays === 'never' ? null : parseInt(expiryDays),
        note: note.trim() || undefined,
      }
      const res = await apiFetch<InvitationResponse>('/api/admin/invitations', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setGeneratedUrl(res.url ?? null)
      onCreated()
    } catch (err) {
      toast({
        title: t('invitations.generateFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!generatedUrl) return
    await navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleClose() {
    setOpen(false)
    setGeneratedUrl(null)
    setCopied(false)
    setSelectedRoles(['user'])
    setExpiryDays('7')
    setNote('')
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button size="sm">{t('invitations.generate')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('invitations.generateTitle')}</DialogTitle>
        </DialogHeader>
        {generatedUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('invitations.generatedUrl')}</p>
            <div className="flex gap-2">
              <Input value={generatedUrl} readOnly className="font-mono text-xs" />
              <Button size="sm" onClick={handleCopy}>
                {copied ? t('invitations.copied') : t('invitations.copyLink')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('invitations.generateRoles')}</Label>
              <div className="flex gap-2 flex-wrap">
                {ALL_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium border transition-colors ${
                      selectedRoles.includes(role)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-muted text-muted-foreground hover:border-foreground'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('invitations.generateExpiry')}</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { val: '1', label: t('invitations.expiry1') },
                  { val: '7', label: t('invitations.expiry7') },
                  { val: '30', label: t('invitations.expiry30') },
                  { val: 'never', label: t('invitations.expiryNever') },
                ].map(({ val, label }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setExpiryDays(val)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      expiryDays === val
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-muted text-muted-foreground hover:border-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-note">{t('invitations.note')}</Label>
              <Input
                id="invite-note"
                placeholder={t('invitations.notePlaceholder')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={120}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          {generatedUrl ? (
            <Button onClick={handleClose}>{t('invitations.done')}</Button>
          ) : (
            <Button onClick={handleGenerate} disabled={loading || selectedRoles.length === 0}>
              {loading ? t('invitations.generating') : t('invitations.generateSubmit')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InvitationsTab() {
  const t = useTranslations('admin')
  const { data: invitationsPage, mutate } = useSWR<Page<InvitationResponse>>(
    '/api/admin/invitations?page_size=100',
    fetcher,
  )
  const invitations = invitationsPage?.items
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const pending = invitations?.filter((i) => !i.used_at) ?? []
  const used = invitations?.filter((i) => i.used_at) ?? []

  async function copyLink(inv: InvitationResponse) {
    if (!inv.url) return
    await navigator.clipboard.writeText(inv.url)
    setCopiedId(inv.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  async function revokeInvitation(id: string) {
    try {
      await apiFetch(`/api/admin/invitations/${id}`, { method: 'DELETE' })
      mutate()
    } catch (err) {
      toast({
        title: t('invitations.revokeFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  if (!invitations) return <p className="text-sm text-muted-foreground py-4">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('invitations.pending')}</h3>
        <GenerateInviteDialog onCreated={mutate} />
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('invitations.noPending')}</p>
      ) : (
        <div className="space-y-2">
          {pending.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center gap-3 rounded-md border px-4 py-3 text-sm"
            >
              <div className="flex gap-1 flex-wrap">
                {inv.roles.map((r) => (
                  <RoleBadge key={r} role={r} />
                ))}
              </div>
              {inv.note && (
                <span className="font-medium">{inv.note}</span>
              )}
              <span className="text-muted-foreground">
                {t('invitations.createdBy')} {inv.created_by_username}
              </span>
              <span className="text-muted-foreground">
                {inv.expires_at
                  ? `${t('invitations.expires')} ${new Date(inv.expires_at).toLocaleDateString()}`
                  : t('invitations.noExpiry')}
              </span>
              <div className="ml-auto flex gap-2">
                {inv.url && (
                  <Button size="sm" variant="outline" onClick={() => copyLink(inv)}>
                    {copiedId === inv.id ? t('invitations.copied') : t('invitations.copyLink')}
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive">
                      {t('invitations.revoke')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('invitations.revokeConfirmTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('invitations.revokeConfirmDesc')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('users.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => revokeInvitation(inv.id)}
                      >
                        {t('invitations.revokeConfirmAction')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-sm font-semibold">{t('invitations.used')}</h3>
      {used.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('invitations.noUsed')}</p>
      ) : (
        <div className="space-y-2">
          {used.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center gap-3 rounded-md border px-4 py-3 text-sm text-muted-foreground"
            >
              <div className="flex gap-1 flex-wrap">
                {inv.roles.map((r) => (
                  <RoleBadge key={r} role={r} />
                ))}
              </div>
              {inv.note && (
                <span className="font-medium text-foreground">{inv.note}</span>
              )}
              <span>
                {t('invitations.usedBy')} {inv.used_by_username}
              </span>
              {inv.used_at && (
                <span>
                  {t('invitations.usedAt')} {new Date(inv.used_at).toLocaleDateString()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Settings tab ───────────────────────────────────────────────────────────────

interface LlmTestResult {
  ok: boolean
  base_url?: string | null
  model_configured?: string | null
  prompt_sent?: string | null
  response_text?: string | null
  http_status?: number | null
  error?: string | null
}

// ── Key/value editors for LLM headers and per-model body params ──────────────

interface KV { key: string; value: string }

function recordToRows(rec: Record<string, string> | undefined): KV[] {
  return Object.entries(rec ?? {}).map(([key, value]) => ({ key, value: String(value) }))
}

function rowsToRecord(rows: KV[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { key, value } of rows) {
    const k = key.trim()
    if (k) out[k] = value
  }
  return out
}

// Body values are entered as text but stored as JSON where they parse (so
// `1024` becomes a number and `{"type":"enabled"}` an object); otherwise the
// raw string is kept.
function bodyToRows(body: Record<string, unknown> | undefined): KV[] {
  return Object.entries(body ?? {}).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  }))
}

function rowsToBody(rows: KV[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const { key, value } of rows) {
    const k = key.trim()
    if (!k) continue
    try {
      out[k] = JSON.parse(value)
    } catch {
      out[k] = value
    }
  }
  return out
}

function KeyValueRows({
  rows,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  addLabel,
}: {
  rows: KV[]
  onChange: (rows: KV[]) => void
  keyPlaceholder: string
  valuePlaceholder: string
  addLabel: string
}) {
  const t = useTranslations('admin')
  const update = (i: number, patch: Partial<KV>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i))
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2">
          <Input
            className="font-mono text-sm"
            placeholder={keyPlaceholder}
            value={row.key}
            onChange={(e) => update(i, { key: e.target.value })}
          />
          <Input
            className="font-mono text-sm"
            placeholder={valuePlaceholder}
            value={row.value}
            onChange={(e) => update(i, { value: e.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => remove(i)}
            aria-label={t('settings.removeRow')}
          >
            <span aria-hidden="true">✕</span>
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, { key: '', value: '' }])}
      >
        {addLabel}
      </Button>
    </div>
  )
}

// A preset row in the admin editor. `name` is the stable id (selection value);
// `label` is what users see. base URL / model id / key / headers / body are the
// per-preset connection. `apiKey` is a newly-typed key (write-only); `apiKeySet`
// reflects whether one is already stored.
interface ModelRow {
  name: string
  label: string
  baseUrl: string
  modelId: string
  apiKey: string
  apiKeySet: boolean
  headers: KV[]
  body: KV[]
  structuredOutputs: boolean
}

function emptyModelRow(): ModelRow {
  return { name: '', label: '', baseUrl: '', modelId: '', apiKey: '', apiKeySet: false, headers: [], body: [], structuredOutputs: true }
}

function SettingsTab() {
  const t = useTranslations('admin')
  const { data: settings, mutate } = useSWR<InstanceSettingsResponse>(
    '/api/admin/settings',
    fetcher,
  )
  const [analysisContext, setAnalysisContext] = useState('')
  const [adminContact, setAdminContact] = useState('')
  const [allowSelfSignup, setAllowSelfSignup] = useState(false)
  // Issue #46 — defaults on server-side; the real value arrives with `settings`.
  const [allowTokens, setAllowTokens] = useState(true)
  // Issue #42 — on by default for the same reason, and read the same way.
  const [allowMcp, setAllowMcp] = useState(true)
  const [modelRows, setModelRows] = useState<ModelRow[]>([])
  const [requiresSubscription, setRequiresSubscription] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testModel, setTestModel] = useState('')
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null)

  useEffect(() => {
    if (settings) {
      setAnalysisContext(settings.llm_analysis_context ?? '')
      setAdminContact(settings.admin_contact ?? '')
      setAllowSelfSignup(Boolean(settings.allow_self_signup))
      setAllowTokens(Boolean(settings.allow_personal_access_tokens))
      setAllowMcp(Boolean(settings.allow_mcp_server))
      setRequiresSubscription(Boolean(settings.llm_requires_subscription))
      setModelRows(
        (settings.llm_models ?? []).map((m) => ({
          name: m.name,
          label: m.label ?? '',
          baseUrl: m.base_url ?? '',
          modelId: m.model ?? '',
          apiKey: '',
          apiKeySet: Boolean(m.api_key_set),
          headers: recordToRows(m.headers),
          body: bodyToRows(m.body),
          // Absent ⇒ default-on; only an explicit false disables it.
          structuredOutputs: m.structured_outputs !== false,
        })),
      )
    }
  }, [settings])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const models = modelRows
        .filter((m) => m.name.trim())
        .map((m) => ({
          name: m.name.trim(),
          label: m.label.trim() || null,
          base_url: m.baseUrl.trim() || null,
          model: m.modelId.trim() || null,
          // Only send a key when a new one was typed; leave stored keys untouched.
          ...(m.apiKey ? { api_key: m.apiKey } : {}),
          headers: rowsToRecord(m.headers),
          body: rowsToBody(m.body),
          structured_outputs: m.structuredOutputs,
        }))
      // Typed so a future backend patch-schema rename is caught at compile time.
      const payload: InstanceSettingsPatch = {
        llm_analysis_context: analysisContext || null,
        admin_contact: adminContact || null,
        allow_self_signup: allowSelfSignup,
        allow_personal_access_tokens: allowTokens,
        allow_mcp_server: allowMcp,
        llm_models: models,
        llm_requires_subscription: requiresSubscription,
      }
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setTestResult(null)
      mutate()
      toast({ title: t('settings.saved') })
    } catch (err) {
      toast({
        title: t('settings.saveFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleTestConnection() {
    if (!settings?.llm_models?.length) {
      setTestResult({ ok: false, error: t('settings.testNoBaseUrl') })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const url = testModel
        ? `/api/llm/test-connection?model=${encodeURIComponent(testModel)}`
        : '/api/llm/test-connection'
      const result = await apiFetch(url, { method: 'POST' }) as LlmTestResult
      setTestResult(result)
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.instanceTitle')}</CardTitle>
          <CardDescription>{t('settings.instanceDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-contact">{t('settings.adminContact')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.adminContactDesc')}</p>
            <Input
              id="admin-contact"
              type="text"
              placeholder={t('settings.adminContactPlaceholder')}
              value={adminContact}
              onChange={(e) => setAdminContact(e.target.value)}
            />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-md border border-input p-3">
            <div className="space-y-1">
              <Label htmlFor="allow-self-signup">{t('settings.allowSelfSignup')}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.allowSelfSignupDesc')}</p>
            </div>
            <Switch
              id="allow-self-signup"
              checked={allowSelfSignup}
              onCheckedChange={setAllowSelfSignup}
            />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-md border border-input p-3">
            <div className="space-y-1">
              <Label htmlFor="allow-tokens">{t('settings.allowTokens')}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.allowTokensDesc')}</p>
              {!allowTokens && (
                // Turning it off refuses authentication, not just issuance —
                // say so, or the switch is a comforting untruth.
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  {t('settings.allowTokensWarning')}
                </p>
              )}
            </div>
            <Switch
              id="allow-tokens"
              checked={allowTokens}
              onCheckedChange={setAllowTokens}
            />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-md border border-input p-3">
            <div className="space-y-1">
              <Label htmlFor="allow-mcp">{t('settings.allowMcp')}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.allowMcpDesc')}</p>
              {!allowMcp && (
                // Off is a 404 on the handshake, not merely on the tool calls,
                // and it withdraws an interface rather than an exposure — both
                // worth saying where the decision is made.
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  {t('settings.allowMcpWarning')}
                </p>
              )}
              {allowMcp && !allowTokens && (
                // The endpoint also accepts a session token, but those last an
                // hour; without personal access tokens there is no credential an
                // external client can hold, so the switch above is on in name
                // only.
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  {t('settings.allowMcpNeedsTokens')}
                </p>
              )}
            </div>
            <Switch
              id="allow-mcp"
              checked={allowMcp}
              onCheckedChange={setAllowMcp}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.llmTitle')}</CardTitle>
          <CardDescription>{t('settings.llmDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-md border border-input p-3">
            <div className="space-y-1">
              <Label htmlFor="requires-subscription">{t('settings.requiresSubscription')}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.requiresSubscriptionDesc')}</p>
              {requiresSubscription && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  {t('settings.requiresSubscriptionWarning')}
                </p>
              )}
            </div>
            <Switch
              id="requires-subscription"
              checked={requiresSubscription}
              onCheckedChange={setRequiresSubscription}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="llm-analysis-context">{t('settings.analysisContext')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.analysisContextDesc')}</p>
            <Textarea
              id="llm-analysis-context"
              placeholder={t('settings.analysisContextPlaceholder')}
              value={analysisContext}
              onChange={(e) => setAnalysisContext(e.target.value)}
              rows={6}
              className="font-mono text-sm"
            />
          </div>

          {/* Selectable presets, each a full connection. First = default. */}
          <div className="space-y-3 pt-2 border-t">
            <Label>{t('settings.models')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.modelsDesc')}</p>
            {modelRows.map((m, i) => {
              const patch = (p: Partial<ModelRow>) => {
                setModelRows(modelRows.map((r, idx) => idx === i ? { ...r, ...p } : r))
                setTestResult(null)
              }
              return (
              <div key={i} className="space-y-3 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium flex-1">
                    {m.label.trim() || m.name.trim() || t('settings.newModel')}
                  </p>
                  {i === 0 && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                      {t('settings.defaultBadge')}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setModelRows(modelRows.filter((_, idx) => idx !== i))}
                  >
                    {t('settings.removeModel')}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('settings.displayName')}</Label>
                    <Input
                      className="text-sm"
                      placeholder={t('settings.displayNamePlaceholder')}
                      value={m.label}
                      onChange={(e) => patch({ label: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('settings.modelIdentifier')}</Label>
                    <Input
                      className="font-mono text-sm"
                      placeholder={t('settings.modelNamePlaceholder')}
                      value={m.name}
                      onChange={(e) => patch({ name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('settings.modelId')}</Label>
                    <Input
                      className="font-mono text-sm"
                      placeholder={t('settings.modelIdPlaceholder')}
                      value={m.modelId}
                      onChange={(e) => patch({ modelId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('settings.presetBaseUrl')}</Label>
                    <Input
                      className="font-mono text-sm"
                      placeholder={t('settings.presetBaseUrlPlaceholder')}
                      value={m.baseUrl}
                      onChange={(e) => patch({ baseUrl: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('settings.presetApiKey')}</Label>
                    {m.apiKeySet && !m.apiKey && (
                      <p className="text-xs text-muted-foreground">{t('settings.apiKeySet')}</p>
                    )}
                    <Input
                      type="password"
                      className="text-sm"
                      placeholder={t('settings.apiKeyPlaceholder')}
                      value={m.apiKey}
                      onChange={(e) => patch({ apiKey: e.target.value })}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t('settings.presetHeaders')}</p>
                <KeyValueRows
                  rows={m.headers}
                  onChange={(r) => patch({ headers: r })}
                  keyPlaceholder={t('settings.headerNamePlaceholder')}
                  valuePlaceholder={t('settings.headerValuePlaceholder')}
                  addLabel={t('settings.addHeader')}
                />
                <p className="text-xs text-muted-foreground">{t('settings.bodyParams')}</p>
                <KeyValueRows
                  rows={m.body}
                  onChange={(r) => patch({ body: r })}
                  keyPlaceholder={t('settings.bodyKeyPlaceholder')}
                  valuePlaceholder={t('settings.bodyValuePlaceholder')}
                  addLabel={t('settings.addBodyParam')}
                />
                <div className="flex items-start justify-between gap-4 pt-1">
                  <div className="space-y-0.5">
                    <Label className="text-xs">{t('settings.structuredOutputs')}</Label>
                    <p className="text-xs text-muted-foreground">{t('settings.structuredOutputsDesc')}</p>
                  </div>
                  <Switch
                    checked={m.structuredOutputs}
                    onCheckedChange={(v) => patch({ structuredOutputs: v })}
                  />
                </div>
              </div>
              )
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModelRows([...modelRows, emptyModelRow()])}
            >
              {t('settings.addModel')}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? t('settings.saving') : t('settings.save')}
            </Button>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={testModel}
              onChange={(e) => setTestModel(e.target.value)}
              aria-label={t('settings.testModelLabel')}
            >
              <option value="">{t('settings.testModelDefault')}</option>
              {modelRows.filter((m) => m.name.trim()).map((m) => (
                <option key={m.name} value={m.name.trim()}>{m.label.trim() || m.name.trim()}</option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              disabled={testing || saving}
              onClick={handleTestConnection}
            >
              {testing ? t('settings.testConnectionTesting') : t('settings.testConnection')}
            </Button>
          </div>
          </div>

        {testResult && (
          <div className={`mt-4 max-w-md rounded-lg border p-4 text-sm space-y-2 ${testResult.ok ? 'border-green-500/40 bg-green-500/5' : 'border-destructive/40 bg-destructive/5'}`}>
            <p className={`font-medium ${testResult.ok ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}>
              {testResult.ok ? t('settings.testConnectionOk') : t('settings.testConnectionFailed')}
            </p>
            {testResult.error && (
              <p className="text-muted-foreground">{testResult.error}</p>
            )}
            {testResult.ok && testResult.model_configured && (
              <p className="text-green-700 dark:text-green-400">
                {t('settings.testModelReplied')}
                {' '}({testResult.model_configured})
              </p>
            )}
            {testResult.prompt_sent && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">{t('settings.testPromptSent')}:</p>
                <p className="text-xs font-mono text-muted-foreground break-words whitespace-pre-wrap">
                  {testResult.prompt_sent}
                </p>
              </div>
            )}
            {testResult.ok && testResult.response_text && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">{t('settings.testResponse')}:</p>
                <p className="text-xs font-mono text-muted-foreground break-words whitespace-pre-wrap">
                  {testResult.response_text}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
      </Card>
    </form>
  )
}

// ── LLM usage tab (issue #9) ────────────────────────────────────────────────

const USAGE_GROUPS = ['user', 'provider', 'feature', 'day', 'week', 'month'] as const

function UsageTab() {
  const t = useTranslations('admin')
  const [groupBy, setGroupBy] = useState<(typeof USAGE_GROUPS)[number]>('user')
  const { data, isLoading } = useSWR<LlmUsageSummaryResponse>(
    `/api/admin/llm-usage/summary?group_by=${groupBy}`,
    fetcher,
  )
  const buckets = data?.buckets ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('usage.title')}</CardTitle>
        <CardDescription>{t('usage.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="usage-group">{t('usage.groupBy')}</Label>
          <select
            id="usage-group"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as (typeof USAGE_GROUPS)[number])}
          >
            {USAGE_GROUPS.map((g) => (
              <option key={g} value={g}>{t(`usage.group.${g}`)}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('usage.loading')}</p>
        ) : buckets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('usage.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">{t(`usage.group.${groupBy}`)}</th>
                  <th className="pb-2 pr-4 font-medium text-right">{t('usage.calls')}</th>
                  <th className="pb-2 pr-4 font-medium text-right">{t('usage.inputTokens')}</th>
                  <th className="pb-2 pr-4 font-medium text-right">{t('usage.outputTokens')}</th>
                  <th className="pb-2 pr-4 font-medium text-right">{t('usage.totalTokens')}</th>
                  <th className="pb-2 font-medium text-right">{t('usage.unknown')}</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono">{b.key ?? '—'}</td>
                    <td className="py-2 pr-4 text-right">{b.calls.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{b.prompt_tokens.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{b.completion_tokens.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{b.total_tokens.toLocaleString()}</td>
                    <td className="py-2 text-right text-muted-foreground">{b.unknown_usage_calls.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const t = useTranslations('admin')
  const { isAdmin, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace(`/dashboard`)
    }
  }, [isAdmin, loading, router])

  if (loading || !isAdmin) return null

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <Tabs defaultValue="users">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="users">{t('tabs.users')}</TabsTrigger>
          <TabsTrigger value="invitations">{t('tabs.invitations')}</TabsTrigger>
          <TabsTrigger value="usage">{t('tabs.usage')}</TabsTrigger>
          <TabsTrigger value="settings">{t('tabs.settings')}</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="invitations" className="mt-4">
          <InvitationsTab />
        </TabsContent>
        <TabsContent value="usage" className="mt-4">
          <UsageTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
