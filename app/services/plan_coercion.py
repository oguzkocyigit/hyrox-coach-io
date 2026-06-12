"""AI plan ciktisini WorkoutTemplateCreate kurallarina uygun hale getirir."""

from pydantic import ValidationError

from app.schemas.ai_plan import AiPlanResponse
from app.schemas.onboarding import GeneratedDay, GeneratedWeekPlan
from app.schemas.plans import TemplateExercise, WorkoutTemplateCreate


def _sanitize_exercise(raw: dict) -> TemplateExercise | None:
    """Eksik olcum alanlarini doldurur; hala gecersizse None."""
    measurement = raw.get("measurement") or "reps"
    if measurement == "reps" and not raw.get("reps"):
        raw["reps"] = 10
    if measurement == "time" and not raw.get("duration_seconds"):
        raw["duration_seconds"] = 60
    if measurement == "distance" and not raw.get("distance_m"):
        raw["distance_m"] = 400
    raw.setdefault("sets", 3)
    raw.setdefault("rest_seconds", 0)
    try:
        return TemplateExercise.model_validate(raw)
    except ValidationError:
        return None


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
            name=day.template.name[:120],
            workout_type=day.template.workout_type,
            format=day.template.format,
            rounds=max(1, day.template.rounds),
            time_cap_minutes=day.template.time_cap_minutes,
            notes=day.template.notes,
            exercises=exercises,
        )
        days.append(
            GeneratedDay(
                day_of_week=max(0, min(6, day.day_of_week)),
                focus=day.focus[:200],
                template=template,
            )
        )
    if not days:
        raise ValidationError.from_exception_data(
            "GeneratedWeekPlan",
            [{"type": "value_error", "loc": ("days",), "msg": "No valid days", "input": []}],
        )
    summary = ai.coach_summary.strip() or "Haftalik programin hazir."
    return GeneratedWeekPlan(coach_summary=summary[:2000], days=days)
