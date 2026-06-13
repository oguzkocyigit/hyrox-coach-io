/**
 * Idman kayit formunun taslak durumu ve payload donusumu.
 * Inputlar string tutulur (klavye girisi), gonderimde sayiya cevrilir.
 */

import type {
  CardioType,
  Exercise,
  ExerciseLog,
  SetMeasurement,
  WorkoutCreate,
  WorkoutSet,
} from "@/api/types";

export type SetDraft = {
  weight: string;
  /** measurement'a gore: tekrar sayisi / mesafe (m) / sure (sn) */
  value: string;
  rpe: string;
};

export type ExerciseDraft = {
  exercise: Exercise;
  measurement: SetMeasurement;
  sets: SetDraft[];
};

/**
 * Egzersize gore mantikli varsayilan olcum:
 * kosu ve mesafe bazli HYROX istasyonlari 'distance', digerleri 'reps'.
 */
export function defaultMeasurement(exercise: Exercise): SetMeasurement {
  if (exercise.category === "running") return "distance";
  if (exercise.category === "hyrox" && exercise.exercise_id !== "wall_balls") {
    return "distance";
  }
  return "reps";
}

export type CardioDraft = {
  cardio_type: CardioType;
  distance: string;
  duration: string;
  avgHr: string;
};

export const emptySet = (): SetDraft => ({ weight: "", value: "", rpe: "" });

export const emptyCardio = (): CardioDraft => ({
  cardio_type: "running",
  distance: "",
  duration: "",
  avgHr: "",
});

/** Virgullu girisleri de kabul eder ("82,5" -> 82.5). */
export function parseNum(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (normalized === "") return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export type DraftValidation =
  | { ok: true; payload: WorkoutCreate }
  | { ok: false; message: string };

export function buildPayload(args: {
  workoutType: string;
  rpe: number | null;
  duration: string;
  exercises: ExerciseDraft[];
  cardio: CardioDraft | null;
}): DraftValidation {
  const workoutType = args.workoutType.trim();
  if (!workoutType) {
    return { ok: false, message: "Idman tipi bos olamaz." };
  }
  if (args.rpe === null) {
    return { ok: false, message: "Idman geneli RPE sec (1-10)." };
  }
  const duration = parseNum(args.duration);
  if (duration === null || duration <= 0) {
    return { ok: false, message: "Gecerli bir sure gir (dakika)." };
  }

  const valueLabels: Record<SetMeasurement, string> = {
    reps: "tekrar",
    distance: "mesafe (m)",
    time: "sure (sn)",
  };

  const exercises: ExerciseLog[] = [];
  for (const draft of args.exercises) {
    const sets: WorkoutSet[] = [];
    for (let i = 0; i < draft.sets.length; i++) {
      const s = draft.sets[i];
      const weight = parseNum(s.weight);
      const value = parseNum(s.value);
      const setRpe = parseNum(s.rpe);
      if (weight === null || weight < 0) {
        return {
          ok: false,
          message: `${draft.exercise.name}: ${i + 1}. set icin agirlik gir (vucut agirligi ise 0).`,
        };
      }
      if (value === null || value <= 0) {
        return {
          ok: false,
          message: `${draft.exercise.name}: ${i + 1}. set icin ${valueLabels[draft.measurement]} gir.`,
        };
      }
      if (setRpe !== null && (setRpe < 1 || setRpe > 10)) {
        return {
          ok: false,
          message: `${draft.exercise.name}: ${i + 1}. set icin RPE 1-10 arasi olmali.`,
        };
      }
      const set: WorkoutSet = {
        measurement: draft.measurement,
        weight_kg: weight,
        rpe: setRpe ?? undefined,
      };
      if (draft.measurement === "reps") set.reps = Math.round(value);
      else if (draft.measurement === "distance") set.distance_m = value;
      else set.duration_seconds = Math.round(value);
      sets.push(set);
    }
    if (sets.length === 0) {
      return { ok: false, message: `${draft.exercise.name}: en az 1 set gir.` };
    }
    exercises.push({ exercise_id: draft.exercise.exercise_id, sets });
  }

  let cardio: WorkoutCreate["cardio"] = null;
  if (args.cardio) {
    const distance = parseNum(args.cardio.distance);
    const cardioDuration = parseNum(args.cardio.duration);
    if (distance === null || distance < 0 || cardioDuration === null || cardioDuration <= 0) {
      return { ok: false, message: "Kardiyo icin mesafe ve sure gir." };
    }
    const avgHr = parseNum(args.cardio.avgHr);
    if (args.cardio.avgHr.trim() !== "" && (avgHr === null || avgHr < 30 || avgHr > 250)) {
      return { ok: false, message: "Ortalama nabiz 30-250 arasi olmali." };
    }
    cardio = {
      cardio_type: args.cardio.cardio_type,
      distance_km: distance,
      duration_minutes: cardioDuration,
      avg_hr: args.cardio.avgHr.trim() === "" ? null : Math.round(avgHr!),
      source: "manual",
    };
  }

  if (exercises.length === 0 && cardio === null) {
    return { ok: false, message: "En az bir egzersiz veya kardiyo blogu ekle." };
  }

  return {
    ok: true,
    payload: {
      workout_type: workoutType,
      user_reported_rpe: args.rpe,
      duration_minutes: Math.round(duration),
      exercises: exercises.length > 0 ? exercises : null,
      cardio,
    },
  };
}
