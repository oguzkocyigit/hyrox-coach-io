"""HealthKit / Health Connect toplu kardiyo senkron servisi.

Tamamen deterministiktir (AI yok). Her sample tek bir workout_logs kaydi +
workout_cardio_details satiri olarak yazilir. Dedup, (user_id, external_id)
unique partial index'i uzerinden ON CONFLICT ile saglanir; ayni batch'in
tekrar gonderilmesi guvenlidir (idempotent).
"""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.sync import HealthCardioSample, HealthSyncResponse
from app.schemas.workout import CardioType

# Mobil senkron kayitlarinda kullanilan idman tipi etiketleri
_WORKOUT_TYPE_BY_CARDIO: dict[CardioType, str] = {
    CardioType.RUNNING: "Synced Run",
    CardioType.ROWING: "Synced Row",
    CardioType.SKI_ERG: "Synced SkiErg",
}

# RPE turetme esikleri: wearable verisinde subjektif zorluk olmadigindan
# ortalama nabizdan deterministik bir tahmin yapilir.
_DEFAULT_RPE: float = 5.0
_RPE_BY_HR_CEILING: list[tuple[int, float]] = [
    (125, 3.0),  # avg_hr < 125 -> cok hafif
    (145, 4.0),  # Zone 2 bandi
    (160, 6.0),  # tempo
    (175, 8.0),  # esik ustu
]
_RPE_MAX_EFFORT: float = 9.0


def derive_rpe(sample: HealthCardioSample) -> float:
    """Sample icin efektif RPE: kullanici gonderdiyse onu, yoksa nabizdan turet."""
    if sample.perceived_effort is not None:
        return sample.perceived_effort
    if sample.avg_hr is None:
        return _DEFAULT_RPE
    for ceiling, rpe in _RPE_BY_HR_CEILING:
        if sample.avg_hr < ceiling:
            return rpe
    return _RPE_MAX_EFFORT


async def import_health_samples(
    db: AsyncSession, user_id: str, samples: list[HealthCardioSample]
) -> HealthSyncResponse:
    """Batch'i tek transaction icinde import eder; duplicate'lari atlar."""
    imported_ids: list[UUID] = []
    skipped = 0

    for sample in samples:
        result = await db.execute(
            text(
                """
                INSERT INTO workout_logs
                    (user_id, date, workout_type, user_reported_rpe,
                     duration_minutes, external_id)
                VALUES
                    (:user_id, :date, :workout_type, :rpe, :duration, :external_id)
                ON CONFLICT (user_id, external_id) WHERE external_id IS NOT NULL
                    DO NOTHING
                RETURNING workout_log_id
                """
            ),
            {
                "user_id": user_id,
                "date": sample.start_time,
                "workout_type": _WORKOUT_TYPE_BY_CARDIO[sample.cardio_type],
                "rpe": derive_rpe(sample),
                "duration": max(1, round(sample.duration_minutes)),
                "external_id": sample.external_id,
            },
        )
        workout_log_id = result.scalar()
        if workout_log_id is None:
            skipped += 1
            continue

        await db.execute(
            text(
                """
                INSERT INTO workout_cardio_details
                    (workout_log_id, cardio_type, distance_km, duration_minutes,
                     avg_hr, source)
                VALUES
                    (:log_id, :cardio_type, :distance_km, :duration_minutes,
                     :avg_hr, :source)
                """
            ),
            {
                "log_id": workout_log_id,
                "cardio_type": sample.cardio_type.value,
                "distance_km": sample.distance_km,
                "duration_minutes": sample.duration_minutes,
                "avg_hr": sample.avg_hr,
                "source": sample.source.value,
            },
        )
        imported_ids.append(workout_log_id)

    return HealthSyncResponse(
        imported=len(imported_ids),
        skipped_duplicates=skipped,
        workout_log_ids=imported_ids,
    )
