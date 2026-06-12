# DESIGN SYSTEM: EMBER

HYROX Coach mobil uygulamasının tasarım sistemi. Yön: **EMBER** — asfalt grisi zemin
üzerine kor turuncusu; premium atletik his (Whoop/Oura sınıfı), modern ve disiplinli.
Tek tema: **koyu**. Açık tema yoktur ve planlanmamaktadır.

Bu doküman `mobile/src/ui/tokens.ts` dosyasının birebir kaynağıdır; token adları
koddakiyle aynı tutulur.

---

## 1. TASARIM İLKELERİ

1. **Kokpit, oyuncak değil.** Veri yoğun ekranlar sakin zeminde nefes alır; turuncu
   yalnızca enerji ve eylem taşır. Bir ekranda birden fazla turuncu odak olmaz.
2. **Eşiğe uzaklık, ham sayı değil.** Her metrik bağlamıyla gösterilir
   ("18/22 set", eşik çizgisi her bar grafiğinde görünür).
3. **Risk her zaman kırmızıdır.** `danger` rengi yalnızca overtraining/limit aşımı
   içindir; dekoratif kullanımı yasaktır. Uygulamanın en kritik anı budur.
4. **Sessiz lüks.** Gradient, gölge ve süsleme yok; derinlik katman renkleriyle
   (`bg → surface → elevated`) kurulur.

---

## 2. RENK PALETİ

### Zemin katmanları
| Token | Hex | Kullanım |
|---|---|---|
| `bg.base` | `#0F1316` | Ekran zemini (asfalt) |
| `bg.surface` | `#171D21` | Kartlar, listeler |
| `bg.elevated` | `#1F262B` | Bottom sheet, modal, aktif satır |
| `stroke.subtle` | `#242C31` | Hairline ayraçlar, kart kenarı |
| `stroke.strong` | `#39444B` | Input odak dışı kenarı |

### Marka / vurgu
| Token | Hex | Kullanım |
|---|---|---|
| `accent.primary` | `#FF5A1F` | Birincil CTA, aktif tab, seçili durum, grafik vurgusu |
| `accent.pressed` | `#E04A12` | Basılı (pressed) durum |
| `accent.subtle` | `#FF5A1F` @ %12 alpha | Seçili satır zemini, ikincil vurgu zemini |
| `accent.ink` | `#0F1316` | Turuncu zemin üzerindeki metin/ikon |

### Metin
| Token | Hex | Kullanım |
|---|---|---|
| `text.primary` | `#ECEFF1` | Başlıklar, metrik değerleri |
| `text.secondary` | `#7E8B94` | Etiketler, yardımcı metin |
| `text.disabled` | `#4D575E` | Pasif öğeler, placeholder |

### Semantik (durum) renkleri
| Token | Hex | Anlam |
|---|---|---|
| `status.safe` | `#2BD9A8` | Güvenli bölge (yük < eşik − 4) |
| `status.caution` | `#FFC247` | Eşiğe yaklaşıyor (eşik − 4 ≤ yük ≤ eşik) |
| `status.danger` | `#FF4757` | Eşik aşıldı / overtraining riski |
| `status.info` | `#5AA9FF` | Bilgi, senkron durumu |

**Kural:** Kas yükü barları ve CNS göstergeleri rengini her zaman bu üçlüden alır
(safe/caution/danger), asla `accent`'tan almaz. Turuncu "marka", yeşil-amber-kırmızı
"fizyoloji" konuşur.

### Tier rozetleri
| Tier | Stil |
|---|---|
| Free | `stroke.strong` kenarlı, `text.secondary` metin (sessiz) |
| Premium | `accent.subtle` zemin, `accent.primary` metin |
| Pro | `accent.primary` zemin, `accent.ink` metin (tam dolu) |

---

## 3. TİPOGRAFİ

Fontlar `@expo-google-fonts` üzerinden yüklenir:

