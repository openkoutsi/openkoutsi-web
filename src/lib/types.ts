export interface TokenPair {
  access_token: string
  token_type: string
}

// Shared pagination envelope returned by list endpoints in API v2.
export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

// Instance user as seen by an administrator (GET /api/admin/users).
// A user's LLM-access entitlement summary (issue #9).
export interface LlmEntitlementSummary {
  status: string
  active: boolean
  source: string
  starts_at?: string | null
  expires_at?: string | null
  notes?: string | null
  updated_at?: string | null
}

export interface UserResponse {
  id: string
  // Null for self-serve signup accounts, which are keyed by email.
  username: string | null
  email?: string | null
  roles: string[]
  created_at: string
  consented_at?: string | null
  consent_version?: string | null
  llm_entitlement?: LlmEntitlementSummary | null
}

export interface InvitationResponse {
  id: string
  roles: string[]
  note: string | null
  created_by_username: string
  used_by_username: string | null
  expires_at: string | null
  used_at: string | null
  created_at: string
  url?: string | null
}

// A selectable model preset as returned by the API (no secret leaked).
export interface LlmModelConfig {
  name: string
  label?: string | null
  base_url?: string | null
  model?: string | null
  api_key_set?: boolean
  headers: Record<string, string>
  body: Record<string, unknown>
  // Send a provider-side strict JSON schema for structured generation. Default on.
  structured_outputs?: boolean
}

export interface InstanceSettingsResponse {
  llm_analysis_context: string | null
  admin_contact: string | null
  // The instance's entire LLM config: selectable presets, first = default.
  llm_models: LlmModelConfig[]
  // Issue #9 opt-in gate: require an LLM-access entitlement (or BYOK).
  llm_requires_subscription: boolean
  // Issue #15: allow self-serve email signup (also needs a configured provider).
  allow_self_signup: boolean
  // Issue #46: allow users to issue personal access tokens. Defaults on —
  // turning it off refuses authentication, so tokens issued beforehand stop
  // working immediately rather than merely becoming un-issuable.
  allow_personal_access_tokens: boolean
  // Issue #42: publish the MCP endpoint (POST /mcp) on this instance. Defaults
  // on — off refuses the endpoint outright, the handshake included, so a client
  // is told the server is not there rather than connecting and then failing
  // every useful call.
  allow_mcp_server: boolean
}

export interface InstanceSettingsPatch {
  llm_analysis_context?: string | null
  admin_contact?: string | null
  llm_models?: LlmModelConfig[]
  llm_requires_subscription?: boolean
  allow_self_signup?: boolean
  allow_personal_access_tokens?: boolean
  allow_mcp_server?: boolean
}

// One aggregation row of the admin LLM-usage summary (issue #9).
export interface LlmUsageBucket {
  key: string | null
  calls: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  unknown_usage_calls: number
}

export interface LlmUsageSummaryResponse {
  group_by: string
  from?: string | null
  to?: string | null
  buckets: LlmUsageBucket[]
}

export interface InstanceInfoResponse {
  admin_contact: string | null
  privacy_policy_url: string
  // Issue #15: whether an email provider is configured (gates the self-serve
  // reset form) and whether self-serve signup is currently offered.
  email_enabled: boolean
  allow_self_signup: boolean
  // Issue #46: whether the settings card offers personal access tokens at all.
  allow_personal_access_tokens: boolean
}

// ── Personal access tokens (issue #46) ─────────────────────────────────────

/** One entry of the scope vocabulary, as served by GET /api/tokens/scopes. */
export interface TokenScope {
  name: string
  description: string
  /** Presented apart from the ordinary read scopes — today only
   *  `athlete:export`, which returns the entire record in one call. */
  sensitive: boolean
}

export interface TokenScopesResponse {
  scopes: TokenScope[]
  allowed_lifetime_days: number[]
  default_lifetime_days: number
  max_lifetime_days: number
}

export type TokenStatus = 'active' | 'expired' | 'revoked'

