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

ANALYSIS_ENDPOINT = "/api/v1/analysis/weekly"
PLAN_GENERATE_ENDPOINT = "/api/v1/plan/generate"
PLAN_GENERATE_DAY_ENDPOINT = "/api/v1/plan/generate-day"
PLAN_MODIFY_ENDPOINT = "/api/v1/plan/modify-workout"

# Tum plan AI uretimleri ortak kota havuzunu paylasir.
PLAN_AI_ENDPOINTS = (
    PLAN_GENERATE_ENDPOINT,
    PLAN_GENERATE_DAY_ENDPOINT,
    PLAN_MODIFY_ENDPOINT,
)

# Tier -> (limit, SQL pencere kosulu)
_TIER_WINDOWS: dict[str, tuple[int, str]] = {
    "premium": (PREMIUM_WEEKLY_LIMIT, "requested_at >= now() - interval '7 days'"),
    "pro": (PRO_DAILY_LIMIT, "requested_at >= date_trunc('day', now())"),
}

# Onboarding plan uretimi: her tier kullanabilir ama limitler farklidir.
# free: 1 (omur boyu — onboarding tek seferlik deneyim), premium: 3/hafta, pro: 5/gun.
_PLAN_TIER_WINDOWS: dict[str, tuple[int, str | None, str]] = {
    "free": (1, None, "toplam"),
    "premium": (3, "requested_at >= now() - interval '7 days'", "haftalik"),
    "pro": (5, "requested_at >= date_trunc('day', now())", "gunluk"),
}


async def _count_usage(
    db: AsyncSession, user_id: str, endpoint: str, window_condition: str | None
) -> int:
    """Belirli ucun (pencere icindeki) kullanim sayisi."""
    window_sql = f" AND {window_condition}" if window_condition else ""
    result = await db.execute(
        text(
            "SELECT count(*) FROM ai_usage_logs "
            f"WHERE user_id = :user_id AND endpoint_called = :endpoint{window_sql}"
        ),
        {"user_id": user_id, "endpoint": endpoint},
    )
    return result.scalar_one()


async def _count_plan_ai_usage(
    db: AsyncSession, user_id: str, window_condition: str | None
) -> int:
    """Plan AI uclarinin (generate / generate-day / modify) toplam kullanimi."""
    window_sql = f" AND {window_condition}" if window_condition else ""
    placeholders = ", ".join(f":ep{i}" for i in range(len(PLAN_AI_ENDPOINTS)))
    params = {f"ep{i}": ep for i, ep in enumerate(PLAN_AI_ENDPOINTS)}
    params["user_id"] = user_id
    result = await db.execute(
        text(
            "SELECT count(*) FROM ai_usage_logs "
            f"WHERE user_id = :user_id AND endpoint_called IN ({placeholders}){window_sql}"
        ),
        params,
    )
    return result.scalar_one()


async def enforce_ai_rate_limit(
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> UserProfile:
    """FastAPI dependency: JWT'den cozulen tier ile AI analiz limiti kontrolu.

    Kontrolden gecen istegin dogrulanmis kullanici profilini doner.
    Sayim ucun kendi kayitlariyla sinirlidir; plan uretimi kotayi etkilemez.
    """
    if current_user.tier == "free":
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI analiz ozellikleri Free pakette yoktur. Premium veya Pro'ya yukseltin.",
        )

    limit, window_condition = _TIER_WINDOWS[current_user.tier]
    used = await _count_usage(
        db, current_user.user_id, ANALYSIS_ENDPOINT, window_condition
    )

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


async def enforce_plan_generation_limit(
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> UserProfile:
    """FastAPI dependency: AI plan uretimi (onboarding) tier limiti.

    Free kullanici da 1 kez deneyebilir (onboarding tum kullanicilarin ilk
    deneyimi); sonraki uretimler Premium/Pro gerektirir.
    """
    limit, window_condition, period = _PLAN_TIER_WINDOWS[current_user.tier]
    used = await _count_plan_ai_usage(db, current_user.user_id, window_condition)

    if used >= limit:
        if current_user.tier == "free":
            detail = (
                "Ucretsiz plan olusturma hakkini kullandin. Yeni planlar icin "
                "Premium veya Pro'ya yukselt."
            )
        else:
            detail = (
                f"{current_user.tier.capitalize()} paketin {period} plan olusturma "
                f"limiti ({limit}) doldu. Limit, pencere sonunda sifirlanir."
            )
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail=detail)

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