| Rol | Font | Kullanım |
|---|---|---|
| Display | **Chakra Petch** (SemiBold/Bold) | Büyük metrik sayıları, ekran başlıkları — teknik/motorsport karakteri |
| Gövde | **Manrope** (Regular/Medium/SemiBold) | Tüm gövde metni, buton etiketleri |
| Data | **Fira Code** (Regular/Medium) | Metrik etiketleri, birimler, tarih/pace değerleri |

### Ölçek
| Token | Font | Boyut / Satır | Kullanım |
|---|---|---|---|
| `display.xl` | Chakra Petch Bold | 44 / 48 | Dashboard ana CNS skoru |
| `display.lg` | Chakra Petch SemiBold | 32 / 36 | Sonuç bottom sheet skoru |
| `heading.1` | Chakra Petch SemiBold | 24 / 30 | Ekran başlıkları |
| `heading.2` | Manrope SemiBold | 18 / 24 | Bölüm başlıkları |
| `body` | Manrope Regular | 15 / 22 | Gövde |
| `body.strong` | Manrope SemiBold | 15 / 22 | Vurgulu gövde |
| `small` | Manrope Regular | 13 / 18 | Yardımcı metin |
| `micro` | Fira Code Medium | 11 / 14, +%8 letter-spacing, UPPERCASE | Metrik etiketleri ("HAFTALIK KAS YÜKÜ") |

**Kural:** Sayı her zaman etiketten büyüktür. `micro` etiket + `display` değer
ikilisi uygulamanın imza dokusudur.

---

## 4. GEOMETRİ VE BOŞLUK

- **Spacing:** 4'lük taban — `4, 8, 12, 16, 20, 24, 32, 40`. Ekran kenar boşluğu: 20.
- **Radius:** `sm: 8` (çipler, inputlar), `md: 10` (kartlar, butonlar),
  `lg: 14` (bottom sheet üst köşeleri), `full` (rozetler, avatar).
- **Dokunma hedefleri:** minimum 44×44 pt.
- **Kart anatomisi:** `bg.surface` zemin, 1px `stroke.subtle` kenar, radius `md`,
  iç boşluk 16. Gölge yok.

---

## 5. BİLEŞEN SPESİFİKASYONLARI

### Butonlar
| Variant | Stil | Kullanım |
|---|---|---|
| Primary | `accent.primary` zemin, `accent.ink` metin, Manrope SemiBold | Ekran başına en fazla 1 adet ("İdmanı Kaydet") |
| Secondary | Şeffaf zemin, 1px `stroke.strong` kenar, `text.primary` metin | İkincil eylemler |
| Ghost | Şeffaf, `text.secondary` metin | Üçüncül ("Vazgeç") |
| Destructive | Şeffaf zemin, 1px `status.danger` kenar, `status.danger` metin | Silme; onay sheet'indeki son buton dolu kırmızı |

Yükseklik 52 (primary), 44 (diğerleri). Basılı durumda zemin `accent.pressed`/`%8 alpha`.

