-- ============================================================
-- 007: Kisisel profil alanlari (ad, yas, cinsiyet, boy, kilo)
-- Profil ekrani icin; kural motoru bu alanlari KULLANMAZ.
-- Idempotent.
-- ============================================================

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS full_name  VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS age        INT NULL CHECK (age IS NULL OR (age >= 13 AND age <= 120)),
    -- male, female, other (istemci etiketleri yereldir)
    ADD COLUMN IF NOT EXISTS gender     VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS height_cm  INT NULL CHECK (height_cm IS NULL OR (height_cm >= 100 AND height_cm <= 250)),
    ADD COLUMN IF NOT EXISTS weight_kg  NUMERIC(5, 1) NULL CHECK (weight_kg IS NULL OR (weight_kg >= 30 AND weight_kg <= 300));
