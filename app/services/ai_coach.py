"""Agentic AI Katmani: Gemini ile haftalik koc analizi (Bolum 6).

- Saglayici: Google AI Studio SDK (google-genai) / Gemini 2.5 Flash Lite.
- Cikti: Pydantic semasi zorunlu kilinarak STRICT Structured JSON Output.
- AI yalnizca deterministik motorun urettigi hazir metrikleri yorumlar;
  hicbir hesaplama LLM'e yaptirilmaz.

Not (Context Caching): Sabit spor bilimi cerceveleri ve HYROX kural
dokumanlari buyudugunde Gemini'nin explicit context caching API'si
devreye alinacak; su an statik icerik system_instruction ile tasiniyor.
"""

from google import genai
from google.genai import types as genai_types

from app.core.config import get_settings
from app.schemas.analysis import CoachAnalysis, WeeklyMetrics

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
