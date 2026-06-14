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
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.ai_coach import SundayReviewPayload, SundayReviewResponse
from app.schemas.ai_plan import (
    AiModifyResponse,
    AiSingleDayResponse,
    AiSuggestExerciseResponse,
    WeeklyPlanAIResponse,
)
from app.schemas.analysis import CoachAnalysis, WeeklyMetrics
from app.schemas.onboarding import (
    DayWorkoutGeneratePayload,
    ExerciseSuggestPayload,
    ExerciseSuggestResponse,
    GeneratedDayWorkout,
    GeneratedWeekPlan,
    ModifiedWorkoutResponse,
    OnboardingPayload,
    WorkoutModifyPayload,
)
from app.services.plan_coercion import (
    coerce_ai_modify,
    coerce_ai_single_day,
    coerce_ai_suggest_exercise,
    hydrate_weekly_plan_from_templates,
    parse_ai_modify,
    parse_ai_single_day,
    parse_ai_suggest_exercise,
    parse_weekly_plan_ai,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.analytics import (
    build_weekly_metrics,
    fetch_weekly_plan_compliance,
    fetch_weekly_workout_logs,
)
from app.services.coaching_context import build_plan_coaching_context
from app.services.template_retrieval import (
    fetch_coach_template_catalog,
    fetch_coach_templates_by_ids,
)

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
    "Role: Elite hybrid performance coach — weekly program ORCHESTRATOR.\n"
    "Task: From the athlete profile and the provided 'Available Templates' list, "
    "build a one-week schedule by SELECTING template_id values ONLY. You do NOT "
    "invent exercises or full workouts.\n"
    "STRICT RULES:\n"
    "1. template_id MUST be exactly one of the provided Available Templates ids. "
    "NEVER invent a template_id not in the list.\n"
    "2. SCHEDULING — training_days (0=Monday ... 6=Sunday): output one entry per "
    "scheduled gym day. If wants_running is true, also schedule running_days; when "
    "split_run_and_gym is true and a day is in BOTH lists, output TWO entries for "
    "that day_of_week (separate templates). Running-only days get a running-appropriate "
    "template with modifications if needed.\n"
    "3. CONSTRAINTS — Respect goal, OMAD/nutrition_constraint, gym/run fed_state, "
    "equipment limits, olympic_proficiency, sled_experience, custom_program_notes, "
    "and any Sunday-review style recovery signals in custom_program_notes.\n"
    "4. MODIFICATIONS — If time is limited, injury, or equipment mismatch: use "
    "modifications.remove_exercises (exercise_id list) to drop 1-2 movements, or "
    "modifications.add_exercises (catalog exercise_id only) to swap/add. Keep "
    "changes minimal (max 2-3 per day).\n"
    "5. CNS recovery — do not stack the heaviest templates on consecutive days; "
    "place hard sessions after rest or light days.\n"
    "6. COACHING CONTEXT — If coaching_context is provided, treat "
    "latest_sunday_review.readiness_score and next_week_adjustments as HIGH "
    "PRIORITY. readiness_score <= 4: prefer lighter templates and more "
    "remove_exercises. readiness_score >= 8: can program harder templates. "
    "journal_notes_last_7_days reveal fatigue, OMAD effects, pain — adjust "
    "template selection and modifications accordingly.\n"
    "7. DURATION — athlete's gym_duration_minutes / run_duration_minutes are their "
    "time windows; mention preferred times in each day's focus.\n"
    "8. Write coach_summary (2-4 sentences) and each day's focus (one sentence) "
    "in TURKISH.\n"
    "Output: STRICT JSON matching the response schema. No exercise lists — only "
    "template_id selections and optional modifications."
)

_DAY_NAMES = [
    "Pazartesi",
    "Sali",
    "Carsamba",
    "Persembe",
    "Cuma",
    "Cumartesi",
    "Pazar",
]

