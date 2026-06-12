"""PATCH /users/me (kisisel profil bilgileri) testleri."""

from tests.conftest import auth_headers, new_user_id

_ME_URL = "/api/v1/users/me"


class TestProfileUpdate:
    async def test_partial_update_and_read_back(self, client):
        headers = auth_headers(new_user_id())

        r = await client.patch(
            _ME_URL,
            json={"full_name": "Oguz Kocyigit", "age": 36},
            headers=headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["full_name"] == "Oguz Kocyigit"
        assert body["age"] == 36
        # Gonderilmeyen alanlar dokunulmadan kalir
        assert body["height_cm"] is None

        # Ikinci kismi guncelleme oncekini ezmez
        r = await client.patch(
            _ME_URL,
            json={"height_cm": 176, "weight_kg": 82.5, "gender": "male"},
            headers=headers,
        )
        body = r.json()
        assert body["full_name"] == "Oguz Kocyigit"
        assert body["height_cm"] == 176
        assert body["weight_kg"] == 82.5
        assert body["gender"] == "male"

        # GET /users/me ayni veriyi doner
        r = await client.get(_ME_URL, headers=headers)
        assert r.json()["weight_kg"] == 82.5

    async def test_empty_body_is_noop(self, client):
        headers = auth_headers(new_user_id())
        r = await client.patch(_ME_URL, json={}, headers=headers)
        assert r.status_code == 200
        assert r.json()["full_name"] is None

    async def test_validation_bounds(self, client):
        headers = auth_headers(new_user_id())
        for bad_payload in (
            {"age": 5},
            {"height_cm": 50},
            {"weight_kg": 10},
            {"gender": "robot"},
        ):
            r = await client.patch(_ME_URL, json=bad_payload, headers=headers)
            assert r.status_code == 422, bad_payload
