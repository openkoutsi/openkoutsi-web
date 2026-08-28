'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'

import { apiFetch, fetcher } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import type {
  CommuteFeedback,
  CommuteRule,
  CommuteRuleProposal,
  CommuteScanResult,
} from '@/lib/types'

/**
 * Sport types offered in the editor.
 *
 * Exact types rather than "cycling", because the distinction is the point
 * (issue #63): an e-bike is very often the commuting bike specifically, so
 * `ebikeride` may be the entire rule for one athlete while another needs a
 * distance band to separate the ride to work from the ride for fun on the same
 * bike. Lower-cased to match what the backend stores.
 */
const SPORT_TYPES = [
  'ride',
  'ebikeride',
  'gravelride',
  'mountainbikeride',
  'virtualride',
  'run',
  'walk',
] as const

/** 0 = Monday, matching `date.weekday()` on the backend. */
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const

function readRules(app: Record<string, unknown> | undefined): CommuteRule[] {
  const raw = app?.commute_rules
  return Array.isArray(raw) ? (raw as CommuteRule[]) : []
}

/** Metres in the settings, kilometres in the input — nobody thinks in metres. */
function toKm(metres: number | undefined): string {
  return metres === undefined ? '' : String(Math.round(metres) / 1000)
}

function fromKm(value: string): number | undefined {
  const parsed = Number(value)
  return value.trim() === '' || Number.isNaN(parsed) ? undefined : Math.round(parsed * 1000)
}

function toMinutes(seconds: number | undefined): string {
  return seconds === undefined ? '' : String(Math.round(seconds / 60))
}

function fromMinutes(value: string): number | undefined {
  const parsed = Number(value)
  return value.trim() === '' || Number.isNaN(parsed) ? undefined : Math.round(parsed * 60)
}

/**
 * Does this rule constrain anything at all?
 *
 * Mirrors `CommuteRule.has_criteria` on the backend, which rejects a rule with
 * no criteria rather than letting it match every ride in the athlete's history.
 * Checked here too so the athlete gets a disabled Save instead of a 400.
 */
function hasCriteria(rule: CommuteRule): boolean {
  return Boolean(
    rule.sport_types?.length ||
      rule.windows?.length ||
      rule.weekdays?.length ||
      rule.min_distance_m !== undefined ||
      rule.max_distance_m !== undefined ||
      rule.min_duration_s !== undefined ||
      rule.max_duration_s !== undefined,
  )
}

/**
 * The athlete's commute rules (issue #63).
 *
 * Two things make this more than a settings form. It opens **prefilled** from a
 * proposal derived from the rides the athlete has already labelled — nobody is
 * going to hand-type "between 4.2 and 6.8 km, 06:41–08:12" — and it shows a live
 * **match count** against recent rides, because a rule whose effect you cannot
 * see is a rule you will set wrong.
 */