### Kas yükü barı (imza bileşen)
- Yatay bar, yükseklik 10, radius `sm`; zemin `bg.base`.
- Dolgu rengi yüke göre: safe / caution / danger (Bölüm 2'deki eşik kuralı).
- **22 eşik çizgisi her zaman görünür:** 2px dikey çizgi, `text.primary` @ %50.
- Sol üst: `micro` kas adı; sağ üst: Fira Code değer ("18.5"), dolgu rengiyle.
- Bar maksimumu 28 birim olarak ölçeklenir (eşik %79 konumunda durur).

### Overtraining uyarı bandı
- `status.danger` @ %12 zemin, 1px `status.danger` kenar, radius `md`.
- İkon (üçgen) + `micro` stil başlık "OVERTRAINING RİSKİ" + kas listesi `body.strong`.
- Dashboard'da en üstte; idman sonucu sheet'inde skorun hemen altında. Animasyonla
  (fade + 4px yukarı kayma) girer, asla yanıp sönmez.

### CNS trend grafiği
- 7 günlük çizgi: `accent.primary`, 2.5px, hafif eğri (catmull-rom).
- Bugünün noktası: 8px dolu daire + `accent.subtle` halo.
- Eksen etiketleri `micro`; ızgara çizgileri `stroke.subtle`, yalnızca yatay.

### Tab bar
- `bg.surface` zemin, üstte 1px `stroke.subtle`.
- 5 sekme: Dashboard, Geçmiş, **Kaydet (orta, yükseltilmiş)**, Koç, Profil.
- Orta buton: 56px daire, `accent.primary` zemin, `accent.ink` artı ikonu —
  uygulamanın tek kalıcı turuncu dolgusu.
- Aktif sekme: `accent.primary` ikon + etiket; pasif: `text.secondary`.

### Bottom sheet (idman sonucu)
- `bg.elevated` zemin, üst radius `lg`, tutamaç çubuğu `stroke.strong`.
- Sıra: skor (`display.lg`) → uyarı bandı (varsa) → kas barları → "Tamam" ghost buton.

### Form / input
- Zemin `bg.surface`, 1px `stroke.strong`, radius `sm`, odakta kenar `accent.primary`.
- Hata: kenar `status.danger` + altında `small` hata metni.
- RPE seçimi: 1–10 yatay slider; değer büyüdükçe ibre rengi safe → caution → danger.

### Boş durumlar
- Merkezde `text.secondary` kısa açıklama + tek primary CTA.
- Dashboard boşsa: "İlk idmanını kaydet — motoru çalıştıralım." + Kaydet butonu.

---

## 6. MOTION

Az ama isabetli; tümü 150–250ms, `easeOut`:

| An | Animasyon |
|---|---|
| Dashboard açılışı | Ana CNS skoru 0'dan değere sayar (400ms), barlar 80ms arayla soldan dolar |
| İdman kaydı sonucu | Sheet spring ile açılır; uyarı bandı 150ms gecikmeyle fade-in |
| Tab geçişi | Çapraz fade, 150ms |
| Silme | Satır sola kayar, 200ms collapse |

Yanıp sönme, sonsuz döngü ve parallax yok.

---

## 7. SES VE DİL (UX Writing)

- Türkçe, kısa, koç gibi: emir kipi ve net bilgi. "Quadriceps eşiği aştı. Bu hafta
  alt vücut hacmini düşür." Ünlem ve emoji yok.
- Sayı her zaman bağlamla: "24 / 22 set" — asla tek başına "24".
- Hata mesajları suçlamaz, yol gösterir: "Bağlantı koptu. Tekrar dene."
- AI koç notu ekranında not, alıntı bloğu gibi sunulur (sol 2px `accent.primary`
  çizgi) — "koçun sesi" görsel olarak ayrışır.

---

## 8. ERİŞİLEBİLİRLİK

- Kontrast: `text.primary` / `bg.base` ≈ 14:1; `accent.primary` / `bg.base` ≈ 5.4:1;
  tüm metin-zemin çiftleri WCAG AA üzerinde tutulur.
- Renk tek başına anlam taşımaz: danger durumunda her zaman ikon + metin eşlik eder.
- Dinamik font ölçeğine (iOS Dynamic Type) `body` ve `small` uyum sağlar;
  `display` sınıfı sabit kalır (layout bütünlüğü).
- Tüm interaktif öğelerde `accessibilityLabel`; barların değeri okunur
  ("Quadriceps, haftalık yük 24, eşik 22'nin üzerinde").

---

## 9. UYGULAMA NOTLARI

- Tüm tokenlar `mobile/src/ui/tokens.ts` içinde tek nesnede yaşar; bileşenler hex
  kullanmaz, token referansı kullanır.
- Fontlar: `@expo-google-fonts/chakra-petch`, `@expo-google-fonts/manrope`,
  `@expo-google-fonts/fira-code`; splash screen font yüklenene dek tutulur.
- Grafikler `react-native-svg` ile özel bileşen olarak çizilir
  (`CnsTrendChart`, `MuscleLoadBar`); renk/eşik kuralları `tokens.ts`'teki
  `chart` sabitleri ve `loadColor()` üzerinden uygulanır. Grafik ihtiyacı
  büyürse victory-native'e geçilebilir.
- App ikonu / splash: asfalt zemin üzerine turuncu monogram (Faz 1 sonunda ayrı iş).
