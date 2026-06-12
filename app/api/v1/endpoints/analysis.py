"""AI analiz endpoint'leri (/api/v1/analysis/*).

Kimlik dogrulamasi Supabase JWT (Bearer) ile yapilir; tum uclar Bolum 5'teki
tier bazli rate-limit dependency'si ile korunur.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.schemas.analysis import WeeklyAnalysisResponse
from app.schemas.user import UserProfile
from app.services.ai_coach import (
    AIServiceNotConfiguredError,
    generate_weekly_coach_note,
)
from app.services.analytics import build_weekly_metrics
from app.services.rate_limit import enforce_ai_rate_limit, record_ai_usage

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post(
    "/weekly",
    response_model=WeeklyAnalysisResponse,
    summary="Haftalik AI koc analizi (tier limitli)",
)
async def weekly_analysis(
    current_user: UserProfile = Depends(enforce_ai_rate_limit),
    db: AsyncSession = Depends(get_db_session),
) -> WeeklyAnalysisResponse:
    """Deterministik motorun haftalik metriklerini Gemini'ye yorumlatir.

    Akis: JWT dogrulama + rate-limit (dependency) -> metrik hesabi
    (deterministik) -> Gemini cagrisi (structured JSON) -> kota tuketim kaydi.

    Kota kaydi yalnizca BASARILI AI cagrisindan sonra atilir; basarisiz
    cagrilar kullanicinin limitini tuketmez.
    """
    metrics = await build_weekly_metrics(db, current_user.user_id)

    try:
        analysis = await generate_weekly_coach_note(metrics)
    except AIServiceNotConfiguredError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    await record_ai_usage(db, current_user.user_id, "/api/v1/analysis/weekly")

    return WeeklyAnalysisResponse(
        user_id=current_user.user_id,
        tier=current_user.tier,
        metrics=metrics,
        analysis=analysis,
    )
