/**
 * Backend Pydantic semalarinin TypeScript karsiliklari.
 * Kaynak: app/schemas/*.py — alan adlari birebir ayni (snake_case).
 * Dogrulama: backend /docs (OpenAPI) ciktisi.
 */

// ---------------------------------------------------------------
// Ortak
// ---------------------------------------------------------------
export type CardioType = "running" | "rowing" | "ski_erg";
export type CardioSource = "apple_health" | "google_health" | "manual";
export type UserTier = "free" | "premium" | "pro";

// ---------------------------------------------------------------
// Kullanici (GET /users/me, PATCH /users/me)
// ---------------------------------------------------------------
export type Gender = "male" | "female" | "other";

export interface UserProfile {
  user_id: string;
  email: string;
  tier: UserTier;
  created_at: string;
  full_name: string | null;
  age: number | null;
  gender: Gender | null;
  height_cm: number | null;
  weight_kg: number | null;
}

/** PATCH /users/me: yalnizca gonderilen alanlar guncellenir. */
export interface UserProfileUpdate {
  full_name?: string | null;
  age?: number | null;
  gender?: Gender | null;
  height_cm?: number | null;
  weight_kg?: number | null;
}

// ---------------------------------------------------------------
// Egzersiz katalogu (GET /exercises)
// ---------------------------------------------------------------
export type ExerciseCategory =
  | "strength"
  | "running"
  | "hyrox"
  | "olympic"
  | "crossfit";

export interface Exercise {
  exercise_id: string;
  name: string;
  category: ExerciseCategory;
  cns_load_factor: number;
  target_muscles: Record<string, number>;
}

// ---------------------------------------------------------------
// Idman kaydi (POST /workouts)
// ---------------------------------------------------------------
/** Set olcum tipi: tekrar / mesafe (m) / sure (sn). */
export type SetMeasurement = "reps" | "distance" | "time";

export interface WorkoutSet {
  measurement: SetMeasurement;
  weight_kg: number;
  reps?: number | null;
  distance_m?: number | null;
  duration_seconds?: number | null;
  rpe?: number | null;
}

export interface ExerciseLog {
  exercise_id: string;
  sets: WorkoutSet[];
}

export interface CardioLog {
  cardio_type: CardioType;
  distance_km: number;
  duration_minutes: number;
  avg_hr?: number | null;
  source?: CardioSource;
}

export interface WorkoutCreate {
  workout_type: string;
  user_reported_rpe: number;
  journal_notes?: string | null;
  duration_minutes: number;
  date?: string | null;
  exercises?: ExerciseLog[] | null;
  cardio?: CardioLog | null;
}

export interface WorkoutSummary {
  workout_log_id: string;
  workout_type: string;
  date: string;
  duration_minutes: number;
  user_reported_rpe: number;
  total_strength_sets: number;
  cardio_distance_km: number | null;
}

export interface MuscleWeeklyLoad {
  muscle: string;
  weekly_load: number;
  overtraining_risk: boolean;
}

export interface WorkoutCreateResponse {
  summary: WorkoutSummary;
  daily_cns_score: number;
  weekly_muscle_loads: MuscleWeeklyLoad[];
  warning_flag: boolean;
  overtraining_risk: string[];
}

// ---------------------------------------------------------------
// Idman gecmisi (GET /workouts)
// ---------------------------------------------------------------
export interface WorkoutSetOut {
  /** Eski kayitlarda alan yoktur; backend 'reps' varsayar */
  measurement?: SetMeasurement;
  weight_kg: number;
  reps: number | null;
  distance_m?: number | null;
  duration_seconds?: number | null;
  rpe: number | null;
}

export interface ExerciseDetailOut {
  exercise_id: string;
  exercise_name: string;
  sets: WorkoutSetOut[];
}

export interface CardioDetailOut {
  cardio_type: string;
  distance_km: number;
  duration_minutes: number;
  avg_hr: number | null;
  source: string;
}

