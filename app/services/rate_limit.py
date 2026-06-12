"""Revenue Integrity & Rate-Limiting (PROJE_BLUEPRINT.md / Bolum 5).

Tum /api/v1/analysis/* uclari `enforce_ai_rate_limit` dependency'si ile
korunur (.cursorrules: tier kontrolleri dependency katmaninda yapilir).

Kimlik ve tier bilgisi artik query parametresinden DEGIL, dogrulanmis
Supabase JWT'den (get_current_user) cozulur:

1. get_current_user token imzasini dogrular ve user_profiles.tier'i ceker.
2. Faturalandirma penceresi icindeki ai_usage_logs kayitlari sayilir.
3. Limit asildiysa HTTP 429 Too Many Requests firlatilir.

Limitler:
- free:    0 istek (AI ozellikleri kapali)
- premium: haftalik (son 7 gun) maksimum 1 istek
- pro:     gunluk (UTC takvim gunu) maksimum 5 istek
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import get_current_user
from app.schemas.user import UserProfile

PREMIUM_WEEKLY_LIMIT: int = 1
PRO_DAILY_LIMIT: int = 5

# Tier -> (limit, SQL pencere kosulu)
_TIER_WINDOWS: dict[str, tuple[int, str]] = {
    "premium": (PREMIUM_WEEKLY_LIMIT, "requested_at >= now() - interval '7 days'"),
    "pro": (PRO_DAILY_LIMIT, "requested_at >= date_trunc('day', now())"),
}


async def enforce_ai_rate_limit(
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> UserProfile:
    """FastAPI dependency: JWT'den cozulen tier ile AI kullanim limiti kontrolu.

    Kontrolden gecen istegin dogrulanmis kullanici profilini doner.
    """
    if current_user.tier == "free":
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI analiz ozellikleri Free pakette yoktur. Premium veya Pro'ya yukseltin.",
        )

    limit, window_condition = _TIER_WINDOWS[current_user.tier]
    result = await db.execute(
        text(
            "SELECT count(*) FROM ai_usage_logs "
            f"WHERE user_id = :user_id AND {window_condition}"
        ),
        {"user_id": current_user.user_id},
    )
    used = result.scalar_one()

    if used >= limit:
        period = "haftalik" if current_user.tier == "premium" else "gunluk"
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"{current_user.tier.capitalize()} paketin {period} AI istek limiti "
                f"({limit}) doldu. Limit, pencere sonunda sifirlanir."
            ),
        )

    return current_user


async def record_ai_usage(db: AsyncSession, user_id: str, endpoint: str) -> None:
    """Basarili AI cagrisi sonrasi kullanim kaydi atar (kota tuketimi)."""
    await db.execute(
        text(
            "INSERT INTO ai_usage_logs (user_id, endpoint_called) "
            "VALUES (:user_id, :endpoint)"
        ),
        {"user_id": user_id, "endpoint": endpoint},
    )
