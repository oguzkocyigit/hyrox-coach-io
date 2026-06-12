"""Agentic AI Katmani: Gemini ile haftalik koc analizi (Bolum 6).

- Saglayici: Google AI Studio SDK (google-genai) / Gemini 2.5 Flash Lite.
- Cikti: Pydantic semasi zorunlu kilinarak STRICT Structured JSON Output.
- AI yalnizca deterministik motorun urettigi hazir metrikleri yorumlar;
  hicbir hesaplama LLM'e yaptirilmaz.

Not (Context Caching): Sabit spor bilimi cerceveleri ve HYROX kural
dokumanlari buyudugunde Gemini'nin explicit context caching API'si
devreye alinacak; su an statik icerik system_instruction ile tasiniyor.
"""

import json

from google import genai
from google.genai import types as genai_types

from app.core.config import get_settings
from app.schemas.analysis import CoachAnalysis, WeeklyMetrics
from app.schemas.onboarding import GeneratedWeekPlan, OnboardingPayload

# Blueprint'teki rol tanimi (sayfa sonu prompt spesifikasyonu)
SYSTEM_INSTRUCTION = (
    "Role: Elite Sports Scientist and HYROX Performance Coach.\n"
    "Input Data: Weekly computed sports metrics (Muscle volume, CNS load, Cardio paces).\n"
    "Task: Analyze the metrics. If any safety threshold is breached "
    "(warning_flag/overtraining_risk), write a brief, raw, punchy tactical advice "
    "for the upcoming week. If nothing is breached, still write a short, motivating "
    "weekly assessment with ONE tactical focus point. coaches_note must NEVER be empty.\n"
    'Output Format: STRICT JSON {"breach_detected": boolean, "coaches_note": string}'
)


class AIServiceNotConfiguredError(Exception):
    """GEMINI_API_KEY tanimli degil; AI katmani devre disi."""


async def generate_weekly_coach_note(metrics: WeeklyMetrics) -> CoachAnalysis:
    """Haftalik metrikleri Gemini'ye gonderir, yapilandirilmis analiz doner."""
    settings = get_settings()
    if not settings.gemini_api_key:
        raise AIServiceNotConfiguredError(
            "GEMINI_API_KEY tanimli degil. .env dosyasina ekleyin."
        )

    client = genai.Client(api_key=settings.gemini_api_key)
    response = await client.aio.models.generate_content(
        model=settings.gemini_model,
        contents=(
            "Weekly computed metrics (deterministic engine output):\n"
            + metrics.model_dump_json(indent=2)
        ),
        config=genai_types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=CoachAnalysis,
            temperature=0.7,
            max_output_tokens=512,
        ),
    )
    return CoachAnalysis.model_validate_json(response.text)


# ---------------------------------------------------------------
# AI Onboarding Wizard: kisisellestirilmis haftalik program uretimi
# ---------------------------------------------------------------
PLAN_SYSTEM_INSTRUCTION = (
    "Role: Elite hybrid training program designer (HYROX / CrossFit / strength).\n"
    "Task: Build a personalized one-week training program from the athlete profile "
    "and the provided exercise catalog.\n"
    "STRICT RULES:\n"
    "1. exercise_id MUST be one of the catalog 'id' values. If a movement is not in "
    "the catalog, set exercise_id to null but still provide a clear name.\n"
    "2. Catalog 'cns' is the CNS load factor (recovery cost). NEVER schedule two "
    "consecutive days that both contain multiple exercises with cns >= 1.8. Place "
    "the heaviest CNS day after a rest day. Respect the athlete's recovery signals "
    "(zone2 habit, nutrition constraint) when distributing volume.\n"
    "3. Schedule EXACTLY days_per_week training days. day_of_week: 0=Monday ... "
    "6=Sunday. Do not output rest days as entries.\n"
    "4. Measurement rules are mandatory: measurement 'reps' requires reps; 'time' "
    "requires duration_seconds; 'distance' requires distance_m.\n"
    "5. template.workout_type must be one of: hybrid, running, strength, metcon, "
    "endurance, power, technique, recovery. template.format must be one of: "
    "standard, circuit, emom, amrap, for_time (amrap/for_time/emom should include "
    "time_cap_minutes).\n"
    "6. Equipment limits: 'standard_gym' -> no sled, SkiErg or wall ball movements; "
    "'minimal' -> only bodyweight, dumbbell and running movements.\n"
    "7. If weekend_conditioning is true, place the hardest conditioning sessions on "
    "Saturday/Sunday (day_of_week 5-6).\n"
    "8. Skill gating: do not program olympic lifts above the athlete's "
    "olympic_proficiency ('none' -> never, 'learning' -> technique work only). Same "
    "logic for sled_experience.\n"
    "9. Use the athlete's 5K pace to calibrate running paces and distances.\n"
    "10. Write coach_summary (2-4 sentences), each day's focus (one sentence) and "
    "all exercise instructions in TURKISH.\n"
    "Output: STRICT JSON matching the response schema. No extra commentary."
)


async def generate_onboarding_plan(
    payload: OnboardingPayload, catalog: list[dict]
) -> GeneratedWeekPlan:
    """Atlet profili + egzersiz katalogundan haftalik program uretir.

    Katalog deterministik motorun kaynagidir (exercise_id + cns_load_factor);
    AI yalnizca bu kimlikleri secip gunlere dagitir, hicbir metrik hesaplamaz.
    """
    settings = get_settings()
    if not settings.gemini_api_key:
        raise AIServiceNotConfiguredError(
            "GEMINI_API_KEY tanimli degil. .env dosyasina ekleyin."
        )

    client = genai.Client(api_key=settings.gemini_api_key)
    response = await client.aio.models.generate_content(
        model=settings.gemini_model,
        contents=(
            "Athlete profile:\n"
            + payload.model_dump_json(indent=2)
            + "\n\nExercise catalog (id / name / category / cns load factor):\n"
            + json.dumps(catalog, ensure_ascii=False)
        ),
        config=genai_types.GenerateContentConfig(
            system_instruction=PLAN_SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=GeneratedWeekPlan,
            temperature=0.6,
            max_output_tokens=8192,
        ),
    )
    return GeneratedWeekPlan.model_validate_json(response.text)
