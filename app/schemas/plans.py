"""Pydantic v2 schemas: antrenman programi (sablonlar + haftalik plan).

RoxHype benzeri akis: kullanici "Build Workout" ile sablon kurar
(Standard / Circuit / EMOM / AMRAP / For Time), haftanin gunlerine atar,
tamamladikca isaretler. Tamamen deterministiktir (AI yok).
"""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing_extensions import Self

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


class TemplateExercise(BaseModel):
    """Sablondaki tek egzersiz girisi.

    measurement alanina gore zorunlu alan degisir:
    - reps     -> reps zorunlu
    - time     -> duration_seconds zorunlu
    - distance -> distance_m zorunlu
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=120, examples=["Sled Push"])
    exercise_id: str | None = Field(
        None,
        max_length=100,
        description="Opsiyonel katalog baglantisi (exercises tablosu)",
    )
    measurement: Measurement = "reps"
    sets: int = Field(1, ge=1, le=50)
    reps: int | None = Field(None, ge=1, le=1000)
    weight_kg: float | None = Field(None, ge=0, le=1000)
    distance_m: float | None = Field(None, gt=0, le=100_000)
    duration_seconds: int | None = Field(None, gt=0, le=24 * 3600)
    rest_seconds: int = Field(0, ge=0, le=3600)
    rpe: float = Field(
        7.0,
        ge=1.0,
        le=10.0,
        description="Hedef egzersiz RPE; idman kaydinda CNS hesabi icin kullanilir",
    )
    instructions: str | None = Field(None, max_length=500)

    @model_validator(mode="after")
    def require_measurement_value(self) -> Self:
        if self.measurement == "reps" and self.reps is None:
            raise ValueError(f"'{self.name}': reps olcumu icin tekrar sayisi gerekli.")
        if self.measurement == "time" and self.duration_seconds is None:
            raise ValueError(f"'{self.name}': time olcumu icin sure gerekli.")
        if self.measurement == "distance" and self.distance_m is None:
            raise ValueError(f"'{self.name}': distance olcumu icin mesafe gerekli.")
        return self


class WorkoutTemplateCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=120)
    workout_type: WorkoutTypeName
    format: WorkoutFormat = "standard"
    rounds: int = Field(1, ge=1, le=50, description="Circuit/EMOM/AMRAP tur sayisi")
    time_cap_minutes: int | None = Field(None, gt=0, le=600)
    notes: str | None = Field(None, max_length=1000)
    exercises: list[TemplateExercise] = Field(..., min_length=1, max_length=50)


class WorkoutTemplateOut(WorkoutTemplateCreate):
    template_id: UUID
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------
# Haftalik plan
# ---------------------------------------------------------------
class PlanEntryCreate(BaseModel):
    template_id: UUID
    scheduled_date: date
    position: int = Field(0, ge=0, le=10, description="Ayni gun siralamasi (AM/PM)")


class PlanEntryOut(BaseModel):
    entry_id: UUID
    scheduled_date: date
    position: int
    completed_at: datetime | None
    template: WorkoutTemplateOut


class WeekPlanResponse(BaseModel):
    """GET /plan/week yaniti: [start_date, end_date] araligindaki girisler."""

    start_date: date
    end_date: date
    entries: list[PlanEntryOut] = Field(default_factory=list)
