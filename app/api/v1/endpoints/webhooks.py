"""Dis servis webhook'lari (/api/v1/webhooks/*).

RevenueCat webhook'u: abonelik olaylarina gore user_profiles.tier gunceller
(MOBILE_BLUEPRINT Bolum 8, Faz 3). Bu uclar Supabase JWT ile DEGIL,
RevenueCat panelinde tanimlanan sabit Authorization header'i ile korunur.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db_session

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Tier kazandiran olaylar: aktif erisim hakki dogurur
_GRANT_EVENTS = {
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
    "NON_RENEWING_PURCHASE",
}
# Erisimi sonlandiran olaylar (CANCELLATION degil: iptal edilse de donem sonuna
# kadar erisim surer; dususu EXPIRATION olayi yapar)
_REVOKE_EVENTS = {"EXPIRATION"}


class RevenueCatEvent(BaseModel):
    """RevenueCat webhook 'event' govdesinin kullandigimiz alt kumesi."""

    type: str = Field(..., examples=["INITIAL_PURCHASE"])
    app_user_id: str | None = None
    entitlement_ids: list[str] | None = None


class RevenueCatWebhookPayload(BaseModel):
    api_version: str | None = None
    event: RevenueCatEvent


class WebhookResult(BaseModel):
    status: str = Field(..., examples=["updated", "ignored", "user_not_found"])
    event_type: str
    tier: str | None = None


def _tier_from_entitlements(entitlement_ids: list[str] | None) -> str:
    """RevenueCat entitlement kimliklerini uygulama tier'ina cevirir.

    Entitlement adlari RevenueCat panelinde 'premium' ve 'pro' olarak
    tanimlanmalidir. Ikisi birden varsa yuksek olan (pro) kazanir.
    """
    ids = {e.strip().lower() for e in entitlement_ids or []}
    if "pro" in ids:
        return "pro"
    if "premium" in ids:
        return "premium"
    return "free"


@router.post(
    "/revenuecat",
    response_model=WebhookResult,
    summary="RevenueCat abonelik olayi (tier guncelleme)",
)
async def revenuecat_webhook(
    payload: RevenueCatWebhookPayload,
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db_session),
) -> WebhookResult:
    """Abonelik olayina gore kullanicinin tier'ini gunceller.

    - Satin alma / yenileme -> entitlement'tan tier (premium/pro)
    - EXPIRATION -> free
    - Diger olaylar (CANCELLATION, BILLING_ISSUE, TEST...) -> degisiklik yok

    Bilinmeyen kullanicida 200 doner (RevenueCat 2xx disinda retry yapar;
    silinmis hesap icin sonsuz retry istemeyiz).
    """
    secret = get_settings().revenuecat_webhook_secret
    if not secret:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RevenueCat webhook yapilandirilmamis (REVENUECAT_WEBHOOK_SECRET).",
        )
    if authorization not in (secret, f"Bearer {secret}"):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Gecersiz webhook kimligi.",
        )

    event = payload.event

    if event.type in _GRANT_EVENTS:
        new_tier = _tier_from_entitlements(event.entitlement_ids)
    elif event.type in _REVOKE_EVENTS:
        new_tier = "free"
    else:
        return WebhookResult(status="ignored", event_type=event.type)

    if not event.app_user_id:
        return WebhookResult(status="ignored", event_type=event.type)

    result = await db.execute(
        text(
            "UPDATE user_profiles SET tier = :tier "
            "WHERE user_id = :user_id RETURNING user_id"
        ),
        {"tier": new_tier, "user_id": event.app_user_id},
    )
    updated = result.scalar_one_or_none()

    return WebhookResult(
        status="updated" if updated else "user_not_found",
        event_type=event.type,
        tier=new_tier,
    )
