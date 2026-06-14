-- ============================================================
-- 010: Pazar degerlendirme kaliciligi + genisletilmis sablon kutuphanesi
-- Idempotent.
-- ============================================================

-- ------------------------------------------------------------
-- Pazar degerlendirme kayitlari (AI ciktisi + kullanici girdisi)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sunday_reviews (
    review_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                VARCHAR(255) NOT NULL
                           REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    missed_workouts_reason TEXT NOT NULL,
    nutrition_adherence    INT NOT NULL
                           CHECK (nutrition_adherence >= 1 AND nutrition_adherence <= 10),
    recovery_feeling       TEXT NOT NULL,
    review_summary         TEXT NOT NULL,
    next_week_adjustments  TEXT NOT NULL,
    readiness_score        INT NOT NULL
                           CHECK (readiness_score >= 1 AND readiness_score <= 10),
    created_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_sunday_reviews_user_created
    ON sunday_reviews (user_id, created_at DESC);

-- ------------------------------------------------------------
-- Ek sistem sablonlari (RAG kutuphanesi)
-- ------------------------------------------------------------
INSERT INTO coach_workout_templates (template_id, name, description, category, exercises) VALUES
(
    'tmpl_zone2_run',
    'Aerobic Base — Zone 2',
    'Kolay aerobik temel: Zone 2 kosu + hafif motor aktivasyon.',
    'running',
    '[
        {"exercise_id": "run_easy", "sets": 1, "distance_m": 5000},
        {"exercise_id": "rowing", "sets": 1, "distance_m": 2000}
    ]'::jsonb
),
(
    'tmpl_upper_hypertrophy',
    'Structura Upper Hypertrophy',
    'Ust vucut hipertrofi: itis, cekis ve omuz odakli hacim blogu.',
    'strength',
    '[
        {"exercise_id": "bench_press", "sets": 4, "reps": 8},
        {"exercise_id": "overhead_press", "sets": 3, "reps": 10},
        {"exercise_id": "barbell_row", "sets": 4, "reps": 10},
        {"exercise_id": "pull_up", "sets": 3, "reps": 8},
        {"exercise_id": "hip_thrust", "sets": 3, "reps": 12}
    ]'::jsonb
),
(
    'tmpl_metcon_engine',
    'Ignis Metcon Engine',
    'Yuksek yogunluklu metabolik kondisyon: thruster, swing ve burpee kombinasyonu.',
    'crossfit',
    '[
        {"exercise_id": "thruster", "sets": 4, "reps": 12},
        {"exercise_id": "kettlebell_swing", "sets": 4, "reps": 20},
        {"exercise_id": "burpee", "sets": 3, "reps": 15},
        {"exercise_id": "box_jump", "sets": 3, "reps": 10}
    ]'::jsonb
)
ON CONFLICT (template_id) DO UPDATE SET
    name        = EXCLUDED.name,
    description = EXCLUDED.description,
    category    = EXCLUDED.category,
    exercises   = EXCLUDED.exercises;
