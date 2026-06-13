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
  overallRpe: string;
  showFinishPanel: boolean;
  savedAt: number;
};

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
