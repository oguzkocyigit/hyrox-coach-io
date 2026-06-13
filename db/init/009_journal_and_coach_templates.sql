-- ============================================================
-- 009: journal_notes + AI koç sistem şablonları
-- Idempotent: tekrar calistirilabilir.
--
-- Not: workout_templates (006) kullanici olusturdugu idman sablonlari
-- icin kullanilir (UUID PK + user_id). AI token maliyetini dusurmek
-- icin onceden tanimli sistem sablonlari coach_workout_templates
-- tablosunda tutulur (VARCHAR template_id PK).
-- ============================================================

-- Idman sonrasi kullanici gunlugu (user_reported_rpe yaninda)
ALTER TABLE workout_logs
    ADD COLUMN IF NOT EXISTS journal_notes TEXT NULL;

-- ------------------------------------------------------------
-- AI koç sistem sablonlari (onceden tanimli program bloklari)
-- exercises: [{"exercise_id": "...", "sets": N, "reps": N?, "distance_m": N?}]
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coach_workout_templates (
    template_id   VARCHAR(100) PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    description   TEXT NULL,
    category      VARCHAR(50) NOT NULL
                  CHECK (category IN ('strength', 'running', 'hyrox', 'olympic', 'crossfit')),
    exercises     JSONB NOT NULL DEFAULT '[]'::jsonb
                  CHECK (jsonb_typeof(exercises) = 'array')
);

-- ------------------------------------------------------------
-- Baslangic sistem sablonlari
-- ------------------------------------------------------------
INSERT INTO coach_workout_templates (template_id, name, description, category, exercises) VALUES
(
    'tmpl_structura_a',
    'Structura Hypertrophy A',
    'Alt govde agirlikli hipertrofi blogu: squat varyasyonu, itis ve cekis hareketleri.',
    'strength',
    '[
        {"exercise_id": "back_squat", "sets": 4, "reps": 8},
        {"exercise_id": "bench_press", "sets": 4, "reps": 8},
        {"exercise_id": "barbell_row", "sets": 4, "reps": 10},
        {"exercise_id": "romanian_deadlift", "sets": 3, "reps": 10},
        {"exercise_id": "overhead_press", "sets": 3, "reps": 10}
    ]'::jsonb
),
(
    'tmpl_ignis_hyrox',
    'Ignis Hyrox Engine',
    'HYROX istasyonlari ve race-pace kosu ile metabolik motor gelistirme blogu.',
    'hyrox',
    '[
        {"exercise_id": "run_hyrox_pace", "sets": 1, "distance_m": 1000},
        {"exercise_id": "rowing", "sets": 1, "distance_m": 1000},
        {"exercise_id": "sled_push", "sets": 4, "distance_m": 25},
        {"exercise_id": "wall_balls", "sets": 4, "reps": 20},
        {"exercise_id": "burpee_broad_jump", "sets": 3, "distance_m": 40},
        {"exercise_id": "farmers_carry", "sets": 3, "distance_m": 100}
    ]'::jsonb
),
(
    'tmpl_ferrum_oly',
    'Ferrum Olympic Block',
    'Olimpik kaldiris ve patlayici guc odakli CrossFit blogu.',
    'crossfit',
    '[
        {"exercise_id": "power_clean", "sets": 5, "reps": 3},
        {"exercise_id": "front_squat", "sets": 4, "reps": 5},
        {"exercise_id": "push_press", "sets": 4, "reps": 5},
        {"exercise_id": "snatch", "sets": 3, "reps": 2},
        {"exercise_id": "kettlebell_swing", "sets": 3, "reps": 15}
    ]'::jsonb
)
ON CONFLICT (template_id) DO UPDATE SET
    name        = EXCLUDED.name,
    description = EXCLUDED.description,
    category    = EXCLUDED.category,
    exercises   = EXCLUDED.exercises;
