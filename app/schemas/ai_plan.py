"""Gemini structured-output icin sade plan semalari.

WorkoutTemplateCreate / TemplateExercise Field metadata'si (examples, gt=0
-> exclusiveMinimum) Gemini response_schema donusumunde patlar.
Bu modeller yalnizca AI ciktisini parse etmek icin; endpoint yaniti
GeneratedWeekPlan'a coerce edilir.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

WorkoutTypeName = Literal[
    "hybrid",
    "running",
    "strength",
    "metcon",
    "endurance",
    "power",
    "technique",
    "recovery",
]
WorkoutFormat = Literal["standard", "circuit", "emom", "amrap", "for_time"]
Measurement = Literal["reps", "time", "distance"]


class AiPlanExercise(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    exercise_id: str | None = None
    measurement: Measurement = "reps"
    sets: int = 3
    reps: int | None = None
    weight_kg: float | None = None
    distance_m: float | None = None
    duration_seconds: int | None = None
    rest_seconds: int = 60
    instructions: str | None = None


class AiPlanTemplate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    workout_type: WorkoutTypeName
    format: WorkoutFormat = "standard"
    rounds: int = 1
    time_cap_minutes: int | None = None
    notes: str | None = None
    exercises: list[AiPlanExercise] = Field(default_factory=list)


class AiPlanDay(BaseModel):
    model_config = ConfigDict(extra="ignore")

    day_of_week: int
    focus: str
    template: AiPlanTemplate


class AiPlanResponse(BaseModel):
    """Gemini response_schema — metadata'siz, duz JSON."""

    model_config = ConfigDict(extra="ignore")

    coach_summary: str
    days: list[AiPlanDay]
