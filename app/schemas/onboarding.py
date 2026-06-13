"""Pydantic v2 schemas: AI Onboarding Wizard (POST /plan/generate).

OnboardingPayload: mobil sihirbazin topladigi atlet profili.
GeneratedWeekPlan: Gemini'nin STRICT Structured JSON ile dondugu haftalik
program — gun sablonlari mevcut WorkoutTemplateCreate semasini kullanir,
boylece uretilen plan dogrudan /templates + /plan/entries uclarina yazilabilir.
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.plans import TemplateExercise, WorkoutTemplateCreate

TrainingGoal = Literal["strength", "conditioning", "hyrox", "hybrid", "crossfit"]
Zone2Habit = Literal["none", "sometimes", "regular"]
SledExperience = Literal["none", "some", "confident"]
OlympicProficiency = Literal["none", "learning", "proficient"]
NutritionConstraint = Literal["none", "omad", "intermittent_fasting", "low_carb"]
EquipmentLevel = Literal["full_box", "standard_gym", "minimal"]
FedState = Literal["fed", "fasted", "flexible"]

_HHMM = r"^([01]\d|2[0-3]):[0-5]\d$"


def _minutes_from_hhmm(value: str) -> int:
    hour, minute = value.split(":")
    return int(hour) * 60 + int(minute)


class OnboardingPayload(BaseModel):
    """Sihirbaz cevaplari — AI'a verilecek atlet profili."""

    goal: TrainingGoal
    training_days: list[int] = Field(
        ...,
        min_length=2,
        max_length=7,
        description="Salon/idman gunleri (0=Pazartesi ... 6=Pazar)",
    )
    days_per_week: int = Field(..., ge=2, le=7)
    wants_running: bool
    running_days: list[int] = Field(
        default_factory=list,
        max_length=7,
        description="Kosu gunleri; wants_running=true ise en az 1",
    )
    split_run_and_gym: bool = Field(
        ...,
        description="Ayni gunde kosu + salon ayri seans mi",
    )
    gym_preferred_start: str = Field(..., pattern=_HHMM, description="Salon baslangic saati HH:MM")
    gym_preferred_end: str = Field(..., pattern=_HHMM, description="Salon bitis saati HH:MM")
    run_preferred_start: str = Field(..., pattern=_HHMM, description="Kosu baslangic saati HH:MM")
    run_preferred_end: str = Field(..., pattern=_HHMM, description="Kosu bitis saati HH:MM")
    gym_fed_state: FedState
    run_fed_state: FedState
    gym_duration_minutes: int = Field(..., ge=30, le=120)
    run_duration_minutes: int = Field(..., ge=20, le=90)
    five_k_pace_seconds_per_km: int | None = Field(
        None, ge=180, le=720, description="5K ortalama tempo (sn/km)"
    )
    zone2_habit: Zone2Habit
    sled_experience: SledExperience
    olympic_proficiency: OlympicProficiency
    weekend_conditioning: bool = Field(
        ..., description="Agir kondisyon gunleri hafta sonuna alinsin mi"
    )
    nutrition_constraint: NutritionConstraint
    equipment: EquipmentLevel

    @field_validator("training_days", "running_days")
    @classmethod
    def validate_day_range(cls, v: list[int]) -> list[int]:
        if len(set(v)) != len(v):
            raise ValueError("Gun listesinde tekrar olamaz")
        for d in v:
            if d < 0 or d > 6:
                raise ValueError("Gun indeksi 0-6 arasinda olmali")
        return sorted(v)

    @model_validator(mode="after")
    def validate_schedule(self) -> "OnboardingPayload":
        if len(self.training_days) != self.days_per_week:
            raise ValueError("days_per_week, training_days uzunluguna esit olmali")
        if self.wants_running and len(self.running_days) < 1:
            raise ValueError("Kosu secildiyse en az bir kosu gunu gerekli")
        if not self.wants_running and self.running_days:
            raise ValueError("Kosu secilmediyse running_days bos olmali")
        if _minutes_from_hhmm(self.gym_preferred_end) <= _minutes_from_hhmm(
            self.gym_preferred_start
        ):
            raise ValueError("Salon bitis saati baslangictan sonra olmali")
        if self.wants_running and _minutes_from_hhmm(self.run_preferred_end) <= _minutes_from_hhmm(
            self.run_preferred_start
        ):
            raise ValueError("Kosu bitis saati baslangictan sonra olmali")
        return self


