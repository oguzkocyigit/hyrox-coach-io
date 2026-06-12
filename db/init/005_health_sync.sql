-- ============================================================
-- 005: Wearable Health Sync (HealthKit / Health Connect)
-- Ayni antrenmanin tekrar import edilmesini engellemek icin
-- harici kayit kimligi (HealthKit UUID / Health Connect record id)
-- workout_logs'a eklenir. Idempotent.
-- ============================================================

ALTER TABLE workout_logs
    ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) NULL;

-- Dedup: ayni kullanici icin ayni harici kayit yalnizca bir kez yazilabilir.
-- Partial index: manuel kayitlarda (external_id NULL) kisitlama yoktur.
CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_logs_user_external
    ON workout_logs (user_id, external_id)
    WHERE external_id IS NOT NULL;
