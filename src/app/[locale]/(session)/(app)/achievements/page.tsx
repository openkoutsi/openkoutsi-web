'use client'

import { useEffect } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { Link } from '@/navigation'
import { useAuth } from '@/lib/auth'
import { fetcher, apiFetch } from '@/lib/api'
import type { AchievementDefinition, Achievements, Streak } from '@/lib/types'
import {
  formatTier,
  gamificationEnabled,
  highestTier,
  nextTier,
  tierProgress,
} from '@/lib/gamification'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Flame, Lock, Trophy } from 'lucide-react'

/** Order categories so the everyday ones lead and the rarer ones follow. */
const CATEGORY_ORDER = [
  'volume',
  'climbing',
  'variety',
  'engagement',
  'plan',
  'goal',
  'streak',
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Round progress for display: whole numbers below 100, one decimal above 10. */
function formatProgress(value: number): string {
  if (value >= 100) return Math.round(value).toString()
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(1)
}

function StreakCard({ streak }: { streak: Streak }) {
  const t = useTranslations('app.achievements')
  const unit = streak.id.endsWith('months') ? 'months' : 'weeks'
  const live = streak.current > 0

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-1">
        <Flame
          className={cn('h-4 w-4 shrink-0', live ? 'text-amber-500' : 'text-muted-foreground')}
          aria-hidden="true"
        />
        <p className="text-sm font-medium truncate">
          {t(`items.${streak.id}.name` as never)}
        </p>
      </div>
      <p className="text-2xl font-semibold tabular-nums">
        {t(unit as 'weeks' | 'months', { count: streak.current })}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {t('longestStreak')}: {t(unit as 'weeks' | 'months', { count: streak.longest })}
      </p>
      {/* An unfinished week is not a broken streak — say so, rather than
          letting a Tuesday visit look like a loss. */}
      {streak.in_progress && (
        <p className="text-xs text-muted-foreground mt-2">{t('inProgressHint')}</p>
      )}
      {!live && <p className="text-xs text-muted-foreground mt-2">{t('noStreak')}</p>}
    </div>
  )
}

function AchievementCard({
  definition,
  earned,
  achievedOn,
  current,
  href,
}: {
  definition: AchievementDefinition
  earned: number | null
  achievedOn: string | null
  current: number
  href: string | null
}) {
  const t = useTranslations('app.achievements')
  const target = nextTier(definition, earned)
  const isEarned = earned !== null
  const tierIndex = isEarned ? definition.tiers.indexOf(earned) + 1 : 0

  const body = (
    <div
      className={cn(
        'h-full rounded-lg border p-4 transition-colors',
        isEarned ? 'bg-card' : 'bg-muted/30',
        href && 'hover:border-foreground/30',
      )}
    >
      <div className="flex items-start gap-2 mb-1">
        {isEarned ? (
          <Trophy className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" aria-hidden="true" />
        ) : (
          <Lock className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className={cn('text-sm font-medium', !isEarned && 'text-muted-foreground')}>
            {t(`items.${definition.id}.name` as never)}
          </p>
          {isEarned && definition.tiers.length > 1 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('tierOf', { current: tierIndex, total: definition.tiers.length })}
              {' · '}
              {formatTier(earned, definition.unit)}
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t(`items.${definition.id}.description` as never, {
          tier: formatTier(target ?? definition.tiers[definition.tiers.length - 1], definition.unit),
        } as never)}
      </p>

      {/* Locked tiers show how far along the athlete is, so the badge reads as
          a target rather than a closed door. */}
      {target !== null && (
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full"
              style={{ width: `${tierProgress(current, target) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
            {t('progress', {
              current: formatProgress(current),
              target: formatTier(target, definition.unit),
            })}
          </p>
        </div>
      )}

      {achievedOn && (
        <p className="text-xs text-muted-foreground mt-2">
          {t('earned', { date: formatDate(achievedOn) })}
        </p>
      )}
    </div>
  )

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  )
}

export default function AchievementsPage() {
  const t = useTranslations('app.achievements')
  const { athlete } = useAuth()
  const enabled = athlete ? gamificationEnabled(athlete.app_settings) : true

  const { data, isLoading } = useSWR<Achievements>(
    enabled ? '/api/achievements' : null,
    fetcher,
  )

  // Clear the "new" marker once the athlete has actually looked at the page.
  useEffect(() => {
    if (!data || data.disabled) return
    if (!data.unlocked.some((u) => !u.seen)) return
    apiFetch('/api/achievements/seen', { method: 'POST' }).catch(() => {
      // A failed dismissal is harmless — the marker simply shows again.
    })
  }, [data])

  if (!enabled || data?.disabled) return null

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>
  }

  const catalogue = data?.catalogue ?? []
  const unlocked = data?.unlocked ?? []
  const progress = data?.progress ?? {}
  const streaks = data?.streaks ?? []

  const byCategory = new Map<string, AchievementDefinition[]>()
  for (const definition of catalogue) {
    const list = byCategory.get(definition.category) ?? []
    list.push(definition)
    byCategory.set(definition.category, list)
  }
  const categories = CATEGORY_ORDER.filter((c) => byCategory.has(c))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {streaks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('streaks')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {streaks.map((streak) => (
                <StreakCard key={streak.id} streak={streak} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {catalogue.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        categories.map((category) => (
          <Card key={category}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t(`categories.${category}` as never)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(byCategory.get(category) ?? []).map((definition) => {
                  const earned = highestTier(unlocked, definition.id)
                  const row = unlocked
                    .filter((u) => u.achievement_id === definition.id)
                    .sort((a, b) => b.tier - a.tier)[0]
                  const activityId = row?.context?.activity_id
                  return (
                    <AchievementCard
                      key={definition.id}
                      definition={definition}
                      earned={earned}
                      achievedOn={row?.achieved_on ?? null}
                      current={progress[definition.id] ?? 0}
                      href={activityId ? `/activities/${activityId}` : null}
                    />
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
