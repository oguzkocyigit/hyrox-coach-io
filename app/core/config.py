"""Application settings loaded from environment variables / .env file."""

from functools import lru_cache

from pydantic import Field, PostgresDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Database (Supabase PostgreSQL) ---
    database_url: PostgresDsn = Field(
        ...,
        description="Async SQLAlchemy DSN: postgresql+asyncpg://user:pass@host:port/db",
    )
    db_use_transaction_pooler: bool = Field(
        default=False,
        description=(
            "Supabase Transaction Pooler (PgBouncer, port 6543) kullaniliyorsa True. "
            "asyncpg prepared statement cache devre disi birakilir."
        ),
    )
    db_pool_size: int = 10
    db_max_overflow: int = 5
    db_pool_timeout_seconds: int = 30

    # --- Supabase API (Auth / Storage) ---
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None
    supabase_jwt_secret: str | None = Field(
        default=None,
        description=(
            "Supabase Dashboard -> Project Settings -> API -> JWT Secret. "
            "Bearer token imza dogrulamasi (HS256) icin zorunludur."
        ),
    )

    # --- AI (Google AI Studio / Gemini) ---
    gemini_api_key: str | None = Field(
        default=None,
        description="Google AI Studio API anahtari. Bos ise AI uclari 503 doner.",
    )
    gemini_model: str = "gemini-2.5-flash-lite"

    # --- RevenueCat (abonelik webhook'u) ---
    revenuecat_webhook_secret: str | None = Field(
        default=None,
        description=(
            "RevenueCat Dashboard -> Integrations -> Webhooks'ta tanimlanan "
            "Authorization header degeri. Bos ise webhook ucu 503 doner."
        ),
    )

    # --- App ---
    app_env: str = "development"

    @field_validator("database_url")
    @classmethod
    def require_asyncpg_driver(cls, v: PostgresDsn) -> PostgresDsn:
        if v.scheme != "postgresql+asyncpg":
            raise ValueError(
                "DATABASE_URL 'postgresql+asyncpg://' semasi ile baslamalidir."
            )
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
