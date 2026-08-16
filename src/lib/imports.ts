/**
 * Which upload path a dropped set of files should take (issue #36).
 *
 * There are two, and they are genuinely different interactions rather than one
 * being a bulk version of the other:
 *
 * - `POST /api/activities/upload` takes one FIT file, returns the created
 *   activity, and — uniquely — attaches the file to an existing synced activity
 *   when one already covers that time, so a Strava-synced ride gains its
 *   device laps. It is rate limited to 30/hour.
 * - `POST /api/activities/import` takes anything (FIT, GPX, TCX, gzipped, or a
 *   zip of them), returns a job to poll, and is limited per *job*.
 *
 * So a couple of FITs dropped on the page should still go the direct way: it is
 * faster, it shows the ride immediately, and it can enrich a synced activity.
 * Everything else — an archive, another format, or more files than someone is
 * plausibly adding by hand — is an import.
 */
import type { ImportJob } from './types'
import { apiFetch } from './api'

/**
 * Above this many files, even plain FITs go through the import job.
 *
 * Chosen against the upload endpoint's 30/hour limit rather than against any
 * property of the files: someone dropping in yesterday's two rides wants them
 * on screen now, and someone dropping in fifteen is importing a backlog and
 * would otherwise be a fifth of the way to being throttled.
 */
export const DIRECT_UPLOAD_MAX_FILES = 5

const PLAIN_FIT = /\.fit$/i
const IMPORTABLE = /\.(fit|gpx|tcx|zip|gz)$/i

export function isImportable(filename: string): boolean {
  return IMPORTABLE.test(filename)
}

export function isPlainFit(filename: string): boolean {
  return PLAIN_FIT.test(filename)
}

export type UploadRoute = 'direct' | 'import' | 'none'

/** Which endpoint this set of files should go to. */
export function chooseUploadRoute(filenames: string[]): UploadRoute {
  const usable = filenames.filter(isImportable)
  if (usable.length === 0) return 'none'
  if (usable.length <= DIRECT_UPLOAD_MAX_FILES && usable.every(isPlainFit)) {
    return 'direct'
  }
  return 'import'
}

/** Files this build knows what to do with, in the order they were given. */
export function importableFiles(files: File[]): File[] {
  return files.filter((f) => isImportable(f.name))
}

/** Start a bulk import and return the job to poll. */
export async function startImport(files: File[]): Promise<ImportJob> {
  const form = new FormData()
  for (const file of files) form.append('files', file)
  return apiFetch<ImportJob>('/api/activities/import', { method: 'POST', body: form })
}

/** Has this job stopped moving? Polling can stop once it has. */
export function isFinished(job: Pick<ImportJob, 'status'> | undefined): boolean {
  return job?.status === 'completed' || job?.status === 'failed'
}

/**
 * Fraction of the job that is done, or `null` while the total is still unknown.
 *
 * `total_files` is 0 until the archives have been walked, and a percentage of
 * an unknown total is a lie with a number on it — the caller shows an
 * indeterminate state instead.
 */
export function importProgress(job: Pick<ImportJob, 'processed' | 'total_files'>): number | null {
  if (!job.total_files) return null
  return Math.min(1, job.processed / job.total_files)
}