class GeneratedDay(BaseModel):
    """Programin tek gunu: hafta gunu + odak cumlesi + idman sablonu."""

    day_of_week: int = Field(..., ge=0, le=6, description="0=Pazartesi ... 6=Pazar")
    focus: str = Field(..., min_length=1, max_length=200)
    template: WorkoutTemplateCreate


class GeneratedWeekPlan(BaseModel):
    """POST /plan/generate yaniti (ayni zamanda Gemini response_schema'si)."""

    coach_summary: str = Field(..., min_length=1, max_length=2000)
    days: list[GeneratedDay] = Field(..., min_length=1, max_length=7)


class AthleteContext(BaseModel):
    """Gunluk AI uretiminde kullanilabilecek hafif atlet profili."""

    goal: TrainingGoal = "hybrid"
    equipment: EquipmentLevel = "full_box"
    zone2_habit: Zone2Habit = "sometimes"
    sled_experience: SledExperience = "some"
    olympic_proficiency: OlympicProficiency = "learning"
    five_k_pace_seconds_per_km: int | None = Field(None, ge=180, le=720)
    nutrition_constraint: NutritionConstraint = "none"


SessionKind = Literal["gym", "running", "hybrid"]


class DayWorkoutGeneratePayload(BaseModel):
    """POST /plan/generate-day — tek gun icin AI idman uretimi."""

    day_of_week: int = Field(..., ge=0, le=6, description="0=Pazartesi ... 6=Pazar")
    session_kind: SessionKind = "gym"
    duration_minutes: int = Field(..., ge=15, le=180)
    preferred_workout_type: str | None = Field(
        None,
        max_length=30,
        description="Opsiyonel tip ipucu: strength, metcon, running, ...",
    )
    athlete_context: AthleteContext | None = None


class GeneratedDayWorkout(BaseModel):
    """POST /plan/generate-day yaniti."""

    focus: str = Field(..., min_length=1, max_length=200)
    template: WorkoutTemplateCreate


class WorkoutModifyPayload(BaseModel):
    """POST /plan/modify-workout — mevcut sablonu AI ile revize et."""

    template: WorkoutTemplateCreate
    change_reason: str = Field(..., min_length=5, max_length=1000)
    target_duration_minutes: int | None = Field(None, ge=15, le=180)


class ModifiedWorkoutResponse(BaseModel):
    """POST /plan/modify-workout yaniti."""

    focus: str = Field("", max_length=200)
    coach_note: str = Field("", max_length=500)
    template: WorkoutTemplateCreate


class WeeklyDayContext(BaseModel):
    """Haftalik plandaki bir gun — egzersiz onerisi baglami."""

    day_of_week: int = Field(..., ge=0, le=6)
    day_name: str = Field(..., min_length=1, max_length=20)
    workout_name: str = Field(..., min_length=1, max_length=120)
    exercise_names: list[str] = Field(default_factory=list, max_length=30)


SuggestMode = Literal["append", "replace"]


class ExerciseSuggestPayload(BaseModel):
    """POST /plan/suggest-exercise — siradaki veya yerine egzersiz oner."""

    mode: SuggestMode = "append"
    workout_name: str = Field(..., min_length=1, max_length=120)
    workout_type: str = Field(..., min_length=1, max_length=30)
    format: str = Field("standard", max_length=20)
    rounds: int = Field(1, ge=1, le=50)
    time_cap_minutes: int | None = Field(None, ge=1, le=600)
    existing_exercises: list[TemplateExercise] = Field(default_factory=list, max_length=50)
    replace_index: int | None = Field(
        None,
        ge=0,
        description="mode=replace ise degistirilecek egzersiz indeksi",
    )
    weekly_context: list[WeeklyDayContext] = Field(default_factory=list, max_length=7)
    day_of_week: int | None = Field(None, ge=0, le=6)
    athlete_context: AthleteContext | None = None

    @model_validator(mode="after")
    def validate_replace(self) -> "ExerciseSuggestPayload":
        if self.mode == "replace":
            if self.replace_index is None:
                raise ValueError("replace modunda replace_index gerekli")
            if self.replace_index >= len(self.existing_exercises):
                raise ValueError("replace_index gecersiz")
        elif self.replace_index is not None:
            raise ValueError("append modunda replace_index verilmemeli")
        return self


class ExerciseSuggestResponse(BaseModel):
    """POST /plan/suggest-exercise yaniti."""

    coach_note: str = Field(..., min_length=1, max_length=500)
    exercise: TemplateExercise
