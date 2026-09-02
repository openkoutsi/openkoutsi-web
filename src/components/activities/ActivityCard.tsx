'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/navigation'
import type { Activity } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SourceBadge } from '@/components/activities/SourceBadge'
import { WorkoutCategoryBadge } from '@/components/activities/WorkoutCategoryBadge'
import { formatDate, formatDuration, formatDistance, formatPower } from '@/lib/utils'
import { Bike, Heart, Zap } from 'lucide-react'

interface Props {
  activity: Activity
  /**
   * `{bike_id: name}` for the athlete's bikes (issue #64). Passed in rather
   * than fetched here: the list draws a page of these at a time, and the
   * garage is a handful of rows the page already has. Omitted where the caller
   * has no bike list, in which case no bike is shown — the card degrades to
   * exactly what it was.
   */
  bikeNames?: Record<string, string>
}

const SPORT_ICONS: Record<string, React.ElementType> = {
  cycling: Bike,
  running: Heart,
  default: Zap,
}

export function ActivityCard({ activity, bikeNames }: Props) {
  const t = useTranslations('activities')
  const Icon = SPORT_ICONS[activity.sport_type?.toLowerCase()] ?? SPORT_ICONS.default
  const bikeName = activity.bike_id ? bikeNames?.[activity.bike_id] : undefined

  return (
    <Link href={`/activities/${activity.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="font-medium text-sm truncate">{activity.name}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <WorkoutCategoryBadge category={activity.workout_category} />
              <SourceBadge sources={activity.sources} />
              {activity.status === 'pending' && (
                <Badge variant="outline" className="text-xs">{t('processing')}</Badge>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{formatDate(activity.start_time)}</p>
          <div className="flex items-center gap-4 mt-3 text-sm">
            <span className="text-muted-foreground">{formatDuration(activity.duration_s)}</span>
            {activity.distance_m != null && (
              <span className="text-muted-foreground">{formatDistance(activity.distance_m)}</span>
            )}
            {activity.weighted_power != null && (
              <span className="font-medium">Weighted Power {formatPower(activity.weighted_power)}</span>
            )}
            {activity.load != null && (
              <span className="font-medium text-primary">{Math.round(activity.load)} Load</span>
            )}
            {bikeName && (
              <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                <Bike className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{bikeName}</span>
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
