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
}

export interface InstanceSettingsPatch {
  llm_analysis_context?: string | null
  admin_contact?: string | null
  llm_models?: LlmModelConfig[]
  llm_requires_subscription?: boolean
  allow_self_signup?: boolean
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
  workout_category: string | null
  labels: string[]
  notes: string | null
  has_fit_file: boolean
  status: string
  created_at: string
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

export interface ActivityDetail extends Activity {
  streams: Record<string, number[]>
  power_bests: Record<number, number>
  distance_bests: Record<number, number>
  power_pr_badges: Record<number, Record<string, string>>
  distance_pr_badges: Record<number, Record<string, string>>
  intervals: Interval[]
  zone_breakdown?: ZoneBreakdown[]
  analysis_status?: string | null
  analysis?: string | null
}

export interface FitnessPoint {
  date: string
  fitness: number
  fatigue: number
  form: number
  daily_load: number
}

export interface FitnessCurrent {
  date: string
  fitness: number
  fatigue: number
  form: number
  form_label: 'peak' | 'fresh' | 'neutral' | 'tired' | 'overreached'
}

export interface ActivitySummary {
  num_activities: number
  total_duration_s: number
  total_distance_m: number
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
  completed_activity_id: string | null
  skip_reason: string | null
  workout_definition_id?: string | null
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
  data: Record<string, string | null>
  read_at: string | null
  created_at: string
}

export interface UnreadCount {
  count: number
}
