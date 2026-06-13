"""Deterministik Kural Motoru (PROJE_BLUEPRINT.md / Bolum 4).

Tum hesaplamalar saf Python matematigi ve SQL sorgulariyla yapilir.
Bu modulde KESINLIKLE LLM/AI cagrisi yapilmaz (sifir token maliyeti).
"""

from dataclasses import dataclass, field

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.analysis import CardioSummaryItem, WeeklyMetrics
from app.schemas.workout import CardioLog, CardioType, WorkoutCreate

# --- Bolum 4.A: Haftalik kas grubu toparlanma tavani (kaliteli set) ---
WEEKLY_VOLUME_CEILING: float = 22.0

# --- Bolum 4.B: Kardiyo Duzeltmesi (Cardio Modifier) ---
# Zone 2 kosusunda hatali yorgunluk siniflandirmasini onlemek icin
# cns_load_factor bu degere dusurulur.
ZONE2_RUNNING_CNS_FACTOR: float = 0.5

# Test asamasi icin sabit Zone 2 ust nabiz esigi (avg_hr < 145 => Zone 2).
# Ileride sporcunun bireysel esigi user_profiles uzerinden okunacak.
ZONE2_HR_THRESHOLD: int = 145

# Kardiyo bloklarinin taban CNS katsayilari (set kavrami olmadigi icin
# her kardiyo blogu 1 birim x katsayi olarak skora dahil edilir).
CARDIO_BASE_CNS_FACTORS: dict[CardioType, float] = {
    CardioType.RUNNING: 1.0,
    CardioType.ROWING: 0.8,
    CardioType.SKI_ERG: 0.8,
}


class UnknownExerciseError(Exception):
    """Payload'da exercises tablosunda bulunmayan exercise_id var."""

    def __init__(self, missing_ids: set[str]) -> None:
        self.missing_ids = missing_ids
        super().__init__(f"Bilinmeyen exercise_id degerleri: {sorted(missing_ids)}")


@dataclass(frozen=True)
class WeeklyOverloadReport:
    """check_weekly_muscle_overload ciktisi."""

    warning_flag: bool
    overtraining_risk: list[str]
    weekly_loads: dict[str, float] = field(default_factory=dict)


async def _fetch_cns_load_factors(
    db: AsyncSession, exercise_ids: list[str]
) -> dict[str, float]:
    """Egzersizlerin cns_load_factor degerlerini DB'den okur.

    Katalogda olmayan bir exercise_id varsa UnknownExerciseError firlatir.
    """
    if not exercise_ids:
        return {}

    result = await db.execute(
        text(
            "SELECT exercise_id, cns_load_factor "
            "FROM exercises WHERE exercise_id = ANY(:ids)"
        ),
        {"ids": exercise_ids},
    )
    factors = {row.exercise_id: row.cns_load_factor for row in result}

    missing = set(exercise_ids) - factors.keys()
    if missing:
        raise UnknownExerciseError(missing)
    return factors


def _effective_cardio_factor(cardio: CardioLog) -> float:
    """Kardiyo blogunun efektif CNS katsayisi (Zone 2 duzeltmesi dahil).

    Kritik Kural (Bolum 4.B): cardio_type == 'running' VE wearable'dan gelen
    avg_hr Zone 2 esiginin altindaysa (< 145) katsayi 0.5'e dusurulur.
    """
    base = CARDIO_BASE_CNS_FACTORS[cardio.cardio_type]
    if (
        cardio.cardio_type is CardioType.RUNNING
        and cardio.avg_hr is not None
        and cardio.avg_hr < ZONE2_HR_THRESHOLD
    ):
        return ZONE2_RUNNING_CNS_FACTOR
    return base


async def calculate_daily_cns_score(db: AsyncSession, workout: WorkoutCreate) -> float:
    """Bolum 4.B formulu:

    Gunluk CNS Skoru = ( SUM(set_sayisi x cns_load_factor) ) x (user_reported_rpe / 10)

    cns_load_factor degerleri exercises tablosundan okunur. Kardiyo blogu,
    set kavrami olmadigindan 1 birim x efektif katsayi olarak toplama dahil
    edilir (Zone 2 kosu duzeltmesi uygulanir).
    """
    exercises = workout.exercises or []
    factors = await _fetch_cns_load_factors(db, [e.exercise_id for e in exercises])

    strength_load = sum(
        len(detail.sets) * factors[detail.exercise_id] for detail in exercises
    )
    cardio_load = (
        _effective_cardio_factor(workout.cardio) if workout.cardio is not None else 0.0
    )

    total_load = strength_load + cardio_load
    return round(total_load * (workout.user_reported_rpe / 10.0), 2)


