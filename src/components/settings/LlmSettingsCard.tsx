'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'

import { apiFetch, fetcher } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'

interface LlmTestResult {
  ok: boolean
  base_url?: string | null
  model_configured?: string | null
  prompt_sent?: string | null
  response_text?: string | null
  http_status?: number | null
  error?: string | null
}

// The user's own BYOK config lives (untyped) on athlete.app_settings.
function readSetting(app: Record<string, unknown> | undefined, key: string): string {
  const v = app?.[key]
  return typeof v === 'string' ? v : ''
}

export function LlmSettingsCard() {
  const t = useTranslations('app')
  const { athlete, refreshAthlete } = useAuth()
  const { data: serversData } = useSWR<{ servers: string[] }>('/api/llm/servers', fetcher)
  const servers = serversData?.servers ?? []
  const restricted = servers.length > 0

  const app = athlete?.app_settings
  const savedBaseUrl = readSetting(app, 'llm_base_url')
  const keySet = Boolean(app?.llm_api_key_set)

  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [clearKey, setClearKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null)

  useEffect(() => {
    if (app) {
      setBaseUrl(readSetting(app, 'llm_base_url'))
      setModel(readSetting(app, 'llm_model'))
    }
  }, [app])

  const usingOwn = savedBaseUrl.trim().length > 0
  const isHttp = baseUrl.trim().startsWith('http://')
  const pageHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'

  async function patchSettings(overrides: Record<string, unknown>) {
    await apiFetch('/api/athlete', {
      method: 'PATCH',
      body: JSON.stringify({ app_settings: { ...(app ?? {}), ...overrides } }),
    })
    await refreshAthlete()
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const overrides: Record<string, unknown> = {
        llm_base_url: baseUrl.trim() || null,
        llm_model: model.trim() || null,
      }
      // Only touch the stored key when a new one is typed or an explicit clear
      // was requested; otherwise leave the encrypted key untouched.
      if (apiKey) overrides.llm_api_key = apiKey
      else if (clearKey) overrides.llm_api_key = null

      await patchSettings(overrides)
      setApiKey('')
      setClearKey(false)
      setTestResult(null)
      toast({ title: t('settings.llm.saved') })
    } catch (err) {
      toast({
        title: t('settings.llm.saveFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setSaving(true)
    try {
      await patchSettings({ llm_base_url: null, llm_model: null, llm_api_key: null })
      setBaseUrl('')
      setModel('')
      setApiKey('')
      setClearKey(false)
      setTestResult(null)
      toast({ title: t('settings.llm.cleared') })
    } catch (err) {
      toast({
        title: t('settings.llm.clearFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!baseUrl.trim()) {
      setTestResult({ ok: false, error: t('settings.llm.testNoBaseUrl') })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const body: Record<string, string> = { base_url: baseUrl.trim() }
      if (model.trim()) body.model = model.trim()
      if (apiKey) body.api_key = apiKey
      const result = (await apiFetch('/api/llm/test-my-connection', {
        method: 'POST',
        body: JSON.stringify(body),
      })) as LlmTestResult
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
        <CardTitle className="text-base">{t('settings.llm.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('settings.llm.desc', { ollama: 'Ollama' })}
          </p>

          {/* BYOK state banner. */}
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              usingOwn
                ? 'border-green-500/40 bg-green-500/5 text-green-700 dark:text-green-400'
                : 'border-input bg-muted/40 text-muted-foreground'
            }`}
          >
            {usingOwn ? t('settings.llm.bannerUsingOwn') : t('settings.llm.bannerUsingInstance')}
          </div>

          <div className="space-y-2">
            <Label htmlFor="byok-base-url">{t('settings.llm.baseUrl')}</Label>
            {restricted ? (
              <>
                <select
                  id="byok-base-url"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={baseUrl}
                  onChange={(e) => { setBaseUrl(e.target.value); setTestResult(null) }}
                >
                  <option value="">{t('settings.llm.selectServer')}</option>
                  {servers.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">{t('settings.llm.serverRestricted')}</p>
              </>
            ) : (
              <>
                <Input
                  id="byok-base-url"
                  type="url"
                  placeholder={t('settings.llm.baseUrlPlaceholder')}
                  value={baseUrl}
                  onChange={(e) => { setBaseUrl(e.target.value); setTestResult(null) }}
                />
                <p className="text-xs text-muted-foreground">
                  {t('settings.llm.baseUrlHint', {
                    ollamaUrl: 'http://localhost:11434/v1',
                    openaiUrl: 'https://api.openai.com/v1',
                  })}
                </p>
              </>
            )}
            {isHttp && pageHttps && (
              <p className="text-xs text-amber-600 dark:text-amber-500">{t('settings.llm.mixedContent')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="byok-model">{t('settings.llm.model')}</Label>
            <Input
              id="byok-model"
              type="text"
              placeholder={t('settings.llm.modelPlaceholder')}
              value={model}
              onChange={(e) => { setModel(e.target.value); setTestResult(null) }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="byok-api-key">
              {t('settings.llm.apiKey')}{' '}
              <span className="text-muted-foreground">{t('settings.llm.apiKeyOptional')}</span>
            </Label>
            {keySet && !clearKey && (
              <p className="text-xs text-muted-foreground">
                {t('settings.llm.apiKeySet')} {t('settings.llm.apiKeySetHint')}
              </p>
            )}
            <Input
              id="byok-api-key"
              type="password"
              placeholder={t('settings.llm.apiKeyPlaceholder')}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setClearKey(false); setTestResult(null) }}
              autoComplete="new-password"
            />
            {keySet && !clearKey && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setClearKey(true); setApiKey(''); setTestResult(null) }}
              >
                {t('settings.llm.clear')}
              </Button>
            )}
          </div>

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">{t('settings.llm.apiKeySecurityTitle')}</summary>
            <p className="mt-2">{t('settings.llm.apiKeySecurityBody')}</p>
          </details>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? t('settings.llm.saving') : t('settings.llm.save')}
            </Button>
            <Button type="button" variant="outline" disabled={testing || saving} onClick={handleTest}>
              {testing ? t('settings.llm.testing') : t('settings.llm.test')}
            </Button>
            {usingOwn && (
              <Button type="button" variant="ghost" disabled={saving} onClick={handleClear}>
                {t('settings.llm.clear')}
              </Button>
            )}
          </div>

          {testResult && (
            <div
              className={`mt-2 rounded-lg border p-4 text-sm space-y-2 ${
                testResult.ok ? 'border-green-500/40 bg-green-500/5' : 'border-destructive/40 bg-destructive/5'
              }`}
            >
              <p className={`font-medium ${testResult.ok ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}>
                {testResult.ok ? t('settings.llm.testOk') : t('settings.llm.testFailed')}
              </p>
              {testResult.error && <p className="text-muted-foreground">{testResult.error}</p>}
              {testResult.ok && testResult.model_configured && (
                <p className="text-green-700 dark:text-green-400">
                  {t('settings.llm.testModelReplied')} ({testResult.model_configured})
                </p>
              )}
              {testResult.ok && testResult.response_text && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">{t('settings.llm.testResponse')}:</p>
                  <p className="text-xs font-mono text-muted-foreground break-words whitespace-pre-wrap">
                    {testResult.response_text}
                  </p>
                </div>
              )}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
