# HYROX Coach — Geliştirme Özeti

Bu döküman, projenin ilk kurulumundan bu yana yapılan önemli geliştirmeleri, mimari kararları ve mevcut durumu özetler. Son güncelleme: **12 Haziran 2026**.

---

## 1. Proje Özeti

**HYROX Coach**, hibrit atletler ve HYROX yarışmacıları için veri odaklı performans yönetim sistemidir.

| Katman | Teknoloji |
|--------|-----------|
| Backend | Python 3.11+ / FastAPI (async) |
| Veritabanı | PostgreSQL (Supabase) |
| AI | Google Gemini 2.5 Flash Lite |
| Mobil | Expo / React Native (TypeScript) |
| Deploy | Render (`render.yaml`, Singapore bölgesi) |

Temel mimari kural: **Günlük idman kaydı, hacim ve CNS hesapları deterministiktir** — LLM yalnızca haftalık/aylık analiz, program üretimi ve RAG işlemlerinde kullanılır.

---

## 2. Backend Geliştirmeleri

### 2.1 Onboarding API şeması (`app/schemas/onboarding.py`)

Mobil sihirbazın gönderdiği `OnboardingPayload` genişletildi ve yeniden yapılandırıldı:

| Alan | Açıklama |
|------|----------|
| `goal` | 5 hedef: `strength`, `conditioning`, `hyrox`, `hybrid`, `crossfit` |
| `training_days` / `running_days` | Salon ve koşu günleri (0=Pzt … 6=Paz) |
| `split_run_and_gym` | Aynı günde koşu + salon ayrı seans mı? |
| `gym_preferred_start/end` | Salon tercih saat aralığı (`HH:MM`) — eski `time_of_day` / `time_window` kaldırıldı |
| `run_preferred_start/end` | Koşu tercih saat aralığı |
| `gym_fed_state` / `run_fed_state` | `fed` / `fasted` / `flexible` |
| `gym_duration_minutes` | Salon penceresi (dk) — **bitiş − başlangıç** ile türetilir (30–240 dk) |
| `run_duration_minutes` | Koşu penceresi (dk) — **bitiş − başlangıç** ile türetilir (20–180 dk) |
| `custom_program_notes` | Opsiyonel serbest metin (max 1500 karakter) — AI'a yüksek öncelikli talimat |

Şema doğrulayıcıları: saat formatı (`HH:MM`), `custom_program_notes` trim/boş normalizasyonu.

### 2.2 AI Koç katmanı (`app/services/ai_coach.py`)

Gemini ile program üretimi için genişletilmiş sistem talimatları:

- **Hedef bazlı programlama** — güç, kondisyon, HYROX, hibrit, CrossFit ağırlıkları
- **Zamanlama** — tercih edilen saat pencereleri ve fed/fasted durumuna göre seans içeriği
- **Süre kuralı** — `gym_duration_minutes` / `run_duration_minutes` = tercih edilen saat aralığı; AI toplam işi bu pencereye ölçekler
- **HYROX / circuit kuralları** — istasyon formatı (`circuit` / `for_time`), her hareket `sets=1`, tur sayısı `template.rounds` ile
- **Özel istekler (kural 12)** — `custom_program_notes` gün bazlı veya genel program talimatı olarak işlenir
- **Türkçe çıktı** — `coach_summary`, gün `focus` metinleri ve egzersiz talimatları

Diğer AI uçları: tek günlük seans üretimi, şablon düzenleme (`ModifyAI`), egzersiz önerisi.

### 2.3 Plan coercion (`app/services/plan_coercion.py`)

AI çıktısını güvenli şablona dönüştüren katman:

