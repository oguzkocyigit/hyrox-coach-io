/**
 * Canli idman oturumu kaliciligi (uygulama arka plana gidince kaybolmasin).
 */

import * as SecureStore from "expo-secure-store";

import type { SessionExerciseLog } from "@/features/program/sessionLog";

const STORAGE_KEY = "hyrox_active_workout_session";

export type PersistedSession = {
  templateId: string;
  planEntryId: string | null;
  status: "idle" | "running" | "paused" | "finished";
  elapsedSeconds: number;
  accumulatedSeconds: number;
  runningSince: number | null;
  currentRound: number;
  logs: SessionExerciseLog[];
  /** Genel idman RPE (1-10); bos birakilirsa kayitta 7 kullanilir. */
  overallRpe: number | null;
  /** Idman sonrasi serbest metin gunluk (max 1500 karakter). */
  journalNotes: string;
  /** Harcanan kalori girisi (kcal, string); opsiyonel. */
  calories?: string;
  /** Saatleri elle gir modu aktif mi (timer yerine baslangic/bitis saati). */
  useManualTime?: boolean;
  /** Manuel mod: secilen gun (ISO, gece yarisi). */
  manualDateISO?: string | null;
  /** Manuel mod: baslangic dakikasi (gece yarisindan). */
  manualStartMin?: number | null;
  /** Manuel mod: bitis dakikasi (gece yarisindan). */
  manualEndMin?: number | null;
  showFinishPanel: boolean;
  savedAt: number;
};

/** Eski oturumlarda overallRpe string olarak saklanmis olabilir. */
export function parsePersistedRpe(value: unknown): number | null {
  if (typeof value === "number" && value >= 1 && value <= 10) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 10) return null;
    return parsed;
  }
  return null;
}

export async function loadPersistedSession(
  templateId: string,
): Promise<PersistedSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (parsed.templateId !== templateId) return null;

    if (parsed.status === "running" && parsed.runningSince != null) {
      const extra = Math.floor((Date.now() - parsed.runningSince) / 1000);
      parsed.elapsedSeconds = parsed.accumulatedSeconds + extra;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function savePersistedSession(session: PersistedSession | null): Promise<void> {
  try {
    if (!session) {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
      return;
    }
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Sessizce yut — oturum yine de calisir
  }
}

export async function clearPersistedSession(): Promise<void> {
  await savePersistedSession(null);
}
