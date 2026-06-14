/**
 * Idmanin "ne zaman" yapildigini temsil eden durum + payload donusumu.
 *
 * Kullanici sabah baslatmayi unutmus olabilir veya gecmis bir gunu girebilir;
 * bu yuzden tarih ve opsiyonel baslangic/bitis saati ayri ayri tutulur.
 * - date: gun (saat onemsiz; gun bazli secim)
 * - startMin / endMin: gece yarisindan itibaren dakika (null = girilmemis)
 */

export type WhenState = {
  /** Secilen gun (yerel). Saat bileseni resolveWhen'de uygulanir. */
  date: Date;
  startMin: number | null;
  endMin: number | null;
};

export function todayWhen(): WhenState {
  return { date: startOfDay(new Date()), startMin: null, endMin: null };
}

export function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

const TR_DAYS = ["Paz", "Pzt", "Sal", "Car", "Per", "Cum", "Cmt"];
const TR_MONTHS = [
  "Oca", "Sub", "Mar", "Nis", "May", "Haz",
  "Tem", "Agu", "Eyl", "Eki", "Kas", "Ara",
];

/** Bugun/Dun gibi gorece etiket; yoksa null. */
export function relativeDayLabel(d: Date): string | null {
  const now = new Date();
  if (isSameDay(d, now)) return "Bugun";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) return "Dun";
  return null;
}

/** "14 Haz Cmt" gibi takvim etiketi. */
export function calendarLabel(d: Date): string {
  return `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${TR_DAYS[d.getDay()]}`;
}

/** "Bugun" / "Dun" / "12 Haz Pzt" gibi kisa, Turkce gun etiketi. */
export function dayLabel(d: Date): string {
  return relativeDayLabel(d) ?? calendarLabel(d);
}

/** "Bugun · 14 Haz Cmt" gibi hem gorece hem takvim iceren tam etiket. */
export function fullDayLabel(d: Date): string {
  const rel = relativeDayLabel(d);
  return rel ? `${rel} · ${calendarLabel(d)}` : calendarLabel(d);
}

export function minutesToLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type ResolvedWhen = {
  /** Backend'e gidecek ISO tarih; bugun + saat yoksa null (sunucu zamani). */
  dateISO: string | null;
  /** Baslangic-bitis araligindan turetilen sure (dk); yoksa null. */
  durationMinutes: number | null;
};

/**
 * WhenState'i payload alanlarina cevirir.
 *
 * - Saat verilmisse: secilen gunun o saatine sabitlenir; bitis saati varsa
 *   kayit zamani olarak bitis kullanilir (idman o saatte bitmis gibi).
 * - Saat yoksa ve gun bugun degilse: gunun 12:00'sine sabitlenir.
 * - Saat yoksa ve gun bugunse: null doner (sunucu su anki zamani kullanir).
 * - durationMinutes yalnizca hem baslangic hem bitis girilmisse hesaplanir.
 */
export function resolveWhen(state: WhenState): ResolvedWhen {
  const anchorMinutes = state.endMin ?? state.startMin;
  let dateISO: string | null = null;

  if (anchorMinutes != null) {
    const d = startOfDay(state.date);
    d.setHours(Math.floor(anchorMinutes / 60), anchorMinutes % 60, 0, 0);
    dateISO = d.toISOString();
  } else if (!isToday(state.date)) {
    const d = startOfDay(state.date);
    d.setHours(12, 0, 0, 0);
    dateISO = d.toISOString();
  }

  let durationMinutes: number | null = null;
  if (state.startMin != null && state.endMin != null) {
    durationMinutes = state.endMin - state.startMin;
    if (durationMinutes <= 0) durationMinutes = null; // gece yarisi asimi vb. -> manuel sure
  }

  return { dateISO, durationMinutes };
}
