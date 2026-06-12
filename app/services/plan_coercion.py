"""AI plan ciktisini WorkoutTemplateCreate kurallarina uygun hale getirir."""

import json
import logging

from pydantic import ValidationError

from app.schemas.ai_plan import AiPlanResponse
from app.schemas.onboarding import GeneratedDay, GeneratedWeekPlan
from app.schemas.plans import TemplateExercise, WorkoutTemplateCreate

logger = logging.getLogger(__name__)

_VALID_WORKOUT_TYPES = {
    "hybrid",
    "running",
    "strength",
    "metcon",
    "endurance",
    "power",
    "technique",
    "recovery",
}
_VALID_FORMATS = {"standard", "circuit", "emom", "amrap", "for_time"}
_VALID_MEASUREMENTS = {"reps", "time", "distance"}

# AI'in sik kullandigi ama enum'da olmayan degerler -> en yakin karsilik
_WORKOUT_TYPE_ALIASES: dict[str, str] = {
    "cardio": "running",
    "conditioning": "metcon",
    "hyrox": "hybrid",
    "crossfit": "metcon",
    "rest": "recovery",
    "mobility": "recovery",
}


def _normalize_workout_type(raw: str) -> str:
    key = (raw or "hybrid").strip().lower()
    if key in _VALID_WORKOUT_TYPES:
        return key
    return _WORKOUT_TYPE_ALIASES.get(key, "hybrid")


def _normalize_format(raw: str) -> str:
    key = (raw or "standard").strip().lower()
    return key if key in _VALID_FORMATS else "standard"


def _normalize_measurement(raw: str) -> str:
    key = (raw or "reps").strip().lower()
    return key if key in _VALID_MEASUREMENTS else "reps"


def _sanitize_exercise(raw: dict) -> TemplateExercise | None:
    """Eksik olcum alanlarini doldurur; hala gecersizse None."""
    raw = dict(raw)
    raw["measurement"] = _normalize_measurement(str(raw.get("measurement", "reps")))
    measurement = raw["measurement"]
    if measurement == "reps" and not raw.get("reps"):
        raw["reps"] = 10
    if measurement == "time" and not raw.get("duration_seconds"):
        raw["duration_seconds"] = 60
    if measurement == "distance" and not raw.get("distance_m"):
        raw["distance_m"] = 400
    raw.setdefault("sets", 3)
    raw.setdefault("rest_seconds", 0)
    if not raw.get("name"):
        raw["name"] = "Egzersiz"
    try:
        return TemplateExercise.model_validate(raw)
    except ValidationError:
        return None


def parse_ai_response(raw_text: str) -> AiPlanResponse:
    """Gemini JSON'unu parse eder; strict parse basarisizsa json.loads fallback."""
    try:
        return AiPlanResponse.model_validate_json(raw_text)
    except ValidationError:
        logger.warning("AiPlanResponse strict parse failed, trying json.loads fallback")
        data = json.loads(raw_text)
        return AiPlanResponse.model_validate(data)


def coerce_ai_plan(ai: AiPlanResponse) -> GeneratedWeekPlan:
    """Gemini'nin sade semasindan API yanitina donusturur."""
    days: list[GeneratedDay] = []
    for day in ai.days:
        exercises: list[TemplateExercise] = []
        for ex in day.template.exercises:
            sanitized = _sanitize_exercise(ex.model_dump())
            if sanitized:
                exercises.append(sanitized)
        if not exercises:
            continue
        template = WorkoutTemplateCreate(
            name=(day.template.name or "Idman")[:120],
            workout_type=_normalize_workout_type(day.template.workout_type),  # type: ignore[arg-type]
            format=_normalize_format(day.template.format),  # type: ignore[arg-type]
            rounds=max(1, day.template.rounds or 1),
            time_cap_minutes=day.template.time_cap_minutes,
            notes=day.template.notes,
            exercises=exercises,
        )
        days.append(
            GeneratedDay(
                day_of_week=max(0, min(6, day.day_of_week)),
                focus=(day.focus or "Antrenman")[:200],
                template=template,
            )
        )
    if not days:
        raise ValueError("AI gecerli idman gunu uretemedi.")
    summary = (ai.coach_summary or "").strip() or "Haftalik programin hazir."
    return GeneratedWeekPlan(coach_summary=summary[:2000], days=days)
