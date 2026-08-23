'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'

import { apiFetch, ApiCodeError } from '@/lib/api'
import type { Bike, CourseDetail } from '@/lib/types'
import type { TargetMode } from '@/lib/courses'
import { parseTargetPower, parseTargetTime } from '@/lib/courses'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CourseTargetPicker, targetHelpKey } from './CourseTargetPicker'
import { Map, Upload } from 'lucide-react'

interface Goal {
  id: string
  title: string
}

interface Props {
  bikes: Bike[]
  goals: Goal[]
  onCreated: (course: CourseDetail) => void
  /**
   * `firstRun` is the same component with the explanation someone who has no
   * courses yet actually needs — a bare dashed box does not tell anyone that
   * the GPX an event organiser published is a thing they can drop here.
   */
  variant?: 'compact' | 'firstRun'
}

/** A course is a route, and a route is a GPX. */
const ACCEPT = '.gpx'

export function CourseUploadDropzone({
  bikes,
  goals,
  onCreated,
  variant = 'compact',
}: Props) {
  const t = useTranslations('courses')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [bikeId, setBikeId] = useState<string>(bikes[0]?.id ?? '')
  const [goalId, setGoalId] = useState<string>('_none')
  const [targetMode, setTargetMode] = useState<TargetMode>('none')
  const [targetValue, setTargetValue] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const dropRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!bikeId && bikes.length > 0) setBikeId(bikes[0].id)
  }, [bikes, bikeId])

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const picked = Array.from(fileList).find((f) => /\.gpx$/i.test(f.name))
      if (!picked) {
        toast({
          title: t('upload.invalidFile'),
          description: t('upload.invalidFileDesc'),
          variant: 'destructive',
        })
        return
      }
      setFile(picked)
      if (!name) setName(picked.name.replace(/\.gpx$/i, ''))
    },
    [name, t],
  )

  useEffect(() => {
    const el = dropRef.current
    if (!el) return
    let counter = 0

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault()
      counter++
      setDragging(true)
    }
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault()
      counter--
      if (counter === 0) setDragging(false)
    }
    const onDragOver = (e: DragEvent) => e.preventDefault()
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      counter = 0
      setDragging(false)
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files)
      }
    }

    el.addEventListener('dragenter', onDragEnter)
    el.addEventListener('dragleave', onDragLeave)
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragenter', onDragEnter)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('drop', onDrop)
    }
  }, [handleFiles])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !bikeId) return

    // A target the athlete typed but that does not parse is a mistake worth
    // stopping on: uploading it as "no target" would answer a question they
    // did not ask.
    const targetSeconds = targetMode === 'time' ? parseTargetTime(targetValue) : null
    const targetWatts = targetMode === 'power' ? parseTargetPower(targetValue) : null
    if (targetMode === 'time' && targetSeconds == null) {
      toast({
        title: t('target.badTime'),
        description: t('target.badTimeDesc'),
        variant: 'destructive',
      })
      return
    }
    if (targetMode === 'power' && targetWatts == null) {
      toast({
        title: t('target.badPower'),
        description: t('target.badPowerDesc'),
        variant: 'destructive',
      })
      return
    }

    const form = new FormData()
    form.append('file', file)
    form.append('bike_id', bikeId)
    if (name.trim()) form.append('name', name.trim())
    if (goalId !== '_none') form.append('goal_id', goalId)
    // Only ever one of the two: they are alternatives, and the API refuses a
    // request that names both.
    if (targetSeconds != null) form.append('target_time_s', String(targetSeconds))
    if (targetWatts != null) form.append('target_power_w', String(targetWatts))
    if (startDate) {
      form.append('start_time', new Date(`${startDate}T${startTime || '00:00'}`).toISOString())
    }

    setUploading(true)
    try {
      const course = await apiFetch<CourseDetail>('/api/courses', {
        method: 'POST',
        body: form,
      })
      setFile(null)
      setName('')
      setTargetMode('none')
      setTargetValue('')
      setStartDate('')
      setStartTime('')
      onCreated(course)
    } catch (err) {
      // The backend answers an unusable course with a reason code rather than
      // a stack trace, so say the reason rather than the status.
      const code = err instanceof ApiCodeError ? err.code : null
      toast({
        title: t('upload.failed'),
        description:
          code && t.has(`upload.reason.${code}` as never)
            ? t(`upload.reason.${code}` as never)
            : err instanceof Error
              ? err.message
              : t('upload.failed'),
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      className="sr-only"
      onChange={(e) => {
        if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files)
        e.target.value = ''
      }}
    />
  )

  if (bikes.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
        <Map className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 text-lg font-semibold">{t('upload.needBikeTitle')}</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {t('upload.needBikeBody')}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div
        ref={dropRef}
        className={cn(
          'rounded-lg border-2 border-dashed p-8 text-center transition-colors select-none cursor-pointer',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          uploading && 'opacity-60 pointer-events-none',
        )}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {variant === 'firstRun' ? (
          <>
            <Map className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold">{t('upload.firstRunTitle')}</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {t('upload.firstRunBody')}
            </p>
          </>
        ) : (
          <>
            <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
            <span className="mt-2 block text-sm text-muted-foreground">
              {file ? file.name : t('upload.drop')}
            </span>
          </>
        )}
        {file && variant === 'firstRun' && (
          <p className="mt-3 text-sm font-medium">{file.name}</p>
        )}
        {input}
      </div>

      {file && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="course-name">{t('upload.name')}</Label>
              <Input
                id="course-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('upload.namePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="course-bike">{t('upload.bike')}</Label>
              <Select value={bikeId} onValueChange={setBikeId}>
                <SelectTrigger id="course-bike">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bikes.map((bike) => (
                    <SelectItem key={bike.id} value={bike.id}>
                      {bike.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="course-target">{t('target.label')}</Label>
              <CourseTargetPicker
                id="course-target"
                mode={targetMode}
                value={targetValue}
                onModeChange={(mode) => {
                  setTargetMode(mode)
                  setTargetValue('')
                }}
                onValueChange={setTargetValue}
              />
              <p className="text-xs text-muted-foreground">{t(targetHelpKey(targetMode))}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="course-goal">{t('upload.goal')}</Label>
              <Select value={goalId} onValueChange={setGoalId}>
                <SelectTrigger id="course-goal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t('upload.noGoal')}</SelectItem>
                  {goals.map((goal) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      {goal.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="course-date">{t('upload.startDate')}</Label>
              <Input
                id="course-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="course-time">{t('upload.startTime')}</Label>
              <Input
                id="course-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={!startDate}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={uploading || !bikeId}>
              {uploading ? t('upload.analysing') : t('upload.analyse')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={uploading}
              onClick={() => setFile(null)}
            >
              {t('upload.cancel')}
            </Button>
          </div>
        </>
      )}
    </form>
  )
}
