-- ============================================================
-- 011: Idman basina harcanan kalori (manuel giris)
-- Idempotent: tekrar calistirilabilir.
-- ============================================================

-- Kullanicinin idmanda harcadigi enerji (kcal). Opsiyonel; manuel girilir,
-- bos birakilabilir. Kural motoru hesaplarini etkilemez (yalnizca kayit/goruntuleme).
ALTER TABLE workout_logs
    ADD COLUMN IF NOT EXISTS calories_burned INT NULL
        CHECK (calories_burned IS NULL OR calories_burned >= 0);
