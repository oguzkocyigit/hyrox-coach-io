# HYROX Coach - Hybrid Performance Management System

Elit hibrit atletler ve HYROX yarismacilari icin veri odakli performans ve toparlanma yonetim sistemi. Detayli mimari icin [PROJE_BLUEPRINT.md](PROJE_BLUEPRINT.md), mobil uygulama plani icin [MOBILE_BLUEPRINT.md](MOBILE_BLUEPRINT.md).

## Proje Yapisi

```
app/
  core/
    config.py      # Pydantic Settings (env tabanli konfigurasyon)
    database.py    # Async SQLAlchemy engine + session dependency
db/
  init/
    001_extensions.sql       # pgcrypto, pgvector
    002_schema.sql           # Tablolar + enum + constraint'ler
    003_indexes.sql          # Kural motoru ve rate-limit indexleri
    004_seed_exercises.sql   # Egzersiz katalogu seed verisi
    005_health_sync.sql      # Wearable senkron dedup kolonu + index
scripts/
  init_db.py       # SQL init scriptlerini sirayla calistirir
```

## Kurulum

### 1. Bagimliliklar

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Supabase Baglanti Ayarlari

`.env.example` dosyasini `.env` olarak kopyalayin ve Supabase Dashboard'dan
(**Project Settings -> Database -> Connection String**) aldiginiz bilgilerle doldurun:

```bash
cp .env.example .env
```

Onemli notlar:

- **Session Pooler (port 5432)** onerilir; `DATABASE_URL` semasi `postgresql+asyncpg://` olmalidir.
- **Transaction Pooler (port 6543)** kullanacaksaniz `DB_USE_TRANSACTION_POOLER=true` yapin
  (PgBouncer transaction modu prepared statement desteklemedigi icin cache otomatik kapatilir).

### 3. Veritabani Initialization

Iki secenekten birini kullanin:

**A) Python runner ile (onerilen):**

```bash
python scripts/init_db.py
```

**B) Supabase SQL Editor ile:** `db/init/` altindaki dosyalari sirayla
(001 -> 004) SQL Editor'e yapistirip calistirin.

Tum scriptler **idempotent**'tir; tekrar calistirmak guvenlidir
(seed verisi `ON CONFLICT DO UPDATE` ile guncellenir).

## API Uclari

Tum uclar `/api/v1` oneklidir ve Supabase JWT (Bearer token) ile korunur.
Interaktif dokumantasyon: `http://localhost:8000/docs`

| Uc | Amac |
|---|---|
| `GET /users/me` | Profil + uyelik seviyesi (ilk login'de otomatik `free` profil) |
| `PATCH /users/me` | Kisisel bilgileri guncelle (ad, yas, cinsiyet, boy, kilo; kismi) |
| `DELETE /users/me` | Hesabi kalici sil: DB verisi + Supabase Auth kaydi (store zorunlulugu) |
| `GET /exercises` | Egzersiz katalogu (`?category=strength\|running\|hyrox`) |
| `POST /workouts` | Idman kaydi + aninda deterministik analiz (CNS, overload uyarisi) |
| `GET /workouts` | Sayfalanmis idman gecmisi (`limit`, `offset`), alt detaylarla |
| `DELETE /workouts/{id}` | Idmani sil (yalnizca sahibi, alt detaylar CASCADE) |
| `POST /sync/health` | HealthKit / Health Connect toplu kardiyo senkronu (idempotent) |
| `GET /metrics/weekly` | Dashboard paketi: CNS trendi, kas yukleri, kardiyo ozeti (AI'siz) |
| `POST /analysis/weekly` | AI koc notu (Gemini); tier bazli rate-limit uygulanir |
| `POST /templates` | Idman sablonu olustur (Standard/Circuit/EMOM/AMRAP/For Time) |
| `GET /templates` | Kullanicinin sablonlari (en yeni once) |
| `PUT /templates/{id}` | Sablonu guncelle (tam degisim) |
| `DELETE /templates/{id}` | Sablonu sil (plan girisleri CASCADE) |
| `POST /plan/generate` | AI Onboarding Wizard: profil + katalogdan kisisellestirilmis haftalik program (tier limitli: free 1 toplam, premium 3/hafta, pro 5/gun) |
| `GET /plan/week?start=` | Haftalik plan (start verilmezse bu haftanin pazartesisi) |
| `POST /plan/entries` | Sablonu bir gune ata (`position` ile ayni gun AM/PM) |
| `POST /plan/entries/{id}/complete` | Tamamlandi isaretle (`DELETE` ile geri al) |
| `DELETE /plan/entries/{id}` | Plan girisini kaldir (sablon durur) |
| `POST /webhooks/revenuecat` | RevenueCat abonelik olayi -> tier guncelleme (JWT degil, webhook secret ile korunur) |

Wearable senkronunda RPE gonderilmezse ortalama nabizdan deterministik
turetilir; ayni `external_id` ikinci kez gonderilirse sessizce atlanir.

## Testler

```bash
pip install -r requirements-dev.txt
pytest                                                    # tam paket (canli dev DB gerekir, ~3 dk)
pytest tests/test_analytics_unit.py tests/test_schemas.py # sadece birim testleri (~1 sn)
PYTEST_UNIT_ONLY=1 pytest tests/test_analytics_unit.py tests/test_schemas.py  # DB baglantisi olmadan (CI ile ayni)
```

- Auth testleri sahte HS256 token kullanir; Supabase Auth'a bagimlilik yoktur.
- Gemini cagrilari mock'lanir; testler API key'siz ve token maliyetsiz calisir.
- Entegrasyon testleri `pytest-` onekli kullanicilar olusturur ve oturum sonunda temizler.

## Deployment

### Docker

```bash
docker build -t hyrox-coach .
docker run --rm -p 8000:8000 --env-file .env hyrox-coach
```

Imaj multi-stage'dir, non-root kullanici ile calisir ve `/health` uzerinden
healthcheck icerir. Worker sayisi `WEB_CONCURRENCY` env'i ile ayarlanir.

### Railway / Fly.io

Her iki platform da repo kokundeki Dockerfile'i otomatik algilar:

- **Railway**: "New Project -> Deploy from GitHub repo" secin; Variables
  sekmesine `.env` icerigini girin (`DATABASE_URL`, `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, ...). `PORT` Railway tarafindan enjekte edilir.
- **Fly.io**: `fly launch` calistirin (Dockerfile'i algilar), secret'lari
  `fly secrets set DATABASE_URL=... GEMINI_API_KEY=...` ile tanimlayin.

### CI (GitHub Actions)

`.github/workflows/ci.yml` uc is kosar:

1. **unit-tests**: her push/PR'da, DB'siz hizli testler.
2. **integration-tests**: `main`'e push'ta, repo secret'lari (`DATABASE_URL`,
   `SUPABASE_URL`) tanimliysa tam paket.
3. **docker-build**: imajin derlenebildigini dogrular.

## Veritabani Semasi Ozeti

| Tablo | Amac |
|---|---|
| `user_profiles` | Kullanici + SaaS tier (`free` / `premium` / `pro`) |
| `exercises` | Egzersiz katalogu: `cns_load_factor` + `target_muscles` (JSONB) |
| `workout_logs` | Antrenman ana kaydi (RPE 1-10, sure) |
| `workout_exercise_details` | Kuvvet setleri (JSONB array) |
| `workout_cardio_details` | Kardiyo: mesafe, sure, `avg_hr`, kaynak (wearable/manuel) |
| `ai_usage_logs` | AI istek kayitlari (rate-limiting middleware sorgular) |
