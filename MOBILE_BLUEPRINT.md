# MOBILE BLUEPRINT: HYROX COACH MOBİL UYGULAMASI

Bu doküman, mevcut FastAPI backend'inin ([PROJE_BLUEPRINT.md](PROJE_BLUEPRINT.md)) üzerine inşa edilecek
mobil uygulamanın teknik planıdır. Backend tamamlanmış ve test altındadır (80 test);
mobil taraf yalnızca API tüketicisidir, hiçbir hesaplama istemcide yapılmaz.

---

## 1. ÜRÜN VİZYONU (Mobil Perspektif)

Tek ekranda "bugün ne kadar yüklenebilirim?" sorusuna cevap veren, sürtünmesiz bir
performans kokpiti. Kullanıcı akışının %90'ı üç eylemde biter:

1. **Bak:** Dashboard'da CNS trendi ve kas yükü barlarını gör.
2. **Kaydet:** İdmanı 30 saniyede logla (veya wearable'dan otomatik senkronla).
3. **Dinle:** Haftalık AI koç notunu oku (Premium/Pro).

Tasarım ilkesi: veri yoğun ama karar basit. Grafikler ham sayı değil,
eşiğe uzaklık gösterir ("quadriceps: 18/22 set").

---

## 2. TEKNOLOJİ YIĞINI

| Katman | Seçim | Gerekçe |
|---|---|---|
| Framework | **React Native + Expo (SDK 53+), TypeScript** | Tek kod tabanı ile iOS + Android; tek geliştirici için en hızlı iterasyon |
| Build | **Expo Dev Build + EAS Build** | HealthKit/Health Connect native modül gerektirir; Expo Go YETERSİZDİR |
| Navigasyon | **Expo Router (file-based)** | Tip güvenli rotalar, derin bağlantı hazır |
| Sunucu durumu | **TanStack Query v5** | Cache, retry, optimistic update; API tüketimi için fiili standart |
| Lokal durum | **Zustand** | Minimal global state (aktif idman taslağı gibi); Redux gereksiz |
| Auth & Session | **@supabase/supabase-js + expo-secure-store** | Token saklama Secure Store'da; otomatik refresh supabase-js'te |
| HealthKit (iOS) | **@kingstinct/react-native-healthkit** | Modern, TS-first HealthKit sarmalayıcısı |
| Health Connect (Android) | **react-native-health-connect** | Health Connect resmi API sarmalayıcısı |
| Grafikler | **react-native-svg (özel bileşenler)** | Trend çizgisi + barlar basit SVG; ihtiyaç büyürse victory-native'e geçilir |
| Form | **react-hook-form + zod** | İdman giriş formu; zod şemaları backend Pydantic kurallarını aynalar |
| Ödeme (Faz 3) | **RevenueCat** | App Store/Play aboneliği + backend webhook ile tier senkronu |

### Neden native (Swift/Kotlin) değil?
Tek geliştirici + iki platform + API-merkezli uygulama. Native'in avantaj sağlayacağı
tek alan (HealthKit derin entegrasyonu) mevcut RN kütüphaneleriyle karşılanıyor.

---

## 3. EKRANLAR VE API EŞLEMESİ

Tüm istekler `Authorization: Bearer <supabase_access_token>` taşır.

| Ekran | Amaç | Tüketilen Uçlar |
|---|---|---|
| **Auth** (signin/signup) | Supabase e-posta + şifre; ileride Apple/Google Sign-In | Supabase Auth SDK (backend'e istek yok) |
| **Dashboard** | CNS trend çizgisi (7 gün), kas yükü barları (22 eşik çizgili), koşu mesafesi, uyarı bandı | `GET /metrics/weekly`, `GET /users/me` |
| **Program** | Haftalık antrenman planı: hafta gezinme, gün kartları, idman atama/tamamlama; "Build Workout" ile şablon kurma (Standard/Circuit/EMOM/AMRAP/For Time; Tekrar/Süre/Mesafe ölçümleri); "İdmanlarım" kütüphanesi (arama + tip filtresi + önizlemeli kartlar + düzenle/sil) | `GET/POST/PUT/DELETE /templates`, `GET /plan/week`, `POST /plan/entries`, `POST|DELETE /plan/entries/{id}/complete` |
| **AI Onboarding Wizard** (`/onboarding`, modal) | Typeform tarzı 5 adım: hedef → kardiyo (5K pace slider + Zone 2) → hareket kapasitesi (sled, olimpik) → takvim/toparlanma (hafta sonu kondisyonu, OMAD/IF) → ekipman + gün sayısı (slider). Cevaplar Zustand store'da; üretilen plan önizlenir, onayda mevcut şablon/plan uçlarıyla bu veya gelecek haftaya yazılır. Tier limiti: free 1 toplam, premium 3/hafta, pro 5/gün. | `POST /plan/generate`, sonra `POST /templates` + `POST /plan/entries` |
| **İdman Kaydet** | Kuvvet (egzersiz + set/tekrar/RPE) ve/veya kardiyo girişi; kayıt sonrası anlık analiz sonucu (bottom sheet) | `GET /exercises` (katalog, cache'li), `POST /workouts` |
| **Geçmiş** | Sayfalanmış idman listesi (infinite scroll), satır kaydırınca sil | `GET /workouts?limit&offset`, `DELETE /workouts/{id}` |
| **İdman Detay** | Geçmiş satırına dokununca set/kardiyo detayları | Geçmiş yanıtındaki veri (ek istek yok) |
| **AI Koç** (Faz 3) | Haftalık koç notu Dashboard'a kart olarak gelir; free kullanıcıya paywall, 429'da "kota doldu" durumu | `POST /analysis/weekly` |
| **Ayarlar / Profil** | Kişisel/Hesap segmentleri; kişisel bilgi düzenleme (ad, yaş, cinsiyet, boy, kilo), tier rozeti, çıkış, RoxHype tarzı "tehlikeli bölge" (**hesap silme**), sürüm bilgisi | `GET /users/me`, `PATCH /users/me`, `DELETE /users/me` |
| **Paywall** (Faz 3) | Premium/Pro abonelik satışı | RevenueCat SDK |

### Kritik UX kuralları
- `POST /workouts` yanıtındaki `warning_flag: true` ise kayıt sonrası bottom sheet'te
  `overtraining_risk` kasları kırmızı vurgulanır — uygulamanın "aha" anı budur.
- `POST /analysis/weekly` 429 dönerse paywall değil, "haftalık hakkın doldu, salı günü yenilenir"
  tarzı sakin bir mesaj gösterilir (Premium); free kullanıcı ucu hiç çağırmaz, doğrudan paywall görür.
- Hesap silme: iki adımlı onay (yazarak onaylama), 204 sonrası local oturum temizlenir
  (token süresi dolana kadar teknik olarak geçerli kalır — istemci hemen signout yapar).

---

## 4. WEARABLE SENKRON AKIŞI (HealthKit / Health Connect)

Backend ucu: `POST /sync/health` (idempotent, max 100 sample/batch).

```
Uygulama açılışı / foreground'a dönüş
  └─> Son senkron zamanını oku (AsyncStorage: lastSyncAt)
  └─> HealthKit/Health Connect'ten lastSyncAt sonrası workout'ları sorgula
       (tipler: running, rowing → backend cardio_type eşlemesi)
  └─> Her workout'u HealthCardioSample'a dönüştür:
       external_id  = HealthKit UUID / Health Connect record id
       avg_hr       = workout'un ortalama nabzı (varsa)
       source       = 'apple_health' | 'google_health'
  └─> 100'lük batch'lerle POST /sync/health
  └─> Başarıda lastSyncAt = now
```

- **Dedup sorumluluğu backend'dedir** (`external_id` unique). İstemci aynı batch'i
  tekrar gönderebilir; çakışma `skipped_duplicates` olarak döner. lastSyncAt sadece optimizasyondur.
- RPE istemciden gönderilmez; backend avg_hr'den deterministik türetir.
- İzin reddedilirse senkron sessizce kapanır; Ayarlar'dan tekrar açılabilir.
- Arka plan senkronu (BGTaskScheduler / WorkManager) MVP'de YOK — açılışta senkron yeterli.

---

## 5. AUTH VE OTURUM MİMARİSİ

1. supabase-js, oturumu `expo-secure-store`'da saklar (`storage` adaptörü ile).
2. Her API isteği öncesi `supabase.auth.getSession()` → taze `access_token` alınır
   (süresi dolmuşsa SDK otomatik refresh eder).
3. Backend 401 dönerse: bir kez session refresh + retry; yine 401 ise signout + Auth ekranı.
4. İlk girişte backend profili otomatik oluşturur (`free`); mobil tarafta ekstra "kayıt" isteği yoktur.
5. `GET /users/me` yanıtı TanStack Query'de cache'lenir; `tier` tüm gating kararlarının tek kaynağıdır.

---

## 6. PROJE YAPISI

Monorepo değil; mobil uygulama ayrı klasörde yaşar: `mobile/`

```
mobile/
  app/                      # Expo Router rotaları
    (auth)/                 #   signin, signup
    (tabs)/                 #   dashboard, history, log, program, profile
    workout/[id].tsx        #   idman detay
  src/
    api/                    # Backend istemcisi
      client.ts             #   fetch sarmalayıcı (baseURL, bearer, 401 retry)
      types.ts              #   Backend Pydantic şemalarının TS karşılıkları
      hooks/                #   useWeeklyMetrics, useWorkouts, useLogWorkout...
    features/
      dashboard/            #   CNS trend, kas yükü barları (victory-native)
      workout-log/          #   form + zod şemaları
      health-sync/          #   HealthKit/Health Connect adaptörleri + senkron motoru
      account/              #   profil, hesap silme
    lib/
      supabase.ts           #   supabase-js + secure-store konfigürasyonu
      env.ts                #   API_BASE_URL (expo-constants üzerinden)
    ui/                     #   tasarım sistemi: tokens, Button, Card, Sheet...
```

- `src/api/types.ts` elle yazılır ve backend `/docs` (OpenAPI) çıktısıyla doğrulanır;
  ileride `openapi-typescript` ile otomatik üretime geçilebilir.
- zod şemaları backend kurallarını aynalar (RPE 1-10, set ≥ 1, distance > 0) —
  hata kullanıcıya istek atılmadan gösterilir, son söz yine backend'indir.

---

## 7. TASARIM SİSTEMİ

Tasarım yönü kararlaştırıldı: **EMBER** — asfalt grisi zemin + kor turuncusu vurgu,
premium atletik dil. Tam spesifikasyon (palet, tipografi, bileşenler, motion,
erişilebilirlik) ayrı dokümandadır: **[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)**

Özet:
- **Tema:** Yalnızca koyu. Zemin `#0F1316`, vurgu `#FF5A1F`; durum renkleri
  yeşil/amber/kırmızı yalnızca fizyolojik anlam taşır (kırmızı = overtraining).
- **Tipografi:** Chakra Petch (display/sayılar), Manrope (gövde), Fira Code (metrik etiketleri).
- **Grafik dili:** Kas yükü barları her zaman 22 eşik çizgisiyle çizilir;
  CNS trendi 7 günlük çizgi + bugünün noktası vurgulu.
- **Boş durumlar:** İlk kullanıcı için her ekranda yönlendirici boş durum
  ("İlk idmanını kaydet" CTA'sı dashboard'a da düşer).
- Erişilebilirlik: dokunma hedefleri ≥ 44pt, renk tek başına anlam taşımaz (ikon + etiket).

---

## 8. YOL HARİTASI (FAZLAR)

### Faz 1 — Çekirdek Döngü (MVP)
1. Expo projesi + dev build altyapısı (EAS), tasarım sistemi temelleri
2. Auth akışı (Supabase) + oturum yönetimi + API istemcisi
3. Dashboard (`/metrics/weekly` görselleştirme)
4. İdman kaydetme (katalog + kuvvet/kardiyo formu + sonuç bottom sheet)
5. Geçmiş (liste + silme) ve idman detayı
6. Ayarlar: profil, çıkış, hesap silme
**Çıktı:** TestFlight / Internal Testing'e çıkabilen, manuel loglama ile tam çalışan uygulama.

### Faz 2 — Wearable
7. ~~HealthKit entegrasyonu + senkron motoru (iOS)~~ **TAMAMLANDI** —
   `@kingstinct/react-native-healthkit` + `src/features/health-sync/` (motor, otomatik senkron,
   Profil > Hesap'ta Apple Health kartı). Native modül gerektirdiğinden dev build şart
   (`npx expo run:ios`); Expo Go'da kart "desteklenmiyor" gösterir, uygulama çökmez.
8. Health Connect entegrasyonu (Android)
**Çıktı:** Koşular otomatik düşer; Zone 2 düzeltmesi backend'de kendiliğinden işler.

### Faz 3 — Monetizasyon + AI
9. ~~AI Koç ekranı (`/analysis/weekly`) + kota/hata durumları~~ **TAMAMLANDI** —
   Dashboard'da `CoachCard`: free kullanıcı kilitli kart + paywall CTA görür (uç hiç çağrılmaz);
   premium/pro istek üzerine haftalık not alır; 429'da sakin "kota doldu" mesajı, 503'te
   "AI servisi aktif değil" bilgisi.
10. RevenueCat + paywall — **KISMEN TAMAMLANDI:**
    - Backend webhook ucu hazır: `POST /webhooks/revenuecat` (entitlement → tier eşlemesi,
      EXPIRATION → free, `REVENUECAT_WEBHOOK_SECRET` ile korumalı, 9 test).
    - Paywall ekranı hazır (`/paywall` modal): Premium/Pro karşılaştırma, mevcut plan rozeti.
    - KALAN: Apple Developer + App Store Connect ürünleri + RevenueCat SDK bağlantısı
      (hesaplar açılınca satın alma butonları SDK'ya bağlanır).
**Çıktı:** Gelir üretebilen sürüm; store yayını.

### Backend bağımlılıkları (mobil sırasında yapılacak)
- Dev ortamının Railway/Fly.io'ya deploy'u (telefon localhost'a erişemez) — Faz 1, adım 2'den önce
- RevenueCat webhook ucu (`POST /webhooks/revenuecat` → tier güncelleme) — Faz 3

---

## 9. ORTAM VE KONFİGÜRASYON

| Değişken | Açıklama |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Backend kökü (dev: deploy edilmiş dev ortamı; lokal test: Mac'in LAN IP'si) |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase proje URL'i (backend ile aynı proje) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (istemcide güvenle taşınabilir) |

Service role key, JWT secret ve Gemini key **asla** mobil pakete girmez.

---

## 10. TEST STRATEJİSİ

- **Birim:** zod şemaları, health-sync dönüştürücüleri (HealthKit kaydı → HealthCardioSample), tarih/pace yardımcıları — Jest.
- **Bileşen:** kritik formlar ve dashboard durumları — React Native Testing Library.
- **E2E (Faz 2+):** Maestro ile 3 altın akış: signin → idman kaydet → dashboard'da gör; senkron; hesap silme.
- Backend zaten sözleşmenin doğruluğunu 80 testle garanti ediyor; mobil testler istemci mantığına odaklanır.