async def check_weekly_muscle_overload(
    db: AsyncSession, user_id: str
) -> WeeklyOverloadReport:
    """Bolum 4.A: son 7 gundeki kumulatif kas grubu yukunu hesaplar.

    Haftalik Kas Yuku = SUM(atilan set sayisi x kas katsayisi)

    target_muscles JSONB'si LATERAL jsonb_each_text ile acilir; hesap tamamen
    DB tarafinda yapilir. Ayni transaction icindeki (henuz commit edilmemis)
    yeni idman kayitlari da sorguya dahildir.

    Herhangi bir kas grubu icin yuk > 22 ise warning_flag=True doner ve
    ilgili kaslar overtraining_risk listesinde etiketlenir.
    """
    result = await db.execute(
        text(
            """
            SELECT m.key AS muscle,
                   SUM(jsonb_array_length(d.sets) * (m.value)::float) AS weekly_load
            FROM workout_exercise_details d
            JOIN workout_logs w ON w.workout_log_id = d.workout_log_id
            JOIN exercises e    ON e.exercise_id = d.exercise_id
            CROSS JOIN LATERAL jsonb_each_text(e.target_muscles) AS m(key, value)
            WHERE w.user_id = :user_id
              AND w.date >= now() - interval '7 days'
            GROUP BY m.key
            ORDER BY weekly_load DESC
            """
        ),
        {"user_id": user_id},
    )
    weekly_loads = {row.muscle: round(row.weekly_load, 2) for row in result}

    at_risk = sorted(
        muscle
        for muscle, load in weekly_loads.items()
        if load > WEEKLY_VOLUME_CEILING
    )
    return WeeklyOverloadReport(
        warning_flag=len(at_risk) > 0,
        overtraining_risk=at_risk,
        weekly_loads=weekly_loads,
    )


async def _fetch_daily_cns_scores(db: AsyncSession, user_id: str) -> dict[str, float]:
    """Son 7 gunun gun bazli CNS skorlari (kuvvet + kardiyo, Zone 2 dahil).

    Bolum 4.B formulu SQL tarafinda uygulanir; kardiyo bloklari blok basina
    1 birim x efektif katsayi olarak hesaba katilir.
    """
    result = await db.execute(
        text(
            """
            WITH strength AS (
                SELECT w.date::date AS day,
                       SUM(jsonb_array_length(d.sets) * e.cns_load_factor
                           * (w.user_reported_rpe / 10.0)) AS cns
                FROM workout_logs w
                JOIN workout_exercise_details d ON d.workout_log_id = w.workout_log_id
                JOIN exercises e ON e.exercise_id = d.exercise_id
                WHERE w.user_id = :user_id
                  AND w.date >= now() - interval '7 days'
                GROUP BY w.date::date
            ),
            cardio AS (
                SELECT w.date::date AS day,
                       SUM(
                           CASE
                               WHEN c.cardio_type = 'running'
                                    AND c.avg_hr IS NOT NULL
                                    AND c.avg_hr < CAST(:zone2_threshold AS int)
                                   THEN CAST(:zone2_factor AS float)
                               WHEN c.cardio_type = 'running' THEN CAST(:running_factor AS float)
                               ELSE CAST(:erg_factor AS float)
                           END * (w.user_reported_rpe / 10.0)
                       ) AS cns
                FROM workout_logs w
                JOIN workout_cardio_details c ON c.workout_log_id = w.workout_log_id
                WHERE w.user_id = :user_id
                  AND w.date >= now() - interval '7 days'
                GROUP BY w.date::date
            )
            SELECT COALESCE(s.day, c.day) AS day,
                   COALESCE(s.cns, 0) + COALESCE(c.cns, 0) AS cns
            FROM strength s
            FULL OUTER JOIN cardio c ON c.day = s.day
            ORDER BY day
            """
        ),
        {
            "user_id": user_id,
            "zone2_threshold": ZONE2_HR_THRESHOLD,
            "zone2_factor": ZONE2_RUNNING_CNS_FACTOR,
            "running_factor": CARDIO_BASE_CNS_FACTORS[CardioType.RUNNING],
            "erg_factor": CARDIO_BASE_CNS_FACTORS[CardioType.ROWING],
        },
    )
    return {row.day.isoformat(): round(row.cns, 2) for row in result}


