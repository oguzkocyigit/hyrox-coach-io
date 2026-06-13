"""Sistem sablonlari (coach_workout_templates) retrieval katmani.

AI haftalik plan uretiminde yalnizca metadata prompt'a verilir; tam exercises
JSONB hydration asamasinda deterministik olarak birlestirilir.
"""

import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_CATALOG_COLUMNS = "template_id, name, category, description"
_FULL_COLUMNS = f"{_CATALOG_COLUMNS}, exercises"


async def fetch_coach_template_catalog(db: AsyncSession) -> list[dict[str, str | None]]:
    """Prompt icin kompakt sablon listesi (exercises haric)."""
    result = await db.execute(
        text(
            f"SELECT {_CATALOG_COLUMNS} "
            "FROM coach_workout_templates ORDER BY category, template_id"
        )
    )
    return [
        {
            "template_id": row.template_id,
            "name": row.name,
            "category": row.category,
            "description": row.description,
        }
        for row in result
    ]


async def fetch_coach_templates_by_ids(
    db: AsyncSession, template_ids: list[str]
) -> dict[str, dict[str, Any]]:
    """Hydration icin secilen sablonlarin tam JSONB exercises verisi."""
    if not template_ids:
        return {}

    result = await db.execute(
        text(
            f"SELECT {_FULL_COLUMNS} "
            "FROM coach_workout_templates "
            "WHERE template_id = ANY(:ids)"
        ),
        {"ids": template_ids},
    )
    rows: dict[str, dict[str, Any]] = {}
    for row in result:
        exercises = row.exercises
        if isinstance(exercises, str):
            exercises = json.loads(exercises)
        rows[row.template_id] = {
            "template_id": row.template_id,
            "name": row.name,
            "category": row.category,
            "description": row.description,
            "exercises": exercises or [],
        }
    return rows
