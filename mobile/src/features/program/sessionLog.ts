/**
 * Sablon egzersizinden idman oturumu log taslagina donusum.
 */

import type {
  Exercise,
  ExerciseLog,
  Measurement,
  SetMeasurement,
  TemplateExercise,
  WorkoutCreate,
  WorkoutFormat,
  WorkoutTemplate,
  WorkoutSet,
} from "@/api/types";
import { parseNum } from "@/features/workout-log/draft";

export type SessionExerciseLog = {
  completed: boolean;
  measurement: SetMeasurement;
  weight: string;
  value: string;
  rpe: string;
  resolvedExerciseId: string | null;
};

export function resolveExerciseId(
  exercise: TemplateExercise,
  catalog: Exercise[],
): string | null {
  if (exercise.exercise_id) return exercise.exercise_id;
  const key = exercise.name.trim().toLowerCase();
  const match = catalog.find((e) => e.name.trim().toLowerCase() === key);
  return match?.exercise_id ?? null;
}

export function templateMeasurementToSet(measurement: Measurement): SetMeasurement {
  return measurement;
}

export function defaultLogValue(exercise: TemplateExercise): string {
  if (exercise.measurement === "reps") return String(exercise.reps ?? "");
  if (exercise.measurement === "time") return String(exercise.duration_seconds ?? "");
  return String(exercise.distance_m ?? "");
}

export function initSessionLogs(
  template: WorkoutTemplate,
  catalog: Exercise[],
): SessionExerciseLog[] {
  return template.exercises.map((exercise) => ({
    completed: false,
    measurement: templateMeasurementToSet(exercise.measurement),
    weight: exercise.weight_kg != null ? String(exercise.weight_kg) : "0",
    value: defaultLogValue(exercise),
    rpe: exercise.rpe != null ? String(exercise.rpe) : "",
    resolvedExerciseId: resolveExerciseId(exercise, catalog),
  }));
}

export function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type SessionPayloadResult =
  | { ok: true; payload: WorkoutCreate }
  | { ok: false; message: string };

export function buildSessionPayload(args: {
  template: WorkoutTemplate;
  logs: SessionExerciseLog[];
  durationMinutes: number;
  overallRpe: number | null;
}): SessionPayloadResult {
  const exercises: ExerciseLog[] = [];

  for (let i = 0; i < args.template.exercises.length; i++) {
    const log = args.logs[i];
    const templateEx = args.template.exercises[i];
    if (!log.completed) continue;
    if (!log.resolvedExerciseId) {
      return {
        ok: false,
        message: `"${templateEx.name}" katalogda bulunamadi; kayit icin egzersizi duzenle.`,
      };
    }

    const weight = parseNum(log.weight);
    const value = parseNum(log.value);
    const setRpe = log.rpe.trim() === "" ? null : parseNum(log.rpe);

    if (weight === null || weight < 0) {
      return { ok: false, message: `${templateEx.name}: agirlik gir (vucut agirligi ise 0).` };
    }
    if (value === null || value <= 0) {
      return { ok: false, message: `${templateEx.name}: gecerli bir deger gir.` };
    }
    if (setRpe !== null && (setRpe < 1 || setRpe > 10)) {
      return { ok: false, message: `${templateEx.name}: RPE 1-10 arasi olmali.` };
    }

    const set: WorkoutSet = {
      measurement: log.measurement,
      weight_kg: weight,
    };
    if (setRpe !== null) set.rpe = setRpe;
    if (log.measurement === "reps") set.reps = Math.round(value);
    else if (log.measurement === "distance") set.distance_m = value;
    else set.duration_seconds = Math.round(value);

    exercises.push({ exercise_id: log.resolvedExerciseId, sets: [set] });
  }

  if (exercises.length === 0) {
    return { ok: false, message: "En az bir egzersizi tamamlandi olarak isaretle." };
  }

  return {
    ok: true,
    payload: {
      workout_type: args.template.name,
      user_reported_rpe: args.overallRpe ?? 7,
      duration_minutes: Math.max(1, Math.round(args.durationMinutes)),
      exercises,
      cardio: null,
    },
  };
}

export function isStationFormat(format: WorkoutFormat): boolean {
  return format === "circuit" || format === "for_time" || format === "amrap" || format === "emom";
}
