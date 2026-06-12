"""POST /plan/generate-day ve /plan/modify-workout testleri."""

from app.schemas.onboarding import GeneratedDayWorkout, ModifiedWorkoutResponse
from app.schemas.plans import TemplateExercise, WorkoutTemplateCreate
from tests.conftest import auth_headers, create_profile, new_user_id

_GENERATE_DAY_URL = "/api/v1/plan/generate-day"
_MODIFY_URL = "/api/v1/plan/modify-workout"


def _mock_day_plan() -> GeneratedDayWorkout:
    return GeneratedDayWorkout(
        focus="Alt vucut kuvvet.",
        template=WorkoutTemplateCreate(
            name="Gunluk Kuvvet",
            workout_type="strength",
            format="standard",
            rounds=1,
            exercises=[
                TemplateExercise(
                    name="Back Squat",
                    exercise_id="back_squat",
                    measurement="reps",
                    sets=5,
                    reps=5,
                    rpe=8.0,
                )
            ],
        ),
    )


def _mock_modified() -> ModifiedWorkoutResponse:
    return ModifiedWorkoutResponse(
        focus="Daha hafif varyant.",
        coach_note="Omuz agrisi icin hacim azaltildi.",
        template=WorkoutTemplateCreate(
            name="Gunluk Kuvvet (Revize)",
            workout_type="strength",
            format="standard",
            rounds=1,
            exercises=[
                TemplateExercise(
                    name="Goblet Squat",
                    measurement="reps",
                    sets=4,
                    reps=8,
                    rpe=6.0,
                )
            ],
        ),
    )


class TestPlanDayAI:
    async def test_generate_day_returns_workout(self, client, db_session, monkeypatch):
        async def _fake(_payload, _catalog):
            return _mock_day_plan()

        monkeypatch.setattr(
            "app.api.v1.endpoints.plans.generate_day_workout", _fake
        )
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="premium")

        r = await client.post(
            _GENERATE_DAY_URL,
            json={
                "day_of_week": 0,
                "session_kind": "gym",
                "duration_minutes": 75,
            },
            headers=auth_headers(user_id),
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["focus"] == "Alt vucut kuvvet."
        assert body["template"]["name"] == "Gunluk Kuvvet"

    async def test_modify_workout_returns_revision(self, client, db_session, monkeypatch):
        async def _fake(_payload, _catalog):
            return _mock_modified()

        monkeypatch.setattr(
            "app.api.v1.endpoints.plans.modify_workout_with_ai", _fake
        )
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="pro")

        r = await client.post(
            _MODIFY_URL,
            json={
                "change_reason": "Omuz agrisi var, squat hacmini azalt.",
                "target_duration_minutes": 60,
                "template": {
                    "name": "Gunluk Kuvvet",
                    "workout_type": "strength",
                    "format": "standard",
                    "rounds": 1,
                    "exercises": [
                        {
                            "name": "Back Squat",
                            "measurement": "reps",
                            "sets": 5,
                            "reps": 5,
                            "rest_seconds": 120,
                            "rpe": 8,
                        }
                    ],
                },
            },
            headers=auth_headers(user_id),
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "Omuz" in body["coach_note"]
        assert body["template"]["name"] == "Gunluk Kuvvet (Revize)"
