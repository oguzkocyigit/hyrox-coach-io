/**
 * Haftalik plan verisini AI egzersiz onerisi baglamina cevirir.
 */

import type { PlanEntry, WeeklyDayContext } from "@/api/types";

const DAY_NAMES = [
  "Pazartesi",
  "Sali",
  "Carsamba",
  "Persembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
];

/** ISO tarihten 0=Pzt ... 6=Paz gun indeksi. */
export function dayOfWeekFromIso(iso: string): number {
  const d = new Date(`${iso}T12:00:00`);
  return (d.getDay() + 6) % 7;
}

export function buildWeeklyContext(entries: PlanEntry[]): WeeklyDayContext[] {
  return entries.map((entry) => {
    const dow = dayOfWeekFromIso(entry.scheduled_date);
    return {
      day_of_week: dow,
      day_name: DAY_NAMES[dow] ?? `Gun ${dow + 1}`,
      workout_name: entry.template.name,
      exercise_names: entry.template.exercises.map((e) => e.name),
    };
  });
}
