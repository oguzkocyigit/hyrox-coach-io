"""Plan sure olceklendirme testleri (deterministik, AI'siz)."""

from app.schemas.plans import TemplateExercise, WorkoutTemplateCreate
from app.services.plan_coercion import (
    estimate_template_minutes,
    scale_template_to_duration,
)


def _short_metcon() -> WorkoutTemplateCreate:
    return WorkoutTemplateCreate(
        name="Kisa Metcon",
        workout_type="metcon",
        format="standard",
        rounds=1,
        exercises=[
            TemplateExercise(
                name="Burpee",
                measurement="reps",
                sets=3,
                reps=10,
                rest_seconds=60,
            ),
            TemplateExercise(
                name="Row",
                measurement="distance",
                sets=3,
                distance_m=500,
                rest_seconds=90,
            ),
        ],
    )


class TestDurationScaling:
    def test_short_template_scales_to_75_minutes(self):
        template = _short_metcon()
        before = estimate_template_minutes(template)
        assert before < 40

        scaled = scale_template_to_duration(template, 75)
        after = estimate_template_minutes(scaled)
        assert 66 <= after <= 84

    def test_amrap_uses_time_cap(self):
        template = WorkoutTemplateCreate(
            name="AMRAP",
            workout_type="metcon",
            format="amrap",
            rounds=1,
            time_cap_minutes=12,
            exercises=[
                TemplateExercise(
                    name="Thruster",
                    measurement="reps",
                    sets=1,
                    reps=10,
                )
            ],
        )
        scaled = scale_template_to_duration(template, 45)
        assert scaled.time_cap_minutes == 45
        assert estimate_template_minutes(scaled) == 45
