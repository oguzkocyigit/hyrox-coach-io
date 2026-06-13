/**
 * Mevcut sablonlari istasyon/circuit mantigina cevirir (backend coercion ile uyumlu).
 * AI oncesi kaydedilmis for_time + 3 set sablonlari goruntuleme/oturumda duzeltilir.
 */

import type { TemplateExercise, WorkoutFormat, WorkoutTemplate, WorkoutTemplateCreate } from "@/api/types";
import { estimateDurationMinutes, formatUsesRounds } from "@/features/program/constants";

const CONDITIONING_TYPES = new Set(["metcon", "hybrid", "endurance"]);
const STATION_FORMATS = new Set<WorkoutFormat>(["circuit", "for_time", "amrap"]);

function inferRounds(template: WorkoutTemplateCreate): number {
  if (!STATION_FORMATS.has(template.format)) return template.rounds;

  const targetMinutes =
    template.time_cap_minutes ?? estimateDurationMinutes(template);
  if (targetMinutes <= 0) return Math.max(3, template.rounds);

  let roundSeconds = 0;
  for (const exercise of template.exercises) {
    if (exercise.measurement === "reps") {
      roundSeconds += (exercise.reps ?? 0) * 4;
    } else if (exercise.measurement === "time") {
      roundSeconds += exercise.duration_seconds ?? 0;
    } else {
      roundSeconds += ((exercise.distance_m ?? 0) / 1000) * 180;
    }
  }
  roundSeconds = Math.max(roundSeconds, 60);
  const rounds = Math.round((targetMinutes * 60) / roundSeconds);
  return Math.min(50, Math.max(3, rounds));
}

function normalizeStations(template: WorkoutTemplateCreate): WorkoutTemplateCreate {
  let format = template.format;
  let workoutType = template.workout_type;

  if (CONDITIONING_TYPES.has(workoutType) && format === "standard") {
    if (template.exercises.length >= 3) format = "circuit";
  }

  if (!STATION_FORMATS.has(format)) return template;

  const exercises: TemplateExercise[] = template.exercises.map((exercise) => ({
    ...exercise,
    sets: 1,
    rest_seconds: 0,
  }));

  let rounds = template.rounds;
  if ((format === "circuit" || format === "amrap" || format === "for_time") && rounds <= 1) {
    rounds = inferRounds({ ...template, format, exercises });
  }

  return { ...template, format, exercises, rounds };
}

/** Sablonu goruntuleme/oturum/onay oncesi normalize et. */
export function normalizeWorkoutTemplate<T extends WorkoutTemplate | WorkoutTemplateCreate>(
  template: T,
): T {
  return normalizeStations(template) as T;
}

export function usesCircuitRounds(format: WorkoutFormat): boolean {
  return formatUsesRounds(format) || format === "for_time" || format === "amrap";
}
