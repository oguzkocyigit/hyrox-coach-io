"""Gemini structured-output icin sade plan semalari.

Alan tipleri bilerek gevsektir (Literal yerine str): Gemini ara sira gecersiz
workout_type/format dondurur; coerce katmani bunlari duzeltir.
"""

from pydantic import BaseModel, ConfigDict, Field


class AiPlanExercise(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = "Egzersiz"
    exercise_id: str | None = None
    measurement: str = "reps"
    sets: int = 3
    reps: int | None = None
    weight_kg: float | None = None
    distance_m: float | None = None
    duration_seconds: int | None = None
    rest_seconds: int = 60
    rpe: float = 7.0
    instructions: str | None = None


class AiPlanTemplate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = "Idman"
    workout_type: str = "hybrid"
    format: str = "standard"
    rounds: int = 1
    time_cap_minutes: int | None = None
    notes: str | None = None
    exercises: list[AiPlanExercise] = Field(default_factory=list)


class AiPlanDay(BaseModel):
    model_config = ConfigDict(extra="ignore")

    day_of_week: int = 0
    focus: str = "Antrenman"
    template: AiPlanTemplate = Field(default_factory=AiPlanTemplate)


class AiPlanResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    coach_summary: str = ""
    days: list[AiPlanDay] = Field(default_factory=list)


class AiSingleDayResponse(BaseModel):
    """Tek gunluk idman uretimi icin Gemini semasi."""

    model_config = ConfigDict(extra="ignore")

    focus: str = "Antrenman"
    template: AiPlanTemplate = Field(default_factory=AiPlanTemplate)


class AiModifyResponse(BaseModel):
    """Mevcut idmani kullanici geri bildirimiyle revize etme semasi."""

    model_config = ConfigDict(extra="ignore")

    focus: str = ""
    coach_note: str = ""
    template: AiPlanTemplate = Field(default_factory=AiPlanTemplate)


class AiSuggestExerciseResponse(BaseModel):
    """Tek egzersiz onerisi (append / replace)."""

    model_config = ConfigDict(extra="ignore")

    coach_note: str = ""
    exercise: AiPlanExercise = Field(default_factory=AiPlanExercise)
