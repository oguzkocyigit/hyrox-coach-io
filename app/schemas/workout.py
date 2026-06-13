"""Pydantic v2 schemas: mobil uygulama + giyilebilir cihaz verisi tek pakette.

PROJE_BLUEPRINT.md Bolum 3 (DB semasi) ve Bolum 4 (kural motoru) ile uyumludur.
"""

from datetime import datetime
from enum import Enum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing_extensions import Self

SetMeasurement = Literal["reps", "distance", "time"]


class CardioType(str, Enum):
    RUNNING = "running"
    ROWING = "rowing"
    SKI_ERG = "ski_erg"


class CardioSource(str, Enum):
    APPLE_HEALTH = "apple_health"
    GOOGLE_HEALTH = "google_health"
    MANUAL = "manual"


# ---------------------------------------------------------------
# Input schemas
# ---------------------------------------------------------------
class WorkoutSet(BaseModel):
    """Tek bir kuvvet seti. DB'de JSONB array elemani olarak saklanir.

    measurement alanina gore zorunlu deger degisir (sled push gibi mesafe
    bazli, plank gibi sure bazli istasyonlar icin):
    - reps     -> reps zorunlu
    - distance -> distance_m zorunlu
    - time     -> duration_seconds zorunlu

    Kural motoru set SAYISINI kullanir; olcum tipi CNS/hacim matematigini
    degistirmez.
    """

    measurement: SetMeasurement = "reps"
    weight_kg: float = Field(0, ge=0, description="Kaldirilan/tasinan agirlik (kg). Vucut agirligi hareketlerinde 0.")
    reps: int | None = Field(None, gt=0)
    distance_m: float | None = Field(None, gt=0, le=100_000, description="Mesafe (metre)")
    duration_seconds: int | None = Field(None, gt=0, le=24 * 3600, description="Sure (saniye)")
    rpe: float | None = Field(
        None, ge=1.0, le=10.0, description="Set bazli hissedilen zorluk (1.0-10.0); opsiyonel"
    )

    @model_validator(mode="after")
    def require_measurement_value(self) -> Self:
        if self.measurement == "reps" and self.reps is None:
            raise ValueError("reps olcumu icin tekrar sayisi gerekli.")
        if self.measurement == "distance" and self.distance_m is None:
            raise ValueError("distance olcumu icin mesafe (metre) gerekli.")
        if self.measurement == "time" and self.duration_seconds is None:
            raise ValueError("time olcumu icin sure (saniye) gerekli.")
        return self


class ExerciseLog(BaseModel):
    exercise_id: str = Field(..., min_length=1, max_length=100, examples=["back_squat"])
    sets: list[WorkoutSet] = Field(..., min_length=1)


class CardioLog(BaseModel):
    """Giyilebilir cihazdan (HealthKit / Health Connect) veya manuel girilen kardiyo blogu."""

    cardio_type: CardioType
    distance_km: float = Field(..., ge=0)
    duration_minutes: float = Field(..., gt=0)
    avg_hr: int | None = Field(None, ge=30, le=250, description="Wearable'dan gelen ortalama nabiz")
    source: CardioSource = CardioSource.MANUAL


class WorkoutCreate(BaseModel):
    """Mobil uygulamadan gelen antrenman kayit paketi (kuvvet + kardiyo)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    # user_id payload'da TASINMAZ; dogrulanmis JWT'den (get_current_user) gelir.
    workout_type: str = Field(..., min_length=1, max_length=100, examples=["Full Body", "Zone 2 Run", "Hyrox Sim"])
    user_reported_rpe: float = Field(
        7.0, ge=1.0, le=10.0, description="Idman geneli hissedilen zorluk (1-10); bos birakilirsa 7"
    )
    journal_notes: str | None = Field(
        default=None,
        max_length=1500,
        description="Idman sonrasi serbest metin gunluk (enerji, agirlik hissi, beslenme vb.)",
    )
    duration_minutes: int = Field(..., gt=0)
    date: datetime | None = Field(None, description="Bos birakilirsa sunucu zamani kullanilir")
    exercises: list[ExerciseLog] | None = None
    cardio: CardioLog | None = None

    @model_validator(mode="after")
    def require_at_least_one_block(self) -> Self:
        if not self.exercises and self.cardio is None:
            raise ValueError("En az bir 'exercises' veya 'cardio' kaydi gereklidir.")
        return self


# ---------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------
class WorkoutSummary(BaseModel):
    """Kaydedilen idmanin mobil uygulamaya donen ozeti."""

    workout_log_id: UUID
    workout_type: str
    date: datetime
    duration_minutes: int
    user_reported_rpe: float
    total_strength_sets: int
    cardio_distance_km: float | None = None


class MuscleWeeklyLoad(BaseModel):
    """Son 7 gunluk kumulatif kaliteli set yuku (set sayisi x kas katsayisi)."""

    muscle: str
    weekly_load: float
    overtraining_risk: bool


class WorkoutSetOut(BaseModel):
    """DB'den okunan set.

    Eski kayitlarla uyum: rpe opsiyonel, measurement varsayilani 'reps'
    (olcum alani olmayan eski JSONB satirlari tekrar bazli kabul edilir).
    """

    measurement: SetMeasurement = "reps"
    weight_kg: float = 0
    reps: int | None = None
    distance_m: float | None = None
    duration_seconds: int | None = None
    rpe: float | None = None


class ExerciseDetailOut(BaseModel):
    exercise_id: str
    exercise_name: str
    sets: list[WorkoutSetOut]


class CardioDetailOut(BaseModel):
    cardio_type: str
    distance_km: float
    duration_minutes: float
    avg_hr: int | None = None
    source: str


class WorkoutHistoryItem(BaseModel):
    """Gecmis listesindeki tek idman karti (alt detaylariyla)."""

    workout_log_id: UUID
    date: datetime
    workout_type: str
    user_reported_rpe: float
    duration_minutes: int
    exercises: list[ExerciseDetailOut] = Field(default_factory=list)
    cardio: list[CardioDetailOut] = Field(default_factory=list)


class WorkoutHistoryResponse(BaseModel):
    """GET /workouts yaniti: sayfalanmis idman gecmisi (en yeni -> en eski)."""

    items: list[WorkoutHistoryItem]
    total_count: int = Field(..., description="Kullanicinin toplam idman sayisi")
    limit: int
    offset: int


class WorkoutCreateResponse(BaseModel):
    summary: WorkoutSummary
    daily_cns_score: float = Field(..., description="Bolum 4.B formulu ile hesaplanan gunluk CNS skoru")
    weekly_muscle_loads: list[MuscleWeeklyLoad]
    warning_flag: bool = Field(..., description="Herhangi bir kas grubu haftalik tavani (22 set) astiysa true")
    overtraining_risk: list[str] = Field(
        default_factory=list,
        description="Haftalik yuku esigi asan kas gruplari",
    )
