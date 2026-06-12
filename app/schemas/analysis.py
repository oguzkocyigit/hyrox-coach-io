"""Pydantic v2 schemas: haftalik AI analiz girdi/cikti modelleri (Bolum 6)."""

from pydantic import BaseModel, Field


class CoachAnalysis(BaseModel):
    """Gemini'den STRICT JSON olarak zorunlu kilinan cikti formati.

    Blueprint: {"breach_detected": boolean, "coaches_note": string}
    """

    breach_detected: bool
    coaches_note: str


class CardioSummaryItem(BaseModel):
    cardio_type: str
    sessions: int
    total_distance_km: float
    total_duration_minutes: float
    avg_pace_min_per_km: float | None = None
    avg_hr: float | None = None


class WeeklyMetrics(BaseModel):
    """Deterministik motorun urettigi, AI'a girdi olan haftalik metrik paketi."""

    weekly_muscle_loads: dict[str, float]
    warning_flag: bool
    overtraining_risk: list[str]
    daily_cns_scores: dict[str, float] = Field(
        default_factory=dict, description="ISO tarih -> gunluk CNS skoru"
    )
    cardio_summary: list[CardioSummaryItem] = Field(default_factory=list)


class WeeklyAnalysisResponse(BaseModel):
    user_id: str
    tier: str
    metrics: WeeklyMetrics
    analysis: CoachAnalysis


class WeeklyMetricsResponse(WeeklyMetrics):
    """GET /metrics/weekly yaniti: mobil dashboard grafik barlarini besler.

    WeeklyMetrics'in tum alanlarina ek olarak, mobilin tek bakista
    gosterecegi duzlestirilmis ozet alanlar icerir. Tamamen deterministiktir
    (AI maliyeti yoktur).
    """

    total_run_distance_km: float = Field(
        0.0, description="Son 7 gunde kosulan toplam mesafe (km)"
    )
    total_workouts: int = Field(0, description="Son 7 gundeki toplam idman sayisi")
