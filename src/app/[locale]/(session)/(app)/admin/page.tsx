'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/navigation'
import useSWR from 'swr'
import { useAuth } from '@/lib/auth'
import { apiFetch, fetcher } from '@/lib/api'
import type {
  UserResponse,
  InvitationResponse,
  InstanceSettingsResponse,
  Page,
} from '@/lib/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
            <th className="pb-2 pr-4 font-medium">{t('users.username')}</th>
            <th className="pb-2 pr-4 font-medium">{t('users.roles')}</th>
            <th className="hidden sm:table-cell pb-2 pr-4 font-medium">{t('users.registeredAt')}</th>
            <th className="hidden sm:table-cell pb-2 pr-4 font-medium">{t('users.consent')}</th>
            <th className="pb-2 font-medium">{t('users.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b last:border-0">
              <td className="py-3 pr-4 font-mono">{u.username}</td>
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
                              {t('users.removeConfirmDesc', { username: u.username })}
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
  models_available?: string[] | null
  model_found?: boolean
  http_status?: number | null
  error?: string | null
}

function SettingsTab() {
  const t = useTranslations('admin')
  const { data: settings, mutate } = useSWR<InstanceSettingsResponse>(
    '/api/admin/settings',
    fetcher,
  )
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [clearKey, setClearKey] = useState(false)
  const [analysisContext, setAnalysisContext] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null)

  useEffect(() => {
    if (settings) {
      setBaseUrl(settings.llm_base_url ?? '')
      setModel(settings.llm_model ?? '')
      setAnalysisContext(settings.llm_analysis_context ?? '')
    }
  }, [settings])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          llm_base_url: baseUrl || null,
          llm_model: model || null,
          llm_api_key: apiKey || null,
          clear_llm_api_key: clearKey,
          llm_analysis_context: analysisContext || null,
        }),
      })
      setApiKey('')
      setClearKey(false)
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
    if (!settings?.llm_base_url) {
      setTestResult({ ok: false, error: t('settings.testNoBaseUrl') })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const result = await apiFetch('/api/llm/test-connection', { method: 'POST' }) as LlmTestResult
      setTestResult(result)
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('settings.llmTitle')}</CardTitle>
        <CardDescription>{t('settings.llmDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="llm-base-url">{t('settings.baseUrl')}</Label>
            <Input
              id="llm-base-url"
              type="url"
              placeholder={t('settings.baseUrlPlaceholder')}
              value={baseUrl}
              onChange={(e) => { setBaseUrl(e.target.value); setTestResult(null) }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="llm-model">{t('settings.model')}</Label>
            <Input
              id="llm-model"
              type="text"
              placeholder={t('settings.modelPlaceholder')}
              value={model}
              onChange={(e) => { setModel(e.target.value); setTestResult(null) }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="llm-api-key">{t('settings.apiKey')}</Label>
            {settings?.llm_api_key_set && !clearKey && (
              <p className="text-xs text-muted-foreground">{t('settings.apiKeySet')}</p>
            )}
            <Input
              id="llm-api-key"
              type="password"
              placeholder={t('settings.apiKeyPlaceholder')}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setClearKey(false); setTestResult(null) }}
              autoComplete="new-password"
            />
            {settings?.llm_api_key_set && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setClearKey(true); setApiKey(''); setTestResult(null) }}
              >
                {t('settings.clearKey')}
              </Button>
            )}
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
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? t('settings.saving') : t('settings.save')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={testing || saving}
              onClick={handleTestConnection}
            >
              {testing ? t('settings.testConnectionTesting') : t('settings.testConnection')}
            </Button>
          </div>
        </form>

        {testResult && (
          <div className={`mt-4 max-w-md rounded-lg border p-4 text-sm space-y-2 ${testResult.ok ? 'border-green-500/40 bg-green-500/5' : 'border-destructive/40 bg-destructive/5'}`}>
            <p className={`font-medium ${testResult.ok ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}>
              {testResult.ok ? t('settings.testConnectionOk') : t('settings.testConnectionFailed')}
            </p>
            {testResult.error && (
              <p className="text-muted-foreground">{testResult.error}</p>
            )}
            {testResult.ok && testResult.model_configured && (
              <p className={testResult.model_found ? 'text-green-700 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                {testResult.model_found ? t('settings.testModelFound') : t('settings.testModelNotFound')}
                {' '}({testResult.model_configured})
              </p>
            )}
            {testResult.ok && testResult.models_available && testResult.models_available.length > 0 && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">{t('settings.testModelsAvailable')}:</p>
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {testResult.models_available.join(', ')}
                </p>
              </div>
            )}
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
          <TabsTrigger value="settings">{t('tabs.settings')}</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="invitations" className="mt-4">
          <InvitationsTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
