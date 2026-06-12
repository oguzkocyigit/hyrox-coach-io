"""Bolum 5: tier bazli rate-limiting ve AI endpoint testleri.

Gemini cagrilari daima mock'lanir; testler API key'siz ve token maliyetsiz
calisir. Kota pencereleri ai_usage_logs'a dogrudan kayit atilarak simule edilir.
"""

from sqlalchemy import text

from app.schemas.analysis import CoachAnalysis
from app.services.ai_coach import AIServiceNotConfiguredError
from tests.conftest import auth_headers, create_profile, new_user_id

_ANALYSIS_URL = "/api/v1/analysis/weekly"


async def _fake_coach_note(_metrics) -> CoachAnalysis:
    return CoachAnalysis(breach_detected=False, coaches_note="Mock coach note.")


def _patch_gemini(monkeypatch, side_effect=None):
    """Endpoint modulundeki Gemini cagrisini mock'lar."""
    if side_effect is None:
        monkeypatch.setattr(
            "app.api.v1.endpoints.analysis.generate_weekly_coach_note",
            _fake_coach_note,
        )
    else:

        async def _raiser(_metrics):
            raise side_effect

        monkeypatch.setattr(
            "app.api.v1.endpoints.analysis.generate_weekly_coach_note", _raiser
        )


async def _seed_usage(db, user_id: str, count: int) -> None:
    for _ in range(count):
        await db.execute(
            text(
                "INSERT INTO ai_usage_logs (user_id, endpoint_called) "
                "VALUES (:u, :e)"
            ),
            {"u": user_id, "e": _ANALYSIS_URL},
        )
    await db.commit()


class TestTierLimits:
    async def test_free_tier_always_blocked(self, client, db_session, monkeypatch):
        _patch_gemini(monkeypatch)
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="free")

        r = await client.post(_ANALYSIS_URL, headers=auth_headers(user_id))
        assert r.status_code == 429
        assert "Free" in r.json()["detail"]

    async def test_premium_allows_one_then_blocks(self, client, db_session, monkeypatch):
        _patch_gemini(monkeypatch)
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="premium")
        headers = auth_headers(user_id)

        first = await client.post(_ANALYSIS_URL, headers=headers)
        assert first.status_code == 200
        assert first.json()["analysis"]["coaches_note"] == "Mock coach note."

        second = await client.post(_ANALYSIS_URL, headers=headers)
        assert second.status_code == 429
        assert "haftalik" in second.json()["detail"]

    async def test_pro_blocks_at_daily_limit(self, client, db_session, monkeypatch):
        _patch_gemini(monkeypatch)
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="pro")
        await _seed_usage(db_session, user_id, 5)

        r = await client.post(_ANALYSIS_URL, headers=auth_headers(user_id))
        assert r.status_code == 429
        assert "gunluk" in r.json()["detail"]

    async def test_pro_under_limit_allowed(self, client, db_session, monkeypatch):
        _patch_gemini(monkeypatch)
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="pro")
        await _seed_usage(db_session, user_id, 4)

        r = await client.post(_ANALYSIS_URL, headers=auth_headers(user_id))
        assert r.status_code == 200


class TestQuotaConsumption:
    async def test_successful_call_records_usage(self, client, db_session, monkeypatch):
        _patch_gemini(monkeypatch)
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="pro")

        r = await client.post(_ANALYSIS_URL, headers=auth_headers(user_id))
        assert r.status_code == 200

        used = (
            await db_session.execute(
                text("SELECT count(*) FROM ai_usage_logs WHERE user_id = :u"),
                {"u": user_id},
            )
        ).scalar_one()
        assert used == 1

    async def test_failed_ai_call_does_not_consume_quota(
        self, client, db_session, monkeypatch
    ):
        _patch_gemini(monkeypatch, side_effect=AIServiceNotConfiguredError("no key"))
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="premium")

        r = await client.post(_ANALYSIS_URL, headers=auth_headers(user_id))
        assert r.status_code == 503

        used = (
            await db_session.execute(
                text("SELECT count(*) FROM ai_usage_logs WHERE user_id = :u"),
                {"u": user_id},
            )
        ).scalar_one()
        assert used == 0

    async def test_response_includes_deterministic_metrics(
        self, client, db_session, monkeypatch
    ):
        _patch_gemini(monkeypatch)
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="pro")

        r = await client.post(_ANALYSIS_URL, headers=auth_headers(user_id))
        body = r.json()
        assert body["tier"] == "pro"
        assert body["user_id"] == user_id
        assert "weekly_muscle_loads" in body["metrics"]
        assert body["analysis"]["breach_detected"] is False
