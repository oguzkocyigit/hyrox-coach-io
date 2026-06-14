"""Kapali dongu: coaching context ve sunday review kaliciligi."""

from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.ai_coach import SundayReviewPayload, SundayReviewResponse
from app.services.coaching_context import build_plan_coaching_context
from app.services.sunday_reviews import (
    fetch_latest_sunday_review,
    has_sunday_review_this_week,
    save_sunday_review,
)
from tests.conftest import create_profile, new_user_id


@pytest.mark.asyncio
async def test_build_plan_coaching_context_empty_user(db_session: AsyncSession):
    user_id = new_user_id()
    await create_profile(db_session, user_id)

    with (
        patch(
            "app.services.coaching_context.fetch_weekly_workout_logs",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch(
            "app.services.coaching_context.build_weekly_metrics",
            new_callable=AsyncMock,
        ) as mock_metrics,
        patch(
            "app.services.coaching_context.fetch_weekly_plan_compliance",
            new_callable=AsyncMock,
            return_value={"completed": 0, "scheduled": 0},
        ),
        patch(
            "app.services.coaching_context.fetch_latest_sunday_review",
            new_callable=AsyncMock,
            return_value=None,
        ),
    ):
        from app.schemas.analysis import WeeklyMetrics

        mock_metrics.return_value = WeeklyMetrics(
            weekly_muscle_loads={},
            warning_flag=False,
            overtraining_risk=[],
        )
        ctx = await build_plan_coaching_context(db_session, user_id)

    assert ctx["journal_notes_last_7_days"] == []
    assert ctx["latest_sunday_review"] is None
    assert ctx["plan_compliance"] == {"completed": 0, "scheduled": 0}


@pytest.mark.asyncio
async def test_sunday_review_persistence_roundtrip(db_session: AsyncSession):
    user_id = new_user_id()
    await create_profile(db_session, user_id, tier="premium")

    payload = SundayReviewPayload(
        missed_workouts_reason="Is yogunlugu",
        nutrition_adherence=7,
        recovery_feeling="orta",
    )
    response = SundayReviewResponse(
        review_summary="Hafta dengeli gecti.",
        next_week_adjustments="Hacmi %10 azalt.",
        readiness_score=6,
    )

    await save_sunday_review(db_session, user_id, payload, response)
    await db_session.commit()

    latest = await fetch_latest_sunday_review(db_session, user_id)
    assert latest is not None
    assert latest["review_summary"] == "Hafta dengeli gecti."
    assert latest["missed_workouts_reason"] == "Is yogunlugu"
    assert latest["readiness_score"] == 6

    assert await has_sunday_review_this_week(db_session, user_id) is True
