'use client'

import useSWR from 'swr'
import { useTranslations } from 'next-intl'

import { Link } from '@/navigation'
import { fetcher, apiFetch } from '@/lib/api'
import type { Bike } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { isCyclingSport } from '@/lib/sports'

const NONE = '__none__'

interface Props {
  activityId: string
  sportType: string | null
  bikeId: string | null
  bikeSource: 'auto' | 'manual' | null
  onChanged: () => void
}

/**
 * Which bike this ride was done on, and who decided (issue #64).
 *
 * The source is shown, not just the bike, because that is what tells the
 * athlete whether their correction actually stuck: a ride reading "matched by
 * sport" after they picked a bike by hand would mean the override had been
 * quietly undone. It has not — the server stamps `manual` and no automatic
 * pass overwrites it — and saying so is how the athlete can trust it.
 *
 * The picker offers **every** bike, retired ones included, unlike the course
 * picker. Correcting an old ride onto the bike it was actually ridden on is the
 * whole point of the override, and that bike is often exactly the one since
 * sold.
 */
export function ActivityBikeCard({
  activityId,
  sportType,
  bikeId,
  bikeSource,
  onChanged,
}: Props) {
  const t = useTranslations('garage.activity')
  const { data: bikes } = useSWR<Bike[]>('/api/bikes', fetcher)
  const list = bikes ?? []

  // A run is not on a bike, and a card offering to put it on one would be
  // noise on every non-cycling activity in the history.
  if (!isCyclingSport(sportType)) return null
  if (list.length === 0) return null

  async function handleChange(value: string) {
    try {
      await apiFetch(`/api/activities/${activityId}`, {
        method: 'PATCH',
        body: JSON.stringify({ bike_id: value === NONE ? null : value }),
      })
      onChanged()
    } catch (err) {
      toast({
        title: t('saveFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {t('title')}
          {bikeSource && (
            <Badge
              variant={bikeSource === 'manual' ? 'secondary' : 'outline'}
              className="text-xs font-normal"
            >
              {t(bikeSource)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Select value={bikeId ?? NONE} onValueChange={handleChange}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder={t('unassigned')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t('none')}</SelectItem>
            {list.map((bike) => (
              <SelectItem key={bike.id} value={bike.id}>
                {bike.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {t('help')}{' '}
          <Link href="/garage" className="underline underline-offset-2">
            {t('manage')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
