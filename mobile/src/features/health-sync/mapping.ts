/**
 * HealthKit kaydi -> backend HealthCardioSample donusumu.
 * Saf fonksiyonlar: HealthKit'e bagimlilik yok, birim testi yazilabilir.
 */

import type { CardioType, HealthCardioSample } from "@/api/types";

/** HealthKit Quantity: kutuphane surumune gore sayi ya da {quantity, unit}. */
type QuantityLike = number | { quantity: number; unit?: string } | null | undefined;

/** Senkron motorunun ihtiyac duydugu minimal workout sekli. */
export type HealthWorkoutLike = {
  uuid: string;
  startDate: Date | string;
  /** saniye (sayi) veya {quantity: saniye} */
  duration: QuantityLike;
  totalDistance?: QuantityLike;
};

function quantityOf(q: QuantityLike): number | null {
  if (q == null) return null;
  if (typeof q === "number") return Number.isFinite(q) ? q : null;
  return Number.isFinite(q.quantity) ? q.quantity : null;
}

/** Mesafeyi km'ye cevirir; birim bilinmiyorsa metre varsayilir. */
export function distanceToKm(q: QuantityLike): number {
  const value = quantityOf(q);
  if (value == null || value <= 0) return 0;
  const unit = typeof q === "object" && q?.unit ? q.unit.toLowerCase() : "m";
  if (unit === "km") return value;
  if (unit === "mi") return value * 1.60934;
  return value / 1000; // m ve bilinmeyenler
}

export function toCardioSample(
  workout: HealthWorkoutLike,
  cardioType: CardioType,
  avgHr: number | null,
): HealthCardioSample | null {
  const durationSeconds = quantityOf(workout.duration);
  if (durationSeconds == null || durationSeconds <= 0) return null;

  const start =
    workout.startDate instanceof Date
      ? workout.startDate
      : new Date(workout.startDate);
  if (Number.isNaN(start.getTime())) return null;

  return {
    external_id: workout.uuid,
    cardio_type: cardioType,
    start_time: start.toISOString(),
    distance_km: Math.round(distanceToKm(workout.totalDistance) * 1000) / 1000,
    duration_minutes: Math.round((durationSeconds / 60) * 10) / 10,
    avg_hr: avgHr != null ? Math.round(avgHr) : null,
    source: "apple_health",
  };
}

/** Backend limiti: istek basina en fazla 100 sample. */
export function toBatches<T>(items: T[], batchSize = 100): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}
