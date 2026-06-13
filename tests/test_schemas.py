"""Pydantic giris modeli validasyon testleri."""

import pytest
from pydantic import ValidationError

from app.schemas.workout import CardioLog, WorkoutCreate, WorkoutSet

_VALID_SET = {"weight_kg": 100.0, "reps": 5, "rpe": 8.0}


class TestWorkoutSet:
    def test_valid_set(self):
        s = WorkoutSet(**_VALID_SET)
        assert s.rpe == 8.0

    @pytest.mark.parametrize("rpe", [0.5, 10.5, 0.0, 11.0])
    def test_rpe_out_of_bounds_rejected(self, rpe):
        with pytest.raises(ValidationError):
            WorkoutSet(**{**_VALID_SET, "rpe": rpe})

    @pytest.mark.parametrize("rpe", [1.0, 10.0])
    def test_rpe_boundaries_accepted(self, rpe):
        assert WorkoutSet(**{**_VALID_SET, "rpe": rpe}).rpe == rpe

    def test_rpe_optional(self):
        s = WorkoutSet(weight_kg=0, reps=10)
        assert s.rpe is None

    def test_zero_reps_rejected(self):
        with pytest.raises(ValidationError):
            WorkoutSet(**{**_VALID_SET, "reps": 0})

    def test_bodyweight_zero_kg_accepted(self):
        assert WorkoutSet(**{**_VALID_SET, "weight_kg": 0}).weight_kg == 0

    def test_legacy_set_without_measurement_defaults_to_reps(self):
        s = WorkoutSet(**_VALID_SET)
        assert s.measurement == "reps"

    def test_distance_set_valid(self):
        s = WorkoutSet(measurement="distance", weight_kg=125, distance_m=25, rpe=8.0)
        assert s.distance_m == 25
        assert s.reps is None

    def test_time_set_valid(self):
        s = WorkoutSet(measurement="time", duration_seconds=60, rpe=6.0)
        assert s.duration_seconds == 60
        assert s.weight_kg == 0

    @pytest.mark.parametrize(
        "payload",
        [
            {"measurement": "reps", "rpe": 8.0},  # reps eksik
            {"measurement": "distance", "rpe": 8.0},  # mesafe eksik
            {"measurement": "time", "rpe": 8.0},  # sure eksik
            {"measurement": "distance", "distance_m": 0, "rpe": 8.0},
            {"measurement": "time", "duration_seconds": 0, "rpe": 8.0},
        ],
    )
    def test_missing_measurement_value_rejected(self, payload):
        with pytest.raises(ValidationError):
            WorkoutSet(**payload)


class TestCardioLog:
    def test_avg_hr_optional(self):
        c = CardioLog(cardio_type="running", distance_km=5.0, duration_minutes=25.0)
        assert c.avg_hr is None
        assert c.source == "manual"

    @pytest.mark.parametrize("hr", [10, 300])
    def test_unrealistic_hr_rejected(self, hr):
        with pytest.raises(ValidationError):
            CardioLog(
                cardio_type="running", distance_km=5.0, duration_minutes=25.0, avg_hr=hr
            )

    def test_invalid_cardio_type_rejected(self):
        with pytest.raises(ValidationError):
            CardioLog(cardio_type="swimming", distance_km=1.0, duration_minutes=30.0)


class TestWorkoutCreate:
    _BASE = {"workout_type": "Test", "user_reported_rpe": 7.0, "duration_minutes": 45}

    def test_requires_at_least_one_block(self):
        with pytest.raises(ValidationError, match="En az bir"):
            WorkoutCreate(**self._BASE)

    def test_cardio_only_is_valid(self):
        w = WorkoutCreate(
            **self._BASE,
            cardio={"cardio_type": "ski_erg", "distance_km": 1.0, "duration_minutes": 4.0},
        )
        assert w.exercises is None

    def test_exercises_only_is_valid(self):
        w = WorkoutCreate(
            **self._BASE,
            exercises=[{"exercise_id": "deadlift", "sets": [_VALID_SET]}],
        )
        assert w.cardio is None

    def test_empty_sets_rejected(self):
        with pytest.raises(ValidationError):
            WorkoutCreate(
                **self._BASE, exercises=[{"exercise_id": "deadlift", "sets": []}]
            )

    def test_user_id_not_accepted_from_payload(self):
        # user_id JWT'den gelir; payload'da gonderilse bile modele sizmamali.
        w = WorkoutCreate(
            **self._BASE,
            user_id="hacker-id",
            exercises=[{"exercise_id": "deadlift", "sets": [_VALID_SET]}],
        )
        assert not hasattr(w, "user_id")
