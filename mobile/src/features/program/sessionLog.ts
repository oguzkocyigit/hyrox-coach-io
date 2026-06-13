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
  WorkoutTemplate,
  WorkoutSet,
} from "@/api/types";
import { usesCircuitRounds } from "@/features/program/normalizeTemplate";
import { parseNum } from "@/features/workout-log/draft";

export type SetLogDraft = {
  completed: boolean;
  weight: string;
  value: string;
  rpe: string;
};

export type SessionExerciseLog = {
  measurement: SetMeasurement;
  resolvedExerciseId: string | null;
  sets: SetLogDraft[];
};

export function resolveExerciseId(
  exercise: TemplateExercise,
  catalog: Exercise[],
): string | null {
  if (exercise.exercise_id) return exercise.exercise_id;
  const key = exercise.name.trim().toLowerCase();
  const exact = catalog.find((e) => e.name.trim().toLowerCase() === key);
  if (exact) return exact.exercise_id;
  const partial = catalog.find(
    (e) =>
      e.name.toLowerCase().includes(key) ||
      key.includes(e.name.trim().toLowerCase()),
  );
  return partial?.exercise_id ?? null;
}

export function templateMeasurementToSet(measurement: Measurement): SetMeasurement {
  return measurement;
}

export function defaultLogValue(exercise: TemplateExercise): string {
  if (exercise.measurement === "reps") return String(exercise.reps ?? "");
  if (exercise.measurement === "time") return String(exercise.duration_seconds ?? "");
  return String(exercise.distance_m ?? "");
}

function emptySetDraft(exercise: TemplateExercise): SetLogDraft {
  return {
    completed: false,
    weight: exercise.weight_kg != null ? String(exercise.weight_kg) : "0",
    value: defaultLogValue(exercise),
    rpe: exercise.rpe != null ? String(exercise.rpe) : "",
  };
}

function setCountForExercise(template: WorkoutTemplate, exercise: TemplateExercise): number {
  if (usesCircuitRounds(template.format)) return Math.max(1, template.rounds);
  return Math.max(1, exercise.sets);
}

export function initSessionLogs(
  template: WorkoutTemplate,
  catalog: Exercise[],
): SessionExerciseLog[] {
  return template.exercises.map((exercise) => ({
    measurement: templateMeasurementToSet(exercise.measurement),
    resolvedExerciseId: resolveExerciseId(exercise, catalog),
    sets: Array.from({ length: setCountForExercise(template, exercise) }, () =>
      emptySetDraft(exercise),
    ),
  }));
}

export function isExerciseDoneInRound(
  log: SessionExerciseLog,
  roundIndex: number,
): boolean {
  return log.sets[roundIndex]?.completed ?? false;
}

export function isRoundComplete(
  logs: SessionExerciseLog[],
  roundIndex: number,
): boolean {
  return logs.every((log) => isExerciseDoneInRound(log, roundIndex));
}

export function totalCompletedSets(logs: SessionExerciseLog[]): number {
  return logs.reduce(
    (sum, log) => sum + log.sets.filter((s) => s.completed).length,
    0,
  );
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
    const completedSets = log.sets.filter((s) => s.completed);
    if (completedSets.length === 0) continue;

    if (!log.resolvedExerciseId) {
      return {
        ok: false,
        message: `"${templateEx.name}" katalogda bulunamadi; katalogdan eslestir.`,
      };
    }

    const workoutSets: WorkoutSet[] = [];
    for (const setDraft of completedSets) {
      const weight = parseNum(setDraft.weight);
      const value = parseNum(setDraft.value);
      const setRpe = setDraft.rpe.trim() === "" ? null : parseNum(setDraft.rpe);

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
      workoutSets.push(set);
    }

    exercises.push({ exercise_id: log.resolvedExerciseId, sets: workoutSets });
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

export function activeSetIndex(
  template: WorkoutTemplate,
  currentRound: number,
): number {
  if (usesCircuitRounds(template.format)) {
    return Math.max(0, Math.min(template.rounds - 1, currentRound - 1));
  }
  return 0;
}

export function totalSetSlots(template: WorkoutTemplate): number {
  if (usesCircuitRounds(template.format)) {
    return template.exercises.length * template.rounds;
  }
  return template.exercises.reduce((sum, e) => sum + Math.max(1, e.sets), 0);
}
