"""AI plan ciktisini WorkoutTemplateCreate kurallarina uygun hale getirir."""

import json
import logging
import math

from pydantic import ValidationError

from app.schemas.ai_plan import (
    AiModifyResponse,
    AiPlanResponse,
    AiSingleDayResponse,
    AiSuggestExerciseResponse,
)
from app.schemas.onboarding import (
    AthleteContext,
    ExerciseSuggestResponse,
    GeneratedDay,
    GeneratedDayWorkout,
    GeneratedWeekPlan,
    ModifiedWorkoutResponse,
    OnboardingPayload,
)
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
_TIME_CAP_FORMATS = {"amrap", "for_time", "emom"}
_ROUND_FORMATS = {"circuit", "emom"}

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
    raw.setdefault("rpe", 7.0)
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


def parse_ai_single_day(raw_text: str) -> AiSingleDayResponse:
    try:
        return AiSingleDayResponse.model_validate_json(raw_text)
    except ValidationError:
        logger.warning("AiSingleDayResponse strict parse failed, trying json.loads fallback")
        data = json.loads(raw_text)
        return AiSingleDayResponse.model_validate(data)


def parse_ai_modify(raw_text: str) -> AiModifyResponse:
    try:
        return AiModifyResponse.model_validate_json(raw_text)
    except ValidationError:
        logger.warning("AiModifyResponse strict parse failed, trying json.loads fallback")
        data = json.loads(raw_text)
        return AiModifyResponse.model_validate(data)


def parse_ai_suggest_exercise(raw_text: str) -> AiSuggestExerciseResponse:
    try:
        return AiSuggestExerciseResponse.model_validate_json(raw_text)
    except ValidationError:
        logger.warning(
            "AiSuggestExerciseResponse strict parse failed, trying json.loads fallback"
        )
        data = json.loads(raw_text)
        return AiSuggestExerciseResponse.model_validate(data)


def estimate_template_minutes(
    template: WorkoutTemplateCreate,
) -> int:
    """Mobil estimateDurationMinutes ile ayni deterministik tahmin."""
    if template.format in _TIME_CAP_FORMATS and template.time_cap_minutes:
        return template.time_cap_minutes

    total_seconds = 0.0
    for exercise in template.exercises:
        if exercise.measurement == "reps":
            work_per_set = (exercise.reps or 0) * 4
        elif exercise.measurement == "time":
            work_per_set = exercise.duration_seconds or 0
        else:
            work_per_set = ((exercise.distance_m or 0) / 1000) * 180
        total_seconds += exercise.sets * (work_per_set + exercise.rest_seconds)

    rounds = template.rounds if template.format in _ROUND_FORMATS else 1
    total_seconds = total_seconds * rounds * 1.1
    return max(1, round(total_seconds / 60))


def _within_duration_tolerance(estimated: int, target: int, tolerance: float = 0.12) -> bool:
    if target <= 0:
        return True
    return abs(estimated - target) / target <= tolerance


def scale_template_to_duration(
    template: WorkoutTemplateCreate,
    target_minutes: int,
) -> WorkoutTemplateCreate:
    """AI ciktisini hedef sureye deterministik olarak olceklendirir."""
    if target_minutes <= 0:
        return template

    estimated = estimate_template_minutes(template)
    if _within_duration_tolerance(estimated, target_minutes):
        return template

    if template.format == "emom":
        return template.model_copy(
            update={"rounds": min(50, max(template.rounds, target_minutes))}
        )

    if template.format in ("amrap", "for_time"):
        return template.model_copy(update={"time_cap_minutes": target_minutes})

    factor = target_minutes / max(estimated, 1)
    scaled_exercises: list[TemplateExercise] = []
    for exercise in template.exercises:
        new_sets = min(50, max(1, round(exercise.sets * factor)))
        new_rest = min(3600, max(exercise.rest_seconds, round(exercise.rest_seconds * factor)))
        updates: dict = {"sets": new_sets, "rest_seconds": new_rest}

        if exercise.measurement == "reps" and factor > 1.15:
            base_reps = exercise.reps or 10
            updates["reps"] = min(1000, max(base_reps, round(base_reps * min(factor, 1.8))))
        elif exercise.measurement == "time" and factor > 1.15:
            base = exercise.duration_seconds or 60
            updates["duration_seconds"] = min(
                24 * 3600, max(base, round(base * min(factor, 1.8)))
            )
        elif exercise.measurement == "distance" and factor > 1.15:
            base = exercise.distance_m or 400
            updates["distance_m"] = min(100_000, max(base, round(base * min(factor, 1.8))))

        scaled_exercises.append(exercise.model_copy(update=updates))

    new_rounds = template.rounds
    if template.format in _ROUND_FORMATS and factor > 1.1:
        new_rounds = min(50, max(template.rounds, round(template.rounds * factor)))

    scaled = template.model_copy(update={"exercises": scaled_exercises, "rounds": new_rounds})

    for _ in range(6):
        est = estimate_template_minutes(scaled)
        if _within_duration_tolerance(est, target_minutes):
            break
        adj = target_minutes / max(est, 1)
        if adj > 1.05:
            bumped = []
            for ex in scaled.exercises:
                bumped.append(
                    ex.model_copy(update={"sets": min(50, max(1, round(ex.sets * adj)))})
                )
            scaled = scaled.model_copy(update={"exercises": bumped})
        elif adj < 0.9:
            trimmed = []
            for ex in scaled.exercises:
                trimmed.append(
                    ex.model_copy(
                        update={"sets": max(1, math.floor(ex.sets * adj))}
                    )
                )
            scaled = scaled.model_copy(update={"exercises": trimmed})
        else:
            break

    return scaled