DAY_PLAN_SYSTEM_INSTRUCTION = (
    "Role: Elite hybrid training program designer (HYROX / CrossFit / strength).\n"
    "Task: Build ONE training session for a SINGLE calendar day from the athlete "
    "context and exercise catalog.\n"
    "STRICT RULES:\n"
    "1. exercise_id MUST be one of the catalog 'id' values. Unknown movements: "
    "exercise_id null, clear name.\n"
    "2. CNS recovery: avoid stacking multiple cns >= 1.8 in one session unless "
    "session_kind is metcon and duration is short.\n"
    "3. session_kind: 'gym' -> strength/metcon/power/technique focus; 'running' -> "
    "running/endurance workout_type; 'hybrid' -> combine run + gym elements.\n"
    "4. DURATION IS MANDATORY — Total work INCLUDING rest must reach "
    "duration_minutes (±10%). Scale sets, rounds, distances and rest periods "
    "upward for long sessions (60-90+ min). A 75-minute gym session needs "
    "substantial volume (many sets/rounds), NOT a 30-minute metcon.\n"
    "5. Measurement rules: reps needs reps; time needs duration_seconds; "
    "distance needs distance_m.\n"
    "6. template.workout_type: hybrid, running, strength, metcon, endurance, "
    "power, technique, recovery. template.format: standard, circuit, emom, "
    "amrap, for_time.\n"
    "7. Equipment limits: standard_gym -> no sled/SkiErg/wall ball; minimal -> "
    "bodyweight/dumbbell/running only.\n"
    "8. Skill gating per olympic_proficiency and sled_experience.\n"
    "9. Write focus (one sentence) and all instructions in TURKISH.\n"
    "Output: STRICT JSON matching the response schema. No extra commentary."
)

MODIFY_WORKOUT_SYSTEM_INSTRUCTION = (
    "Role: Elite hybrid training coach revising an existing workout template.\n"
    "Task: Modify the provided workout based on the athlete's change_reason while "
    "keeping safe, coherent structure.\n"
    "STRICT RULES:\n"
    "1. Preserve exercise_id values from the original when the movement stays; "
    "catalog ids only for new movements.\n"
    "2. Address change_reason directly in coach_note (1-2 sentences, Turkish).\n"
    "3. If target_duration_minutes is set, total work INCLUDING rest must match "
    "it (±10%). Scale volume accordingly.\n"
    "4. Do not remove all exercises; produce a complete revised template.\n"
    "5. Measurement and workout_type/format rules same as plan generation.\n"
    "6. Write focus and instructions in TURKISH.\n"
    "Output: STRICT JSON matching the response schema. No extra commentary."
)

SUGGEST_EXERCISE_SYSTEM_INSTRUCTION = (
    "Role: Elite hybrid training coach picking ONE next exercise for a workout.\n"
    "Task: Suggest exactly ONE exercise that fits the current session, the "
    "movement before it (if any), and the athlete's weekly plan context.\n"
    "STRICT RULES:\n"
    "1. exercise_id MUST be from catalog 'id'. Unknown: exercise_id null, clear name.\n"
    "2. mode=append: pick the logical NEXT movement — alternate push/pull, "
    "avoid duplicate names or exercise_ids already in existing_exercises, "
    "respect CNS (do not stack multiple cns>=1.8 back-to-back unless metcon).\n"
    "3. mode=replace: substitute the exercise at replace_index with a similar "
    "role but better fit (variation, injury-friendly swap, or progression).\n"
    "4. weekly_context: avoid overloading muscle groups already hit heavily "
    "on other days this week.\n"
    "5. Match workout_type/format (circuit -> concise stations, strength -> "
    "sets/reps with rest, running -> distance/time).\n"
    "6. Include realistic sets, reps/distance/time, rest_seconds, rpe (1-10), "
    "optional weight_kg and brief instructions.\n"
    "7. Measurement rules: reps needs reps; time needs duration_seconds; "
    "distance needs distance_m.\n"
    "8. Equipment/skill limits from athlete_context.\n"
    "9. coach_note: 1 short Turkish sentence explaining WHY this exercise.\n"
    "Output: STRICT JSON matching the response schema. No extra commentary."
)

SUNDAY_REVIEW_SYSTEM_INSTRUCTION = (
    "Role: Elite hybrid performance coach conducting the athlete's weekly Sunday review.\n"
    "Task: Analyze workout logs (especially journal_notes and user_reported_rpe), "
    "the athlete's self-reported nutrition adherence, recovery feeling, missed "
    "workout context, plan compliance, and deterministic weekly metrics "
    "(muscle volume, CNS load, overtraining flags).\n"
    "Tone: Empathic but direct — like a world-class coach who reads between the lines.\n"
    "Language: Write ALL text fields in TURKISH.\n"
    "Output STRICT JSON:\n"
    "- review_summary: 3-5 sentences evaluating the week holistically\n"
    "- next_week_adjustments: 2-4 tactical recommendations as one string "
    "(use bullet lines with '- ' prefix)\n"
    "- readiness_score: integer 1-10 for readiness to push next week "
    "(1=needs deload/rest, 10=prime to attack)\n"
    "Never diagnose medical conditions. If injury is mentioned, advise caution "
    "and smart volume modification."
)


