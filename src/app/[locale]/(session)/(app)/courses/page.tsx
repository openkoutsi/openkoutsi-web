'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'

import { fetcher, apiFetch } from '@/lib/api'
import type { Bike, CourseDetail, CourseSummary, Goal, Page } from '@/lib/types'
import { formatKm } from '@/lib/courses'
import { formatDate, formatTime } from '@/lib/utils'
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
import { CourseUploadDropzone } from '@/components/courses/CourseUploadDropzone'
import { CourseDetailView } from '@/components/courses/CourseDetailView'
import { BikeManager } from '@/components/courses/BikeManager'
import { Plus, Trash2 } from 'lucide-react'

export default function CoursesPage() {
  const t = useTranslations('courses')
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const { data: courses, mutate: mutateCourses } = useSWR<Page<CourseSummary>>(
    '/api/courses',
    fetcher,
  )
  const { data: bikes, mutate: mutateBikes } = useSWR<Bike[]>('/api/bikes', fetcher)
  const { data: goals } = useSWR<Page<Goal>>('/api/goals', fetcher)

  const items = courses?.items ?? []
  const bikeList = bikes ?? []
  const activeGoals = (goals?.items ?? []).filter((g) => g.status === 'active')

  function handleCreated(course: CourseDetail) {
    setAdding(false)
    setOpenId(course.id)
    mutateCourses()
  }

  async function handleDelete(course: CourseSummary) {
    try {
      await apiFetch(`/api/courses/${course.id}`, { method: 'DELETE' })
      if (openId === course.id) setOpenId(null)
      mutateCourses()
      toast({ title: t('list.deleted', { name: course.name }) })
    } catch (err) {
      toast({
        title: t('list.deleteFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  const showFirstRun = courses != null && items.length === 0 && !adding

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <BikeManager bikes={bikeList} onChanged={() => mutateBikes()} />
          {!showFirstRun && !adding && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" />
              {t('list.add')}
            </Button>
          )}
        </div>
      </div>

      {(adding || showFirstRun) && (
        <Card>
          <CardContent className="pt-6">
            <CourseUploadDropzone
              bikes={bikeList}
              goals={activeGoals}
              onCreated={handleCreated}
              variant={showFirstRun ? 'firstRun' : 'compact'}
            />
            {adding && !showFirstRun && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => setAdding(false)}
              >
                {t('list.cancelAdd')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {items.map((course) => {
        const isOpen = openId === course.id
        return (
          <Card key={course.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{course.name}</CardTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="tabular-nums">{formatKm(course.distance_m)}</span>
                    {course.elevation_gain_m != null && (
                      <span className="tabular-nums">
                        {Math.round(course.elevation_gain_m)} m
                      </span>
                    )}
                    {course.predicted_time_s != null && (
                      <span className="tabular-nums">
                        {formatTime(Math.round(course.predicted_time_s))}
                      </span>
                    )}
                    <span>{formatDate(course.created_at)}</span>
                    {course.feasible === false && (
                      <Badge variant="destructive">
                        {course.target_power_w != null
                          ? t('list.targetUnsustainable')
                          : t('list.targetMissed')}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setOpenId(isOpen ? null : course.id)}>
                    {isOpen ? t('list.hide') : t('list.open')}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" aria-label={t('list.delete')}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('list.deleteTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('list.deleteBody', { name: course.name })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('list.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(course)}>
                          {t('list.delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            {isOpen && (
              <CardContent>
                <CourseDetailView
                  courseId={course.id}
                  bikes={bikeList}
                  onChanged={() => mutateCourses()}
                />
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
