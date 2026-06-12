"""JWT auth katmani entegrasyon testleri (HS256 legacy yolu).

ES256/JWKS yolu network gerektirdigi icin burada test edilmez; imza
dogrulama mantigi iki algoritmada da ayni jwt.decode cagrisina iner.
"""

from sqlalchemy import text

from tests.conftest import auth_headers, create_profile, make_token, new_user_id


class TestTokenValidation:
    async def test_missing_token_returns_401(self, client):
        r = await client.get("/api/v1/workouts")
        assert r.status_code == 401
        assert "Bearer" in r.headers.get("www-authenticate", "")

    async def test_garbage_token_returns_401(self, client):
        r = await client.get(
            "/api/v1/workouts", headers={"Authorization": "Bearer not.a.jwt"}
        )
        assert r.status_code == 401

    async def test_expired_token_returns_401(self, client):
        headers = auth_headers(new_user_id(), exp_offset=-60)
        r = await client.get("/api/v1/workouts", headers=headers)
        assert r.status_code == 401
        assert "suresi dolmus" in r.json()["detail"]

    async def test_wrong_signature_returns_401(self, client):
        headers = auth_headers(new_user_id(), secret="wrong-secret-wrong-secret-wrong!")
        r = await client.get("/api/v1/workouts", headers=headers)
        assert r.status_code == 401

    async def test_wrong_audience_returns_401(self, client):
        headers = auth_headers(new_user_id(), audience="service_role")
        r = await client.get("/api/v1/workouts", headers=headers)
        assert r.status_code == 401


class TestAutoSyncProfiles:
    async def test_new_user_profile_created_as_free(self, client, db_session):
        user_id = new_user_id()
        email = f"{user_id}@pytest.local"

        r = await client.get("/api/v1/workouts", headers=auth_headers(user_id, email))
        assert r.status_code == 200

        row = (
            await db_session.execute(
                text("SELECT email, tier FROM user_profiles WHERE user_id = :u"),
                {"u": user_id},
            )
        ).one()
        assert row.email == email
        assert row.tier == "free"

    async def test_existing_profile_tier_preserved(self, client, db_session):
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="pro")

        r = await client.get("/api/v1/workouts", headers=auth_headers(user_id))
        assert r.status_code == 200

        tier = (
            await db_session.execute(
                text("SELECT tier FROM user_profiles WHERE user_id = :u"),
                {"u": user_id},
            )
        ).scalar_one()
        assert tier == "pro"  # auto-sync mevcut profili 'free'e dusurmemeli

    async def test_token_without_email_uses_placeholder(self, client, db_session):
        user_id = new_user_id()
        token = make_token(user_id)  # email claim'i yok

        r = await client.get(
            "/api/v1/workouts", headers={"Authorization": f"Bearer {token}"}
        )
        assert r.status_code == 200

        email = (
            await db_session.execute(
                text("SELECT email FROM user_profiles WHERE user_id = :u"),
                {"u": user_id},
            )
        ).scalar_one()
        assert email == f"{user_id}@no-email.supabase"