async def _generate_structured(
    *,
    system_instruction: str,
    contents: str,
    response_schema: type,
    parse_fn,
    coerce_fn,
    temperature: float = 0.55,
    max_output_tokens: int = 4096,
):
    settings = get_settings()
    if not settings.gemini_api_key:
        raise AIServiceNotConfiguredError(
            "GEMINI_API_KEY tanimli degil. .env dosyasina ekleyin."
        )

    client = genai.Client(api_key=settings.gemini_api_key)
    last_error: Exception | None = None

    for attempt in range(3):
        try:
            response = await client.aio.models.generate_content(
                model=settings.gemini_model,
                contents=contents,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_schema=response_schema,
                    temperature=temperature + attempt * 0.05,
                    max_output_tokens=max_output_tokens,
                ),
            )
            if not response.text:
                raise ValueError("Gemini bos yanit dondurdu.")
            parsed = parse_fn(response.text)
            return coerce_fn(parsed)
        except (ValidationError, ValueError) as exc:
            last_error = exc
            continue

    assert last_error is not None
    raise last_error


async def generate_onboarding_plan(
    db: AsyncSession,
    user_id: str,
    payload: OnboardingPayload,
    catalog: list[dict],
) -> GeneratedWeekPlan:
    """Atlet profilinden haftalik program: AI sablon secer, backend hydrate eder.

    Token maliyeti dusurulur: Gemini yalnizca template_id + modifications doner;
    exercises JSONB veritabanindan deterministik olarak birlestirilir.
    """
    available_templates = await fetch_coach_template_catalog(db)
    if not available_templates:
        raise ValueError(
            "Sistem sablonlari bulunamadi. coach_workout_templates tablosunu kontrol edin."
        )

    compact_catalog = [
        {"id": item["id"], "name": item["name"], "category": item["category"]}
        for item in catalog
    ]
    coaching_context = await build_plan_coaching_context(db, user_id)

    ai_selection = await _generate_structured(
        system_instruction=PLAN_SYSTEM_INSTRUCTION,
        contents=(
            "Athlete profile:\n"
            + payload.model_dump_json(indent=2)
            + "\n\nCoaching context (Sunday review + journal notes + metrics):\n"
            + json.dumps(coaching_context, ensure_ascii=False, indent=2)
            + "\n\nAvailable Templates (select template_id from this list ONLY):\n"
            + json.dumps(available_templates, ensure_ascii=False, indent=2)
            + "\n\nExercise catalog (for modifications.add/remove exercise_id only):\n"
            + json.dumps(compact_catalog, ensure_ascii=False)
        ),
        response_schema=WeeklyPlanAIResponse,
        parse_fn=parse_weekly_plan_ai,
        coerce_fn=lambda ai: ai,
        max_output_tokens=2048,
    )

    template_ids = list({day.template_id for day in ai_selection.days})
    templates_by_id = await fetch_coach_templates_by_ids(db, template_ids)

    return hydrate_weekly_plan_from_templates(
        ai_selection, payload, templates_by_id, catalog
    )


async def generate_day_workout(
    payload: DayWorkoutGeneratePayload, catalog: list[dict]
) -> GeneratedDayWorkout:
    """Tek gun icin AI idman uretir; sure deterministik olarak zorlanir."""
    day_name = _DAY_NAMES[payload.day_of_week]
    athlete = payload.athlete_context.model_dump() if payload.athlete_context else {}
    request = {
        "day_of_week": payload.day_of_week,
        "day_name": day_name,
        "session_kind": payload.session_kind,
        "duration_minutes": payload.duration_minutes,
        "preferred_workout_type": payload.preferred_workout_type,
        "athlete_context": athlete,
    }
    return await _generate_structured(
        system_instruction=DAY_PLAN_SYSTEM_INSTRUCTION,
        contents=(
            "Single-day workout request:\n"
            + json.dumps(request, ensure_ascii=False, indent=2)
            + "\n\nExercise catalog (id / name / category / cns load factor):\n"
            + json.dumps(catalog, ensure_ascii=False)
        ),
        response_schema=AiSingleDayResponse,
        parse_fn=parse_ai_single_day,
        coerce_fn=lambda ai: coerce_ai_single_day(
            ai, target_minutes=payload.duration_minutes
        ),
    )


