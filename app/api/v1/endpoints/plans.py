"""Antrenman programi endpoint'leri: /templates (sablonlar) + /plan (haftalik plan)."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import get_current_user
from app.schemas.plans import (
    PlanEntryCreate,
    PlanEntryOut,
    WeekPlanResponse,
    WorkoutTemplateCreate,
    WorkoutTemplateOut,
)
from app.schemas.user import UserProfile
from app.services import plans as plan_service
from app.services.plans import PlanNotFoundError

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
