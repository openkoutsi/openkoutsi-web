'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { apiFetch } from '@/lib/api'
import type { Bike, RidingPosition } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { Bike as BikeIcon, Trash2 } from 'lucide-react'

const POSITIONS: RidingPosition[] = ['tops', 'hoods', 'drops', 'aero']

interface Props {
  bikes: Bike[]
  onChanged: () => void
}

/**
 * Bikes, kept where they are used (issue #55).
 *
 * The physics needs tyre width and riding position and nothing else about the
 * bike, so this is deliberately four fields in a dialog on the courses page
 * rather than a settings section: it is a course input, and it belongs beside
 * the thing that consumes it.
 */
export function BikeManager({ bikes, onChanged }: Props) {
  const t = useTranslations('courses.bikes')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [width, setWidth] = useState('')
  const [position, setPosition] = useState<RidingPosition>('hoods')
  const [saving, setSaving] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const parsed = Number(width)
    setSaving(true)
    try {
      await apiFetch('/api/bikes', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          tyre_width_mm: width && Number.isFinite(parsed) ? parsed : null,
          riding_position: position,
        }),
      })
      setName('')
      setWidth('')
      setPosition('hoods')
      onChanged()
    } catch (err) {
      toast({
        title: t('saveFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(bike: Bike) {
    try {
      await apiFetch(`/api/bikes/${bike.id}`, { method: 'DELETE' })
      onChanged()
    } catch (err) {
      toast({
        title: t('deleteFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BikeIcon className="mr-1 h-4 w-4" />
          {t('manage')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{t('why')}</p>

        {bikes.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {bikes.map((bike) => (
              <li key={bike.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{bike.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t(`position.${bike.riding_position}` as never)}
                    {bike.tyre_width_mm ? ` · ${bike.tyre_width_mm} mm` : ''}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('delete')}
                  onClick={() => handleDelete(bike)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="bike-name">{t('name')}</Label>
            <Input
              id="bike-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bike-width">{t('tyreWidth')}</Label>
              <Input
                id="bike-width"
                type="number"
                min={10}
                max={80}
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="28"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bike-position">{t('ridingPosition')}</Label>
              <Select
                value={position}
                onValueChange={(v) => setPosition(v as RidingPosition)}
              >
                <SelectTrigger id="bike-position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`position.${p}` as never)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" size="sm" disabled={saving || !name.trim()}>
            {saving ? t('saving') : t('add')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
