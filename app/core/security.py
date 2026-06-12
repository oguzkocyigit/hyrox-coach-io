"""Supabase JWT Auth dogrulama katmani.

Akis:
1. Authorization: Bearer <token> basligi HTTPBearer semasi ile okunur.
2. Token imzasi dogrulanir (aud='authenticated' zorunlu):
   - ES256 (yeni nesil Supabase "JWT Signing Keys"): public key,
     {SUPABASE_URL}/auth/v1/.well-known/jwks.json adresinden cekilir ve
     bellekte cache'lenir.
   - HS256 (legacy): SUPABASE_JWT_SECRET ile dogrulanir.
3. Token'daki `sub` (Supabase Auth user UUID) ile user_profiles tablosundan
   profil + tier cekilir. Profil yoksa otomatik olarak 'free' tier ile
   olusturulur (Auto-sync profiles).
4. Token eksik/gecersiz/suresi dolmussa HTTP 401 Unauthorized firlatilir.
"""

import time

import httpx
import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db_session
from app.schemas.user import UserProfile

# auto_error=False: eksik header'da FastAPI'nin varsayilan 403'u yerine
# spesifikasyona uygun 401 donebilmek icin hatayi kendimiz yonetiyoruz.
_bearer_scheme = HTTPBearer(auto_error=False)

SUPABASE_JWT_AUDIENCE = "authenticated"


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


# --- JWKS cache (ES256 / yeni nesil Supabase imzalama anahtarlari) ---
_JWKS_TTL_SECONDS: int = 3600
_jwks_keys: dict[str, jwt.PyJWK] = {}
_jwks_fetched_at: float = 0.0


async def _get_jwks_key(kid: str) -> jwt.PyJWK:
    """JWKS endpoint'inden public key'i ceker; 1 saat bellekte cache'ler."""
    global _jwks_fetched_at

    stale = (time.monotonic() - _jwks_fetched_at) > _JWKS_TTL_SECONDS
    if kid not in _jwks_keys or stale:
        settings = get_settings()
        if not settings.supabase_url:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="SUPABASE_URL tanimli degil; JWKS dogrulamasi yapilamiyor.",
            )
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
            )
            response.raise_for_status()
        _jwks_keys.clear()
        for key_data in response.json().get("keys", []):
            _jwks_keys[key_data["kid"]] = jwt.PyJWK(key_data)
        _jwks_fetched_at = time.monotonic()

    key = _jwks_keys.get(kid)
    if key is None:
        raise _unauthorized("Token, bilinmeyen bir imza anahtari ile imzalanmis.")
    return key


async def decode_supabase_token(token: str) -> dict:
    """JWT imzasini dogrular ve claim'leri doner. Gecersizse 401 firlatir.

    Token header'indaki algoritmaya gore ES256 (JWKS) veya HS256 (legacy
    secret) dogrulamasi secilir.
    """
    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError as exc:
        raise _unauthorized("Gecersiz kimlik dogrulama token'i.") from exc

    algorithm: str = header.get("alg", "")
    if algorithm == "ES256":
        signing_key = (await _get_jwks_key(header.get("kid", ""))).key
    elif algorithm == "HS256":
        settings = get_settings()
        if not settings.supabase_jwt_secret:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="SUPABASE_JWT_SECRET tanimli degil. .env dosyasina ekleyin.",
            )
        signing_key = settings.supabase_jwt_secret
    else:
        raise _unauthorized(f"Desteklenmeyen imza algoritmasi: {algorithm or 'yok'}")

    try:
        return jwt.decode(
            token,
            signing_key,
            algorithms=[algorithm],
            audience=SUPABASE_JWT_AUDIENCE,
            options={"require": ["sub", "exp"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise _unauthorized("Token suresi dolmus. Lutfen yeniden giris yapin.") from exc
    except jwt.InvalidTokenError as exc:
        raise _unauthorized("Gecersiz kimlik dogrulama token'i.") from exc


async def _fetch_or_create_profile(
    db: AsyncSession, user_id: str, email: str
) -> UserProfile:
    """Profili ceker; yoksa 'free' tier ile olusturur (Auto-sync profiles)."""
    result = await db.execute(
        text(
            "SELECT user_id, email, tier, created_at, "
            "       full_name, age, gender, height_cm, weight_kg "
            "FROM user_profiles WHERE user_id = :user_id"
        ),
        {"user_id": user_id},
    )
    row = result.one_or_none()
    if row is not None:
        return _row_to_profile(row)

    # Supabase'e yeni uye olmus kullanici: free tier ile otomatik kayit.
    # ON CONFLICT, es zamanli ilk isteklerdeki yaris durumunu guvenle cozer.
    result = await db.execute(
        text(
            """
            INSERT INTO user_profiles (user_id, email, tier)
            VALUES (:user_id, :email, 'free')
            ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
            RETURNING user_id, email, tier, created_at,
                      full_name, age, gender, height_cm, weight_kg
            """
        ),
        {"user_id": user_id, "email": email},
    )
    return _row_to_profile(result.one())


def _row_to_profile(row) -> UserProfile:
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


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer_scheme),
    db: AsyncSession = Depends(get_db_session),
) -> UserProfile:
    """FastAPI dependency: Bearer JWT dogrulamasi + profil cozumleme.

    Kullanim:
        @router.post("/...")
        async def handler(current_user: UserProfile = Depends(get_current_user)): ...
    """
    if credentials is None:
        raise _unauthorized("Authorization basligi eksik. Bearer token gereklidir.")

    claims = await decode_supabase_token(credentials.credentials)
    user_id: str = claims["sub"]
    # Supabase access token'larinda email claim'i bulunur; yoksa placeholder.
    email: str = claims.get("email") or f"{user_id}@no-email.supabase"

    return await _fetch_or_create_profile(db, user_id, email)
