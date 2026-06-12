"""POST /webhooks/revenuecat (tier guncelleme) testleri."""

import pytest
from sqlalchemy import text

from tests.conftest import create_profile, new_user_id

_URL = "/api/v1/webhooks/revenuecat"
_SECRET = "pytest-revenuecat-secret"
_HEADERS = {"Authorization": _SECRET}


@pytest.fixture(autouse=True)
def _webhook_secret():
    """Webhook secret'ini test suresince ayarlar (lru_cache'li settings uzerinde)."""
    from app.core.config import get_settings

    settings = get_settings()
    old = settings.revenuecat_webhook_secret
    settings.revenuecat_webhook_secret = _SECRET
    yield
    settings.revenuecat_webhook_secret = old


def _payload(event_type: str, user_id: str | None, entitlements: list[str] | None = None) -> dict:
    return {
        "api_version": "1.0",
        "event": {
            "type": event_type,
            "app_user_id": user_id,
            "entitlement_ids": entitlements,
        },
    }


async def _tier_of(db_session, user_id: str) -> str:
    result = await db_session.execute(
        text("SELECT tier FROM user_profiles WHERE user_id = :u"), {"u": user_id}
    )
    return result.scalar_one()


class TestRevenueCatWebhook:
    async def test_initial_purchase_sets_premium(self, client, db_session):
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="free")

        r = await client.post(
            _URL,
            json=_payload("INITIAL_PURCHASE", user_id, ["premium"]),
            headers=_HEADERS,
        )
        assert r.status_code == 200, r.text
        assert r.json() == {
            "status": "updated",
            "event_type": "INITIAL_PURCHASE",
            "tier": "premium",
        }
        assert await _tier_of(db_session, user_id) == "premium"

    async def test_product_change_upgrades_to_pro(self, client, db_session):
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="premium")

        r = await client.post(
            _URL,
            json=_payload("PRODUCT_CHANGE", user_id, ["premium", "pro"]),
            headers=_HEADERS,
        )
        assert r.status_code == 200
        assert r.json()["tier"] == "pro"
        assert await _tier_of(db_session, user_id) == "pro"

    async def test_expiration_reverts_to_free(self, client, db_session):
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="pro")

        r = await client.post(
            _URL,
            json=_payload("EXPIRATION", user_id, []),
            headers=_HEADERS,
        )
        assert r.status_code == 200
        assert r.json()["tier"] == "free"
        assert await _tier_of(db_session, user_id) == "free"

    async def test_cancellation_is_ignored(self, client, db_session):
        """Iptal donem sonuna kadar erisimi kesmez; tier degismez."""
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="premium")

        r = await client.post(
            _URL,
            json=_payload("CANCELLATION", user_id, ["premium"]),
            headers=_HEADERS,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "ignored"
        assert await _tier_of(db_session, user_id) == "premium"

    async def test_unknown_user_returns_200(self, client):
        """RevenueCat 2xx disinda retry yapar; silinmis hesapta retry istemeyiz."""
        r = await client.post(
            _URL,
            json=_payload("RENEWAL", "pytest-nonexistent-user", ["premium"]),
            headers=_HEADERS,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "user_not_found"

    async def test_wrong_secret_rejected(self, client):
        r = await client.post(
            _URL,
            json=_payload("RENEWAL", new_user_id(), ["premium"]),
            headers={"Authorization": "wrong-secret"},
        )
        assert r.status_code == 401

    async def test_missing_auth_header_rejected(self, client):
        r = await client.post(_URL, json=_payload("RENEWAL", new_user_id(), ["premium"]))
        assert r.status_code == 401

    async def test_unconfigured_secret_returns_503(self, client):
        from app.core.config import get_settings

        get_settings().revenuecat_webhook_secret = None
        r = await client.post(
            _URL,
            json=_payload("RENEWAL", new_user_id(), ["premium"]),
            headers=_HEADERS,
        )
        assert r.status_code == 503

    async def test_bearer_prefix_accepted(self, client, db_session):
        user_id = new_user_id()
        await create_profile(db_session, user_id, tier="free")

        r = await client.post(
            _URL,
            json=_payload("RENEWAL", user_id, ["pro"]),
            headers={"Authorization": f"Bearer {_SECRET}"},
        )
        assert r.status_code == 200
        assert await _tier_of(db_session, user_id) == "pro"
