"""Kural motoru birim testleri (DB'siz, saf matematik).

Bolum 4.B formulu ve Zone 2 kardiyo duzeltmesinin sinir degerleri.
"""

from types import SimpleNamespace

import pytest

from app.schemas.workout import CardioLog, WorkoutCreate
from app.services.analytics import (
    UnknownExerciseError,
    ZONE2_HR_THRESHOLD,
    _effective_cardio_factor,
    calculate_daily_cns_score,
)


def _run(avg_hr: int | None) -> CardioLog:
    return CardioLog(
        cardio_type="running", distance_km=8.0, duration_minutes=45.0, avg_hr=avg_hr
    )


class TestZone2CardioModifier:
    """Kritik Kural: running + avg_hr < 145 => katsayi 0.5'e duser."""

    def test_zone2_run_reduced_to_half(self):
        assert _effective_cardio_factor(_run(138)) == 0.5

    def test_boundary_one_below_threshold_is_zone2(self):
        assert _effective_cardio_factor(_run(ZONE2_HR_THRESHOLD - 1)) == 0.5

    def test_boundary_exactly_threshold_is_not_zone2(self):
        # Kural kesin '<' oldugu icin 145 nabiz Zone 2 sayilmaz.
        assert _effective_cardio_factor(_run(ZONE2_HR_THRESHOLD)) == 1.0

    def test_high_hr_run_full_factor(self):
        assert _effective_cardio_factor(_run(172)) == 1.0

    def test_run_without_wearable_hr_full_factor(self):
        assert _effective_cardio_factor(_run(None)) == 1.0

    def test_low_hr_rowing_not_reduced(self):
        rowing = CardioLog(
            cardio_type="rowing", distance_km=2.0, duration_minutes=9.0, avg_hr=120
        )
        # Duzeltme yalnizca kosu icindir; erg'ler taban katsayisinda kalir.
        assert _effective_cardio_factor(rowing) == 0.8


class _FakeResult:
    def __init__(self, rows: list):
        self._rows = rows

    def __iter__(self):
        return iter(self._rows)


class _FakeDB:
    """exercises tablosunu taklit eden minimal async stub."""

    def __init__(self, factors: dict[str, float]):
        self._factors = factors

    async def execute(self, *_args, **_kwargs):
        return _FakeResult(
            [
                SimpleNamespace(exercise_id=eid, cns_load_factor=f)
                for eid, f in self._factors.items()
            ]
        )


def _workout(**overrides) -> WorkoutCreate:
    base: dict = {
        "workout_type": "Test",
        "user_reported_rpe": 8.0,
        "duration_minutes": 60,
        "exercises": [
            {
                "exercise_id": "back_squat",
                "sets": [{"weight_kg": 120, "reps": 6, "rpe": 8.0}] * 4,
            }
        ],
    }
    base.update(overrides)
    return WorkoutCreate(**base)


class TestDailyCnsScore:
    """Gunluk CNS = SUM(set x cns_load_factor) x (RPE / 10)"""

    async def test_strength_only(self):
        db = _FakeDB({"back_squat": 1.4})
        # 4 set x 1.4 = 5.6 -> x 0.8 = 4.48
        assert await calculate_daily_cns_score(db, _workout()) == pytest.approx(4.48)

    async def test_strength_plus_zone2_run(self):
        db = _FakeDB({"back_squat": 1.4})
        workout = _workout(
            cardio={
                "cardio_type": "running",
                "distance_km": 8.0,
                "duration_minutes": 45,
                "avg_hr": 140,
            }
        )
        # (5.6 + 0.5) x 0.8 = 4.88
        assert await calculate_daily_cns_score(db, workout) == pytest.approx(4.88)

    async def test_strength_plus_hard_run(self):
        db = _FakeDB({"back_squat": 1.4})
        workout = _workout(
            cardio={
                "cardio_type": "running",
                "distance_km": 5.0,
                "duration_minutes": 22,
                "avg_hr": 168,
            }
        )
        # (5.6 + 1.0) x 0.8 = 5.28
        assert await calculate_daily_cns_score(db, workout) == pytest.approx(5.28)

    async def test_cardio_only(self):
        db = _FakeDB({})
        workout = WorkoutCreate(
            workout_type="Row",
            user_reported_rpe=6.0,
            duration_minutes=30,
            cardio={"cardio_type": "rowing", "distance_km": 5.0, "duration_minutes": 25},
        )
        # 0.8 x 0.6 = 0.48
        assert await calculate_daily_cns_score(db, workout) == pytest.approx(0.48)

    async def test_unknown_exercise_raises(self):
        db = _FakeDB({})  # katalog bos -> back_squat bulunamaz
        with pytest.raises(UnknownExerciseError) as exc_info:
            await calculate_daily_cns_score(db, _workout())
        assert "back_squat" in str(exc_info.value)
