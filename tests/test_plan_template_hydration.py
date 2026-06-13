"""Sablon-secim (RAG) hydration testleri — AI'siz, deterministik."""

from app.schemas.ai_plan import TemplateModifications, WeeklyPlanAIDay, WeeklyPlanAIResponse
from app.schemas.onboarding import OnboardingPayload
from app.services.plan_coercion import hydrate_weekly_plan_from_templates

_MIN_PAYLOAD = OnboardingPayload(
    goal="hybrid",
    training_days=[0, 2, 4],
    days_per_week=3,
    wants_running=False,
    running_days=[],
    split_run_and_gym=False,
    gym_preferred_start="17:00",
    gym_preferred_end="20:00",
    run_preferred_start="06:00",
    run_preferred_end="08:00",
    gym_fed_state="fed",
    run_fed_state="flexible",
    gym_duration_minutes=120,
    run_duration_minutes=60,
    five_k_pace_seconds_per_km=330,
    zone2_habit="sometimes",
    sled_experience="some",
    olympic_proficiency="learning",
    weekend_conditioning=False,
    nutrition_constraint="none",
    equipment="full_box",
)

_STRUCTURA_ROW = {
    "template_id": "tmpl_structura_a",
    "name": "Structura Hypertrophy A",
    "category": "strength",
    "description": "Hipertrofi blogu",
    "exercises": [
        {"exercise_id": "back_squat", "sets": 4, "reps": 8},
        {"exercise_id": "bench_press", "sets": 4, "reps": 8},
        {"exercise_id": "wall_balls", "sets": 3, "reps": 20},
    ],
}

_CATALOG = [
    {"id": "back_squat", "name": "Back Squat", "category": "strength"},
    {"id": "bench_press", "name": "Bench Press", "category": "strength"},
    {"id": "wall_balls", "name": "Wall Balls", "category": "hyrox"},
    {"id": "box_jump", "name": "Box Jump", "category": "crossfit"},
]


class TestTemplateHydration:
    def test_hydrates_template_and_applies_modifications(self):
        ai = WeeklyPlanAIResponse(
            coach_summary="Haftalik plan hazir.",
            days=[
                WeeklyPlanAIDay(
                    day_of_week=0,
                    template_id="tmpl_structura_a",
                    focus="Pazartesi kuvvet",
                    modifications=TemplateModifications(
                        remove_exercises=["wall_balls"],
                        add_exercises=["box_jump"],
                    ),
                )
            ],
        )

        plan = hydrate_weekly_plan_from_templates(
            ai,
            _MIN_PAYLOAD,
            {"tmpl_structura_a": _STRUCTURA_ROW},
            _CATALOG,
        )

        assert plan.coach_summary == "Haftalik plan hazir."
        assert len(plan.days) == 1
        exercises = plan.days[0].template.exercises
        ids = [ex.exercise_id for ex in exercises]
        assert "wall_balls" not in ids
        assert "box_jump" in ids
        assert "back_squat" in ids

    def test_unknown_template_id_skipped(self):
        ai = WeeklyPlanAIResponse(
            coach_summary="Ozet",
            days=[
                WeeklyPlanAIDay(
                    day_of_week=0,
                    template_id="tmpl_does_not_exist",
                    focus="Test",
                )
            ],
        )

        try:
            hydrate_weekly_plan_from_templates(ai, _MIN_PAYLOAD, {}, _CATALOG)
            assert False, "expected ValueError"
        except ValueError as exc:
            assert "hydrate" in str(exc).lower()