/** A token's metadata. Never carries the secret or its hash. */
export interface PersonalAccessTokenResponse {
  id: string
  name: string
  scopes: string[]
  status: TokenStatus
  expires_at: string
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

/** The create response — the only time the secret is ever returned. */
export interface PersonalAccessTokenCreated extends PersonalAccessTokenResponse {
  token: string
}

/** An admin's view of one user's token: metadata only, and deliberately no
 *  name — names are user-written free text and revealing on their own. */
export interface AdminPersonalAccessTokenResponse {
  id: string
  scopes: string[]
  status: TokenStatus
  expires_at: string
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface User {
  id: string
  email: string
  created_at: string
}

export interface Zone {
  name: string
  low: number
  high: number
}

export interface FtpTest {
  date: string
  ftp: number
  method: string
}

export interface AthleteProfile {
  id: string
  user_id: string
  name: string | null
  date_of_birth: string | null
  weight_kg: number | null
  ftp: number | null
  max_hr: number | null
  resting_hr: number | null
  hr_zones: Zone[]
  power_zones: Zone[]
  ftp_tests: FtpTest[]
  connected_providers: string[]
  app_settings: Record<string, unknown>
  avatar_url: string | null
  consent_accepted: boolean
  created_at: string
  updated_at: string
}

/** Why `Activity.decoupling_pct` is absent — see the backend's decoupling gate. */
export type DecouplingReason =
  | 'too_short'
  | 'no_power'
  | 'no_hr'
  | 'degenerate_hr'
  | 'stream_mismatch'
  | 'variable_effort'
  | 'uneven_pacing'

export interface Activity {
  id: string
  athlete_id: string
  sources: string[]
  name: string
  sport_type: string
  start_time: string
  duration_s: number
  distance_m: number | null
  elevation_m: number | null
  avg_power: number | null
  weighted_power: number | null
  avg_hr: number | null
  max_hr: number | null
  avg_cadence: number | null
  load: number | null
  intensity: number | null
  // Aerobic response metrics (issue #37). `efficiency_factor` (weighted power
  // per heartbeat) and `variability_index` (weighted / average power) are
  // derived server-side on read, so they are present on activities processed
  // long before the feature existed. `decoupling_pct` is the power:HR drift
  // over the ride; when it is null, `decoupling_reason` says why a figure would
  // be misleading rather than leaving the athlete to guess.
  efficiency_factor: number | null
  variability_index: number | null
  decoupling_pct: number | null
  decoupling_reason: DecouplingReason | null
  workout_category: string | null
  labels: string[]
  notes: string | null
  rpe: number | null
  has_fit_file: boolean
  // Which format the stored original is in (issue #36). `has_fit_file` still
  // means "there is an original to download"; this says what the download will
  // be, and it is what tells the UI that a ride with no power data came from a
  // GPX rather than from a broken import. Null when there is no file.
  original_format: ActivityFileFormat | null
  status: string
  created_at: string
}

/** Formats openkoutsi can ingest and store an original of (issue #36). */
export type ActivityFileFormat = 'fit' | 'gpx' | 'tcx'

/** What became of one file in a bulk import. */
export type ImportOutcome = 'imported' | 'skipped_duplicate' | 'failed'

export interface ImportFileResult {
  filename: string
  outcome: ImportOutcome
  /** Prose from the backend explaining a skip or a failure. */
  reason: string | null
  activity_id: string | null
  format: ActivityFileFormat | null
}

export interface ImportJob {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  source_name: string | null
  /** 0 until the archives have been walked — see `processed`. */
  total_files: number
  imported: number
  skipped_duplicate: number
  failed: number
  processed: number
  /** Why the *job* died, as opposed to why one file did. */
  error: string | null
  created_at: string
  updated_at: string | null
  completed_at: string | null
  results: ImportFileResult[]
}

/** The list view, which omits per-file detail — it can be thousands of rows. */
export type ImportJobSummary = Omit<ImportJob, 'results'>

export interface PaginatedImports {
  items: ImportJobSummary[]
  total: number
}

export interface ManualActivityCreate {
  sport_type?: string
  start_time?: string
  duration_s?: number
  name?: string
  distance_m?: number
  elevation_m?: number
  avg_hr?: number
  max_hr?: number
  avg_power?: number
  avg_cadence?: number
  rpe?: number
  load?: number
}

export interface StreamPoint {
  time: number
  power?: number | null
  hr?: number | null
  cadence?: number | null
  altitude?: number | null
  velocity?: number | null
}

export interface ZoneBreakdown {
  zone: string
  seconds: number
  pct: number
}

export interface Interval {
  interval_number: number
  start_offset_s: number
  duration_s: number
  distance_m: number | null
  avg_hr: number | null
  avg_power: number | null
  avg_speed_ms: number | null
  avg_cadence: number | null
  is_auto_split: boolean
}

/**
 * A per-second sample, or `null` where the sensor recorded nothing.
 *
 * Streams are 1 Hz series on one shared clock: index `i` is second `i` of the
 * activity, in every channel. A `null` is a gap — a strap dropout, or a stretch
 * the device didn't record at all — and is **not** a zero. Reading one as zero
 * draws a plunge to 0 W where the athlete was riding normally, and quietly
 * lowers anything that averages over the stream.
 *
 * Activities processed before the backend put streams on this clock carry dense
 * arrays with no nulls; they move onto it when reprocessed. Both shapes have to
 * render, so treat a null as "no value here" rather than branching on the ride.
 */
export type StreamSample = number | null

export type StreamMap = Record<string, StreamSample[]>

export interface ActivityDetail extends Activity {
  streams: StreamMap
  power_bests: Record<number, number>
  distance_bests: Record<number, number>
  power_pr_badges: Record<number, Record<string, string>>
  distance_pr_badges: Record<number, Record<string, string>>
  intervals: Interval[]
  // CP (watts) and W' (joules) the `w_bal` stream was integrated with, frozen at
  // processing time. Both null — and no `w_bal` in `streams` — when the
  // athlete's power bests weren't enough to fit a CP.
  cp_w: number | null
  w_prime_j: number | null
  // How many duration bests the CP fit used. Low values mean a thin power
  // profile at the time — typically an old ride imported early in a
  // newest-first provider backlog.
  cp_fit_points: number | null
  zone_breakdown?: ZoneBreakdown[]
  analysis_status?: string | null
  analysis?: string | null
  // Issue #43 — see `TrainingStatus.progress`. Only set while `analysis_status`
  // is "pending" on the agentic path.
  analysis_progress?: string | null
}

export type FormLabel = 'peak' | 'fresh' | 'neutral' | 'tired' | 'overreached'

export interface FitnessPoint {
  date: string
  fitness: number
  fatigue: number
  form: number
  daily_load: number
  // Present only on rows from /api/metrics/fitness/forecast: a modeled day
  // projected from the plan's prescribed Load, not a measured one.
  projected?: boolean
  form_label?: FormLabel
}

/**
 * One steady endurance ride in the aerobic efficiency trend
 * (`GET /api/metrics/efficiency`, issue #37).
 *
 * The backend has already filtered out interval and non-cycling rides, so every
 * point here is directly comparable with the others.
 */
export interface EfficiencyPoint {
  activity_id: string
  date: string
  duration_s: number | null
  efficiency_factor: number
  decoupling_pct: number | null
}

export type IntensityBasis = 'power' | 'hr'
export type IntensityMethod = 'time' | 'session'
export type IntensityShape = 'polarized' | 'pyramidal' | 'threshold' | 'predominantly_low'

/**
 * One of the three intensity bands: 1 below LT1, 2 between LT1 and LT2,
 * 3 above LT2.
 *
 * `pct` is the band's share in whatever unit the method counts in — seconds for
 * `method=time`, sessions for `method=session`. `sessions` is only populated
 * for the session method.
 */
export interface IntensityBand {
  band: number
  seconds: number
  pct: number
  sessions: number | null
}

/**
 * Intensity distribution over a training block
 * (`GET /api/metrics/intensity-distribution`, issue #38).
 *
 * `basis` is null for the session method, which counts workout categories and
 * so has no power/HR distinction. `classification` is null when the window has
 * no usable data.
 */
export interface IntensityDistribution {
  start: string | null
  end: string | null
  basis: IntensityBasis | null
  method: IntensityMethod
  bands: IntensityBand[]
  classification: IntensityShape | null
  coverage: {
    activities_total: number
    activities_used: number
    seconds_total: number
  }
  zone_definitions_changed: boolean
}

export interface FitnessCurrent {
  date: string
  fitness: number
  fatigue: number
  form: number
  form_label: FormLabel
}

export interface ActivitySummary {
  num_activities: number
  total_duration_s: number
  total_distance_m: number
}

// Accumulated time-in-zone for one ISO week (Monday-based). `hr` and `power`
// map zone name → seconds; either may be empty. See GET /api/metrics/zones/weekly.
export interface WeeklyZoneBucket {
  week_start: string
  hr: Record<string, number>
  power: Record<string, number>
}

export interface Goal {
  id: string
  athlete_id: string
  title: string
  description: string | null
  target_date: string | null
  metric: string | null
  target_value: number | null
  current_value: number | null
  status: string
  outcome_note: string | null
  created_at: string
}

export interface GoalCreate {
  title: string
  description?: string
  target_date?: string
  metric?: string
  target_value?: number
}

export interface PlannedWorkout {
  id: string
  plan_id: string
  week_number: number
  day_of_week: number
  workout_type: string
  description: string | null
  duration_min: number | null
  target_load: number | null
  // All activities linked to this workout. One session recorded as several
  // activities can link them all here so their combined duration/Load count.
  // Optional so older cached payloads (single link only) still type-check.
  linked_activity_ids?: string[]
  // Derived from the first linked activity; kept for backward compatibility.
  completed_activity_id: string | null
  skip_reason: string | null
  workout_definition_id?: string | null
  // Derived per-workout adherence match score (0–100); null until the workout
  // is completed or past (issue #26).
  match_score?: number | null
}

// ---- Structured workout definitions ----

export type StepType = 'warmup' | 'active' | 'recovery' | 'cooldown' | 'rest' | 'other'
export type TargetMetric = 'power' | 'hr' | 'cadence' | 'pace'

export interface TimeDuration { type: 'time'; seconds: number }
export interface DistanceDuration { type: 'distance'; meters: number }
export interface OpenDuration { type: 'open' }
export type WorkoutDuration = TimeDuration | DistanceDuration | OpenDuration

export interface ZoneSpec { type: 'zone'; zone_number: number }
export interface PctFtpSpec { type: 'pct_ftp'; pct: number }
export interface AbsoluteSpec { type: 'absolute'; value: number }
export interface RangeSpec { type: 'range'; low: number; high: number }
export type TargetSpec = ZoneSpec | PctFtpSpec | AbsoluteSpec | RangeSpec

export interface WorkoutTarget { metric: TargetMetric; spec: TargetSpec }

export interface WorkoutStep {
  kind: 'step'
  step_type: StepType
  duration: WorkoutDuration
  target: WorkoutTarget | null
  notes: string | null
}

export interface RepeatBlock {
  kind: 'repeat'
  repeat_count: number
  steps: WorkoutStepOrRepeat[]
}

export type WorkoutStepOrRepeat = WorkoutStep | RepeatBlock

export interface WorkoutDefinition {
  id: string
  athlete_id: string
  name: string
  description: string | null
  sport_type: string
  steps: WorkoutStepOrRepeat[]
  estimated_duration_s: number | null
  estimated_load: number | null
  created_at: string
  updated_at: string
}

export interface ExportFormat {
  key: string
  label: string
  file_extension: string
  mime_type: string
}

export interface TrainingPlan {
  id: string
  athlete_id: string
  name: string
  start_date: string
  end_date: string | null
  goal: string | null
  weeks: number | null
  status: string
  created_at: string
  workouts: PlannedWorkout[]
  config: Record<string, unknown> | null
  generation_method: string | null
  // Per-week metadata (build vs recovery week, focus note, target weekly
  // Load/hours). Optional so older cached payloads still type-check.
  week_meta?: PlanWeekMeta[] | null
  // Current "so far" adherence score (0–100) and breakdown (issue #26); null
  // when the plan has nothing contributing yet.
  adherence_score?: number | null
  adherence_summary?: PlanAdherenceSummary | null
}

export interface PlanWeekMeta {
  week_number: number
  week_type: string // "build" | "recovery" | "taper"
  focus?: string | null
  target_load?: number | null
  target_hours?: number | null
  base_load?: number | null
}

export interface PlanAdherenceSummary {
  completed: number
  missed: number
  skipped: number
  pending: number
  // Sessions still to do from today onward: future workouts + today's un-acted
  // workout. Optional so older cached payloads still type-check.
  remaining?: number
}

export interface PlanAdherencePoint {
  date: string
  score: number | null
  completed: number
  missed: number
  skipped: number
  pending: number
}

export interface PaginatedActivities {
  items: Activity[]
  total: number
  page: number
  page_size: number
}

export interface PowerBestEntry {
  duration_s: number
  rank: number
  power_w: number
  activity_id: string
  activity_name: string | null
  activity_start_time: string | null
  weight_kg: number | null
  w_per_kg: number | null
}

export interface WeightLogEntry {
  date: string
  weight_kg: number
}

export interface AllTimePowerBests {
  bests: PowerBestEntry[]
}

export interface FtpEstimate {
  twenty_min_power: number | null
  ftp_simple: number | null
  simple_available: boolean
  cp: number | null
  w_prime: number | null
  ftp_cp: number | null
  cp_available: boolean
}

export interface PowerModelPoint {
  duration_s: number
  power_w: number
}

// One fitted power–duration model. `model` is a stable key
// ('cp2' | 'cp3' | 'exp' | 'power_law'); parameter fields are populated only
// for the models that define them.
export interface PowerModelFit {
  model: string
  available: boolean
  cp: number | null
  w_prime: number | null
  k: number | null
  pmax: number | null
  tau: number | null
  a: number | null
  b: number | null
  rmse: number | null
  curve: PowerModelPoint[]
  predictions: PowerModelPoint[]
}

export interface PowerModels {
  models: PowerModelFit[]
  days: number | null
}

export interface DistanceBestEntry {
  distance_m: number
  rank: number
  time_s: number
  activity_id: string
  activity_name: string | null
  activity_start_time: string | null
}

export interface AllTimeDistanceBests {
  bests: DistanceBestEntry[]
}

export interface TrainingStatus {
  status: string | null
  feedback: string | null
  generated_date: string | null
  // Issue #43. What the agentic coach is doing right now, while `status` is
  // "pending" and no prose has arrived yet: a code from a fixed vocabulary
  // (`thinking`, `tool.<tool_name>`), never a sentence. Null once the answer
  // starts and null for the whole non-agentic path. Render it through
  // `progressText`, which falls back to generic copy for a code this build
  // doesn't know — the tool set grows without a frontend release.
  progress?: string | null
}

export interface GoalGuidance {
  status: string | null
  verdict: string | null
  guidance: string | null
  updated_at: string | null
}

export interface Message {
  id: string
  type: string
  /**
   * Machine-readable metadata — deep links, icon selection, the data export.
   * Never the source of what the message says: the backend renders `title` and
   * `body` when the message is sent, so a new message type is readable here
   * without the web app shipping a template for it first.
   */
  data: Record<string, unknown>
  /** Null on messages sent before messages carried their own text. */
  title: string | null
  body: string | null
  /** Which language `title`/`body` were rendered in. */
  locale: string | null
  read_at: string | null
  created_at: string
}

export interface UnreadCount {
  count: number
}

// ── Achievements & streaks (issue #33) ─────────────────────────────────────

/**
 * A catalogue entry. Carries ids and tiers only — the display name and
 * description are i18n strings under `app.achievements.<id>`, so the same
 * payload serves every locale.
 */
export interface AchievementDefinition {
  id: string
  category: string
  tiers: number[]
  /** What the tier numbers mean: count, hours, km, metres, load, percent, weeks, months. */
  unit: string
  /** Data dependency ("distance", "elevation", "load", "plan"); null when always reachable. */
  requires: string | null
  /**
   * For streaks: what makes one period qualify — 5 `hours` a week, 100 `km` a
   * week — as distinct from `tiers`, which counts qualifying periods. Comes from
   * the backend's own constants, so the rule shown always matches the rule
   * enforced; never hardcode these numbers in copy. Null for non-streaks and
   * for the streaks that need only a single activity.
   */
  threshold: number | null
  threshold_unit: string | null
}

export interface AchievementUnlock {
  achievement_id: string
  tier: number
  /** The day the criterion was actually met, derived from the athlete's history. */
  achieved_on: string
  created_at: string | null
  seen: boolean
  context: Record<string, string> | null
}

export interface Streak {
  id: string
  current: number
  longest: number
  /**
   * The current week hasn't qualified yet but the streak is still alive — the
   * week simply isn't over. Never render this as broken.
   */
  in_progress: boolean
}

export interface Achievements {
  catalogue: AchievementDefinition[]
  unlocked: AchievementUnlock[]
  progress: Record<string, number>
  streaks: Streak[]
  /** True when the athlete has opted out; the UI hides the feature entirely. */
  disabled: boolean
}

// ── Conversational Koutsi (issue #44) ──────────────────────────────────────

/**
 * What an assistant turn is doing.
 *
 * `queued` is the one with no equivalent anywhere else in the app. A chat turn
 * competes for the same agent slots as the background daily-status runs, and
 * unlike them it has no single-shot prompt to fall back to — so instead of
 * being refused it waits, and the wait is a state the athlete can read rather
 * than a spinner that means nothing.
 */
export type ChatMessageStatus = 'queued' | 'pending' | 'complete' | 'error'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  /** Grows as the answer streams in; empty while queued. */
  content: string
  /** Null on the athlete's own turns — nothing about them is pending. */
  status: ChatMessageStatus | null
  /**
   * Issue #43's progress code while the turn is still gathering. Render it
   * through `progressText`, exactly as the dashboard card does.
   */
  progress?: string | null
  /**
   * Why a turn failed, as a machine key this app localises. Unknown codes fall
   * back to generic copy: the backend can learn a new failure mode without a
   * frontend release, the same contract the progress codes have.
   */
  error_code?: string | null
  /** Registry tool names the turn consulted — never arguments or results. */
  tool_names?: string[] | null
  created_at: string
}

export interface ChatConversation {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

export interface ChatConversationDetail extends ChatConversation {
  messages: ChatMessage[]
}

/**
 * Why chat is or is not usable, answered *before* the athlete types.
 *
 * Chat is the only LLM surface with nothing to degrade to, so its reasons for
 * not working have to be knowable up front — discovering "your model can't call
 * tools" as a failed turn, after composing a question, is a bad way to learn a
 * permanent fact about your own setup.
 */
export interface ChatAvailability {
  /** The `agentic_koutsi` opt-in. Chat needs tools to be worth anything. */
  enabled: boolean
  /** False disables the surface: a settled property, not a transient failure. */
  tools_supported: boolean
  entitled: boolean
  turns_remaining_today: number
  max_turns_per_conversation: number
  max_message_chars: number
}
