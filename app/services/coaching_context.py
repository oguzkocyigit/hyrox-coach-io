"""Haftalik plan uretimi icin kapali dongu koc baglami (deterministik + DB)."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.analytics import (
    build_weekly_metrics,
    fetch_weekly_plan_compliance,
    fetch_weekly_workout_logs,
)
from app.services.sunday_reviews import fetch_latest_sunday_review


async def build_plan_coaching_context(
    db: AsyncSession, user_id: str
) -> dict[str, object]:
    """Plan RAG prompt'una eklenecek haftalik koc sinyalleri.

    AI hesaplama yapmaz; yalnizca hazir veriyi yorumlar.
    """
    workout_logs = await fetch_weekly_workout_logs(db, user_id)
    journal_notes = [
        {
            "date": log["date"],
            "workout_type": log["workout_type"],
            "user_reported_rpe": log["user_reported_rpe"],
            "note": log["journal_notes"],
        }
        for log in workout_logs
        if log.get("journal_notes")
    ]

    metrics = await build_weekly_metrics(db, user_id)
    compliance = await fetch_weekly_plan_compliance(db, user_id)
    latest_review = await fetch_latest_sunday_review(db, user_id)

    return {
        "plan_compliance": compliance,
        "weekly_metrics": metrics.model_dump(),
        "journal_notes_last_7_days": journal_notes,
        "latest_sunday_review": latest_review,
    }
