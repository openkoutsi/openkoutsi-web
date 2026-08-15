'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { apiFetch, fetcher } from '@/lib/api'
import { toast } from '@/components/ui/use-toast'
import { Upload, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  chooseUploadRoute,
  importableFiles,
  isFinished,
  startImport,
} from '@/lib/imports'
import type { PaginatedImports } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { ImportProgress } from './ImportProgress'

interface Props {
  onUploaded?: () => void
  /**
   * `firstRun` is the same component with the explanation an athlete who has
   * nothing here yet actually needs (issue #36). Bringing a training history
   * across is the hardest part of adopting openkoutsi, and a bare dashed box
   * saying "drop files here" does not tell anyone that their Strava export is
   * something they can drop.
   */
  variant?: 'compact' | 'firstRun'
}

/** Everything the two endpoints between them accept. */
const ACCEPT = '.fit,.gpx,.tcx,.zip,.gz'

export function UploadDropzone({ onUploaded, variant = 'compact' }: Props) {
  const t = useTranslations('activities')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // An import outlives the page: reloading mid-job should show the job again
  // rather than an idle dropzone while nine hundred files are being parsed.
  const { data: recent } = useSWR<PaginatedImports>(
    jobId ? null : '/api/activities/imports?limit=1',
    fetcher,
  )
  useEffect(() => {
    const latest = recent?.items?.[0]
    if (latest && !isFinished(latest)) setJobId(latest.id)
  }, [recent])

  const uploadDirect = useCallback(
    async (files: File[]) => {
      let succeeded = 0
      for (const file of files) {
        try {
          const form = new FormData()
          form.append('file', file)
          await apiFetch('/api/activities/upload', { method: 'POST', body: form })
          succeeded++
        } catch (err) {
          toast({
            title: t('upload.uploadFailed', { name: file.name }),
            description: err instanceof Error ? err.message : 'Unknown error',
            variant: 'destructive',
          })
        }
      }
      if (succeeded > 0) {
        toast({
          title: succeeded === 1 ? t('upload.uploaded') : t('upload.uploadedMultiple', { count: succeeded }),
          description: succeeded === 1
            ? t('upload.processing', { name: files[0].name })
            : t('upload.processingMultiple'),
        })
        onUploaded?.()
      }
    },
    [onUploaded, t],
  )

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const all = Array.from(fileList)
      const usable = importableFiles(all)
      const route = chooseUploadRoute(all.map((f) => f.name))

      if (route === 'none') {
        toast({
          title: t('upload.invalidFile'),
          description: t('upload.invalidFileDesc'),
          variant: 'destructive',
        })
        return
      }
      if (usable.length < all.length) {
        toast({
          title: t('upload.someSkipped'),
          description: t('upload.someSkippedDesc'),
          variant: 'destructive',
        })
      }

      setUploading(true)
      try {
        if (route === 'direct') {
          await uploadDirect(usable)
        } else {
          const job = await startImport(usable)
          setJobId(job.id)
        }
      } catch (err) {
        toast({
          title: t('import.startFailed'),
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        })
      } finally {
        setUploading(false)
      }
    },
    [t, uploadDirect],
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
    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
    }
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

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files)
      e.target.value = ''
    },
    [handleFiles],
  )

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      multiple
      className="sr-only"
      onChange={handleChange}
    />
  )

  return (
    <div className="space-y-3">
      {jobId && (
        <ImportProgress
          jobId={jobId}
          onFinished={() => onUploaded?.()}
          onDismiss={() => setJobId(null)}
        />
      )}

      {variant === 'firstRun' ? (
        <div
          ref={dropRef}
          className={cn(
            'rounded-lg border-2 border-dashed p-8 text-center transition-colors select-none',
            dragging ? 'border-primary bg-primary/5' : 'border-border',
            uploading && 'opacity-60 pointer-events-none',
          )}
        >
          <History className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">{t('import.firstRunTitle')}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {t('import.firstRunBody')}
          </p>
          <Button
            className="mt-4"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? t('import.starting') : t('import.chooseFiles')}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">{t('import.formats')}</p>
          {input}
        </div>
      ) : (
        <div
          ref={dropRef}
          className={cn(
            'flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors select-none',
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
            uploading && 'opacity-60 pointer-events-none',
          )}
          onClick={() => !uploading && inputRef.current?.click()}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm text-muted-foreground text-center">
            {uploading ? t('upload.uploading') : t('upload.drop')}
          </span>
          <span className="text-xs text-muted-foreground text-center">
            {t('import.formats')}
          </span>
          {input}
        </div>
      )}
    </div>
  )
}
