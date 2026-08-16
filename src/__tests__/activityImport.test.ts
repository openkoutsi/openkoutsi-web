import { describe, expect, it } from 'vitest'

import activitiesEn from '../../messages/en/activities.json'
import activitiesFi from '../../messages/fi/activities.json'
import {
  DIRECT_UPLOAD_MAX_FILES,
  chooseUploadRoute,
  importProgress,
  importableFiles,
  isFinished,
  isImportable,
  isPlainFit,
} from '@/lib/imports'

// Bulk activity import (issue #36). Two endpoints, and the interesting logic in
// the web app is which one a given drop should go to.

describe('recognising importable files', () => {
  it.each([
    'ride.fit',
    'RIDE.FIT',
    'ride.gpx',
    'ride.tcx',
    'activities.zip',
    '12345.fit.gz',
    '12345.gpx.gz',
  ])('accepts %s', (name) => {
    expect(isImportable(name)).toBe(true)
  })

  it.each(['notes.txt', 'photo.jpg', 'ride.fit.bak', 'ride', 'ride.gpx.txt'])(
    'rejects %s',
    (name) => {
      expect(isImportable(name)).toBe(false)
    },
  )

  it('tells a plain FIT from a gzipped one', () => {
    // The direct upload endpoint takes an uncompressed FIT and nothing else.
    expect(isPlainFit('ride.fit')).toBe(true)
    expect(isPlainFit('ride.fit.gz')).toBe(false)
    expect(isPlainFit('ride.gpx')).toBe(false)
  })

  it('keeps the files it understands, in order', () => {
    const files = [
      new File([''], 'a.fit'),
      new File([''], 'notes.txt'),
      new File([''], 'b.gpx'),
    ]
    expect(importableFiles(files).map((f) => f.name)).toEqual(['a.fit', 'b.gpx'])
  })
})

describe('choosing between the upload and the import endpoint', () => {
  it('sends a couple of FIT files straight to the upload endpoint', () => {
    // Faster, shows the ride immediately, and it is the only path that attaches
    // a device file to an already-synced activity.
    expect(chooseUploadRoute(['ride.fit'])).toBe('direct')
    expect(chooseUploadRoute(['a.fit', 'b.fit'])).toBe('direct')
  })

  it('sends anything that is not a plain FIT to the import job', () => {
    expect(chooseUploadRoute(['ride.gpx'])).toBe('import')
    expect(chooseUploadRoute(['ride.tcx'])).toBe('import')
    expect(chooseUploadRoute(['export.zip'])).toBe('import')
    expect(chooseUploadRoute(['ride.fit.gz'])).toBe('import')
    expect(chooseUploadRoute(['a.fit', 'b.gpx'])).toBe('import')
  })

  it('sends a backlog to the import job even when it is all FIT', () => {
    // The upload endpoint allows 30 an hour, which is the whole reason bulk
    // import exists; a drop this size should not be spending that budget.
    const many = Array.from({ length: DIRECT_UPLOAD_MAX_FILES + 1 }, (_, i) => `${i}.fit`)
    expect(chooseUploadRoute(many)).toBe('import')
  })

  it('ignores files it cannot use when deciding', () => {
    expect(chooseUploadRoute(['ride.fit', 'notes.txt'])).toBe('direct')
    expect(chooseUploadRoute(['notes.txt', 'photo.jpg'])).toBe('none')
    expect(chooseUploadRoute([])).toBe('none')
  })
})

describe('job progress', () => {
  it('has no percentage until the archive has been walked', () => {
    // `total_files` is 0 while the zip is still being expanded, and a
    // percentage of an unknown total is a lie with a number on it.
    expect(importProgress({ processed: 0, total_files: 0 })).toBeNull()
  })

  it('is the fraction of files finished with', () => {
    expect(importProgress({ processed: 25, total_files: 100 })).toBeCloseTo(0.25)
    expect(importProgress({ processed: 100, total_files: 100 })).toBe(1)
  })

  it('never exceeds one', () => {
    expect(importProgress({ processed: 7, total_files: 5 })).toBe(1)
  })

  it('stops polling only once the job settles', () => {
    expect(isFinished({ status: 'pending' })).toBe(false)
    expect(isFinished({ status: 'running' })).toBe(false)
    expect(isFinished({ status: 'completed' })).toBe(true)
    expect(isFinished({ status: 'failed' })).toBe(true)
    expect(isFinished(undefined)).toBe(false)
  })
})

describe('import i18n', () => {
  const KEYS = [
    'title',
    'firstRunTitle',
    'firstRunBody',
    'chooseFiles',
    'formats',
    'starting',
    'startFailed',
    'reading',
    'progress',
    'summary',
    'jobFailed',
    'allImported',
    'needsAttention',
    'showAll',
    'showOnlyNotable',
    'dismiss',
    'noPowerNote',
  ] as const

  it('defines every import key in both locales', () => {
    for (const key of KEYS) {
      expect(activitiesEn.import, `en.import.${key}`).toHaveProperty(key)
      expect(activitiesFi.import, `fi.import.${key}`).toHaveProperty(key)
    }
  })

  it('translates every outcome the API can report', () => {
    // These are the stable codes in `ImportJob.results`; a missing one shows a
    // raw message id next to a filename in the result list.
    for (const outcome of ['imported', 'skipped_duplicate', 'failed']) {
      expect(activitiesEn.import.outcome).toHaveProperty(outcome)
      expect(activitiesFi.import.outcome).toHaveProperty(outcome)
    }
  })

  it('keeps the two locales structurally identical', () => {
    expect(Object.keys(activitiesFi.import).sort()).toEqual(
      Object.keys(activitiesEn.import).sort(),
    )
  })

  it('names the same interpolations in both locales', () => {
    const placeholders = (value: string) => (value.match(/\{(\w+)\}/g) ?? []).sort()
    for (const key of KEYS) {
      const en = (activitiesEn.import as Record<string, unknown>)[key] as string
      const fi = (activitiesFi.import as Record<string, unknown>)[key] as string
      expect(placeholders(fi), `import.${key}`).toEqual(placeholders(en))
    }
  })

  it('offers the download in whichever format the original is', () => {
    for (const locale of [activitiesEn, activitiesFi]) {
      expect(locale.detail).toHaveProperty('downloadOriginal')
      expect(locale.detail.downloadOriginal).toContain('{format}')
    }
  })

  it('no longer claims only .fit files are supported', () => {
    for (const locale of [activitiesEn, activitiesFi]) {
      const blob = JSON.stringify(locale.upload).toLowerCase()
      expect(blob).toContain('.gpx')
      expect(blob).toContain('.tcx')
    }
  })
})
