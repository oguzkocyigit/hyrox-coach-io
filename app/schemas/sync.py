"""Pydantic v2 schemas: HealthKit / Health Connect toplu senkron modelleri."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.workout import CardioSource, CardioType


class HealthCardioSample(BaseModel):
    """Giyilebilir cihazdan gelen tek bir kardiyo aktivitesi.

    external_id: HealthKit workout UUID'si veya Health Connect record id'si.
    Ayni kayit tekrar gonderilirse sessizce atlanir (dedup).
    """

    external_id: str = Field(..., min_length=1, max_length=255)
    cardio_type: CardioType
    start_time: datetime
    distance_km: float = Field(..., ge=0)
    duration_minutes: float = Field(..., gt=0)
    avg_hr: int | None = Field(None, ge=30, le=250)
    source: CardioSource = CardioSource.APPLE_HEALTH
    perceived_effort: float | None = Field(
        None,
        ge=1.0,
        le=10.0,
        description=(
            "Opsiyonel RPE. Gonderilmezse avg_hr'den deterministik olarak "
            "turetilir (nabiz yoksa varsayilan 5.0)."
        ),
    )


class HealthSyncRequest(BaseModel):
    samples: list[HealthCardioSample] = Field(..., min_length=1, max_length=100)


class HealthSyncResponse(BaseModel):
    imported: int = Field(..., description="Yeni olusturulan idman sayisi")
    skipped_duplicates: int = Field(..., description="Daha once import edilmis kayit sayisi")
    workout_log_ids: list[UUID] = Field(default_factory=list)
