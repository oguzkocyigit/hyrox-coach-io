"""DELETE /users/me (hesap silme) testleri."""

from fastapi import HTTPException, status
from sqlalchemy import text

from app.services.account import AccountServiceNotConfiguredError
from tests.conftest import auth_headers, create_profile, new_user_id

_ME_URL = "/api/v1/users/me"

_WORKOUT = {
    "workout_type": "Pre-delete Session",
    "user_reported_rpe": 6.0,
    "duration_minutes": 30,
    "cardio": {"cardio_type": "running", "distance_km": 5.0, "duration_minutes": 30.0},
}


async def _profile_exists(db_session, user_id: str) -> bool:
    count = (
        await db_session.execute(
            text("SELECT count(*) FROM user_profiles WHERE user_id = :u"),
            {"u": user_id},
        )
    ).scalar_one()
    return count > 0


class TestDeleteAccount:
    async def test_deletes_profile_and_all_data(self, client, db_session):
        """Profil + idmanlar + AI kayitlari CASCADE ile silinmeli.

        Test kullanicisi Supabase Auth'ta yoktur; admin API'nin 404'u
        basari sayilir, dolayisiyla uc canli ortama karsi calisir.
        """
        user_id = new_user_id()
        headers = auth_headers(user_id)
        await create_profile(db_session, user_id, tier="premium")
        await db_session.execute(
            text(
                "INSERT INTO ai_usage_logs (user_id, endpoint_called) "
                "VALUES (:u, '/api/v1/analysis/weekly')"
            ),
            {"u": user_id},
        )
        await db_session.commit()
        r = await client.post("/api/v1/workouts", json=_WORKOUT, headers=headers)
        assert r.status_code == 201

        r = await client.delete(_ME_URL, headers=headers)
        assert r.status_code == 204

        assert not await _profile_exists(db_session, user_id)
        for table in ("workout_logs", "ai_usage_logs"):
            count = (
                await db_session.execute(
                    text(f"SELECT count(*) FROM {table} WHERE user_id = :u"),
                    {"u": user_id},
                )
            ).scalar_one()
            assert count == 0, f"{table} temizlenmedi"

    async def test_auth_failure_rolls_back_db(self, client, db_session, monkeypatch):
        """Supabase Auth silinemezse DB silmesi geri alinmali (yarim hesap yok)."""

        async def _failing_auth_delete(user_id: str) -> None:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="auth down")

        monkeypatch.setattr(
            "app.services.account._delete_supabase_auth_user", _failing_auth_delete
        )

        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="pro")
        await db_session.commit()

        r = await client.delete(_ME_URL, headers=auth_headers(user_id))
        assert r.status_code == 502
        assert await _profile_exists(db_session, user_id)  # rollback edildi

    async def test_missing_config_returns_503(self, client, monkeypatch):
        async def _not_configured(user_id: str) -> None:
            raise AccountServiceNotConfiguredError

        monkeypatch.setattr(
            "app.services.account._delete_supabase_auth_user", _not_configured
        )

        r = await client.delete(_ME_URL, headers=auth_headers(new_user_id()))
        assert r.status_code == 503

    async def test_requires_auth(self, client):
        r = await client.delete(_ME_URL)
        assert r.status_code == 401
