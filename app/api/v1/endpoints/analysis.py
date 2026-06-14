"""AI analiz endpoint'leri (/api/v1/analysis/*).

Kimlik dogrulamasi Supabase JWT (Bearer) ile yapilir; tum uclar Bolum 5'teki
tier bazli rate-limit dependency'si ile korunur.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import get_current_user
from app.schemas.ai_coach import (
    SundayReviewPayload,
    SundayReviewRecord,
    SundayReviewResponse,
    SundayReviewStatusResponse,
)
from app.schemas.analysis import WeeklyAnalysisResponse
from app.schemas.user import UserProfile
from app.services.ai_coach import (
    AIServiceNotConfiguredError,
    generate_sunday_review,
    generate_weekly_coach_note,
)
from app.services.analytics import build_weekly_metrics
from app.services.rate_limit import (
    enforce_ai_rate_limit,
    enforce_sunday_review_rate_limit,
    record_ai_usage,
)
from app.services.sunday_reviews import (
    fetch_latest_sunday_review,
    fetch_sunday_review_history,
    has_sunday_review_this_week,
    save_sunday_review,
)

router = APIRouter(prefix="/analysis", tags=["analysis"])


def _row_to_record(row: dict[str, object]) -> SundayReviewRecord:
    return SundayReviewRecord(
        review_id=str(row["review_id"]),
        missed_workouts_reason=str(row["missed_workouts_reason"]),
        nutrition_adherence=int(row["nutrition_adherence"]),  # type: ignore[arg-type]
        recovery_feeling=str(row["recovery_feeling"]),
        review_summary=str(row["review_summary"]),
        next_week_adjustments=str(row["next_week_adjustments"]),
        readiness_score=int(row["readiness_score"]),  # type: ignore[arg-type]
        created_at=str(row["created_at"]),
    )


@router.post(
    "/weekly",
    response_model=WeeklyAnalysisResponse,
    summary="Haftalik AI koc analizi (tier limitli)",
)
async def weekly_analysis(
    current_user: UserProfile = Depends(enforce_ai_rate_limit),
    db: AsyncSession = Depends(get_db_session),
) -> WeeklyAnalysisResponse:
    """Deterministik motorun haftalik metriklerini Gemini'ye yorumlatir."""
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


@router.post(
    "/sunday-review",
    response_model=SundayReviewRecord,
    summary="Pazar degerlendirme sihirbazi (tier limitli)",
)
async def sunday_review(
    payload: SundayReviewPayload,
    current_user: UserProfile = Depends(enforce_sunday_review_rate_limit),
    db: AsyncSession = Depends(get_db_session),
) -> SundayReviewRecord:
    """Haftalik loglar + oz-degerlendirme -> AI koc notu -> DB'ye kayit."""
    try:
        review = await generate_sunday_review(db, current_user.user_id, payload)
    except AIServiceNotConfiguredError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    await save_sunday_review(db, current_user.user_id, payload, review)
    await record_ai_usage(db, current_user.user_id, "/api/v1/analysis/sunday-review")

    saved = await fetch_latest_sunday_review(db, current_user.user_id)
    if saved is None:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Degerlendirme kaydedilemedi.",
        )
    return _row_to_record(saved)


@router.get(
    "/sunday-review/status",
    response_model=SundayReviewStatusResponse,
    summary="Bu haftaki pazar degerlendirme durumu",
)
async def sunday_review_status(
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> SundayReviewStatusResponse:
    """Mobil badge: bu hafta tamamlandi mi + son kayit."""
    completed = await has_sunday_review_this_week(db, current_user.user_id)
    latest_row = await fetch_latest_sunday_review(db, current_user.user_id)
    latest = _row_to_record(latest_row) if latest_row else None
    return SundayReviewStatusResponse(completed_this_week=completed, latest=latest)


@router.get(
    "/sunday-review/history",
    response_model=list[SundayReviewRecord],
    summary="Pazar degerlendirme gecmisi",
)
async def sunday_review_history(
    limit: int = Query(10, ge=1, le=30),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[SundayReviewRecord]:
    rows = await fetch_sunday_review_history(db, current_user.user_id, limit)
    return [_row_to_record(row) for row in rows]
