"""/templates ve /plan uclarinin testleri (antrenman programi)."""

import uuid as uuidlib
from datetime import date, timedelta

from sqlalchemy import text

from tests.conftest import auth_headers, new_user_id

_TEMPLATES_URL = "/api/v1/templates"
_WEEK_URL = "/api/v1/plan/week"
_ENTRIES_URL = "/api/v1/plan/entries"


def _template_payload(**overrides) -> dict:
    base = {
        "name": "HYROX Half-Distance Grinder",
        "workout_type": "hybrid",
        "format": "circuit",
        "rounds": 2,
        "exercises": [
            {"name": "Run", "measurement": "distance", "distance_m": 500},
            {
                "name": "Sled Push",
                "measurement": "distance",
                "distance_m": 25,
                "weight_kg": 125,
            },
            {
                "name": "Hang Power Clean",
                "measurement": "reps",
                "sets": 5,
                "reps": 3,
                "weight_kg": 65,
                "rest_seconds": 120,
                "instructions": "Explode from mid-thigh, fast elbows.",
            },
            {"name": "Plank", "measurement": "time", "duration_seconds": 60},
        ],
    }
    base.update(overrides)
    return base


async def _create_template(client, headers, **overrides) -> dict:
    r = await client.post(_TEMPLATES_URL, json=_template_payload(**overrides), headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


class TestTemplates:
    async def test_create_and_list(self, client):
        headers = auth_headers(new_user_id())
        created = await _create_template(client, headers)

        assert created["format"] == "circuit"
        assert created["rounds"] == 2
        assert len(created["exercises"]) == 4
        clean = next(e for e in created["exercises"] if e["name"] == "Hang Power Clean")
        assert clean["weight_kg"] == 65
        assert clean["rest_seconds"] == 120

        r = await client.get(_TEMPLATES_URL, headers=headers)
        body = r.json()
        assert len(body) == 1
        assert body[0]["template_id"] == created["template_id"]

    async def test_measurement_validation(self, client):
        headers = auth_headers(new_user_id())
        # reps olcumu ama reps yok -> 422
        bad = _template_payload(
            exercises=[{"name": "Pull-Up", "measurement": "reps", "sets": 5}]
        )
        r = await client.post(_TEMPLATES_URL, json=bad, headers=headers)
        assert r.status_code == 422

    async def test_update_replaces_content(self, client):
        headers = auth_headers(new_user_id())
        created = await _create_template(client, headers)

        updated_payload = _template_payload(
            name="Updated Grinder",
            format="amrap",
            time_cap_minutes=20,
            exercises=[{"name": "Wall Ball", "measurement": "reps", "reps": 50, "weight_kg": 9}],
        )
        r = await client.put(
            f"{_TEMPLATES_URL}/{created['template_id']}",
            json=updated_payload,
            headers=headers,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["name"] == "Updated Grinder"
        assert body["format"] == "amrap"
        assert body["time_cap_minutes"] == 20
        assert len(body["exercises"]) == 1

    async def test_other_users_template_is_404(self, client):
        owner = auth_headers(new_user_id())
        attacker = auth_headers(new_user_id())
        created = await _create_template(client, owner)

        r = await client.put(
            f"{_TEMPLATES_URL}/{created['template_id']}",
            json=_template_payload(),
            headers=attacker,
        )
        assert r.status_code == 404

        r = await client.delete(f"{_TEMPLATES_URL}/{created['template_id']}", headers=attacker)
        assert r.status_code == 404

    async def test_delete_template_cascades_plan_entries(self, client, db_session):
        headers = auth_headers(new_user_id())
        created = await _create_template(client, headers)

        r = await client.post(
            _ENTRIES_URL,
            json={
                "template_id": created["template_id"],
                "scheduled_date": date.today().isoformat(),
            },
            headers=headers,
        )
        entry_id = r.json()["entry_id"]

        r = await client.delete(f"{_TEMPLATES_URL}/{created['template_id']}", headers=headers)
        assert r.status_code == 204

        remaining = (
            await db_session.execute(
                text("SELECT count(*) FROM plan_entries WHERE entry_id = :id"),
                {"id": entry_id},
            )
        ).scalar_one()
        assert remaining == 0


class TestWeekPlan:
    async def test_schedule_and_week_view(self, client):
        headers = auth_headers(new_user_id())
        template = await _create_template(client, headers)

        monday = date.today() - timedelta(days=date.today().weekday())
        for offset, position in [(0, 0), (1, 0), (1, 1)]:  # Pzt + Sali AM/PM
            r = await client.post(
                _ENTRIES_URL,
                json={
                    "template_id": template["template_id"],
                    "scheduled_date": (monday + timedelta(days=offset)).isoformat(),
                    "position": position,
                },
                headers=headers,
            )
            assert r.status_code == 201

        r = await client.get(_WEEK_URL, headers=headers)
        body = r.json()
        assert body["start_date"] == monday.isoformat()
        assert body["end_date"] == (monday + timedelta(days=6)).isoformat()
        assert len(body["entries"]) == 3
        # Siralama: tarih, sonra position
        tuesday_entries = [
            e for e in body["entries"]
            if e["scheduled_date"] == (monday + timedelta(days=1)).isoformat()
        ]
        assert [e["position"] for e in tuesday_entries] == [0, 1]
        # Sablon detayi gomulu doner
        assert body["entries"][0]["template"]["name"] == template["name"]

    async def test_week_filter_excludes_other_weeks(self, client):
        headers = auth_headers(new_user_id())
        template = await _create_template(client, headers)
        monday = date.today() - timedelta(days=date.today().weekday())

        await client.post(
            _ENTRIES_URL,
            json={
                "template_id": template["template_id"],
                "scheduled_date": (monday + timedelta(days=7)).isoformat(),
            },
            headers=headers,
        )

        r = await client.get(_WEEK_URL, headers=headers)
        assert len(r.json()["entries"]) == 0

        r = await client.get(
            f"{_WEEK_URL}?start={(monday + timedelta(days=7)).isoformat()}",
            headers=headers,
        )
        assert len(r.json()["entries"]) == 1

    async def test_complete_and_uncomplete(self, client):
        headers = auth_headers(new_user_id())
        template = await _create_template(client, headers)
        r = await client.post(
            _ENTRIES_URL,
            json={
                "template_id": template["template_id"],
                "scheduled_date": date.today().isoformat(),
            },
            headers=headers,
        )
        entry_id = r.json()["entry_id"]
        assert r.json()["completed_at"] is None

        r = await client.post(f"{_ENTRIES_URL}/{entry_id}/complete", headers=headers)
        assert r.status_code == 200
        assert r.json()["completed_at"] is not None

        r = await client.delete(f"{_ENTRIES_URL}/{entry_id}/complete", headers=headers)
        assert r.status_code == 200
        assert r.json()["completed_at"] is None

    async def test_cannot_schedule_others_template(self, client):
        owner = auth_headers(new_user_id())
        attacker = auth_headers(new_user_id())
        template = await _create_template(client, owner)

        r = await client.post(
            _ENTRIES_URL,
            json={
                "template_id": template["template_id"],
                "scheduled_date": date.today().isoformat(),
            },
            headers=attacker,
        )
        assert r.status_code == 404

    async def test_remove_entry_keeps_template(self, client):
        headers = auth_headers(new_user_id())
        template = await _create_template(client, headers)
        r = await client.post(
            _ENTRIES_URL,
            json={
                "template_id": template["template_id"],
                "scheduled_date": date.today().isoformat(),
            },
            headers=headers,
        )
        entry_id = r.json()["entry_id"]

        r = await client.delete(f"{_ENTRIES_URL}/{entry_id}", headers=headers)
        assert r.status_code == 204

        r = await client.get(_TEMPLATES_URL, headers=headers)
        assert len(r.json()) == 1  # sablon durur

    async def test_nonexistent_entry_404(self, client):
        headers = auth_headers(new_user_id())
        r = await client.post(
            f"{_ENTRIES_URL}/{uuidlib.uuid4()}/complete", headers=headers
        )
        assert r.status_code == 404
