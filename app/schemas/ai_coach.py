"""Pydantic v2 schemas: Pazar degerlendirme sihirbazi (Sunday Review Wizard)."""

from pydantic import BaseModel, ConfigDict, Field


class SundayReviewPayload(BaseModel):
    """Mobil sihirbazin gonderdigi haftalik oz-degerlendirme paketi."""

    model_config = ConfigDict(str_strip_whitespace=True)

    missed_workouts_reason: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Kacirilan idmanlarin nedeni veya tam uyum notu",
    )
    nutrition_adherence: int = Field(
        ...,
        ge=1,
        le=10,
        description="Beslenme hedefine uyum (1=dusuk, 10=mukemmel)",
    )
    recovery_feeling: str = Field(
        ...,
        min_length=1,
        max_length=1500,
        description="Genel toparlanma ve enerji hissiyatı",
    )


class SundayReviewResponse(BaseModel):
    """Gemini'den STRICT JSON olarak donen haftalik koc degerlendirmesi."""

    review_summary: str = Field(..., min_length=1)
    next_week_adjustments: str = Field(..., min_length=1)
    readiness_score: int = Field(..., ge=1, le=10)
