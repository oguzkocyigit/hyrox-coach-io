"""Antrenman programi servisi: sablon CRUD + haftalik plan islemleri.

Tum sorgular sahiplik kosulu (user_id) icerir; baska kullanicinin kaydina
erisim her zaman "bulunamadi" olarak davranir (varlik sizdirilmaz).
"""

import json
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.plans import (
    PlanEntryCreate,
    PlanEntryOut,
    WeekPlanResponse,
    WorkoutTemplateCreate,
    WorkoutTemplateOut,
)


class PlanNotFoundError(Exception):
    """Sablon veya plan girisi bulunamadi (ya da kullaniciya ait degil)."""


async def fetch_exercise_catalog(db: AsyncSession) -> list[dict]:
    """AI plan uretimi icin kompakt egzersiz katalogu (id/name/category/cns)."""
    result = await db.execute(
        text(
            "SELECT exercise_id, name, category, cns_load_factor "
            "FROM exercises ORDER BY category, exercise_id"
        )
    )
    return [
        {
            "id": row.exercise_id,
            "name": row.name,
            "category": row.category,
            "cns": float(row.cns_load_factor),
        }
        for row in result
    ]


def _row_to_template(row) -> WorkoutTemplateOut:
    exercises = row.exercises
    if isinstance(exercises, str):
        exercises = json.loads(exercises)
    return WorkoutTemplateOut(
        template_id=row.template_id,
        name=row.name,
        workout_type=row.workout_type,
        format=row.format,
        rounds=row.rounds,
        time_cap_minutes=row.time_cap_minutes,
        notes=row.notes,
        exercises=exercises,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


_TEMPLATE_COLUMNS = (
    "template_id, name, workout_type, format, rounds, time_cap_minutes, "
    "notes, exercises, created_at, updated_at"
)


# ---------------------------------------------------------------
# Sablonlar
# ---------------------------------------------------------------
async def create_template(
    db: AsyncSession, user_id: str, payload: WorkoutTemplateCreate
) -> WorkoutTemplateOut:
    result = await db.execute(
        text(
            f"""
            INSERT INTO workout_templates
                (user_id, name, workout_type, format, rounds,
                 time_cap_minutes, notes, exercises)
            VALUES
                (:user_id, :name, :workout_type, :format, :rounds,
                 :time_cap, :notes, CAST(:exercises AS jsonb))
            RETURNING {_TEMPLATE_COLUMNS}
            """
        ),
        {
            "user_id": user_id,
            "name": payload.name,
            "workout_type": payload.workout_type,
            "format": payload.format,
            "rounds": payload.rounds,
            "time_cap": payload.time_cap_minutes,
            "notes": payload.notes,
            "exercises": json.dumps([e.model_dump() for e in payload.exercises]),
        },
    )
    return _row_to_template(result.one())


async def list_templates(db: AsyncSession, user_id: str) -> list[WorkoutTemplateOut]:
    result = await db.execute(
        text(
            f"""
            SELECT {_TEMPLATE_COLUMNS}
            FROM workout_templates
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            """
        ),
        {"user_id": user_id},
    )
    return [_row_to_template(row) for row in result]


async def update_template(
    db: AsyncSession, user_id: str, template_id: UUID, payload: WorkoutTemplateCreate
) -> WorkoutTemplateOut:
    result = await db.execute(
        text(
            f"""
            UPDATE workout_templates
            SET name = :name,
                workout_type = :workout_type,
                format = :format,
                rounds = :rounds,
                time_cap_minutes = :time_cap,
                notes = :notes,
                exercises = CAST(:exercises AS jsonb),
                updated_at = now()
            WHERE template_id = :template_id AND user_id = :user_id
            RETURNING {_TEMPLATE_COLUMNS}
            """
        ),
        {
            "template_id": template_id,
            "user_id": user_id,
            "name": payload.name,
            "workout_type": payload.workout_type,
            "format": payload.format,
            "rounds": payload.rounds,
            "time_cap": payload.time_cap_minutes,
            "notes": payload.notes,
            "exercises": json.dumps([e.model_dump() for e in payload.exercises]),
        },
    )
    row = result.one_or_none()
    if row is None:
        raise PlanNotFoundError
    return _row_to_template(row)


async def delete_template(db: AsyncSession, user_id: str, template_id: UUID) -> None:
    result = await db.execute(
        text(
            "DELETE FROM workout_templates "
            "WHERE template_id = :template_id AND user_id = :user_id "
            "RETURNING template_id"
        ),
        {"template_id": template_id, "user_id": user_id},
    )
    if result.scalar() is None:
        raise PlanNotFoundError


# ---------------------------------------------------------------
# Haftalik plan
# ---------------------------------------------------------------
async def schedule_entry(
    db: AsyncSession, user_id: str, payload: PlanEntryCreate
) -> PlanEntryOut:
    # Sablon sahipligi dogrulanir; baskasinin sablonu atanamaz
    owner_check = await db.execute(
        text(
            "SELECT 1 FROM workout_templates "
            "WHERE template_id = :template_id AND user_id = :user_id"
        ),
        {"template_id": payload.template_id, "user_id": user_id},
    )
    if owner_check.scalar() is None:
        raise PlanNotFoundError

    result = await db.execute(
        text(
            """
            INSERT INTO plan_entries (user_id, template_id, scheduled_date, position)
            VALUES (:user_id, :template_id, :scheduled_date, :position)
            RETURNING entry_id
            """
        ),
        {
            "user_id": user_id,
            "template_id": payload.template_id,
            "scheduled_date": payload.scheduled_date,
            "position": payload.position,
        },
    )
    entry_id: UUID = result.scalar_one()
    return (await _fetch_entries(db, user_id, entry_id=entry_id))[0]


async def get_week_plan(
    db: AsyncSession, user_id: str, start: date | None
) -> WeekPlanResponse:
    """start verilmezse icinde bulunulan haftanin pazartesisi kullanilir."""
    if start is None:
        today = date.today()
        start = today - timedelta(days=today.weekday())
    end = start + timedelta(days=6)
    entries = await _fetch_entries(db, user_id, start=start, end=end)
    return WeekPlanResponse(start_date=start, end_date=end, entries=entries)


async def set_entry_completion(
    db: AsyncSession, user_id: str, entry_id: UUID, completed: bool
) -> PlanEntryOut:
    result = await db.execute(
        text(
            """
            UPDATE plan_entries
            SET completed_at = CASE WHEN :completed THEN now() ELSE NULL END
            WHERE entry_id = :entry_id AND user_id = :user_id
            RETURNING entry_id
            """
        ),
        {"entry_id": entry_id, "user_id": user_id, "completed": completed},
    )
    if result.scalar() is None:
        raise PlanNotFoundError
    return (await _fetch_entries(db, user_id, entry_id=entry_id))[0]


async def delete_entry(db: AsyncSession, user_id: str, entry_id: UUID) -> None:
    result = await db.execute(
        text(
            "DELETE FROM plan_entries "
            "WHERE entry_id = :entry_id AND user_id = :user_id "
            "RETURNING entry_id"
        ),
        {"entry_id": entry_id, "user_id": user_id},
    )
    if result.scalar() is None:
        raise PlanNotFoundError


async def _fetch_entries(
    db: AsyncSession,
    user_id: str,
    *,
    entry_id: UUID | None = None,
    start: date | None = None,
    end: date | None = None,
) -> list[PlanEntryOut]:
    result = await db.execute(
        text(
            """
            SELECT e.entry_id, e.scheduled_date, e.position, e.completed_at,
                   t.template_id, t.name, t.workout_type, t.format, t.rounds,
                   t.time_cap_minutes, t.notes, t.exercises,
                   t.created_at, t.updated_at
            FROM plan_entries e
            JOIN workout_templates t ON t.template_id = e.template_id
            WHERE e.user_id = :user_id
              AND (CAST(:entry_id AS uuid) IS NULL OR e.entry_id = :entry_id)
              AND (CAST(:start AS date) IS NULL OR e.scheduled_date >= :start)
              AND (CAST(:end AS date) IS NULL OR e.scheduled_date <= :end)
            ORDER BY e.scheduled_date, e.position, e.created_at
            """
        ),
        {"user_id": user_id, "entry_id": entry_id, "start": start, "end": end},
    )
    return [
        PlanEntryOut(
            entry_id=row.entry_id,
            scheduled_date=row.scheduled_date,
            position=row.position,
            completed_at=row.completed_at,
            template=_row_to_template(row),
        )
        for row in result
    ]
