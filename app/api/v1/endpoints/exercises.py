"""Egzersiz katalogu endpoint'leri (/api/v1/exercises).

Mobil idman giris ekranini besler: kullanici egzersizi bu katalogdan secer,
boylece exercise_id'ler her zaman kural motorunun tanidigi degerler olur.
"""

import json

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import get_current_user
from app.schemas.user import UserProfile

router = APIRouter(prefix="/exercises", tags=["exercises"])

_VALID_CATEGORIES = ("strength", "running", "hyrox", "olympic", "crossfit")


class ExerciseOut(BaseModel):
    exercise_id: str
    name: str
    category: str
    cns_load_factor: float
    target_muscles: dict[str, float]


@router.get(
    "",
    response_model=list[ExerciseOut],
    summary="Egzersiz katalogunu listele",
)
async def list_exercises(
    category: str | None = Query(
        None, description=f"Opsiyonel filtre: {', '.join(_VALID_CATEGORIES)}"
    ),
    _current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[ExerciseOut]:
    result = await db.execute(
        text(
            """
            SELECT exercise_id, name, category, cns_load_factor, target_muscles
            FROM exercises
            WHERE (CAST(:category AS varchar) IS NULL
                   OR category = CAST(:category AS varchar))
            ORDER BY category, name
            """
        ),
        {"category": category},
    )
    return [
        ExerciseOut(
            exercise_id=row.exercise_id,
            name=row.name,
            category=row.category,
            cns_load_factor=row.cns_load_factor,
            target_muscles=(
                json.loads(row.target_muscles)
                if isinstance(row.target_muscles, str)
                else row.target_muscles
            ),
        )
        for row in result
    ]
