'use client'

import {
  AlertTriangle,
  CalendarPlus,
  Check,
  PencilLine,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Link } from '@/navigation'
import type { ChatProposal, PlanProposalSummary } from '@/lib/types'

/**
 * The offer Koutsi has put in front of the athlete (issue #72).
 *
 * **The card is the prompt.** The athlete answers with a button, never by
 * typing "yes" into the thread — a typed yes would put the decision back inside
 * the very thing being gated, and the whole design turns on the model not being
 * able to reach the write. Koutsi drafted this; the click is what writes it.
 *
 * Which makes the archive warning below the most important thing on the card
 * rather than a detail. Creating a plan **archives every active plan whose dates
 * overlap it**, so a yes given without seeing that is not consent to what
 * actually happens. The backend names those plans in the summary and re-checks
 * the set at apply time; this shows them, by name and date range, above the
 * buttons rather than below them.
 *
 * The four settled states are rendered too, not hidden. A turn that carried an
 * offer the athlete declined last week should read as a turn that carried an
 * offer, not as an ordinary answer — and an offer that lapsed should say so
 * rather than sitting there looking live.
 */

const DECIDED: Record<string, string> = {
  applied: 'status.applied',
  declined: 'status.declined',
  expired: 'status.expired',
  superseded: 'status.superseded',
}

function when(value: string | null): string {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString()
}

function hours(minutes: number | null): string | null {
  if (!minutes) return null
  return (minutes / 60).toFixed(1)
}

