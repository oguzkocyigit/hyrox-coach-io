"""POST /sync/health, GET /users/me, GET /exercises, DELETE /workouts testleri."""

import uuid as uuidlib
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from app.schemas.sync import HealthCardioSample
from app.services.health_sync import derive_rpe
from tests.conftest import auth_headers, create_profile, new_user_id

_SYNC_URL = "/api/v1/sync/health"


def _sample(**overrides) -> dict:
    base = {
        "external_id": f"hk-{uuidlib.uuid4().hex}",
        "cardio_type": "running",
        "start_time": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
        "distance_km": 8.0,
        "duration_minutes": 45.0,
        "avg_hr": 140,
        "source": "apple_health",
    }
    base.update(overrides)
    return base


class TestRpeDerivation:
    """Wearable verisinde RPE yoksa nabizdan deterministik turetilir."""

    @pytest.mark.parametrize(
        ("avg_hr", "expected"),
        [(110, 3.0), (130, 4.0), (144, 4.0), (150, 6.0), (165, 8.0), (180, 9.0)],
    )
    def test_rpe_from_heart_rate(self, avg_hr, expected):
        sample = HealthCardioSample(**_sample(avg_hr=avg_hr))
        assert derive_rpe(sample) == expected

    def test_no_hr_falls_back_to_default(self):
        sample = HealthCardioSample(**_sample(avg_hr=None))
        assert derive_rpe(sample) == 5.0

    def test_explicit_effort_wins_over_hr(self):
        sample = HealthCardioSample(**_sample(avg_hr=180, perceived_effort=2.0))
        assert derive_rpe(sample) == 2.0


class TestHealthSync:
    async def test_batch_import_creates_workouts(self, client, db_session):
        user_id = new_user_id()
        payload = {"samples": [_sample(), _sample(cardio_type="rowing", distance_km=2.0)]}

        r = await client.post(_SYNC_URL, json=payload, headers=auth_headers(user_id))
        assert r.status_code == 200
        body = r.json()
        assert body["imported"] == 2
        assert body["skipped_duplicates"] == 0
        assert len(body["workout_log_ids"]) == 2

        types = (
            await db_session.execute(
                text(
                    "SELECT workout_type FROM workout_logs "
                    "WHERE user_id = :u ORDER BY workout_type"
                ),
                {"u": user_id},
            )
        ).scalars().all()
        assert types == ["Synced Row", "Synced Run"]

    async def test_resync_is_idempotent(self, client):
        user_id = new_user_id()
        payload = {"samples": [_sample(), _sample()]}
        headers = auth_headers(user_id)

        first = await client.post(_SYNC_URL, json=payload, headers=headers)
        assert first.json()["imported"] == 2

        second = await client.post(_SYNC_URL, json=payload, headers=headers)
        body = second.json()
        assert body["imported"] == 0
        assert body["skipped_duplicates"] == 2

    async def test_partial_duplicate_batch(self, client):
        user_id = new_user_id()
        headers = auth_headers(user_id)
        existing = _sample()

        await client.post(_SYNC_URL, json={"samples": [existing]}, headers=headers)
        r = await client.post(
            _SYNC_URL, json={"samples": [existing, _sample()]}, headers=headers
        )
        body = r.json()
        assert body["imported"] == 1
        assert body["skipped_duplicates"] == 1

    async def test_same_external_id_different_users_both_import(self, client):
        shared = _sample()
        r1 = await client.post(
            _SYNC_URL, json={"samples": [shared]}, headers=auth_headers(new_user_id())
        )
        r2 = await client.post(
            _SYNC_URL, json={"samples": [shared]}, headers=auth_headers(new_user_id())
        )
        assert r1.json()["imported"] == 1
        assert r2.json()["imported"] == 1  # dedup kullanici bazlidir

    async def test_synced_run_feeds_rule_engine(self, client):
        user_id = new_user_id()
        # Zone 2 kosusu: avg_hr 140 -> turetilen RPE 4.0, CNS katsayisi 0.5
        r = await client.post(
            _SYNC_URL, json={"samples": [_sample()]}, headers=auth_headers(user_id)
        )
        assert r.status_code == 200

        r = await client.get("/api/v1/metrics/weekly", headers=auth_headers(user_id))
        body = r.json()
        assert body["total_workouts"] == 1
        assert body["total_run_distance_km"] == pytest.approx(8.0)
        # 0.5 x (4.0 / 10) = 0.2
        (score,) = body["daily_cns_scores"].values()
        assert score == pytest.approx(0.2)

    async def test_empty_batch_rejected(self, client):
        r = await client.post(
            _SYNC_URL, json={"samples": []}, headers=auth_headers(new_user_id())
        )
        assert r.status_code == 422


