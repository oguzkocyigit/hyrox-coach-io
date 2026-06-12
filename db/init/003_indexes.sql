-- ============================================================
-- 003: Indexes
-- Deterministik kural motoru (son 7 gun hacim/CNS sorgulari) ve
-- rate-limiting middleware sorgulari icin optimize edilmistir.
-- ============================================================

-- "Son 7 gunluk kumulatif kas yuku" ve "gunluk CNS skoru" sorgulari:
-- WHERE user_id = ? AND date >= now() - interval '7 days'
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date
    ON workout_logs (user_id, date DESC);

-- Workout detaylarina join erisimi
CREATE INDEX IF NOT EXISTS idx_workout_exercise_details_log
    ON workout_exercise_details (workout_log_id);

CREATE INDEX IF NOT EXISTS idx_workout_exercise_details_exercise
    ON workout_exercise_details (exercise_id);

CREATE INDEX IF NOT EXISTS idx_workout_cardio_details_log
    ON workout_cardio_details (workout_log_id);

-- Rate-limiting: faturalandirma donemi icindeki AI istek sayisi
-- WHERE user_id = ? AND requested_at >= ?
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_requested_at
    ON ai_usage_logs (user_id, requested_at DESC);

-- Kas grubu bazli hacim sorgulari icin JSONB GIN index
-- (orn. target_muscles ? 'quadriceps')
CREATE INDEX IF NOT EXISTS idx_exercises_target_muscles
    ON exercises USING GIN (target_muscles);