async def _fetch_cardio_summary(
    db: AsyncSession, user_id: str
) -> list[CardioSummaryItem]:
    """Son 7 gunun kardiyo ozeti: tip bazinda mesafe, sure, pace ve ortalama nabiz."""
    result = await db.execute(
        text(
            """
            SELECT c.cardio_type,
                   count(*)                  AS sessions,
                   SUM(c.distance_km)        AS total_distance_km,
                   SUM(c.duration_minutes)   AS total_duration_minutes,
                   AVG(c.avg_hr)             AS avg_hr
            FROM workout_logs w
            JOIN workout_cardio_details c ON c.workout_log_id = w.workout_log_id
            WHERE w.user_id = :user_id
              AND w.date >= now() - interval '7 days'
            GROUP BY c.cardio_type
            ORDER BY total_distance_km DESC
            """
        ),
        {"user_id": user_id},
    )
    summary: list[CardioSummaryItem] = []
    for row in result:
        pace = (
            round(row.total_duration_minutes / row.total_distance_km, 2)
            if row.total_distance_km and row.total_distance_km > 0
            else None
        )
        summary.append(
            CardioSummaryItem(
                cardio_type=row.cardio_type,
                sessions=row.sessions,
                total_distance_km=round(row.total_distance_km, 2),
                total_duration_minutes=round(row.total_duration_minutes, 1),
                avg_pace_min_per_km=pace,
                avg_hr=round(row.avg_hr, 1) if row.avg_hr is not None else None,
            )
        )
    return summary


async def fetch_weekly_workout_logs(
    db: AsyncSession, user_id: str
) -> list[dict[str, object]]:
    """Son 7 gunluk idman kayitlari (Pazar degerlendirmesi icin AI girdisi)."""
    result = await db.execute(
        text(
            """
            SELECT workout_log_id,
                   date,
                   workout_type,
                   user_reported_rpe,
                   duration_minutes,
                   journal_notes
            FROM workout_logs
            WHERE user_id = :user_id
              AND date >= now() - interval '7 days'
            ORDER BY date ASC
            """
        ),
        {"user_id": user_id},
    )
    return [
        {
            "workout_log_id": str(row.workout_log_id),
            "date": row.date.isoformat(),
            "workout_type": row.workout_type,
            "user_reported_rpe": float(row.user_reported_rpe),
            "duration_minutes": row.duration_minutes,
            "journal_notes": row.journal_notes,
        }
        for row in result
    ]


async def fetch_weekly_plan_compliance(db: AsyncSession, user_id: str) -> dict[str, int]:
    """Son 7 gun (bugun dahil) planlanan vs tamamlanan idman sayisi."""
    result = await db.execute(
        text(
            """
            SELECT count(*)::int AS planned,
                   count(completed_at)::int AS completed
            FROM plan_entries
            WHERE user_id = :user_id
              AND scheduled_date >= (current_date - interval '6 days')
              AND scheduled_date <= current_date
            """
        ),
        {"user_id": user_id},
    )
    row = result.one()
    return {"planned": row.planned, "completed": row.completed}


async def build_weekly_metrics(db: AsyncSession, user_id: str) -> WeeklyMetrics:
    """AI analiz katmanina girdi olacak haftalik metrik paketini uretir.

    Tamamen deterministiktir; AI yalnizca bu hazir metrikleri yorumlar
    (Bolum 6 / .cursorrules: hesaplamalar icin LLM kullanilmaz).
    """
    overload = await check_weekly_muscle_overload(db, user_id)
    daily_cns = await _fetch_daily_cns_scores(db, user_id)
    cardio = await _fetch_cardio_summary(db, user_id)

    return WeeklyMetrics(
        weekly_muscle_loads=overload.weekly_loads,
        warning_flag=overload.warning_flag,
        overtraining_risk=overload.overtraining_risk,
        daily_cns_scores=daily_cns,
        cardio_summary=cardio,
    )