export interface WorkoutHistoryItem {
  workout_log_id: string;
  date: string;
  workout_type: string;
  user_reported_rpe: number;
  duration_minutes: number;
  exercises: ExerciseDetailOut[];
  cardio: CardioDetailOut[];
}

export interface WorkoutHistoryResponse {
  items: WorkoutHistoryItem[];
  total_count: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------
// Haftalik metrikler (GET /metrics/weekly)
// ---------------------------------------------------------------
export interface CardioSummaryItem {
  cardio_type: string;
  sessions: number;
  total_distance_km: number;
  total_duration_minutes: number;
  avg_pace_min_per_km: number | null;
  avg_hr: number | null;
}

export interface WeeklyMetricsResponse {
  weekly_muscle_loads: Record<string, number>;
  warning_flag: boolean;
  overtraining_risk: string[];
  /** ISO tarih -> gunluk CNS skoru */
  daily_cns_scores: Record<string, number>;
  cardio_summary: CardioSummaryItem[];
  total_run_distance_km: number;
  total_workouts: number;
}

// ---------------------------------------------------------------
// AI analiz (POST /analysis/weekly)
// ---------------------------------------------------------------
export interface CoachAnalysis {
  breach_detected: boolean;
  coaches_note: string;
}

export interface WeeklyAnalysisResponse {
  user_id: string;
  tier: UserTier;
  metrics: Omit<WeeklyMetricsResponse, "total_run_distance_km" | "total_workouts">;
  analysis: CoachAnalysis;
}

// ---------------------------------------------------------------
// Pazar degerlendirme sihirbazi (POST /analysis/sunday-review)
// ---------------------------------------------------------------
export interface SundayReviewPayload {
  missed_workouts_reason: string;
  nutrition_adherence: number;
  recovery_feeling: string;
}

export interface SundayReviewResponse {
  review_summary: string;
  next_week_adjustments: string;
  readiness_score: number;
}

// ---------------------------------------------------------------
// Antrenman programi (/templates + /plan)
// ---------------------------------------------------------------
export type PlanWorkoutType =
  | "hybrid"
  | "running"
  | "strength"
  | "metcon"
  | "endurance"
  | "power"
  | "technique"
  | "recovery";

export type WorkoutFormat = "standard" | "circuit" | "emom" | "amrap" | "for_time";

export type Measurement = "reps" | "time" | "distance";

export interface TemplateExercise {
  name: string;
  exercise_id?: string | null;
  measurement: Measurement;
  sets: number;
  reps?: number | null;
  weight_kg?: number | null;
  distance_m?: number | null;
  duration_seconds?: number | null;
  rest_seconds: number;
  /** Hedef RPE (1-10); CNS hesabi icin idman kaydinda kullanilir */
  rpe?: number;
  instructions?: string | null;
}

export interface WorkoutTemplateCreate {
  name: string;
  workout_type: PlanWorkoutType;
  format: WorkoutFormat;
  rounds: number;
  time_cap_minutes?: number | null;
  notes?: string | null;
  exercises: TemplateExercise[];
}

export interface WorkoutTemplate extends WorkoutTemplateCreate {
  template_id: string;
  created_at: string;
  updated_at: string;
}

export interface PlanEntryCreate {
  template_id: string;
  scheduled_date: string; // YYYY-MM-DD
  position?: number;
}

export interface PlanEntry {
  entry_id: string;
  scheduled_date: string;
  position: number;
  completed_at: string | null;
  template: WorkoutTemplate;
}

export interface WeekPlanResponse {
  start_date: string;
  end_date: string;
  entries: PlanEntry[];
}

// ---------------------------------------------------------------
// AI Onboarding Wizard (POST /plan/generate)
// ---------------------------------------------------------------
export type TrainingGoal =
  | "strength"
  | "conditioning"
  | "hyrox"
  | "hybrid"
  | "crossfit";
export type Zone2Habit = "none" | "sometimes" | "regular";
export type SledExperience = "none" | "some" | "confident";
export type OlympicProficiency = "none" | "learning" | "proficient";
export type NutritionConstraint =
  | "none"
  | "omad"
  | "intermittent_fasting"
  | "low_carb";
export type EquipmentLevel = "full_box" | "standard_gym" | "minimal";
export type FedState = "fed" | "fasted" | "flexible";

export interface OnboardingPayload {
  goal: TrainingGoal;
  /** Secilen salon/idman gunleri (0=Pzt ... 6=Paz); days_per_week = uzunluk */
  training_days: number[];
  days_per_week: number;
  wants_running: boolean;
  /** Kosu gunleri; wants_running=true ise en az 1 */
  running_days: number[];
  /** Ayni gunde kosu + salon ayri seans mi */
  split_run_and_gym: boolean;
  gym_preferred_start: string;
  gym_preferred_end: string;
  run_preferred_start: string;
  run_preferred_end: string;
  gym_fed_state: FedState;
  run_fed_state: FedState;
  gym_duration_minutes: number;
  run_duration_minutes: number;
  five_k_pace_seconds_per_km?: number | null;
  zone2_habit: Zone2Habit;
  sled_experience: SledExperience;
  olympic_proficiency: OlympicProficiency;
  weekend_conditioning: boolean;
  nutrition_constraint: NutritionConstraint;
  equipment: EquipmentLevel;
  /** Opsiyonel: gun bazli veya genel program istekleri */
  custom_program_notes?: string | null;
}

export interface GeneratedDay {
  /** 0 = Pazartesi ... 6 = Pazar */
  day_of_week: number;
  focus: string;
  template: WorkoutTemplateCreate;
}

export interface GeneratedWeekPlan {
  coach_summary: string;
  days: GeneratedDay[];
}

// ---------------------------------------------------------------
// AI gunluk idman + revize (POST /plan/generate-day, /plan/modify-workout)
// ---------------------------------------------------------------
export type SessionKind = "gym" | "running" | "hybrid";

export interface AthleteContext {
  goal?: TrainingGoal;
  equipment?: EquipmentLevel;
  zone2_habit?: Zone2Habit;
  sled_experience?: SledExperience;
  olympic_proficiency?: OlympicProficiency;
  five_k_pace_seconds_per_km?: number | null;
  nutrition_constraint?: NutritionConstraint;
}

export interface DayWorkoutGeneratePayload {
  day_of_week: number;
  session_kind: SessionKind;
  duration_minutes: number;
  preferred_workout_type?: string | null;
  athlete_context?: AthleteContext | null;
}

export interface GeneratedDayWorkout {
  focus: string;
  template: WorkoutTemplateCreate;
}

export interface WorkoutModifyPayload {
  template: WorkoutTemplateCreate;
  change_reason: string;
  target_duration_minutes?: number | null;
}

export interface ModifiedWorkoutResponse {
  focus: string;
  coach_note: string;
  template: WorkoutTemplateCreate;
}

export interface WeeklyDayContext {
  day_of_week: number;
  day_name: string;
  workout_name: string;
  exercise_names: string[];
}

export type SuggestMode = "append" | "replace";

export interface ExerciseSuggestPayload {
  mode: SuggestMode;
  workout_name: string;
  workout_type: string;
  format: WorkoutFormat;
  rounds: number;
  time_cap_minutes?: number | null;
  existing_exercises: TemplateExercise[];
  replace_index?: number | null;
  weekly_context?: WeeklyDayContext[];
  day_of_week?: number | null;
  athlete_context?: AthleteContext | null;
}

export interface ExerciseSuggestResponse {
  coach_note: string;
  exercise: TemplateExercise;
}

// ---------------------------------------------------------------
// Wearable senkron (POST /sync/health)
// ---------------------------------------------------------------
export interface HealthCardioSample {
  external_id: string;
  cardio_type: CardioType;
  start_time: string;
  distance_km: number;
  duration_minutes: number;
  avg_hr?: number | null;
  source: CardioSource;
  perceived_effort?: number | null;
}

export interface HealthSyncRequest {
  samples: HealthCardioSample[];
}

export interface HealthSyncResponse {
  imported: number;
  skipped_duplicates: number;
  workout_log_ids: string[];
}
