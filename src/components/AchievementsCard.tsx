'use client'

import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { Link } from '@/navigation'
import { fetcher } from '@/lib/api'
import type { Achievements } from '@/lib/types'
import { byMostRecent, formatTier } from '@/lib/gamification'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Flame, Trophy } from 'lucide-react'

/** How many recent unlocks the dashboard shows before deferring to the page. */
const RECENT_LIMIT = 3

/**
 * Dashboard summary of the athlete's headline streak and latest badges
 * (issue #33). Renders nothing at all when there is nothing to celebrate yet,
 * rather than occupying the dashboard with an empty shell.
 */
export function AchievementsCard() {
  const t = useTranslations('app.achievements')
  const { data } = useSWR<Achievements>('/api/achievements', fetcher)

  if (!data || data.disabled) return null

  const active = data.streaks.find((s) => s.id === 'streak_active_weeks')
  const recent = byMostRecent(data.unlocked).slice(0, RECENT_LIMIT)

  if (!recent.length && !active?.current) return null

  const byId = new Map(data.catalogue.map((d) => [d.id, d]))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <Link
          href="/achievements"
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          {t('viewAll')}
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {active && active.current > 0 && (
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
            <span className="text-sm font-medium tabular-nums">
              {t('weeks', { count: active.current })}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {t('items.streak_active_weeks.name')}
            </span>
          </div>
        )}

        {recent.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">{t('recentlyEarned')}</p>
            <ul className="space-y-1.5">
              {recent.map((unlock) => {
                const definition = byId.get(unlock.achievement_id)
                return (
                  <li
                    key={`${unlock.achievement_id}-${unlock.tier}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Trophy
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        unlock.seen ? 'text-muted-foreground' : 'text-amber-500',
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {t(`items.${unlock.achievement_id}.name` as never)}
                    </span>
                    {definition && definition.tiers.length > 1 && (
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {formatTier(unlock.tier, definition.unit)}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
