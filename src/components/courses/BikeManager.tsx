'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { Link } from '@/navigation'
import type { Bike } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Bike as BikeIcon, ArrowRight } from 'lucide-react'

interface Props {
  bikes: Bike[]
}

/**
 * What bikes the pacing model has to choose from (issues #55, #64).
 *
 * This used to be the only place a bike could be created, edited or deleted —
 * four fields in a dialog beside the thing that consumed them. The garage
 * (issue #64) owns that now, and this shrank to a read-only summary that links
 * out to it: a second editing surface for the same rows is how the two drift,
 * and it would have to grow every garage field or quietly refuse to show them.
 *
 * It lists what the course picker will actually offer, which is why retired
 * bikes are shown as retired rather than hidden: an athlete who cannot find
 * their bike in the picker above should be able to see *why* here.
 */
export function BikeManager({ bikes }: Props) {
  const t = useTranslations('courses.bikes')
  const [open, setOpen] = useState(false)

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

        {bikes.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {bikes.map((bike) => (
              <li key={bike.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {bike.name}
                    {bike.retired_at && (
                      <Badge variant="outline" className="text-xs font-normal">
                        {t('retired')}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t(`position.${bike.riding_position}` as never)}
                    {bike.tyre_width_mm ? ` · ${bike.tyre_width_mm} mm` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        )}

        <Button asChild size="sm" className="w-full">
          <Link href="/garage" onClick={() => setOpen(false)}>
            {t('openGarage')}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </DialogContent>
    </Dialog>
  )
}
