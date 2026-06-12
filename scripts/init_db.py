"""Veritabani initialization runner.

db/init/ klasorundeki SQL dosyalarini dosya adi sirasina gore
(001_, 002_, ...) Supabase PostgreSQL uzerinde calistirir.
Tum scriptler idempotent oldugu icin guvenle tekrar calistirilabilir.

Kullanim:
    python scripts/init_db.py
"""

import asyncio
import sys
from pathlib import Path

import asyncpg

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import get_settings  # noqa: E402

INIT_DIR = PROJECT_ROOT / "db" / "init"


def _asyncpg_dsn() -> str:
    """SQLAlchemy DSN'ini ('postgresql+asyncpg://') asyncpg formatina cevirir."""
    settings = get_settings()
    return str(settings.database_url).replace("postgresql+asyncpg://", "postgresql://", 1)


async def run_init_scripts() -> None:
    sql_files = sorted(INIT_DIR.glob("*.sql"))
    if not sql_files:
        print(f"HATA: {INIT_DIR} icinde SQL dosyasi bulunamadi.")
        sys.exit(1)

    settings = get_settings()
    conn = await asyncpg.connect(
        _asyncpg_dsn(),
        statement_cache_size=0 if settings.db_use_transaction_pooler else 100,
    )
    print(f"Baglanti kuruldu: {conn.get_server_version()}")

    try:
        for sql_file in sql_files:
            print(f"-> Calistiriliyor: {sql_file.name} ...", end=" ")
            sql = sql_file.read_text(encoding="utf-8")
            # Her dosya kendi transaction'i icinde calisir;
            # hata durumunda o dosyanin tamami rollback edilir.
            async with conn.transaction():
                await conn.execute(sql)
            print("OK")
        print("\nVeritabani initialization basariyla tamamlandi.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run_init_scripts())
