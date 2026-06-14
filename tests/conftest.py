"""Pytest fixture'lari ve test yardimcilari.

Strateji:
- Auth: testler HS256 ile imzalanan sahte token'lar kullanir; SUPABASE_JWT_SECRET
  ortam degiskeni app modulleri import edilmeden ONCE test secret'i ile ezilir
  (security.py'daki HS256 legacy yolu devreye girer, JWKS/network'e gerek kalmaz).
- DB: entegrasyon testleri .env'deki canli Supabase dev veritabanina karsi calisir.
  Tum test kullanicilari 'pytest-' on ekiyle olusturulur ve oturum sonunda
  CASCADE ile temizlenir.
- Gemini: AI cagrilari testlerde daima mock'lanir (sifir token maliyeti).
"""

import os
import time
import uuid as uuidlib

# app modulleri import edilmeden once ayarlanmali (pydantic-settings'te
# ortam degiskeni .env dosyasini ezer).
TEST_JWT_SECRET = "pytest-jwt-secret-0123456789abcdef0123456789abcdef"
os.environ["SUPABASE_JWT_SECRET"] = TEST_JWT_SECRET

# CI birim test job'u: DB fixture'lari devre disi (localhost Postgres yok).
PYTEST_UNIT_ONLY = os.environ.get("PYTEST_UNIT_ONLY") == "1"

import asyncio  # noqa: E402
import httpx  # noqa: E402
import jwt  # noqa: E402
import pytest  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402


# ---------------------------------------------------------------
# Yardimcilar
# ---------------------------------------------------------------
def new_user_id() -> str:
    """Oturum sonunda otomatik temizlenen benzersiz test kullanici id'si."""
    return f"pytest-{uuidlib.uuid4().hex[:12]}"


def make_token(
    user_id: str,
    email: str | None = None,
    *,
    secret: str = TEST_JWT_SECRET,
    exp_offset: int = 3600,
    audience: str = "authenticated",
) -> str:
    claims: dict = {
        "sub": user_id,
        "aud": audience,
        "exp": int(time.time()) + exp_offset,
        "role": "authenticated",
    }
    if email is not None:
        claims["email"] = email
    return jwt.encode(claims, secret, algorithm="HS256")


def auth_headers(user_id: str, email: str | None = None, **kwargs) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(user_id, email, **kwargs)}"}


async def create_profile(
    db: AsyncSession, user_id: str, tier: str = "free", email: str | None = None
) -> None:
    """Testin ihtiyac duydugu tier ile profil olusturur (varsa tier'i gunceller)."""
    await db.execute(
        text(
            """
            INSERT INTO user_profiles (user_id, email, tier)
            VALUES (:u, :e, :t)
            ON CONFLICT (user_id) DO UPDATE SET tier = EXCLUDED.tier
            """
        ),
        {"u": user_id, "e": email or f"{user_id}@pytest.local", "t": tier},
    )
    await db.commit()


# ---------------------------------------------------------------
# Fixture'lar
# ---------------------------------------------------------------
@pytest.fixture()
async def client():
    """Uygulamaya in-process ASGI istemcisi."""
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test", timeout=30
    ) as c:
        yield c


@pytest.fixture()
async def db_session():
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.rollback()


@pytest.fixture(autouse=True)
async def _dispose_engine_after_test():
    """Her testten sonra connection pool'u bosaltir.

    pytest-asyncio her teste yeni bir event loop verir; asyncpg baglantilari
    olusturulduklari loop'a bagli oldugundan, pool boşaltilmazsa sonraki test
    'attached to a different loop' hatasi alir.
    """
    yield
    if PYTEST_UNIT_ONLY:
        return
    from app.core.database import engine

    await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def _cleanup_test_data():
    """Oturum sonunda tum pytest kullanicilarini (CASCADE ile) temizler."""
    yield
    if PYTEST_UNIT_ONLY:
        return

    async def _clean() -> None:
        from app.core.database import AsyncSessionLocal, engine

        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM user_profiles WHERE user_id LIKE 'pytest-%'")
            )
            await session.commit()
        await engine.dispose()

    asyncio.run(_clean())