/** A whole drafted plan: what it is, how long, and what the first week looks like. */
function DraftedPlan({ summary }: { summary: PlanProposalSummary }) {
  const t = useTranslations('chat.proposal')

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-medium">{summary.plan_name}</p>
        {summary.goal && (
          <p className="text-xs text-muted-foreground">{summary.goal}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {t('dates', {
            start: when(summary.start_date),
            end: when(summary.end_date),
            weeks: summary.weeks ?? 0,
          })}
        </p>
      </div>

      {summary.weekly.length > 0 && (
        <ul
          aria-label={t('weeksLabel')}
          className="max-h-44 overflow-y-auto rounded-md border border-border/60 text-xs"
        >
          {summary.weekly.map((week) => {
            // `week_type` is a machine key, not prose: the backend sends no
            // English sentence here precisely so this reads the same in Finnish.
            const typeKey = `weekType.${week.week_type ?? 'build'}`
            const total = hours(week.total_duration_min)
            return (
              <li
                key={week.week_number}
                className="flex items-baseline justify-between gap-3 border-b border-border/40 px-2 py-1 last:border-b-0"
              >
                <span className="font-medium">
                  {t('weekLabel', { number: week.week_number })}
                </span>
                <span className="text-muted-foreground">
                  {t.has(typeKey) ? t(typeKey) : ''}
                </span>
                <span className="text-muted-foreground">
                  {t('weekSummary', {
                    sessions: week.sessions,
                    load: week.total_load ?? 0,
                    hours: total ?? '0',
                  })}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {summary.first_week.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium">{t('firstWeek')}</p>
          <ul aria-label={t('firstWeek')} className="flex flex-col gap-0.5 text-xs">
            {summary.first_week.map((session) => {
              const dayKey = `days.${session.day_of_week}`
              return (
                <li key={session.day_of_week} className="flex gap-2">
                  <span className="w-10 shrink-0 text-muted-foreground">
                    {t.has(dayKey) ? t(dayKey) : ''}
                  </span>
                  <span className="min-w-0">
                    {session.description ||
                      session.workout_type ||
                      t('restDay')}
                    {session.duration_min ? (
                      <span className="text-muted-foreground">
                        {' '}
                        {t('sessionMeta', {
                          minutes: session.duration_min,
                          load: session.target_load ?? 0,
                        })}
                      </span>
                    ) : null}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {summary.remaining_weeks > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('moreWeeks', { count: summary.remaining_weeks })}
        </p>
      )}
    </div>
  )
}

/** A change to something that already exists: the fields it would move. */
function DraftedChange({ summary }: { summary: PlanProposalSummary }) {
  const t = useTranslations('chat.proposal')

  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">
        {summary.target_label
          ? `${summary.plan_name} — ${summary.target_label}`
          : summary.plan_name}
      </p>
      {summary.target_date && (
        <p className="text-xs text-muted-foreground">{when(summary.target_date)}</p>
      )}
      <ul aria-label={t('changesLabel')} className="flex flex-col gap-1 text-xs">
        {summary.changes.map((change) => {
          const fieldKey = `field.${change.field}`
          return (
            <li key={change.field} className="flex flex-wrap gap-1">
              <span className="font-medium">
                {t.has(fieldKey) ? t(fieldKey) : change.field}
              </span>
              <span className="text-muted-foreground">
                {t('changeArrow', {
                  before: change.before ?? t('unset'),
                  after: change.after ?? t('unset'),
                })}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function PlanProposalCard({
  proposal,
  onApprove,
  onDecline,
  busy = false,
}: {
  proposal: ChatProposal
  onApprove?: () => void
  onDecline?: () => void
  busy?: boolean
}) {
  const t = useTranslations('chat.proposal')
  const { summary, status } = proposal
  const isCreate = summary.kind === 'create_plan'
  const titleKey = `title.${summary.kind}`
  const approveKey = `approve.${summary.kind}`
  const Icon = isCreate ? CalendarPlus : PencilLine

  return (
    <section
      aria-label={t.has(titleKey) ? t(titleKey) : t('title.create_plan')}
      className="ml-13 max-w-prose rounded-2xl border border-border bg-muted/30 p-4 text-sm"
    >
      <p className="mb-3 flex items-center gap-2 font-medium">
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        {t.has(titleKey) ? t(titleKey) : t('title.create_plan')}
      </p>

      {isCreate ? (
        <DraftedPlan summary={summary} />
      ) : (
        <DraftedChange summary={summary} />
      )}

      {/* The thing a yes actually costs, above the button rather than below it. */}
      {summary.archives.length > 0 && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs"
        >
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive"
            aria-hidden
          />
          <div>
            <p className="font-medium">
              {t('archiveTitle', { count: summary.archives.length })}
            </p>
            <ul className="text-muted-foreground">
              {summary.archives.map((plan) => (
                <li key={plan.plan_id}>
                  {plan.name}
                  {plan.start_date && plan.end_date
                    ? ` (${when(plan.start_date)} – ${when(plan.end_date)})`
                    : ''}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground">{t('archiveUndo')}</p>
          </div>
        </div>
      )}

      {summary.reopens_plan && (
        <p className="mt-2 text-xs text-muted-foreground">{t('reopens')}</p>
      )}

      {/* Shortening a plan leaves its later sessions where they are, and they go
          on being scored — as missed. The write matches what the plan page has
          always done; what would not be honest is a card showing "4 weeks → 1"
          and letting the athlete find out afterwards why their adherence fell. */}
      {summary.stranded_sessions > 0 && (
        <p
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs"
        >
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive"
            aria-hidden
          />
          <span>{t('stranded', { count: summary.stranded_sessions })}</span>
        </p>
      )}

      {/* A rule-built draft is a different thing to be offered, not a worse
          version of the same thing — so it says so rather than passing itself
          off as one Koutsi wrote. */}
      {isCreate && summary.built_by === 'rule_based' && (
        <p className="mt-2 text-xs text-muted-foreground">{t('ruleBased')}</p>
      )}

      {status === 'pending' ? (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{t('nothingYet')}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onApprove} disabled={busy} className="gap-1.5">
              <Check className="h-3.5 w-3.5" aria-hidden />
              {t.has(approveKey) ? t(approveKey) : t('approve.create_plan')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDecline}
              disabled={busy}
              className="gap-1.5"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              {t('decline')}
            </Button>
          </div>
          {proposal.expires_at && (
            <p className="text-xs text-muted-foreground">
              {t('expires', { when: when(proposal.expires_at) })}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-xs font-medium" role="status">
            {t(DECIDED[status] ?? 'status.declined')}
          </p>
          {status === 'applied' && (
            <Link href="/plan" className="text-xs font-medium text-primary hover:underline">
              {t('openPlan')}
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
