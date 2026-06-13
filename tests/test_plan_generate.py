"""POST /plan/generate (AI Onboarding Wizard) testleri.

Gemini daima mock'lanir; testler API key'siz ve token maliyetsiz calisir.
"""

from sqlalchemy import text

from app.schemas.onboarding import GeneratedDay, GeneratedWeekPlan
from app.schemas.plans import TemplateExercise, WorkoutTemplateCreate
from tests.conftest import auth_headers, create_profile, new_user_id

_URL = "/api/v1/plan/generate"
_ANALYSIS_URL = "/api/v1/analysis/weekly"

_PAYLOAD = {
    "goal": "hybrid",
    "training_days": [0, 2, 4, 5],
    "days_per_week": 4,
    "wants_running": True,
    "running_days": [1, 3, 6],
    "split_run_and_gym": True,
    "gym_preferred_start": "17:00",
    "gym_preferred_end": "20:00",
    "run_preferred_start": "06:00",
    "run_preferred_end": "08:00",
    "gym_fed_state": "fed",
    "run_fed_state": "fasted",
    "gym_duration_minutes": 180,
    "run_duration_minutes": 120,
    "five_k_pace_seconds_per_km": 330,
    "zone2_habit": "sometimes",
    "sled_experience": "some",
    "olympic_proficiency": "learning",
    "weekend_conditioning": True,
    "nutrition_constraint": "none",
    "equipment": "full_box",
}


def _mock_plan() -> GeneratedWeekPlan:
    """Bir gecerli, bir uydurma exercise_id iceren sahte AI plani."""
    return GeneratedWeekPlan(
        coach_summary="Mock haftalik plan ozeti.",
        days=[
            GeneratedDay(
                day_of_week=0,
                focus="Alt vucut kuvvet odagi.",
                template=WorkoutTemplateCreate(
                    name="Gun 1 - Kuvvet",
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
                        ),
                        TemplateExercise(
                            name="Uydurma Hareket",
                            exercise_id="ex_does_not_exist",
                            measurement="reps",
                            sets=3,
                            reps=10,
                            rpe=7.0,
                        ),
                    ],
                ),
            )
        ],
    )


def _patch_gemini(monkeypatch):
    async def _fake(_payload, _catalog):
        return _mock_plan()

    monkeypatch.setattr(
        "app.api.v1.endpoints.plans.generate_onboarding_plan", _fake
    )


class TestPlanGenerate:
    async def test_generates_plan_and_nulls_unknown_exercise_ids(
        self, client, db_session, monkeypatch
    ):
        _patch_gemini(monkeypatch)
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="premium")

        r = await client.post(_URL, json=_PAYLOAD, headers=auth_headers(user_id))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["coach_summary"] == "Mock haftalik plan ozeti."

        exercises = body["days"][0]["template"]["exercises"]
        # Katalogda olan kimlik korunur, uydurma kimlik null'a cevrilir
        assert exercises[0]["exercise_id"] == "back_squat"
        assert exercises[1]["exercise_id"] is None
        assert exercises[1]["name"] == "Uydurma Hareket"

    async def test_free_tier_one_lifetime_generation(
        self, client, db_session, monkeypatch
    ):
        _patch_gemini(monkeypatch)
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="free")
        headers = auth_headers(user_id)

        first = await client.post(_URL, json=_PAYLOAD, headers=headers)
        assert first.status_code == 200

        second = await client.post(_URL, json=_PAYLOAD, headers=headers)
        assert second.status_code == 429
        assert "Premium" in second.json()["detail"]

    async def test_usage_recorded_with_plan_endpoint(
        self, client, db_session, monkeypatch
    ):
        _patch_gemini(monkeypatch)
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="pro")

        r = await client.post(_URL, json=_PAYLOAD, headers=auth_headers(user_id))
        assert r.status_code == 200

        endpoint = (
            await db_session.execute(
                text(
                    "SELECT endpoint_called FROM ai_usage_logs WHERE user_id = :u"
                ),
                {"u": user_id},
            )
        ).scalar_one()
        assert endpoint == _URL

    async def test_plan_quota_does_not_consume_analysis_quota(
        self, client, db_session, monkeypatch
    ):
        """Plan uretimi, /analysis/weekly kotasini ETKILEMEMELI (uc bazli sayim)."""
        from app.schemas.analysis import CoachAnalysis

        _patch_gemini(monkeypatch)

        async def _fake_note(_metrics):
            return CoachAnalysis(breach_detected=False, coaches_note="Mock not.")

        monkeypatch.setattr(
            "app.api.v1.endpoints.analysis.generate_weekly_coach_note", _fake_note
        )

        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="premium")
        headers = auth_headers(user_id)

        plan = await client.post(_URL, json=_PAYLOAD, headers=headers)
        assert plan.status_code == 200

        # Premium'un haftalik 1 analiz hakki plan uretiminden etkilenmez
        analysis = await client.post(_ANALYSIS_URL, headers=headers)
        assert analysis.status_code == 200

    async def test_invalid_payload_rejected(self, client, db_session):
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="pro")

        bad = {**_PAYLOAD, "days_per_week": 9}
        r = await client.post(_URL, json=bad, headers=auth_headers(user_id))
        assert r.status_code == 422