class TestUsersMe:
    async def test_returns_profile_with_tier(self, client, db_session):
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="premium")

        r = await client.get("/api/v1/users/me", headers=auth_headers(user_id))
        assert r.status_code == 200
        body = r.json()
        assert body["user_id"] == user_id
        assert body["tier"] == "premium"

    async def test_first_login_autocreates_free_profile(self, client):
        r = await client.get(
            "/api/v1/users/me", headers=auth_headers(new_user_id())
        )
        assert r.status_code == 200
        assert r.json()["tier"] == "free"


class TestExerciseCatalog:
    async def test_full_catalog(self, client):
        r = await client.get("/api/v1/exercises", headers=auth_headers(new_user_id()))
        assert r.status_code == 200
        body = r.json()
        assert len(body) >= 20
        squat = next(e for e in body if e["exercise_id"] == "back_squat")
        assert squat["cns_load_factor"] == pytest.approx(1.4)
        assert squat["target_muscles"]["quadriceps"] == pytest.approx(1.0)

    async def test_category_filter(self, client):
        r = await client.get(
            "/api/v1/exercises?category=hyrox", headers=auth_headers(new_user_id())
        )
        body = r.json()
        assert len(body) == 8  # 8 resmi HYROX istasyonu
        assert all(e["category"] == "hyrox" for e in body)

    async def test_requires_auth(self, client):
        r = await client.get("/api/v1/exercises")
        assert r.status_code == 401


class TestDeleteWorkout:
    _WORKOUT = {
        "workout_type": "To Delete",
        "user_reported_rpe": 5.0,
        "duration_minutes": 20,
        "cardio": {"cardio_type": "rowing", "distance_km": 1.0, "duration_minutes": 5.0},
    }

    async def test_owner_can_delete_with_cascade(self, client, db_session):
        user_id = new_user_id()
        r = await client.post(
            "/api/v1/workouts", json=self._WORKOUT, headers=auth_headers(user_id)
        )
        workout_id = r.json()["summary"]["workout_log_id"]

        r = await client.delete(
            f"/api/v1/workouts/{workout_id}", headers=auth_headers(user_id)
        )
        assert r.status_code == 204

        remaining = (
            await db_session.execute(
                text(
                    "SELECT count(*) FROM workout_cardio_details "
                    "WHERE workout_log_id = :id"
                ),
                {"id": workout_id},
            )
        ).scalar_one()
        assert remaining == 0  # alt detaylar CASCADE ile silinir

    async def test_other_users_workout_returns_404(self, client):
        owner, attacker = new_user_id(), new_user_id()
        r = await client.post(
            "/api/v1/workouts", json=self._WORKOUT, headers=auth_headers(owner)
        )
        workout_id = r.json()["summary"]["workout_log_id"]

        r = await client.delete(
            f"/api/v1/workouts/{workout_id}", headers=auth_headers(attacker)
        )
        assert r.status_code == 404

        # Sahibi hala gorebilmeli
        r = await client.get("/api/v1/workouts", headers=auth_headers(owner))
        assert r.json()["total_count"] == 1

    async def test_nonexistent_workout_returns_404(self, client):
        r = await client.delete(
            f"/api/v1/workouts/{uuidlib.uuid4()}", headers=auth_headers(new_user_id())
        )
        assert r.status_code == 404
