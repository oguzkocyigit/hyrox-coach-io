"""Wearable senkron endpoint'leri (/api/v1/sync/*).

iOS HealthKit ve Android Health Connect istemcileri, cihazdan okuduklari
kardiyo aktivitelerini buraya toplu gonderir. Tamamen deterministiktir.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import get_current_user
from app.schemas.sync import HealthSyncRequest, HealthSyncResponse
from app.schemas.user import UserProfile
from app.services.health_sync import import_health_samples

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post(
    "/health",
    response_model=HealthSyncResponse,
    summary="HealthKit / Health Connect toplu kardiyo senkronu (idempotent)",
)
async def sync_health_data(
    payload: HealthSyncRequest,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> HealthSyncResponse:
    """Batch'teki her aktiviteyi idman olarak kaydeder.

    - Dedup: ayni `external_id` ikinci kez gonderilirse atlanir; istemci
      ayni batch'i guvenle tekrar gonderebilir (retry-safe).
    - RPE: `perceived_effort` verilmezse avg_hr'den deterministik turetilir.
    - Tek transaction: batch ya butunuyle islenir ya da hic islenmez.
    """
    return await import_health_samples(db, current_user.user_id, payload.samples)
