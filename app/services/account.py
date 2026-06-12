"""Hesap silme servisi (App Store / Play Store zorunlulugu).

Iki katmanda silme yapilir:
1. Uygulama veritabani: user_profiles satiri silinir; idmanlar, detaylar ve
   AI kullanim kayitlari FK CASCADE ile otomatik temizlenir.
2. Supabase Auth: admin API uzerinden auth kullanicisi silinir, boylece
   kullanici yeni token alamaz.

Sira onemlidir: DB silme islemi request transaction'i icinde yapilir ve
Supabase Auth cagrisi basarisiz olursa exception ile rollback edilir; yarim
silinmis hesap olusmaz.
"""

import logging

import httpx
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_AUTH_DELETE_TIMEOUT_SECONDS = 10.0


class AccountServiceNotConfiguredError(Exception):
    """SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tanimli degil."""


async def _delete_supabase_auth_user(user_id: str) -> None:
    """Supabase Auth'tan kullaniciyi admin API ile siler.

    404, kullanicinin auth tarafinda zaten olmadigi anlamina gelir (ornegin
    daha once silinmis ya da test kullanicisi); basari sayilir.
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise AccountServiceNotConfiguredError

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users/{user_id}"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
    }
    async with httpx.AsyncClient(timeout=_AUTH_DELETE_TIMEOUT_SECONDS) as client:
        response = await client.delete(url, headers=headers)

    if response.status_code in (200, 204, 404):
        return

    logger.error(
        "Supabase Auth kullanici silme basarisiz (user=%s, status=%s): %s",
        user_id,
        response.status_code,
        response.text,
    )
    raise HTTPException(
        status.HTTP_502_BAD_GATEWAY,
        detail="Hesap silinemedi; auth saglayicisina ulasilamadi. Tekrar deneyin.",
    )


async def delete_account(db: AsyncSession, user_id: str) -> None:
    """Kullanicinin tum verisini ve auth kaydini kalici olarak siler."""
    # Once DB (henuz commit edilmez): auth silme basarisiz olursa rollback olur.
    await db.execute(
        text("DELETE FROM user_profiles WHERE user_id = :user_id"),
        {"user_id": user_id},
    )
    await _delete_supabase_auth_user(user_id)
