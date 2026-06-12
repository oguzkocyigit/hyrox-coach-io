-- ============================================================
-- 001: PostgreSQL Extensions
-- Supabase'de "pgcrypto" (gen_random_uuid) ve "vector" (pgvector)
-- desteklenir. Script idempotent'tir.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Gelecekteki RAG (Retrieval-Augmented Generation) ozellikleri icin (PROJE_BLUEPRINT 2. bolum)
CREATE EXTENSION IF NOT EXISTS vector;
