"""Async database engine, session factory and FastAPI dependency.

Supabase notlari:
- Session Pooler (port 5432) ile standart kullanim onerilir.
- Transaction Pooler (PgBouncer, port 6543) kullaniliyorsa asyncpg'nin
  prepared statement cache'i kapatilmalidir; aksi halde
  "prepared statement does not exist" hatalari alinir.
"""

from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings


def _build_engine() -> AsyncEngine:
    settings = get_settings()

    connect_args: dict[str, Any] = {}
    if settings.db_use_transaction_pooler:
        # PgBouncer transaction mode prepared statement desteklemez.
        connect_args["statement_cache_size"] = 0
        connect_args["prepared_statement_cache_size"] = 0

    return create_async_engine(
        str(settings.database_url),
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_timeout=settings.db_pool_timeout_seconds,
        pool_pre_ping=True,
        connect_args=connect_args,
        echo=settings.app_env == "development",
    )


engine: AsyncEngine = _build_engine()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: route basina bir async session.

    Hata durumunda transaction guvenli sekilde rollback edilir.

    Kullanim:
        @router.get("/...")
        async def handler(db: AsyncSession = Depends(get_db_session)): ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
