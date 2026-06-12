"""Antrenman programi endpoint'leri: /templates (sablonlar) + /plan (haftalik plan)."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import get_current_user
from app.schemas.onboarding import GeneratedWeekPlan, OnboardingPayload
from app.schemas.plans import (
    PlanEntryCreate,
    PlanEntryOut,
    WeekPlanResponse,
    WorkoutTemplateCreate,
    WorkoutTemplateOut,
)
from app.schemas.user import UserProfile
from app.services import plans as plan_service
from app.services.ai_coach import (
    AIServiceNotConfiguredError,
    generate_onboarding_plan,
)
from app.services.plans import PlanNotFoundError
from app.services.rate_limit import (
    PLAN_GENERATE_ENDPOINT,
    enforce_plan_generation_limit,
    record_ai_usage,
)

router = APIRouter(tags=["plans"])

_NOT_FOUND = HTTPException(status.HTTP_404_NOT_FOUND, detail="Kayit bulunamadi.")


# ---------------------------------------------------------------
# Idman sablonlari (Build Workout)
# ---------------------------------------------------------------
@router.post(
    "/templates",
    response_model=WorkoutTemplateOut,
    status_code=status.HTTP_201_CREATED,
    summary="Idman sablonu olustur",
)
async def create_template(
    payload: WorkoutTemplateCreate,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> WorkoutTemplateOut:
    return await plan_service.create_template(db, current_user.user_id, payload)


@router.get(
    "/templates",
    response_model=list[WorkoutTemplateOut],
    summary="Kullanicinin sablonlarini listele (en yeni once)",
)
async def list_templates(
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[WorkoutTemplateOut]:
    return await plan_service.list_templates(db, current_user.user_id)


@router.put(
    "/templates/{template_id}",
    response_model=WorkoutTemplateOut,
    summary="Sablonu guncelle (tam degisim)",
)
async def update_template(
    template_id: UUID,
    payload: WorkoutTemplateCreate,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> WorkoutTemplateOut:
    try:
        return await plan_service.update_template(
            db, current_user.user_id, template_id, payload
        )
    except PlanNotFoundError:
        raise _NOT_FOUND


@router.delete(
    "/templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sablonu sil (plana atanmis girisleri de CASCADE silinir)",
)
async def delete_template(
    template_id: UUID,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    try:
        await plan_service.delete_template(db, current_user.user_id, template_id)
    except PlanNotFoundError:
        raise _NOT_FOUND


# ---------------------------------------------------------------
# AI Onboarding Wizard: kisisellestirilmis haftalik plan uretimi
# ---------------------------------------------------------------
@router.post(
    "/plan/generate",
    response_model=GeneratedWeekPlan,
    summary="AI ile kisisellestirilmis haftalik program uret (tier limitli)",
)
async def generate_plan(
    payload: OnboardingPayload,
    current_user: UserProfile = Depends(enforce_plan_generation_limit),
    db: AsyncSession = Depends(get_db_session),
) -> GeneratedWeekPlan:
    """Onboarding cevaplarini Gemini'ye besler, haftalik program doner.

    - Egzersiz katalogu (exercise_id + CNS faktorleri) prompt'a verilir;
      AI yalnizca mevcut kimlikleri secer, hicbir metrik hesaplamaz.
    - AI'in dondurdugu bilinmeyen exercise_id'ler null'a cevrilir (isim kalir).
    - Kota yalnizca BASARILI uretimden sonra tuketilir.
    - Plan istemcide onizlenir; kullanici onaylarsa mevcut /templates +
      /plan/entries uclariyla kaydedilir (bu uc DB'ye yazmaz).
    """
    catalog = await plan_service.fetch_exercise_catalog(db)

    try:
        plan = await generate_onboarding_plan(payload, catalog)
    except AIServiceNotConfiguredError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="AI gecerli bir plan uretemedi. Lutfen tekrar dene.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    valid_ids = {item["id"] for item in catalog}
    for day in plan.days:
        for exercise in day.template.exercises:
            if exercise.exercise_id and exercise.exercise_id not in valid_ids:
                exercise.exercise_id = None

    await record_ai_usage(db, current_user.user_id, PLAN_GENERATE_ENDPOINT)
    return plan


# ---------------------------------------------------------------
# Haftalik plan
# ---------------------------------------------------------------
@router.get(
    "/plan/week",
    response_model=WeekPlanResponse,
    summary="Haftalik plani getir (start verilmezse bu haftanin pazartesisi)",
)
async def get_week_plan(
    start: date | None = Query(None, description="Hafta baslangici (YYYY-MM-DD)"),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> WeekPlanResponse:
    return await plan_service.get_week_plan(db, current_user.user_id, start)


@router.post(
    "/plan/entries",
    response_model=PlanEntryOut,
    status_code=status.HTTP_201_CREATED,
    summary="Sablonu bir gune ata",
)
async def schedule_entry(
    payload: PlanEntryCreate,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> PlanEntryOut:
    try:
        return await plan_service.schedule_entry(db, current_user.user_id, payload)
    except PlanNotFoundError:
        raise _NOT_FOUND


@router.post(
    "/plan/entries/{entry_id}/complete",
    response_model=PlanEntryOut,
    summary="Plan girisini tamamlandi olarak isaretle",
)
async def complete_entry(
    entry_id: UUID,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> PlanEntryOut:
    try:
        return await plan_service.set_entry_completion(
            db, current_user.user_id, entry_id, completed=True
        )
    except PlanNotFoundError:
        raise _NOT_FOUND


@router.delete(
    "/plan/entries/{entry_id}/complete",
    response_model=PlanEntryOut,
    summary="Tamamlandi isaretini kaldir",
)
async def uncomplete_entry(
    entry_id: UUID,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> PlanEntryOut:
    try:
        return await plan_service.set_entry_completion(
            db, current_user.user_id, entry_id, completed=False
        )
    except PlanNotFoundError:
        raise _NOT_FOUND


@router.delete(
    "/plan/entries/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Plan girisini kaldir (sablon silinmez)",
)
async def delete_entry(
    entry_id: UUID,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    try:
        await plan_service.delete_entry(db, current_user.user_id, entry_id)
    except PlanNotFoundError:
        raise _NOT_FOUND
