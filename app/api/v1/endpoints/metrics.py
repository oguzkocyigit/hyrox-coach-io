"""Deterministik metrik endpoint'leri (/api/v1/metrics/*).

Mobil dashboard'u besler; kural motoru (Bolum 4) sonuclarini AI maliyeti
OLMADAN doner. Kimlik dogrulamasi Supabase JWT (Bearer) ile yapilir.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import get_current_user
from app.schemas.analysis import WeeklyMetricsResponse
from app.schemas.user import UserProfile
from app.services.analytics import build_weekly_metrics

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get(
    "/weekly",
    response_model=WeeklyMetricsResponse,
    summary="Haftalik deterministik metrik paketi (dashboard)",
)
async def weekly_metrics(
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> WeeklyMetricsResponse:
    """Son 7 gunun kural motoru ciktisini doner:

    - Gun gun CNS yorgunluk trendi (Zone 2 duzeltmesi dahil)
    - Kas grubu hacim ozetleri (set sayisi x kas katsayisi)
    - Kardiyo ozeti ve toplam kosu mesafesi
    - Tavan asimi varsa warning_flag + overtraining_risk listesi
    """
    metrics = await build_weekly_metrics(db, current_user.user_id)

    result = await db.execute(
        text(
            "SELECT count(*) FROM workout_logs "
            "WHERE user_id = :user_id AND date >= now() - interval '7 days'"
        ),
        {"user_id": current_user.user_id},
    )
    total_workouts: int = result.scalar_one()

    total_run_km = sum(
        item.total_distance_km
        for item in metrics.cardio_summary
        if item.cardio_type == "running"
    )

    return WeeklyMetricsResponse(
        **metrics.model_dump(),
        total_run_distance_km=round(total_run_km, 2),
        total_workouts=total_workouts,
    )