- **İstasyon normalizasyonu** — HYROX/metcon şablonlarında hareketler `sets=1`, `rest_seconds=0`
- **Format düzeltme** — conditioning tiplerinde `standard` → `circuit` dönüşümü
- **Tur çıkarımı** — `_infer_rounds_from_duration`: süre hedefine göre `rounds` hesaplama
- **Süre ölçekleme** — `scale_template_to_duration` ile hedef dakikaya uyum
- **Format bazlı varsayılan set sayıları** — `standard`, `circuit`, `emom`, `amrap`, `for_time`

### 2.4 İdman kaydı şeması (`app/schemas/workout.py`)

- Set bazında opsiyonel **`rpe`** alanı
- Varsayılan **`user_reported_rpe`** = 7

### 2.5 CI ve test altyapısı

**Sorun:** CI birim testleri Postgres'e bağlanmaya çalışıyor, oturum sonunda event loop hatası veriyordu.

**Çözüm:**
- `tests/conftest.py`: `PYTEST_UNIT_ONLY=1` ortam değişkeni ile DB fixture'ları devre dışı
- `.github/workflows/ci.yml`: birim test job'unda `PYTEST_UNIT_ONLY: "1"` set edildi
- Entegrasyon testleri ayrı job'da canlı Supabase'e karşı çalışır (secret'lar tanımlıysa)

**Test güncellemeleri:** `tests/test_plan_generate.py` payload'ı yeni saat aralığı + türetilmiş sürelerle uyumlu (ör. 17:00–20:00 → 180 dk salon, 06:00–08:00 → 120 dk koşu).

### 2.6 Deploy

- `render.yaml`: `autoDeploy: true` — `main` branch push'unda otomatik deploy
- Bölge: Singapore (Supabase `ap-southeast-1` ile uyumlu)
- Free plan uyku modu notu dokümante edildi

---

## 3. Mobil Geliştirmeleri

### 3.1 Onboarding sihirbazı (9 adım)

Dosyalar: `mobile/src/app/onboarding.tsx`, `store.ts`, `options.ts`, `SessionScheduleCard.tsx`, `timeUtils.ts`

| Adım | Başlık | İçerik |
|------|--------|--------|
| 1 | Hedefin ne? | 5 hedef kartı (Güç, Kondisyon, Hyrox, Hibrit, Crossfit) |
| 2 | Kardiyo kapasiten | 5K tempo slider + Zone 2 alışkanlığı |
| 3 | Hareket kapasiten | Sled deneyimi + Olympic proficiency |
| 4 | Haftalık takvim | Salon günleri, koşu isteği, koşu günleri |
| 5 | Zamanlama | Salon/koşu **saat aralığı** (başlangıç–bitiş chip'leri); aynı gün çakışmada split seçimi |
| 6 | Beslenme tercihleri | Salon/koşu için fed/fasted/flexible + beslenme kısıtları |
| 7 | Takvim ve toparlanma | Hafta sonu kondisyon tercihi |
| 8 | Ekipman | full_box / standard_gym / minimal |
| 9 | Özel isteklerin var mı? | Serbest metin (`customProgramNotes`, max 1500) |

**Zamanlama UX (son güncelleme):**
- Ayrı süre slider'ı **kaldırıldı** — süre otomatik: `bitiş − başlangıç`
- Kart başlığında: `06:00 – 08:00 · ~120 dk`
- Minimum pencere: salon 30 dk, koşu 20 dk
- Başlangıç değişince bitiş otomatik kaydırılır

**Plan önizleme:**
- AI plan üretildikten sonra gün kartlarına dokunarak `WorkoutDetailSheet` ile tam detay görüntüleme
- `asPreviewTemplate()` ile önizleme şablonu oluşturulur

**Store:** Zustand tabanlı `useOnboardingStore`; `buildPayload()` API'ye uygun payload üretir; `buildAthleteContext()` günlük AI üretiminde kullanılır.

### 3.2 Canlı idman oturumu

Dosyalar: `WorkoutSessionSheet.tsx`, `sessionLog.ts`, `sessionStore.ts`, `normalizeTemplate.ts`

Özellikler:

| Özellik | Açıklama |
|---------|----------|
| Başlat / Duraklat / Bitir | Zamanlayıcı ile canlı oturum |
| Circuit tur takibi | `for_time`, `amrap`, `circuit` formatlarında tur sayacı |
| Set loglama | Tekrar, mesafe, süre; opsiyonel set RPE |
| Katalog eşleştirme | Bilinmeyen hareket adları için egzersiz seçici |
| Oturum kalıcılığı | `expo-secure-store` ile arka plana gidince kaybolmaz |
| Kayıt sonrası analiz | `ResultSheet` — CNS skoru, overload uyarısı, kas yük barları |
| Şablon normalizasyonu | Görüntüleme/oturum öncesi `normalizeWorkoutTemplate()` |

**Düzeltilen hata:** Oturum açılışında `logs[index]` undefined crash — `activeLogs` fallback ve init refactor.

### 3.3 Program ekranı

Dosyalar: `program.tsx`, `WorkoutDetailSheet.tsx`, `WorkoutBuilderSheet.tsx`, `WorkoutModifyAISheet.tsx`, `WorkoutLibrarySheet.tsx`, `DayWorkoutAISheet.tsx`, `TodaysWorkoutCard.tsx`

- Haftalık plan görünümü ve gün detayları
- Şablondan **İdmanı Başlat** butonu (`WorkoutDetailSheet`)
- Manuel şablon oluşturma (Builder)
- AI ile şablon düzenleme (Modify AI)
- Kütüphane entegrasyonu
- Seçili gün için tek seans AI üretimi (`DayWorkoutAISheet`) — varsayılan süre onboarding salon penceresinden türetilir

### 3.4 Geçmiş ekranı

Dosya: `mobile/src/app/(tabs)/history.tsx`

- `GET /workouts` ile sayfalanmış idman geçmişi
- Genişletilebilir kartlar: egzersiz setleri, kardiyo özeti
- İdman silme (onay diyaloğu)

### 3.5 Dashboard ve sağlık senkronu

- `HealthSyncCard` — HealthKit / Health Connect manuel senkron
- `useAutoHealthSync` — uygulama açılışı ve foreground'a dönüşte otomatik senkron
- Dashboard'da CNS trendi, kas yükleri (deterministik API)

### 3.6 UI / Tasarım sistemi

- `mobile/src/ui/tokens.ts` — renk, tipografi, spacing token'ları
- `DESIGN_SYSTEM.md`, `MOBILE_BLUEPRINT.md` — tasarım ve mobil mimari referansları
- Onboarding bileşenleri: `OptionCard`, `Slider`, `DayPicker`, `SessionScheduleCard`

---

## 4. API Uçları (Özet)

Tüm uçlar `/api/v1` altında, Supabase JWT ile korunur.

| Uç | Amaç |
|----|------|
| `POST /plan/generate` | Onboarding → AI haftalık plan |
| `POST /plan/day/generate` | Tek günlük AI seans |
| `POST /plan/modify` | AI şablon düzenleme |
| `POST /plan/suggest-exercise` | AI egzersiz önerisi |
| `POST /workouts` | İdman kaydı + anlık CNS analizi |
| `GET /workouts` | Sayfalanmış geçmiş |
| `POST /sync/health` | Wearable kardiyo senkronu |
| `GET /metrics/weekly` | Dashboard metrikleri (AI'siz) |
| `POST /analysis/weekly` | AI haftalık koç notu |

---

## 5. Kırıcı API Değişiklikleri

Mobil uygulamanın güncel backend ile çalışması için Render'da deploy edilmiş API gerekir.

| Eski | Yeni |
|------|------|
| `time_of_day`, `time_window` | `gym_preferred_start/end`, `run_preferred_start/end` |
| Sabit `gym_duration_minutes` (slider) | Süre = saat aralığından türetilir |
| 4 hedef | 5 hedef (`hyrox`, `crossfit` eklendi) |
| — | `custom_program_notes` (opsiyonel) |

---

## 6. Git Geçmişi (Önemli Commit'ler)

```
cbc5036 AI coach improvement
68cd909 Improve live workout sessions and HYROX template normalization
058a578 backend update
70f0843 build fix
462ce9f backend update
1092a03 workout create updates
da9fd64 AI powered update
3aefa84 Harden AI plan generation against invalid Gemini output
9e0fe98 Fix AI plan generation: use Gemini-safe response schema
2390148 AI powered
3f97f84 Add Render blueprint for one-click backend deploy
0ee9e6b Initial commit: backend (FastAPI) + mobil (Expo) — Faz 1-3
```

---

## 7. Henüz Commit Edilmemiş Değişiklikler

Aşağıdaki dosyalar working tree'de değiştirilmiş durumda (zamanlama UX sadeleştirmesi):

```
app/schemas/onboarding.py          — süre limitleri genişletildi
app/services/ai_coach.py           — süre = saat penceresi kuralı
mobile/src/app/onboarding.tsx      — slider kaldırıldı
mobile/src/features/onboarding/SessionScheduleCard.tsx
mobile/src/features/onboarding/store.ts
mobile/src/features/onboarding/timeUtils.ts
mobile/src/features/program/DayWorkoutAISheet.tsx
tests/test_plan_generate.py
```

**Önerilen sonraki adım:** Bu değişiklikleri commit + push → Render auto-deploy.

---

## 8. Bilinen Sınırlamalar ve Gelecek İşler

| Konu | Durum |
|------|-------|
| Normalize edilmiş şablonlar DB'ye yazılmıyor | Görüntüleme/oturumda client-side normalize |
| RevenueCat E2E | Cihazda test edilmeli |
| Builder header Modify AI butonu | Opsiyonel polish |
| CI entegrasyon testleri | Supabase secret'ları gerektirir; fork PR'larda atlanır |
| Free Render plan | 15 dk idle sonrası uyku; ilk istek yavaş |

---

## 9. Dosya Haritası (Anahtar Modüller)

```
hyrox-coach/
├── app/
│   ├── schemas/onboarding.py      # Onboarding + AI plan şemaları
│   ├── schemas/workout.py         # İdman kaydı + RPE
│   ├── services/ai_coach.py       # Gemini entegrasyonu
│   ├── services/plan_coercion.py  # AI çıktı düzeltme
│   └── api/v1/endpoints/plans.py  # Plan API uçları
├── mobile/src/
│   ├── app/onboarding.tsx         # 9 adımlı sihirbaz
│   ├── app/(tabs)/program.tsx     # Haftalık program
│   ├── app/(tabs)/history.tsx     # İdman geçmişi
│   ├── features/onboarding/       # Store, kartlar, zaman yardımcıları
│   ├── features/program/          # Oturum, builder, AI sheet'ler
│   └── features/health-sync/      # HealthKit / Health Connect
├── tests/
│   ├── conftest.py                # PYTEST_UNIT_ONLY desteği
│   └── test_plan_generate.py      # Plan üretim testleri
├── render.yaml                    # Render deploy blueprint
└── .github/workflows/ci.yml       # CI pipeline
```

---

## 10. Geliştirme Kuralları (Özet)

`.cursorrules` dosyasından:

1. Pydantic v2, explicit type hints, FastAPI dependency injection
2. AI yalnızca analiz / program üretimi — günlük log ve CNS hesapları deterministik
3. `user_tier` (`free`, `premium`, `pro`) rate-limiting
4. Transaction rollback on error
5. Always-online network stratejisi

---

*Bu döküman proje geliştirme oturumlarının birleşik özetidir. Detaylı mimari için [PROJE_BLUEPRINT.md](PROJE_BLUEPRINT.md) ve [MOBILE_BLUEPRINT.md](MOBILE_BLUEPRINT.md) dosyalarına bakın.*
