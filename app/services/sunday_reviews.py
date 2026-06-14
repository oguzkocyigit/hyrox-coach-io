"""Pazar degerlendirme kayitlari: kalicilik ve sorgulama."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.ai_coach import SundayReviewPayload, SundayReviewResponse


async def save_sunday_review(
    db: AsyncSession,
    user_id: str,
    payload: SundayReviewPayload,
    response: SundayReviewResponse,
) -> UUID:
    """Basarili AI degerlendirmesini sunday_reviews tablosuna yazar."""
    result = await db.execute(
        text(
            """
            INSERT INTO sunday_reviews
                (user_id, missed_workouts_reason, nutrition_adherence,
                 recovery_feeling, review_summary, next_week_adjustments,
                 readiness_score)
            VALUES
                (:user_id, :missed_reason, :nutrition, :recovery,
                 :summary, :adjustments, :readiness)
            RETURNING review_id
            """
        ),
        {
            "user_id": user_id,
            "missed_reason": payload.missed_workouts_reason,
            "nutrition": payload.nutrition_adherence,
            "recovery": payload.recovery_feeling,
            "summary": response.review_summary,
            "adjustments": response.next_week_adjustments,
            "readiness": response.readiness_score,
        },
    )
    return result.scalar_one()


async def fetch_latest_sunday_review(
    db: AsyncSession, user_id: str
) -> dict[str, object] | None:
    """Kullanicinin en son pazar degerlendirmesi (plan RAG baglami icin)."""
    result = await db.execute(
        text(
            """
            SELECT review_id, missed_workouts_reason, nutrition_adherence,
                   recovery_feeling, review_summary, next_week_adjustments,
                   readiness_score, created_at
            FROM sunday_reviews
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            LIMIT 1
            """
        ),
        {"user_id": user_id},
    )
    row = result.first()
    if row is None:
        return None
    return {
        "review_id": str(row.review_id),
        "missed_workouts_reason": row.missed_workouts_reason,
        "nutrition_adherence": row.nutrition_adherence,
        "recovery_feeling": row.recovery_feeling,
        "review_summary": row.review_summary,
        "next_week_adjustments": row.next_week_adjustments,
        "readiness_score": row.readiness_score,
        "created_at": row.created_at.isoformat(),
    }


async def has_sunday_review_this_week(db: AsyncSession, user_id: str) -> bool:
    """Bu hafta (Pzt 00:00'dan itibaren) degerlendirme yapildi mi."""
    result = await db.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1 FROM sunday_reviews
                WHERE user_id = :user_id
                  AND created_at >= date_trunc('week', now())
            )
            """
        ),
        {"user_id": user_id},
    )
    return bool(result.scalar_one())


async def fetch_sunday_review_history(
    db: AsyncSession, user_id: str, limit: int = 10
) -> list[dict[str, object]]:
    """Son N pazar degerlendirmesi (mobil gecmis)."""
    result = await db.execute(
        text(
            """
            SELECT review_id, missed_workouts_reason, nutrition_adherence,
                   recovery_feeling, review_summary, next_week_adjustments,
                   readiness_score, created_at
            FROM sunday_reviews
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            LIMIT :limit
            """
        ),
        {"user_id": user_id, "limit": limit},
    )
    return [
        {
            "review_id": str(row.review_id),
            "missed_workouts_reason": row.missed_workouts_reason,
            "nutrition_adherence": row.nutrition_adherence,
            "recovery_feeling": row.recovery_feeling,
            "review_summary": row.review_summary,
            "next_week_adjustments": row.next_week_adjustments,
            "readiness_score": row.readiness_score,
            "created_at": row.created_at.isoformat(),
        }
        for row in result
    ]
