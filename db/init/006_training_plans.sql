-- ============================================================
-- 006: Antrenman programi (idman sablonlari + haftalik plan)
-- RoxHype benzeri akis: kullanici idman sablonu kurar (Build Workout),
-- haftanin gunlerine atar, tamamladikca isaretler. Idempotent.
-- ============================================================

-- Idman sablonlari: egzersiz listesi JSONB olarak saklanir (sirali dizi).
-- Eleman yapisi Pydantic (TemplateExercise) ile dogrulanir:
-- {"name", "exercise_id"?, "measurement", "sets", "reps"?, "weight_kg"?,
--  "distance_m"?, "duration_seconds"?, "rest_seconds", "instructions"?}
CREATE TABLE IF NOT EXISTS workout_templates (
    template_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           VARCHAR(255) NOT NULL
                      REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    name              VARCHAR(120) NOT NULL,
    -- hybrid, running, strength, metcon, endurance, power, technique, recovery
    workout_type      VARCHAR(30) NOT NULL,
    -- standard, circuit, emom, amrap, for_time
    format            VARCHAR(20) NOT NULL DEFAULT 'standard',
    rounds            INT NOT NULL DEFAULT 1 CHECK (rounds >= 1),
    time_cap_minutes  INT NULL CHECK (time_cap_minutes IS NULL OR time_cap_minutes > 0),
    notes             TEXT NULL,
    exercises         JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_workout_templates_user
    ON workout_templates (user_id, created_at DESC);

-- Haftalik plan girisleri: bir sablonun bir gune atanmasi.
-- position: ayni gun birden fazla idman (AM/PM) siralamasi.
CREATE TABLE IF NOT EXISTS plan_entries (
    entry_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         VARCHAR(255) NOT NULL
                    REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    template_id     UUID NOT NULL
                    REFERENCES workout_templates(template_id) ON DELETE CASCADE,
    scheduled_date  DATE NOT NULL,
    position        INT NOT NULL DEFAULT 0 CHECK (position >= 0),
    completed_at    TIMESTAMP WITH TIME ZONE NULL,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_plan_entries_user_date
    ON plan_entries (user_id, scheduled_date);
