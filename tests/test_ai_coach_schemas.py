"""Pazar degerlendirme sihirbazi sema testleri."""

import pytest
from pydantic import ValidationError

from app.schemas.ai_coach import SundayReviewPayload, SundayReviewResponse


class TestSundayReviewPayload:
    def test_valid_payload(self):
        p = SundayReviewPayload(
            missed_workouts_reason="Is yogunlugu nedeniyle 2 idman kacirdim.",
            nutrition_adherence=7,
            recovery_feeling="Genel olarak iyi toparlandim.",
        )
        assert p.nutrition_adherence == 7

    @pytest.mark.parametrize("score", [0, 11])
    def test_nutrition_adherence_bounds(self, score):
        with pytest.raises(ValidationError):
            SundayReviewPayload(
                missed_workouts_reason="Test",
                nutrition_adherence=score,
                recovery_feeling="Test",
            )


class TestSundayReviewResponse:
    def test_valid_response(self):
        r = SundayReviewResponse(
            review_summary="Hafta iyi gecti.",
            next_week_adjustments="- Hacmi %10 dusur",
            readiness_score=7,
        )
        assert r.readiness_score == 7

    def test_readiness_score_bounds(self):
        with pytest.raises(ValidationError):
            SundayReviewResponse(
                review_summary="x",
                next_week_adjustments="y",
                readiness_score=11,
            )