export function CommuteRulesCard() {
  const t = useTranslations('app')
  const tCommon = useTranslations('common')
  const { athlete, refreshAthlete } = useAuth()

  const [rules, setRules] = useState<CommuteRule[]>([])
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [matchCount, setMatchCount] = useState<number | null>(null)

  const { data: proposal } = useSWR<CommuteRuleProposal>(
    '/api/activities/commute/proposal',
    fetcher,
  )
  const { data: feedback, mutate: refreshFeedback } = useSWR<CommuteFeedback>(
    '/api/activities/commute/feedback',
    fetcher,
  )

  const app = athlete?.app_settings as Record<string, unknown> | undefined
  const savedRules = JSON.stringify(readRules(app))

  useEffect(() => {
    setRules(JSON.parse(savedRules) as CommuteRule[])
  }, [savedRules])

  /**
   * How many rides awaiting an answer the saved rules currently account for.
   * Read from the server rather than recomputed here: the matcher is the
   * backend's, and a second implementation in TypeScript would drift.
   */
  const refreshMatchCount = useCallback(async () => {
    try {
      const res = (await apiFetch(
        '/api/activities?suggested_label=commute&page_size=1',
      )) as { total: number }
      setMatchCount(res.total)
    } catch {
      setMatchCount(null)
    }
  }, [])

  useEffect(() => {
    void refreshMatchCount()
  }, [refreshMatchCount, savedRules])

  function update(index: number, patch: Partial<CommuteRule>) {
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function addRule(seed?: CommuteRule) {
    // A stable, athlete-readable id: it is what `source` records on every
    // suggestion the rule produces, so it shows up in explanations.
    const id = seed?.id && !rules.some((r) => r.id === seed.id)
      ? seed.id
      : `commute-${rules.length + 1}-${Date.now().toString(36)}`
    setRules((prev) => [...prev, { ...(seed ?? {}), id, enabled: true }])
  }

  async function handleSave() {
    setSaving(true)
    try {
      await apiFetch('/api/athlete', {
        method: 'PATCH',
        body: JSON.stringify({ app_settings: { commute_rules: rules } }),
      })
      await refreshAthlete()
      await refreshMatchCount()
      await refreshFeedback()
      toast({ title: t('settings.commute.saved') })
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : t('settings.commute.saveFailed'),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleScan() {
    setScanning(true)
    try {
      const result = (await apiFetch('/api/activities/commute/scan', {
        method: 'POST',
      })) as CommuteScanResult
      await refreshMatchCount()
      toast({
        title: t('settings.commute.scanned', {
          scanned: result.scanned,
          suggested: result.suggested,
        }),
      })
    } catch {
      toast({ title: t('settings.commute.scanFailed'), variant: 'destructive' })
    } finally {
      setScanning(false)
    }
  }

  const dirty = JSON.stringify(rules) !== savedRules
  const invalid = rules.some((rule) => !hasCriteria(rule))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('settings.commute.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('settings.commute.desc')}</p>

        {/* The proposal: what turns this from a form into something usable. */}
        {proposal?.rule && rules.length === 0 && (
          <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 space-y-2">
            <p className="text-sm">
              {t('settings.commute.proposalAvailable', { count: proposal.sample_count })}
            </p>
            <Button size="sm" onClick={() => addRule(proposal.rule ?? undefined)}>
              {t('settings.commute.usePropsal')}
            </Button>
          </div>
        )}
        {proposal && !proposal.rule && rules.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t('settings.commute.notEnoughHistory', {
              count: proposal.sample_count,
              min: proposal.min_samples,
            })}
          </p>
        )}

        {rules.map((rule, index) => (
          <div key={rule.id} className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={rule.name ?? ''}
                placeholder={t('settings.commute.namePlaceholder')}
                onChange={(e) => update(index, { name: e.target.value || undefined })}
                className="max-w-xs"
              />
              <button
                type="button"
                onClick={() => setRules((prev) => prev.filter((_, i) => i !== index))}
                className="ml-auto text-sm text-muted-foreground hover:text-destructive"
              >
                {tCommon('delete')}
              </button>
            </div>

            <div>
              <Label className="text-xs">{t('settings.commute.sportTypes')}</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {SPORT_TYPES.map((sport) => {
                  const active = rule.sport_types?.includes(sport) ?? false
                  return (
                    <button
                      key={sport}
                      type="button"
                      onClick={() =>
                        update(index, {
                          sport_types: active
                            ? rule.sport_types?.filter((s) => s !== sport)
                            : [...(rule.sport_types ?? []), sport],
                        })
                      }
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {t(`settings.commute.sport.${sport}`)}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t('settings.commute.distanceKm')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    step="0.1"
                    value={toKm(rule.min_distance_m)}
                    onChange={(e) => update(index, { min_distance_m: fromKm(e.target.value) })}
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="number"
                    step="0.1"
                    value={toKm(rule.max_distance_m)}
                    onChange={(e) => update(index, { max_distance_m: fromKm(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">{t('settings.commute.durationMin')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    value={toMinutes(rule.min_duration_s)}
                    onChange={(e) => update(index, { min_duration_s: fromMinutes(e.target.value) })}
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="number"
                    value={toMinutes(rule.max_duration_s)}
                    onChange={(e) => update(index, { max_duration_s: fromMinutes(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs">{t('settings.commute.windows')}</Label>
              {/* Two windows is the normal case, not an edge case: a commute is
                  a there-and-back pair and the legs are rarely symmetric. */}
              <div className="space-y-2 mt-1">
                {(rule.windows ?? []).map((window, wi) => (
                  <div key={wi} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={window.start}
                      onChange={(e) =>
                        update(index, {
                          windows: rule.windows?.map((w, i) =>
                            i === wi ? { ...w, start: e.target.value } : w,
                          ),
                        })
                      }
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="time"
                      value={window.end}
                      onChange={(e) =>
                        update(index, {
                          windows: rule.windows?.map((w, i) =>
                            i === wi ? { ...w, end: e.target.value } : w,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        update(index, { windows: rule.windows?.filter((_, i) => i !== wi) })
                      }
                      className="text-sm text-muted-foreground hover:text-destructive"
                    >
                      {tCommon('delete')}
                    </button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update(index, {
                      windows: [...(rule.windows ?? []), { start: '07:00', end: '09:00' }],
                    })
                  }
                >
                  {t('settings.commute.addWindow')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('settings.commute.windowsHint')}
              </p>
            </div>

            <div>
              <Label className="text-xs">{t('settings.commute.weekdays')}</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {WEEKDAYS.map((day) => {
                  const active = rule.weekdays?.includes(day) ?? false
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        update(index, {
                          weekdays: active
                            ? rule.weekdays?.filter((d) => d !== day)
                            : [...(rule.weekdays ?? []), day].sort((a, b) => a - b),
                        })
                      }
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {t(`settings.commute.day.${day}`)}
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={rule.auto_apply ?? false}
                onChange={(e) => update(index, { auto_apply: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              {t('settings.commute.autoApply')}
            </label>
            <p className="text-xs text-muted-foreground -mt-2 ml-6">
              {t('settings.commute.autoApplyHint')}
            </p>

            {!hasCriteria(rule) && (
              <p className="text-xs text-destructive">{t('settings.commute.needsCriteria')}</p>
            )}
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => addRule()}>
            {t('settings.commute.addRule')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty || invalid}>
            {saving ? tCommon('saving') : tCommon('save')}
          </Button>
          <Button size="sm" variant="outline" onClick={handleScan} disabled={scanning || dirty}>
            {scanning ? t('settings.commute.scanning') : t('settings.commute.scanHistory')}
          </Button>
        </div>

        {matchCount !== null && matchCount > 0 && (
          <p className="text-sm">{t('settings.commute.awaitingReview', { count: matchCount })}</p>
        )}

        {/* Where the rules look wrong, reported and never applied (issue #63):
            silently widening a rule each time its output is accepted is a
            feedback loop with no brake. */}
        {feedback && feedback.widen.length > 0 && (
          <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 space-y-1">
            <p className="text-sm font-medium">{t('settings.commute.tooNarrow')}</p>
            {feedback.widen.map((entry) => (
              <p key={entry.rule_id} className="text-xs text-muted-foreground">
                {t('settings.commute.tooNarrowDetail', {
                  rule: entry.rule_id,
                  criteria: Object.keys(entry.criteria).join(', '),
                })}
              </p>
            ))}
          </div>
        )}
        {feedback && feedback.review.length > 0 && (
          <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 space-y-1">
            <p className="text-sm font-medium">{t('settings.commute.tooWide')}</p>
            {feedback.review.map((entry) => (
              <p key={entry.rule_id} className="text-xs text-muted-foreground">
                {t('settings.commute.tooWideDetail', {
                  rule: entry.rule_id,
                  count: entry.dismissed,
                })}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
