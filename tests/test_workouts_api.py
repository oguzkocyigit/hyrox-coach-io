"""POST /workouts, GET /workouts ve GET /metrics/weekly entegrasyon testleri.

Canli Supabase dev DB'sine karsi calisir; her test kendi izole pytest-
kullanicisini olusturur.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from tests.conftest import auth_headers, new_user_id

_ZONE2_WORKOUT = {
    "workout_type": "Hyrox Sim",
    "user_reported_rpe": 8.0,
    "duration_minutes": 75,
    "exercises": [
        {
            "exercise_id": "back_squat",
            "sets": [{"weight_kg": 120, "reps": 6, "rpe": 8.0}] * 4,
        }
    ],
    "cardio": {
        "cardio_type": "running",
        "distance_km": 8.0,
        "duration_minutes": 44.0,
        "avg_hr": 140,
        "source": "apple_health",
    },
}


class TestLogWorkout:
    async def test_full_workout_persisted_and_scored(self, client, db_session):
        user_id = new_user_id()
        r = await client.post(
            "/api/v1/workouts", json=_ZONE2_WORKOUT, headers=auth_headers(user_id)
        )
        assert r.status_code == 201
        body = r.json()

        # (4 set x 1.4 + zone2 kosu 0.5) x 0.8 = 4.88
        assert body["daily_cns_score"] == pytest.approx(4.88)
        assert body["warning_flag"] is False
        assert body["summary"]["total_strength_sets"] == 4
        assert body["summary"]["cardio_distance_km"] == 8.0

        # quadriceps yuku: 4 set x 1.0 katsayi = 4.0
        loads = {m["muscle"]: m["weekly_load"] for m in body["weekly_muscle_loads"]}
        assert loads["quadriceps"] == pytest.approx(4.0)

        n = (
            await db_session.execute(
                text("SELECT count(*) FROM workout_logs WHERE user_id = :u"),
                {"u": user_id},
            )
        ).scalar_one()
        assert n == 1

    async def test_unknown_exercise_rolls_back_everything(self, client, db_session):
        user_id = new_user_id()
        payload = {
            **_ZONE2_WORKOUT,
            "exercises": [
                {
                    "exercise_id": "nonexistent_exercise",
                    "sets": [{"weight_kg": 1, "reps": 1, "rpe": 5.0}],
                }
            ],
        }
        r = await client.post(
            "/api/v1/workouts", json=payload, headers=auth_headers(user_id)
        )
        assert r.status_code == 422
        assert "nonexistent_exercise" in r.json()["detail"]

        # Transaction butunlugu: ana kayit dahil hicbir sey yazilmamali
        n = (
            await db_session.execute(
                text("SELECT count(*) FROM workout_logs WHERE user_id = :u"),
                {"u": user_id},
            )
        ).scalar_one()
        assert n == 0

    async def test_overtraining_warning_when_ceiling_exceeded(self, client):
        user_id = new_user_id()
        # quadriceps: 12 x 1.0 (back_squat) + 12 x 1.0 (bulgarian) = 24 > 22
        payload = {
            "workout_type": "Leg Day (Overreaching)",
            "user_reported_rpe": 9.0,
            "duration_minutes": 90,
            "exercises": [
                {
                    "exercise_id": "back_squat",
                    "sets": [{"weight_kg": 130, "reps": 5, "rpe": 9.0}] * 12,
                },
                {
                    "exercise_id": "bulgarian_split_squat",
                    "sets": [{"weight_kg": 30, "reps": 10, "rpe": 8.5}] * 12,
                },
            ],
        }
        r = await client.post(
            "/api/v1/workouts", json=payload, headers=auth_headers(user_id)
        )
        assert r.status_code == 201
        body = r.json()
        assert body["warning_flag"] is True
        assert "quadriceps" in body["overtraining_risk"]


class TestWorkoutHistory:
    async def _seed_three_workouts(self, client, user_id: str) -> None:
        now = datetime.now(timezone.utc)
        for hours_ago, wtype in [(3, "Oldest"), (2, "Middle"), (1, "Newest")]:
            payload = {
                "workout_type": wtype,
                "user_reported_rpe": 6.0,
                "duration_minutes": 30,
                "date": (now - timedelta(hours=hours_ago)).isoformat(),
                "cardio": {
                    "cardio_type": "rowing",
                    "distance_km": 2.0,
                    "duration_minutes": 8.0,
                },
            }
            r = await client.post(
                "/api/v1/workouts", json=payload, headers=auth_headers(user_id)
            )
            assert r.status_code == 201

    async def test_pagination_and_ordering(self, client):
        user_id = new_user_id()
        await self._seed_three_workouts(client, user_id)
        headers = auth_headers(user_id)

        r = await client.get("/api/v1/workouts?limit=2&offset=0", headers=headers)
        assert r.status_code == 200
        body = r.json()
        assert body["total_count"] == 3
        assert [w["workout_type"] for w in body["items"]] == ["Newest", "Middle"]

        r = await client.get("/api/v1/workouts?limit=2&offset=2", headers=headers)
        body = r.json()
        assert [w["workout_type"] for w in body["items"]] == ["Oldest"]
        assert body["total_count"] == 3

    async def test_offset_beyond_total_keeps_count(self, client):
        user_id = new_user_id()
        await self._seed_three_workouts(client, user_id)

        r = await client.get(
            "/api/v1/workouts?limit=10&offset=99", headers=auth_headers(user_id)
        )
        body = r.json()
        assert body["items"] == []
        assert body["total_count"] == 3

    async def test_limit_above_max_rejected(self, client):
        r = await client.get(
            "/api/v1/workouts?limit=500", headers=auth_headers(new_user_id())
        )
        assert r.status_code == 422

    async def test_subdetails_included(self, client):
        user_id = new_user_id()
        r = await client.post(
            "/api/v1/workouts", json=_ZONE2_WORKOUT, headers=auth_headers(user_id)
        )
        assert r.status_code == 201

        r = await client.get("/api/v1/workouts", headers=auth_headers(user_id))
        item = r.json()["items"][0]
        assert item["exercises"][0]["exercise_id"] == "back_squat"
        assert item["exercises"][0]["exercise_name"]  # katalogdan join'lenir
        assert len(item["exercises"][0]["sets"]) == 4
        assert item["cardio"][0]["avg_hr"] == 140

    async def test_users_cannot_see_each_others_workouts(self, client):
        user_a, user_b = new_user_id(), new_user_id()
        r = await client.post(
            "/api/v1/workouts", json=_ZONE2_WORKOUT, headers=auth_headers(user_a)
        )
        assert r.status_code == 201

        r = await client.get("/api/v1/workouts", headers=auth_headers(user_b))
        assert r.json()["total_count"] == 0


class TestWeeklyMetrics:
    async def test_dashboard_package_shape(self, client):
        user_id = new_user_id()
        r = await client.post(
            "/api/v1/workouts", json=_ZONE2_WORKOUT, headers=auth_headers(user_id)
        )
        assert r.status_code == 201

        r = await client.get("/api/v1/metrics/weekly", headers=auth_headers(user_id))
        assert r.status_code == 200
        body = r.json()

        assert body["total_workouts"] == 1
        assert body["total_run_distance_km"] == pytest.approx(8.0)
        assert body["warning_flag"] is False
        assert body["weekly_muscle_loads"]["quadriceps"] == pytest.approx(4.0)
        # Gun bazli CNS trendi bugunu icermeli
        assert len(body["daily_cns_scores"]) == 1
        (score,) = body["daily_cns_scores"].values()
        assert score == pytest.approx(4.88)
        run_summary = next(
            c for c in body["cardio_summary"] if c["cardio_type"] == "running"
        )
        assert run_summary["avg_pace_min_per_km"] == pytest.approx(5.5)

    async def test_empty_user_gets_clean_zero_package(self, client):
        r = await client.get(
            "/api/v1/metrics/weekly", headers=auth_headers(new_user_id())
        )
        assert r.status_code == 200
        body = r.json()
        assert body["total_workouts"] == 0
        assert body["weekly_muscle_loads"] == {}
        assert body["warning_flag"] is False
        assert body["cardio_summary"] == []
