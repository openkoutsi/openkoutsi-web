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
            <th className="pb-2 pr-4 font-medium">{t('users.llmAccess')}</th>
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
}

function emptyModelRow(): ModelRow {
  return { name: '', label: '', baseUrl: '', modelId: '', apiKey: '', apiKeySet: false, headers: [], body: [] }
}

function SettingsTab() {
  const t = useTranslations('admin')
  const { data: settings, mutate } = useSWR<InstanceSettingsResponse>(
    '/api/admin/settings',
    fetcher,
  )
  const [analysisContext, setAnalysisContext] = useState('')
  const [adminContact, setAdminContact] = useState('')
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
        }))
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          llm_analysis_context: analysisContext || null,
          admin_contact: adminContact || null,
          llm_models: models,
          llm_requires_subscription: requiresSubscription,
        }),
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
        <CardContent>
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
