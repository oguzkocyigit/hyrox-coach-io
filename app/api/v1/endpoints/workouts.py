"""Workout logging endpoint'leri.

Kayit + analiz tamamen deterministiktir (Bolum 4 kural motoru); AI cagrisi yoktur.
Kimlik, Supabase JWT (Bearer token) uzerinden get_current_user ile cozulur.

Not: Analitik fonksiyonlar kayitla ayni request/transaction icinde calisir
cunku sonuclari (warning_flag, overtraining_risk) API yanitinda donulmek
zorundadir; BackgroundTasks ile calistirilsalardi yanita dahil edilemezlerdi.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import get_current_user
from app.schemas.user import UserProfile
from app.schemas.workout import (
    MuscleWeeklyLoad,
    WorkoutCreate,
    WorkoutCreateResponse,
    WorkoutHistoryResponse,
    WorkoutSummary,
)
from app.services.analytics import (
    UnknownExerciseError,
    calculate_daily_cns_score,
    check_weekly_muscle_overload,
)
from app.services.workouts import fetch_workout_history, save_workout

router = APIRouter(prefix="/workouts", tags=["workouts"])

MAX_PAGE_SIZE = 50


@router.get(
    "",
    response_model=WorkoutHistoryResponse,
    summary="Idman gecmisini sayfalanmis olarak listele",
)
async def list_workouts(
    limit: int = Query(20, ge=1, le=MAX_PAGE_SIZE, description="Sayfa boyutu"),
    offset: int = Query(0, ge=0, description="Atlanacak kayit sayisi"),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> WorkoutHistoryResponse:
    """Kullanicinin gecmis idmanlarini alt detaylariyla (egzersiz setleri +
    kardiyo) en yeniden en eskiye dogru doner. Mobil sonsuz scroll icin
    limit/offset pagination ve total_count icerir.
    """
    page = await fetch_workout_history(db, current_user.user_id, limit, offset)
    return WorkoutHistoryResponse(
        items=page.items,
        total_count=page.total_count,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=WorkoutCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Idman kaydet ve deterministik analiz dondur",
)
async def log_workout(
    payload: WorkoutCreate,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> WorkoutCreateResponse:
    """Idmani iliskili tablolara tek transaction icinde kaydeder, ardindan:

    1. Gunluk CNS Skorunu hesaplar (Zone 2 kosu duzeltmesi dahil).
    2. Son 7 gunluk kumulatif kas grubu yuklerini tarar.
    3. Tavani (22 kaliteli set) asan kas gruplarini `overtraining_risk`
       olarak etiketler ve `warning_flag: true` doner.
    """
    try:
        # CNS hesabi exercise_id dogrulamasini da yapar; FK ihlaline dusmemek
        # icin kayittan ONCE calistirilir.
        daily_cns_score = await calculate_daily_cns_score(db, payload)
        saved = await save_workout(db, current_user.user_id, payload)
        # Haftalik tarama, ayni transaction'daki yeni insert'leri de gorur.
        overload = await check_weekly_muscle_overload(db, current_user.user_id)
    except UnknownExerciseError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    summary = WorkoutSummary(
        workout_log_id=saved.workout_log_id,
        workout_type=payload.workout_type,
        date=saved.date,
        duration_minutes=payload.duration_minutes,
        user_reported_rpe=payload.user_reported_rpe,
        total_strength_sets=sum(len(e.sets) for e in payload.exercises or []),
        cardio_distance_km=payload.cardio.distance_km if payload.cardio else None,
        calories_burned=payload.calories_burned,
    )

    return WorkoutCreateResponse(
        summary=summary,
        daily_cns_score=daily_cns_score,
        weekly_muscle_loads=[
            MuscleWeeklyLoad(
                muscle=muscle,
                weekly_load=load,
                overtraining_risk=muscle in overload.overtraining_risk,
            )
            for muscle, load in overload.weekly_loads.items()
        ],
        warning_flag=overload.warning_flag,
        overtraining_risk=overload.overtraining_risk,
    )


@router.delete(
    "/{workout_log_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Idmani sil (yalnizca sahibi)",
)
async def delete_workout(
    workout_log_id: UUID,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """Idmani ve alt detaylarini (CASCADE) siler.

    Sahiplik kontrolu sorguya gomuludur: baska kullanicinin idmani icin de
    404 doner, boylece kayit varligi sizdirilmaz.
    """
    result = await db.execute(
        text(
            "DELETE FROM workout_logs "
            "WHERE workout_log_id = :id AND user_id = :user_id "
            "RETURNING workout_log_id"
        ),
        {"id": workout_log_id, "user_id": current_user.user_id},
    )
    if result.scalar() is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="Idman bulunamadi."
        )
