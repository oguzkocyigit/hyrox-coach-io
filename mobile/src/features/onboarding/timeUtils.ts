/** Dakika (gece yarisindan itibaren) <-> HH:MM donusumleri. */

export function minutesToTimeString(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function timeStringToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function formatTimeRange(startMinutes: number, endMinutes: number): string {
  return `${minutesToTimeString(startMinutes)} – ${minutesToTimeString(endMinutes)}`;
}

/** Baslangic–bitis araligindan idman suresi (dk). */
export function durationMinutesFromRange(startMinutes: number, endMinutes: number): number {
  return Math.max(0, endMinutes - startMinutes);
}

/** 30 dk adimlarla min–max arasi tum zamanlar. */
export function timeOptions(minMinutes: number, maxMinutes: number, step = 30): number[] {
  const out: number[] = [];
  for (let t = minMinutes; t <= maxMinutes; t += step) {
    out.push(t);
  }
  return out;
}