async def modify_workout_with_ai(
    payload: WorkoutModifyPayload, catalog: list[dict]
) -> ModifiedWorkoutResponse:
    """Mevcut sablonu kullanici geri bildirimiyle AI uzerinden revize eder."""
    request = {
        "change_reason": payload.change_reason,
        "target_duration_minutes": payload.target_duration_minutes,
        "current_template": payload.template.model_dump(),
    }
    target = payload.target_duration_minutes
    fallback_name = payload.template.name
    return await _generate_structured(
        system_instruction=MODIFY_WORKOUT_SYSTEM_INSTRUCTION,
        contents=(
            "Workout revision request:\n"
            + json.dumps(request, ensure_ascii=False, indent=2)
            + "\n\nExercise catalog (id / name / category / cns load factor):\n"
            + json.dumps(catalog, ensure_ascii=False)
        ),
        response_schema=AiModifyResponse,
        parse_fn=parse_ai_modify,
        coerce_fn=lambda ai: coerce_ai_modify(
            ai,
            target_minutes=target,
            fallback_name=fallback_name,
        ),
    )


async def suggest_exercise_with_ai(
    payload: ExerciseSuggestPayload, catalog: list[dict]
) -> ExerciseSuggestResponse:
    """Mevcut idman taslagina tek egzersiz onerir (ekle veya degistir)."""
    day_name = (
        _DAY_NAMES[payload.day_of_week]
        if payload.day_of_week is not None
        else None
    )
    request = {
        "mode": payload.mode,
        "replace_index": payload.replace_index,
        "workout_name": payload.workout_name,
        "workout_type": payload.workout_type,
        "format": payload.format,
        "rounds": payload.rounds,
        "time_cap_minutes": payload.time_cap_minutes,
        "day_of_week": payload.day_of_week,
        "day_name": day_name,
        "existing_exercises": [e.model_dump() for e in payload.existing_exercises],
        "weekly_context": [w.model_dump() for w in payload.weekly_context],
        "athlete_context": (
            payload.athlete_context.model_dump() if payload.athlete_context else {}
        ),
    }
    return await _generate_structured(
        system_instruction=SUGGEST_EXERCISE_SYSTEM_INSTRUCTION,
        contents=(
            "Exercise suggestion request:\n"
            + json.dumps(request, ensure_ascii=False, indent=2)
            + "\n\nExercise catalog (id / name / category / cns load factor):\n"
            + json.dumps(catalog, ensure_ascii=False)
        ),
        response_schema=AiSuggestExerciseResponse,
        parse_fn=parse_ai_suggest_exercise,
        coerce_fn=coerce_ai_suggest_exercise,
        max_output_tokens=2048,
    )


async def generate_sunday_review(
    db: AsyncSession,
    user_id: str,
    payload: SundayReviewPayload,
) -> SundayReviewResponse:
    """Son 7 gunluk loglar + mobil oz-degerlendirmeyi Gemini ile haftalik koc notuna donusturur."""
    workout_logs = await fetch_weekly_workout_logs(db, user_id)
    plan_compliance = await fetch_weekly_plan_compliance(db, user_id)
    metrics = await build_weekly_metrics(db, user_id)

    context = {
        "athlete_reflection": payload.model_dump(),
        "plan_compliance": plan_compliance,
        "workout_logs_last_7_days": workout_logs,
        "weekly_metrics": metrics.model_dump(),
    }

    settings = get_settings()
    if not settings.gemini_api_key:
        raise AIServiceNotConfiguredError(
            "GEMINI_API_KEY tanimli degil. .env dosyasina ekleyin."
        )

    client = genai.Client(api_key=settings.gemini_api_key)
    last_error: Exception | None = None

    for attempt in range(3):
        try:
            response = await client.aio.models.generate_content(
                model=settings.gemini_model,
                contents=(
                    "Weekly Sunday review context (deterministic metrics + athlete input):\n"
                    + json.dumps(context, ensure_ascii=False, indent=2)
                ),
                config=genai_types.GenerateContentConfig(
                    system_instruction=SUNDAY_REVIEW_SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                    response_schema=SundayReviewResponse,
                    temperature=0.65 + attempt * 0.05,
                    max_output_tokens=1024,
                ),
            )
            if not response.text:
                raise ValueError("Gemini bos yanit dondurdu.")
            return SundayReviewResponse.model_validate_json(response.text)
        except (ValidationError, ValueError) as exc:
            last_error = exc
            continue

    assert last_error is not None
    raise last_error
