"""Antrenman kaydi persistence servisi.

Tum insert'ler endpoint'e enjekte edilen tek AsyncSession transaction'i
icinde calisir; hata durumunda get_db_session dependency'si rollback yapar
(transaction butunlugu: ana kayit + detaylar ya hep ya hic yazilir).

user_id parametresi dogrulanmis JWT'den (get_current_user) gelir; kullanici
profili auth katmaninda garanti edildigi icin ayrica varlik kontrolu yapilmaz.
"""

import json
from datetime import datetime
from typing import NamedTuple
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.workout import WorkoutCreate, WorkoutHistoryItem


class SavedWorkout(NamedTuple):
    workout_log_id: UUID
    date: datetime


async def save_workout(
    db: AsyncSession, user_id: str, workout: WorkoutCreate
) -> SavedWorkout:
    """Ana kaydi + kuvvet ve kardiyo detaylarini iliskili tablolara yazar."""
    result = await db.execute(
        text(
            """
            INSERT INTO workout_logs
                (user_id, date, workout_type, user_reported_rpe, journal_notes,
                 duration_minutes, calories_burned)
            VALUES
                (:user_id, COALESCE(:date, now()), :workout_type, :rpe, :journal_notes,
                 :duration, :calories)
            RETURNING workout_log_id, date
            """
        ),
        {
            "user_id": user_id,
            "date": workout.date,
            "workout_type": workout.workout_type,
            "rpe": workout.user_reported_rpe,
            "journal_notes": workout.journal_notes,
            "duration": workout.duration_minutes,
            "calories": workout.calories_burned,
        },
    )
    row = result.one()
    saved = SavedWorkout(workout_log_id=row.workout_log_id, date=row.date)

    for detail in workout.exercises or []:
        await db.execute(
            text(
                """
                INSERT INTO workout_exercise_details (workout_log_id, exercise_id, sets)
                VALUES (:log_id, :exercise_id, CAST(:sets AS JSONB))
                """
            ),
            {
                "log_id": saved.workout_log_id,
                "exercise_id": detail.exercise_id,
                "sets": json.dumps([s.model_dump() for s in detail.sets]),
            },
        )

    if workout.cardio is not None:
        cardio = workout.cardio
        await db.execute(
            text(
                """
                INSERT INTO workout_cardio_details
                    (workout_log_id, cardio_type, distance_km, duration_minutes, avg_hr, source)
                VALUES
                    (:log_id, :cardio_type, :distance_km, :duration_minutes, :avg_hr, :source)
                """
            ),
            {
                "log_id": saved.workout_log_id,
                "cardio_type": cardio.cardio_type.value,
                "distance_km": cardio.distance_km,
                "duration_minutes": cardio.duration_minutes,
                "avg_hr": cardio.avg_hr,
                "source": cardio.source.value,
            },
        )

    return saved


class WorkoutHistoryPage(NamedTuple):
    items: list[WorkoutHistoryItem]
    total_count: int


def _ensure_parsed(value: object) -> list:
    """asyncpg json kolonunu surume gore str veya list dondurebilir."""
    if isinstance(value, str):
        return json.loads(value)
    return value or []


async def fetch_workout_history(
    db: AsyncSession, user_id: str, limit: int, offset: int
) -> WorkoutHistoryPage:
    """Sayfalanmis idman gecmisi (en yeni -> en eski).

    Alt detaylar (egzersiz setleri + kardiyo) N+1 sorgusuna dusmemek icin
    tek SQL'de correlated json_agg ile toplanir; toplam kayit sayisi ayni
    sorguda window function ile doner.
    """
    result = await db.execute(
        text(
            """
            SELECT w.workout_log_id,
                   w.date,
                   w.workout_type,
                   w.user_reported_rpe,
                   w.duration_minutes,
                   w.calories_burned,
                   w.journal_notes,
                   COALESCE(
                       (SELECT json_agg(json_build_object(
                                   'exercise_id', d.exercise_id,
                                   'exercise_name', e.name,
                                   'sets', d.sets))
                        FROM workout_exercise_details d
                        JOIN exercises e ON e.exercise_id = d.exercise_id
                        WHERE d.workout_log_id = w.workout_log_id),
                       '[]'::json
                   ) AS exercises,
                   COALESCE(
                       (SELECT json_agg(json_build_object(
                                   'cardio_type', c.cardio_type,
                                   'distance_km', c.distance_km,
                                   'duration_minutes', c.duration_minutes,
                                   'avg_hr', c.avg_hr,
                                   'source', c.source))
                        FROM workout_cardio_details c
                        WHERE c.workout_log_id = w.workout_log_id),
                       '[]'::json
                   ) AS cardio,
                   count(*) OVER () AS total_count
            FROM workout_logs w
            WHERE w.user_id = :user_id
            ORDER BY w.date DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {"user_id": user_id, "limit": limit, "offset": offset},
    )
    rows = result.all()

    items = [
        WorkoutHistoryItem(
            workout_log_id=row.workout_log_id,
            date=row.date,
            workout_type=row.workout_type,
            user_reported_rpe=row.user_reported_rpe,
            duration_minutes=row.duration_minutes,
            calories_burned=row.calories_burned,
            journal_notes=row.journal_notes,
            exercises=_ensure_parsed(row.exercises),
            cardio=_ensure_parsed(row.cardio),
        )
        for row in rows
    ]
    if rows:
        total_count = rows[0].total_count
    else:
        # Offset toplam kayit sayisini astiysa window function sonucu yoktur;
        # pagination UI'inin dogru calismasi icin toplami ayrica sayariz.
        count_result = await db.execute(
            text("SELECT count(*) FROM workout_logs WHERE user_id = :user_id"),
            {"user_id": user_id},
        )
        total_count = count_result.scalar_one()

    return WorkoutHistoryPage(items=items, total_count=total_count)
