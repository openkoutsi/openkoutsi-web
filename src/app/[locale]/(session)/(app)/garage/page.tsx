'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'

import { fetcher, apiFetch } from '@/lib/api'
import type { AssignHistoryResult, Bike, BikeDetail } from '@/lib/types'
import { formatGarageKm } from '@/lib/garage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { toast } from '@/components/ui/use-toast'
import { BikeForm } from '@/components/garage/BikeForm'
import { MaintenanceLog } from '@/components/garage/MaintenanceLog'
import { AccessoryList } from '@/components/garage/AccessoryList'
import { ChevronDown, History, Plus, Trash2 } from 'lucide-react'

/**
 * The garage (issue #64): the bikes an athlete owns, how far each has been
 * ridden, what has been done to it and what is bolted to it.
 *
 * A top-level route rather than a dialog on the courses page, because these
 * rows stopped being a course input the moment they started carrying an
 * athlete's kilometres and maintenance history. They are still the *same* rows
 * the course bike picker reads — which is what makes "bikes in the garage are
 * entries in the route-analysis picker" true with nothing to keep in sync.
 */
export default function GaragePage() {
  const t = useTranslations('garage')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  const { data: bikes, isLoading, mutate } = useSWR<Bike[]>('/api/bikes', fetcher)
  const list = bikes ?? []

  async function handleAssignHistory() {
    setScanning(true)
    try {
      const result = await apiFetch<AssignHistoryResult>('/api/bikes/assign-history', {
        method: 'POST',
      })
      toast({
        title: result.assigned
          ? t('assignHistory.done', {
              assigned: result.assigned,
              scanned: result.scanned,
            })
          : t('assignHistory.nothing'),
      })
      mutate()
    } catch (err) {
      toast({
        title: t('assignHistory.failed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setScanning(false)
    }
  }

  async function handleRetire(bike: Bike, retire: boolean) {
    try {
      await apiFetch(`/api/bikes/${bike.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ retired_at: retire ? new Date().toISOString() : null }),
      })
      mutate()
    } catch (err) {
      toast({
        title: t('retire.failed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  async function handleDelete(bike: Bike) {
    try {
      await apiFetch(`/api/bikes/${bike.id}`, { method: 'DELETE' })
      if (openId === bike.id) setOpenId(null)
      mutate()
    } catch (err) {
      toast({
        title: t('deleteFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {list.some((b) => b.default_sports.length > 0) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAssignHistory}
              disabled={scanning}
              title={t('assignHistory.help')}
            >
              <History className="mr-1 h-4 w-4" />
              {scanning ? t('assignHistory.running') : t('assignHistory.action')}
            </Button>
          )}
          {!adding && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" />
              {t('add')}
            </Button>
          )}
        </div>
      </div>

      {adding && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('addTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <BikeForm
              onSaved={() => {
                setAdding(false)
                mutate()
              }}
              onCancel={() => setAdding(false)}
            />
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">{t('loading')}</p>}
      {!isLoading && list.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      )}

      <div className="space-y-3">
        {list.map((bike) => (
          <BikeCard
            key={bike.id}
            bike={bike}
            open={openId === bike.id}
            editing={editingId === bike.id}
            onToggle={() => setOpenId(openId === bike.id ? null : bike.id)}
            onEdit={() => {
              setEditingId(bike.id)
              setOpenId(bike.id)
            }}
            onEditDone={() => {
              setEditingId(null)
              mutate()
            }}
            onEditCancel={() => setEditingId(null)}
            onRetire={(retire) => handleRetire(bike, retire)}
            onDelete={() => handleDelete(bike)}
            onChanged={() => mutate()}
          />
        ))}
      </div>
    </div>
  )
}

interface BikeCardProps {
  bike: Bike
  open: boolean
  editing: boolean
  onToggle: () => void
  onEdit: () => void
  onEditDone: () => void
  onEditCancel: () => void
  onRetire: (retire: boolean) => void
  onDelete: () => void
  onChanged: () => void
}

/**
 * One bike: its totals always, its log and accessories when opened.
 *
 * The detail request is deferred until the card is open. The list endpoint
 * already carries every figure the collapsed row shows, and a garage of six
 * bikes should not fetch six maintenance logs to draw six headlines.
 */
function BikeCard({
  bike,
  open,
  editing,
  onToggle,
  onEdit,
  onEditDone,
  onEditCancel,
  onRetire,
  onDelete,
  onChanged,
}: BikeCardProps) {
  const t = useTranslations('garage')
  const { data: detail, mutate: mutateDetail } = useSWR<BikeDetail>(
    open ? `/api/bikes/${bike.id}` : null,
    fetcher,
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button onClick={onToggle} className="min-w-0 text-left">
            <CardTitle className="flex items-center gap-2 text-base">
              {bike.name}
              {bike.retired_at && (
                <Badge variant="outline" className="text-xs font-normal">
                  {t('retire.badge')}
                </Badge>
              )}
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  open ? 'rotate-180' : ''
                }`}
              />
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {bike.default_sports.length > 0
                ? t('sports.claimed', {
                    sports: bike.default_sports
                      .map((s) => t(`sports.${s}` as never))
                      .join(', '),
                  })
                : t('sports.none')}
            </p>
          </button>

          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('distance.tracked')}</p>
              <p className="text-lg font-semibold">{formatGarageKm(bike.tracked_km)}</p>
            </div>
            {/* Reported beside `tracked`, never instead of it: one is what
                openkoutsi observed and the other leans on a number the athlete
                typed. Only shown when there is a baseline making them differ. */}
            {bike.odometer_base_km != null && bike.odometer_base_km > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">{t('distance.lifetime')}</p>
                <p className="text-lg font-semibold">{formatGarageKm(bike.lifetime_km)}</p>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-5 border-t pt-4">
          {editing ? (
            <BikeForm bike={bike} onSaved={onEditDone} onCancel={onEditCancel} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={onEdit}>
                  {t('edit')}
                </Button>
                {/* Retirement first, deletion behind a confirmation: an athlete
                    who means "stop showing me this" wants the history kept, and
                    a delete cannot be undone. */}
                {bike.retired_at ? (
                  <Button variant="outline" size="sm" onClick={() => onRetire(false)}>
                    {t('retire.unretire')}
                  </Button>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        {t('retire.action')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('retire.confirmTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('retire.confirmBody')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onRetire(true)}>
                          {t('retire.action')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" aria-label={t('delete.action')}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t('delete.confirmTitle', { name: bike.name })}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('delete.confirmBody')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete}>
                        {t('delete.confirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                {bike.retired_at && (
                  <p className="text-xs text-muted-foreground">{t('retire.help')}</p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                {t('distance.trackedHelp')}
                {bike.odometer_base_km != null && bike.odometer_base_km > 0
                  ? ` ${t('distance.lifetimeHelp')}`
                  : ''}
              </p>

              {detail && (
                <>
                  <MaintenanceLog
                    bikeId={bike.id}
                    entries={detail.maintenance}
                    onChanged={() => {
                      mutateDetail()
                      onChanged()
                    }}
                  />
                  <AccessoryList
                    bikeId={bike.id}
                    accessories={detail.accessories}
                    onChanged={() => mutateDetail()}
                  />
                </>
              )}
              {!detail && <p className="text-sm text-muted-foreground">{t('loading')}</p>}
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}
