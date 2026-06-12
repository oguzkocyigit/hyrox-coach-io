/**
 * Antrenman programi alan sabitleri: tip/format etiketleri, kategorik
 * renkler ve tahmini sure hesabi. Tum hesaplar deterministiktir.
 */

import type {
  Measurement,
  PlanWorkoutType,
  TemplateExercise,
  WorkoutFormat,
  WorkoutTemplateCreate,
} from "@/api/types";
import { color } from "@/ui/tokens";

/** Idman tipi rozetleri icin kategorik renkler (grafik amacli, accent degil). */
export const WORKOUT_TYPES: {
  id: PlanWorkoutType;
  label: string;
  dot: string;
}[] = [
  { id: "hybrid", label: "Hibrit", dot: color.categorical.green },
  { id: "running", label: "Kosu", dot: color.categorical.blue },
  { id: "strength", label: "Kuvvet", dot: color.categorical.purple },
  { id: "metcon", label: "Metcon", dot: color.categorical.amber },
  { id: "endurance", label: "Dayaniklilik", dot: color.categorical.sky },
  { id: "power", label: "Guc", dot: color.categorical.red },
  { id: "technique", label: "Teknik", dot: color.categorical.orange },
  { id: "recovery", label: "Toparlanma", dot: color.categorical.mint },
];

export const WORKOUT_FORMATS: {
  id: WorkoutFormat;
  label: string;
  description: string;
}[] = [
  {
    id: "standard",
    label: "Standard",
    description: "Klasik set x tekrar akisi; her egzersiz kendi setleriyle.",
  },
  {
    id: "circuit",
    label: "Circuit",
    description: "Tum egzersizleri sirayla bitir, belirtilen tur kadar tekrarla.",
  },
  {
    id: "emom",
    label: "EMOM",
    description: "Her dakika basinda yeni hareket; kalan sure dinlenme.",
  },
  {
    id: "amrap",
    label: "AMRAP",
    description: "Sure dolana kadar mumkun oldugunca cok tur.",
  },
  {
    id: "for_time",
    label: "For Time",
    description: "Listedeki isi en kisa surede bitir; sure kaydedilir.",
  },
];

export const MEASUREMENTS: { id: Measurement; label: string; icon: string }[] = [
  { id: "reps", label: "Tekrar", icon: "repeat" },
  { id: "time", label: "Sure", icon: "time-outline" },
  { id: "distance", label: "Mesafe", icon: "flag-outline" },
];

export function typeMeta(id: PlanWorkoutType) {
  return WORKOUT_TYPES.find((t) => t.id === id) ?? WORKOUT_TYPES[0];
}

export function formatMeta(id: WorkoutFormat) {
  return WORKOUT_FORMATS.find((f) => f.id === id) ?? WORKOUT_FORMATS[0];
}

/** Tur sayisi bu formatlarda anlamlidir. */
export function formatUsesRounds(format: WorkoutFormat): boolean {
  return format === "circuit" || format === "emom";
}

/** Sure limiti bu formatlarda anlamlidir. */
export function formatUsesTimeCap(format: WorkoutFormat): boolean {
  return format === "amrap" || format === "for_time" || format === "emom";
}

/** Egzersiz satiri ozeti: "4 set x 10 @ 22kg · 90s dinlenme" gibi. */
export function exerciseSummary(e: TemplateExercise): string {
  const parts: string[] = [];
  if (e.measurement === "reps") {
    parts.push(`${e.sets} set x ${e.reps ?? 0}`);
  } else if (e.measurement === "time") {
    parts.push(`${e.sets} set x ${formatSeconds(e.duration_seconds ?? 0)}`);
  } else {
    const m = e.distance_m ?? 0;
    parts.push(`${e.sets} set x ${m >= 1000 ? `${m / 1000}km` : `${m}m`}`);
  }
  if (e.weight_kg) parts.push(`${e.weight_kg}kg`);
  if (e.rest_seconds > 0) parts.push(`${e.rest_seconds}s dinlenme`);
  return parts.join(" · ");
}

export function formatSeconds(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}dk` : `${minutes}dk ${seconds}s`;
}

/**
 * Deterministik tahmini sure (dakika).
 * Kaba kabuller: 1 tekrar ~ 4sn, mesafe ~ 3dk/km tempo, gecisler icin %10 pay.
 * AMRAP/For Time'da time cap varsa dogrudan o kullanilir.
 */
export function estimateDurationMinutes(
  template: Pick<WorkoutTemplateCreate, "exercises" | "rounds" | "format" | "time_cap_minutes">,
): number {
  if (formatUsesTimeCap(template.format) && template.time_cap_minutes) {
    return template.time_cap_minutes;
  }

  let totalSeconds = 0;
  for (const e of template.exercises) {
    let workPerSet = 0;
    if (e.measurement === "reps") workPerSet = (e.reps ?? 0) * 4;
    else if (e.measurement === "time") workPerSet = e.duration_seconds ?? 0;
    else workPerSet = ((e.distance_m ?? 0) / 1000) * 180;
    totalSeconds += e.sets * (workPerSet + e.rest_seconds);
  }
  const rounds = formatUsesRounds(template.format) ? template.rounds : 1;
  totalSeconds = totalSeconds * rounds * 1.1;
  return Math.max(1, Math.round(totalSeconds / 60));
}
