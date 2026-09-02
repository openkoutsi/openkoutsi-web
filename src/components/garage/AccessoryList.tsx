'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { apiFetch } from '@/lib/api'
import type { BikeAccessory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { Plus, Trash2 } from 'lucide-react'

interface Props {
  bikeId: string
  accessories: BikeAccessory[]
  onChanged: () => void
}

/**
 * What is bolted to a bike (issue #64).
 *
 * A plain list on purpose. A child trailer genuinely changes mass and drag, but
 * feeding that into the pacing model means touching the physics and deciding
 * what happens to already-analysed courses; that is deferred. Nothing here
 * moves a prediction, and the copy says so rather than letting an athlete
 * assume a fitted trailer is being accounted for.
 */
export function AccessoryList({ bikeId, accessories, onChanged }: Props) {
  const t = useTranslations('garage.accessories')
  const tg = useTranslations('garage')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await apiFetch(`/api/bikes/${bikeId}/accessories`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), note: note.trim() || null }),
      })
      setName('')
      setNote('')
      setAdding(false)
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

  async function handleDelete(accessory: BikeAccessory) {
    try {
      await apiFetch(`/api/bikes/${bikeId}/accessories/${accessory.id}`, {
        method: 'DELETE',
      })
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t('title')}</h3>
        {!adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t('add')}
          </Button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="accessory-name">{t('name')}</Label>
              <Input
                id="accessory-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessory-note">{t('note')}</Label>
              <Input
                id="accessory-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('help')}</p>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving || !name.trim()}>
              {saving ? tg('saving') : t('add')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              {tg('cancel')}
            </Button>
          </div>
        </form>
      )}

      {accessories.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        accessories.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {accessories.map((accessory) => (
              <li
                key={accessory.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm">{accessory.name}</div>
                  {accessory.note && (
                    <p className="truncate text-xs text-muted-foreground">
                      {accessory.note}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('delete')}
                  onClick={() => handleDelete(accessory)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  )
}
