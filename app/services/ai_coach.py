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
from app.schemas.ai_plan import (
    AiModifyResponse,
    AiPlanResponse,
    AiSingleDayResponse,
    AiSuggestExerciseResponse,
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
    coerce_ai_plan,
    coerce_ai_single_day,
    coerce_ai_suggest_exercise,
    parse_ai_modify,
    parse_ai_response,
    parse_ai_single_day,
    parse_ai_suggest_exercise,
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
    "3. SCHEDULING — training_days lists gym/strength session days (0=Monday ... "
    "6=Sunday). Output EXACTLY one entry per day in training_days. If wants_running "
    "is true, also program running on running_days: when split_run_and_gym is true "
    "and a day appears in BOTH lists, output TWO separate entries for that "
    "day_of_week (one running-focused, one gym-focused) with distinct templates; "
    "when split_run_and_gym is false and days overlap, output ONE hybrid entry "
    "combining run + gym in a single session. Running-only days (in running_days but "
    "NOT in training_days) get one running entry. Never output rest days.\n"
    "4. TIMING — Respect gym_preferred_start/end and run_preferred_start/end "
    "(HH:MM). Mention the athlete's preferred window in each day's focus (e.g. "
    "'06:00-08:00 arasi ac karnina kosu'). gym_fed_state / run_fed_state: "
    "'fasted' -> Zone 2 / easy aerobic only, no heavy lifting fasted; 'fed' -> "
    "athlete eats before session (light snack/meal ok); 'flexible' -> coach decides.\n"
    "4b. GOAL — strength: prioritize heavy lifts; conditioning: engine/metcon; "
    "hyrox: race stations + run integration; hybrid: balanced strength+engine; "
    "crossfit: varied WODs and skill work.\n"
    "5. DURATION — Total work (including rest) should approximate gym_duration_minutes "
    "for gym sessions and run_duration_minutes for running sessions. Scale sets, "
    "rounds and distances accordingly.\n"
    "6. Measurement rules are mandatory: measurement 'reps' requires reps; 'time' "
    "requires duration_seconds; 'distance' requires distance_m.\n"
    "7. template.workout_type must be one of: hybrid, running, strength, metcon, "
    "endurance, power, technique, recovery. template.format must be one of: "
    "standard, circuit, emom, amrap, for_time (amrap/for_time/emom should include "
    "time_cap_minutes).\n"
    "7b. HYROX / metcon / hybrid conditioning MUST use format 'circuit' or "
    "'for_time' — NOT 'standard'. Each station is ONE movement prescription "
    "(sets=1 per exercise): e.g. 1000m SkiErg, 100m Sled Push, NOT '3 set x 1000m'. "
    "Use template.rounds for how many times to repeat the full station list.\n"
    "8. Equipment limits: 'standard_gym' -> no sled, SkiErg or wall ball movements; "
    "'minimal' -> only bodyweight, dumbbell and running movements.\n"
    "9. If weekend_conditioning is true, place the hardest conditioning sessions on "
    "Saturday/Sunday (day_of_week 5-6) when compatible with training_days.\n"
    "10. Skill gating: do not program olympic lifts above the athlete's "
    "olympic_proficiency ('none' -> never, 'learning' -> technique work only). Same "
    "logic for sled_experience.\n"
    "11. Use the athlete's 5K pace to calibrate running paces and distances.\n"
    "12. Write coach_summary (2-4 sentences), each day's focus (one sentence) and "
    "all exercise instructions in TURKISH.\n"
    "Output: STRICT JSON matching the response schema. No extra commentary."
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
    payload: OnboardingPayload, catalog: list[dict]
) -> GeneratedWeekPlan:
    """Atlet profili + egzersiz katalogundan haftalik program uretir.

    Katalog deterministik motorun kaynagidir (exercise_id + cns_load_factor);
    AI yalnizca bu kimlikleri secip gunlere dagitir, hicbir metrik hesaplamaz.
    Gecici hatalarda en fazla 3 deneme yapilir.
    """
    return await _generate_structured(
        system_instruction=PLAN_SYSTEM_INSTRUCTION,
        contents=(
            "Athlete profile:\n"
            + payload.model_dump_json(indent=2)
            + "\n\nExercise catalog (id / name / category / cns load factor):\n"
            + json.dumps(catalog, ensure_ascii=False)
        ),
        response_schema=AiPlanResponse,
        parse_fn=parse_ai_response,
        coerce_fn=lambda ai: coerce_ai_plan(ai, payload),
        max_output_tokens=8192,
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
