"""Pydantic v2 schemas: AI Onboarding Wizard (POST /plan/generate).

OnboardingPayload: mobil sihirbazin topladigi atlet profili.
GeneratedWeekPlan: Gemini'nin STRICT Structured JSON ile dondugu haftalik
program — gun sablonlari mevcut WorkoutTemplateCreate semasini kullanir,
boylece uretilen plan dogrudan /templates + /plan/entries uclarina yazilabilir.
"""

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.plans import WorkoutTemplateCreate

TrainingGoal = Literal["strength", "conditioning", "hybrid"]
Zone2Habit = Literal["none", "sometimes", "regular"]
SledExperience = Literal["none", "some", "confident"]
OlympicProficiency = Literal["none", "learning", "proficient"]
NutritionConstraint = Literal["none", "omad", "intermittent_fasting", "low_carb"]
EquipmentLevel = Literal["full_box", "standard_gym", "minimal"]


class OnboardingPayload(BaseModel):
    """Sihirbaz cevaplari — AI'a verilecek atlet profili."""

    goal: TrainingGoal
    days_per_week: int = Field(..., ge=2, le=7)
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


class GeneratedDay(BaseModel):
    """Programin tek gunu: hafta gunu + odak cumlesi + idman sablonu."""

    day_of_week: int = Field(..., ge=0, le=6, description="0=Pazartesi ... 6=Pazar")
    focus: str = Field(..., min_length=1, max_length=200)
    template: WorkoutTemplateCreate


class GeneratedWeekPlan(BaseModel):
    """POST /plan/generate yaniti (ayni zamanda Gemini response_schema'si)."""

    coach_summary: str = Field(..., min_length=1, max_length=2000)
    days: list[GeneratedDay] = Field(..., min_length=1, max_length=7)
