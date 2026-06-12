# MASTER PROJECT BLUEPRINT: HYBRID PERFORMANCE MANAGEMENT SYSTEM

## 1. OVERVIEW & PRODUCT VISION
This is a Mobile-First, Cloud-Backend, Data-Driven Performance and Recovery Management SaaS tailored specifically for elite hybrid athletes and HYROX competitors. 
The app eliminates the friction of using multiple platforms (e.g., Strava for running, Hevy for lifting) by fusing strength metrics, cardiovascular capacity, and central nervous system (CNS) fatigue thresholds into a single, cohesive, scientific dashboard.

### Core Engineering Strategy:
- 80% Deterministic Engine: Volume landmarks, cumulative stress tracking, and physiological limits are computed instantly via backend math logic and DB views (Zero AI Cost).
- 20% Agentic AI Layer: Large Language Models (LLM) are triggered asynchronously ONLY for hyper-personalized weekly coaching notes, adaptation strategies, and trend analysis.

---

## 2. DETAILED TECHNICAL ARCHITECTURE

### Backend Framework
- Python 3.11+ using FastAPI.
- Async/Await design pattern for highly concurrent I/O performance.
- Pydantic models for strict payload validation.

### Database Strategy
- PostgreSQL hosted on Supabase.
- Strict relational constraints to manage dependencies between workouts, specific target muscles, and wearable biometric logs.
- `pgvector` enabled for future RAG (Retrieval-Augmented Generation) extensions.

### Monetization & Rate Limiting (SaaS Tiering)
- Free Tier: Unlimited logging & access to deterministic charts. No AI features.
- Premium Tier: 1 Weekly AI Analysis Report.
- Pro Tier: Unlimited logging + 5 Daily Adaptive AI requests (e.g., dynamic program modification on bad days).

---

## 3. DATABASE SCHEMA (PostgreSQL / Supabase Migration)

```sql
CREATE TYPE user_tier AS ENUM ('free', 'premium', 'pro');

CREATE TABLE user_profiles (
    user_id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    tier user_tier DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE exercises (
    exercise_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'strength', 'running', 'hyrox'
    cns_load_factor FLOAT NOT NULL,
    target_muscles JSONB NOT NULL   -- Structure: {"quadriceps": 1.0, "glutes": 0.5}
);

CREATE TABLE workout_logs (
    workout_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES user_profiles(user_id),
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    workout_type VARCHAR(100) NOT NULL, -- 'Full Body', 'Zone 2 Run', 'Hyrox Sim'
    user_reported_rpe FLOAT NOT NULL, -- Scale: 1.0 - 10.0
    duration_minutes INT NOT NULL
);

CREATE TABLE workout_exercise_details (
    detail_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_log_id UUID REFERENCES workout_logs(workout_log_id) ON DELETE CASCADE,
    exercise_id VARCHAR(100) REFERENCES exercises(exercise_id),
    sets JSONB NOT NULL -- Structure: [{"weight_kg": 120, "reps": 6, "rpe": 8.0}]
);

CREATE TABLE workout_cardio_details (
    cardio_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_log_id UUID REFERENCES workout_logs(workout_log_id) ON DELETE CASCADE,
    cardio_type VARCHAR(50) NOT NULL, -- 'running', 'rowing', 'ski_erg'
    distance_km FLOAT NOT NULL,
    duration_minutes FLOAT NOT NULL,
    avg_hr INT NULL, -- Captured via wearable devices
    source VARCHAR(50) DEFAULT 'manual' -- 'apple_health', 'google_health', 'manual'
);

CREATE TABLE ai_usage_logs (
    usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES user_profiles(user_id),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    endpoint_called VARCHAR(255) NOT NULL
);

```


## 4. CORE MATHEMATICAL LOOPS (The Rule Engine)

### A. Haftalık Kas Grubu Kaliteli Set Sayısı (Volume Landmarks)
Her ana kas grubunun spor biliminde önerilen haftalık maksimum toparlanma (recovery) tavan sınırı 20-22 kaliteli settir.

$$\text{Haftalık Kas Yükü} = \sum (\text{Atılan Set Sayısı} \times \text{Kas Katsayısı})$$

Eğer herhangi bir spesifik kas grubu için son 7 gündeki kümülatif $\text{Haftalık Kas Yükü} > 22$ olursa, API yanıtı otomatik olarak `warning_flag: true` dönecektir ve ilgili kas grubunu `overtraining_risk` olarak etiketleyecektir.

### B. CNS Fatigue Scoring System (Merkezi Sinir Sistemi Yorgunluk Skoru)
Günlük sistemik sinirsel tükenme, yapılan egzersizlerin hacim yükleri ile sporcunun subjektif Hissedilen Zorluk Derecesi (RPE) harmanlanarak kantitatif olarak ölçülür:

$$\text{Günlük CNS Skoru} = \left( \sum (\text{Set Sayısı} \times \text{cns\_load\_factor}) \right) \times \left( \frac{\text{user\_reported\_rpe}}{10} \right)$$

* **Kardiyo Düzenlemesi (Cardio Modifier):** Eğer `cardio_type == 'running'` ise ve giyilebilir cihazdan gelen `avg_hr` (ortalama nabız) değeri sporcunun bireysel Zone 2 aerobik eşiği içerisindeyse, hatalı yorgunluk sınıflandırmasını önlemek adına o koşu idmanı için `cns_load_factor` otomatik olarak `0.5` değerine düşürülür.

---

## 5. REVENUE INTEGRITY & RATE-LIMITING MIDDLEWARE
Yapay zeka token kullanımının suistimal edilmesini engellemek ve SaaS kar marjını korumak için, bir FastAPI middleware katmanı tüm `/api/v1/analysis/*` uçlarını (endpoints) koruma altına alacaktır:

1.  İstek atan `user_id` için mevcut faturalandırma dönemi içerisindeki `ai_usage_logs` kayıtları sorgulanır.
2.  Kullanıcının `user_profiles.tier` bilgisi doğrulanır.
3.  Kullanıcının kümülatif istek sayısı, üyelik tipine ait aşağıda tanımlanmış sınırları aşıyorsa işlem iptal edilir ve geriye `HTTP 429 Too Many Requests` status kodu fırlatılır.

* **Free Tier:** Günlük/Haftalık 0 AI İsteği izni.
* **Premium Tier:** Haftalık maksimum 1 adet AI Analiz İsteği izni.
* **Pro Tier:** Günlük maksimum 5 adet AI Analiz İsteği izni.

---

## 6. AI SERVICE SPECIFICATIONS
* **Sağlayıcı:** Google AI Studio SDK üzerinden Gemini 2.5 Flash Lite modeli kullanılacaktır.
* **Optimizasyon:** Sabit spor bilimi çerçeveleri, fizyolojik sınır dökümanları ve resmi HYROX yarış kuralları gibi büyük metinler için API seviyesinde **Context Caching** (Bağlam Önbelleğe Alma) aktif edilecektir.
* **Serileştirme:** Yapay zekadan dönecek yanıtlar, Pydantic yapılandırmaları zorunlu kılınarak tamamen **Structured JSON Output** (Yapılandırılmış JSON Çıktısı) formatında alınacaktır.


## Role: Elite Sports Scientist and HYROX Performance Coach.
* **Input Data:** Weekly computed sports metrics (Muscle volume, CNS load, Cardio paces).
* **Task:** Analyze the metrics. If any safety threshold is breached, write a brief, raw, punchy tactical advice for the upcoming week.
* **Output Format:** STRICT JSON {"breach_detected": boolean, "coaches_note": string}