def _coerce_template_from_ai(
    raw_template,
    *,
    target_minutes: int | None = None,
) -> WorkoutTemplateCreate | None:
    exercises: list[TemplateExercise] = []
    for ex in raw_template.exercises:
        sanitized = _sanitize_exercise(ex.model_dump())
        if sanitized:
            exercises.append(sanitized)
    if not exercises:
        return None

    template = WorkoutTemplateCreate(
        name=(raw_template.name or "Idman")[:120],
        workout_type=_normalize_workout_type(raw_template.workout_type),  # type: ignore[arg-type]
        format=_normalize_format(raw_template.format),  # type: ignore[arg-type]
        rounds=max(1, raw_template.rounds or 1),
        time_cap_minutes=raw_template.time_cap_minutes,
        notes=raw_template.notes,
        exercises=exercises,
    )
    if target_minutes:
        return scale_template_to_duration(template, target_minutes)
    return template


def _target_minutes_for_day(
    workout_type: str,
    payload: OnboardingPayload,
) -> int:
    if workout_type == "running":
        return payload.run_duration_minutes
    return payload.gym_duration_minutes


def coerce_ai_plan(
    ai: AiPlanResponse,
    payload: OnboardingPayload | None = None,
) -> GeneratedWeekPlan:
    """Gemini'nin sade semasindan API yanitina donusturur."""
    days: list[GeneratedDay] = []
    for day in ai.days:
        template = _coerce_template_from_ai(day.template)
        if not template:
            continue
        if payload:
            target = _target_minutes_for_day(template.workout_type, payload)
            template = scale_template_to_duration(template, target)
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


def coerce_ai_single_day(
    ai: AiSingleDayResponse,
    *,
    target_minutes: int,
) -> GeneratedDayWorkout:
    template = _coerce_template_from_ai(ai.template, target_minutes=target_minutes)
    if not template:
        raise ValueError("AI gecerli idman uretemedi.")
    return GeneratedDayWorkout(
        focus=(ai.focus or "Antrenman")[:200],
        template=template,
    )


def coerce_ai_modify(
    ai: AiModifyResponse,
    *,
    target_minutes: int | None,
    fallback_name: str,
) -> ModifiedWorkoutResponse:
    template = _coerce_template_from_ai(ai.template, target_minutes=target_minutes)
    if not template:
        raise ValueError("AI gecerli revize idman uretemedi.")
    if not template.name.strip():
        template = template.model_copy(update={"name": fallback_name[:120]})
    return ModifiedWorkoutResponse(
        focus=(ai.focus or "")[:200],
        coach_note=(ai.coach_note or "").strip()[:500],
        template=template,
    )


def coerce_ai_suggest_exercise(ai: AiSuggestExerciseResponse) -> ExerciseSuggestResponse:
    raw = ai.exercise.model_dump()
    exercise = _sanitize_exercise(raw)
    if not exercise:
        raise ValueError("AI gecerli egzersiz oneremedi.")
    note = (ai.coach_note or "").strip() or "Program akisina uygun hareket."
    return ExerciseSuggestResponse(coach_note=note[:500], exercise=exercise)
