-- ============================================================
-- 002: Core Schema
-- PROJE_BLUEPRINT.md / Bolum 3'e gore tablolar.
-- Idempotent: tekrar calistirilabilir.
-- ============================================================

-- SaaS uyelik seviyeleri
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_tier') THEN
        CREATE TYPE user_tier AS ENUM ('free', 'premium', 'pro');
    END IF;
END
$$;

-- ------------------------------------------------------------
-- Kullanici profilleri
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id     VARCHAR(255) PRIMARY KEY,
    email       VARCHAR(255) UNIQUE NOT NULL,
    tier        user_tier NOT NULL DEFAULT 'free',
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Egzersiz katalogu (deterministik CNS / hacim motoru girdileri)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exercises (
    exercise_id     VARCHAR(100) PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    category        VARCHAR(50)  NOT NULL
                    CHECK (category IN ('strength', 'running', 'hyrox', 'olympic', 'crossfit')),
    cns_load_factor FLOAT NOT NULL CHECK (cns_load_factor > 0),
    -- Yapi: {"quadriceps": 1.0, "glutes": 0.5}
    target_muscles  JSONB NOT NULL
);

-- ------------------------------------------------------------
-- Antrenman ana kaydi
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workout_logs (
    workout_log_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           VARCHAR(255) NOT NULL
                      REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    date              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 'Full Body', 'Zone 2 Run', 'Hyrox Sim' ...
    workout_type      VARCHAR(100) NOT NULL,
    -- RPE olcegi: 1.0 - 10.0 (CNS skoru hesabinda kullanilir)
    user_reported_rpe FLOAT NOT NULL
                      CHECK (user_reported_rpe >= 1.0 AND user_reported_rpe <= 10.0),
    duration_minutes  INT NOT NULL CHECK (duration_minutes > 0)
);

-- ------------------------------------------------------------
-- Antrenman icindeki kuvvet egzersizi detaylari
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workout_exercise_details (
    detail_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_log_id  UUID NOT NULL
                    REFERENCES workout_logs(workout_log_id) ON DELETE CASCADE,
    exercise_id     VARCHAR(100) NOT NULL
                    REFERENCES exercises(exercise_id),
    -- Yapi: [{"weight_kg": 120, "reps": 6, "rpe": 8.0}]
    sets            JSONB NOT NULL
                    CHECK (jsonb_typeof(sets) = 'array')
);

-- ------------------------------------------------------------
-- Antrenman icindeki kardiyo detaylari
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workout_cardio_details (
    cardio_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_log_id   UUID NOT NULL
                     REFERENCES workout_logs(workout_log_id) ON DELETE CASCADE,
    cardio_type      VARCHAR(50) NOT NULL,  -- 'running', 'rowing', 'ski_erg'
    distance_km      FLOAT NOT NULL CHECK (distance_km >= 0),
    duration_minutes FLOAT NOT NULL CHECK (duration_minutes > 0),
    -- Giyilebilir cihazdan gelen ortalama nabiz (Zone 2 cardio modifier icin)
    avg_hr           INT NULL CHECK (avg_hr IS NULL OR (avg_hr BETWEEN 30 AND 250)),
    source           VARCHAR(50) NOT NULL DEFAULT 'manual'
                     CHECK (source IN ('apple_health', 'google_health', 'manual'))
);

-- ------------------------------------------------------------
-- AI kullanim kayitlari (rate-limiting middleware sorgular)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    usage_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         VARCHAR(255) NOT NULL
                    REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    requested_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    endpoint_called VARCHAR(255) NOT NULL
);
