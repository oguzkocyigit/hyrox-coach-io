"""Kullanici endpoint'leri (/api/v1/users/*)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import get_current_user
from app.schemas.user import UserProfile, UserProfileUpdate
from app.services.account import AccountServiceNotConfiguredError, delete_account

router = APIRouter(prefix="/users", tags=["users"])

# UserProfileUpdate alani -> user_profiles kolonu (birebir ayni adlar)
_UPDATABLE_FIELDS = ("full_name", "age", "gender", "height_cm", "weight_kg")


@router.get(
    "/me",
    response_model=UserProfile,
    summary="Dogrulanmis kullanicinin profili ve uyelik seviyesi",
)
async def read_current_user(
    current_user: UserProfile = Depends(get_current_user),
) -> UserProfile:
    """Mobil uygulamanin acilista cektigi profil paketi (tier dahil).

    Ilk kez gelen Supabase uyeleri icin profil, auth katmaninda otomatik
    olusturulur (free tier); bu uc ayrica bir kayit islemi yapmaz.
    """
    return current_user


@router.patch(
    "/me",
    response_model=UserProfile,
    summary="Kisisel profil bilgilerini guncelle (kismi)",
)
async def update_current_user(
    payload: UserProfileUpdate,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> UserProfile:
    """Yalnizca govdede gonderilen alanlar guncellenir (partial update).

    Bu alanlar profil ekrani icindir; deterministik kural motoru
    bu verileri kullanmaz.
    """
    updates = payload.model_dump(exclude_unset=True)
    fields = {k: v for k, v in updates.items() if k in _UPDATABLE_FIELDS}
    if not fields:
        return current_user

    set_clause = ", ".join(f"{name} = :{name}" for name in fields)
    result = await db.execute(
        text(
            f"""
            UPDATE user_profiles
            SET {set_clause}
            WHERE user_id = :user_id
            RETURNING user_id, email, tier, created_at,
                      full_name, age, gender, height_cm, weight_kg
            """
        ),
        {**fields, "user_id": current_user.user_id},
    )
    row = result.one()
    return UserProfile(
        user_id=row.user_id,
        email=row.email,
        tier=row.tier,
        created_at=row.created_at,
        full_name=row.full_name,
        age=row.age,
        gender=row.gender,
        height_cm=row.height_cm,
        weight_kg=float(row.weight_kg) if row.weight_kg is not None else None,
    )


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Hesabi ve tum veriyi kalici olarak sil",
)
async def delete_current_user(
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """Hesap silme (App Store / Play Store zorunlulugu).

    - Profil, idmanlar, alt detaylar ve AI kullanim kayitlari DB'den
      CASCADE ile silinir.
    - Supabase Auth kullanicisi admin API ile silinir; kullanici yeni
      token alamaz. Eldeki token suresi dolana kadar teknik olarak
      gecerlidir; istemci silme sonrasi local oturumu kapatmalidir.
    """
    try:
        await delete_account(db, current_user.user_id)
    except AccountServiceNotConfiguredError:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Hesap silme servisi yapilandirilmamis "
                "(SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY eksik)."
            ),
        )
