"""Pydantic v2 schemas: kimligi dogrulanmis kullanici profili."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

UserTier = Literal["free", "premium", "pro"]

Gender = Literal["male", "female", "other"]


class UserProfile(BaseModel):
    """JWT dogrulamasindan gecen istegin guvenli kullanici objesi."""

    user_id: str
    email: str
    tier: UserTier
    created_at: datetime | None = None
    # Kisisel bilgiler (profil ekrani; kural motoru kullanmaz)
    full_name: str | None = None
    age: int | None = None
    gender: Gender | None = None
    height_cm: int | None = None
    weight_kg: float | None = None


class UserProfileUpdate(BaseModel):
    """PATCH /users/me govdesi: yalnizca gonderilen alanlar guncellenir."""

    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str | None = Field(None, max_length=100)
    age: int | None = Field(None, ge=13, le=120)
    gender: Gender | None = None
    height_cm: int | None = Field(None, ge=100, le=250)
    weight_kg: float | None = Field(None, ge=30, le=300)
