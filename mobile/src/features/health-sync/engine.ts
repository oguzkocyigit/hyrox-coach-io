/**
 * HealthKit senkron motoru (MOBILE_BLUEPRINT Bolum 4).
 *
 * - Native modul yalnizca calisma aninda require edilir; Expo Go'da modul
 *   yoksa senkron "desteklenmiyor" olarak raporlanir, uygulama cokmez.
 * - Dedup backend sorumlulugundadir (external_id); lastSyncAt yalnizca
 *   sorguyu kucultmek icin optimizasyondur.
 * - RPE gonderilmez; backend avg_hr'den deterministik turetir.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

import { api } from "@/api/client";
import type { CardioType, HealthSyncResponse } from "@/api/types";
import {
  toBatches,
  toCardioSample,
  type HealthWorkoutLike,
} from "@/features/health-sync/mapping";

const ENABLED_KEY = "health_sync_enabled";
const LAST_SYNC_KEY = "health_sync_last_at";

/** Sorgulanacak workout sayisi tavani (dedup backend'de oldugundan guvenli). */
const QUERY_LIMIT = 50;

export type SyncResult = {
  imported: number;
  skippedDuplicates: number;
  scanned: number;
};

// ---------------------------------------------------------------
// Native modul erisimi (korumali)
// ---------------------------------------------------------------
type HealthKitModule = typeof import("@kingstinct/react-native-healthkit");

let cachedModule: HealthKitModule | null | undefined;

/** Expo Go'da native modul yoktur; require bile denenmemeli. */
const isExpoGo = Constants.appOwnership === "expo";

function getHealthKit(): HealthKitModule | null {
  if (cachedModule !== undefined) return cachedModule;
  if (Platform.OS !== "ios" || isExpoGo) {
    cachedModule = null;
    return cachedModule;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require("@kingstinct/react-native-healthkit") as HealthKitModule;
  } catch {
    // Expo Go: nitro modul yok
    cachedModule = null;
  }
  return cachedModule;
}

export async function isHealthSyncSupported(): Promise<boolean> {
  const hk = getHealthKit();
  if (!hk) return false;
  try {
    return await hk.isHealthDataAvailable();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------
// Ayarlar (SecureStore)
// ---------------------------------------------------------------
export async function isSyncEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ENABLED_KEY)) === "1";
}

export async function setSyncEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(ENABLED_KEY, enabled ? "1" : "0");
}

export async function getLastSyncAt(): Promise<Date | null> {
  const raw = await SecureStore.getItemAsync(LAST_SYNC_KEY);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function setLastSyncAt(date: Date): Promise<void> {
  await SecureStore.setItemAsync(LAST_SYNC_KEY, date.toISOString());
}

// ---------------------------------------------------------------
// Izinler
// ---------------------------------------------------------------
export async function requestHealthPermissions(): Promise<boolean> {
  const hk = getHealthKit();
  if (!hk) return false;
  try {
    await hk.requestAuthorization({
      toRead: ["HKWorkoutTypeIdentifier", "HKQuantityTypeIdentifierHeartRate"],
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------
// Senkron
// ---------------------------------------------------------------
async function averageHeartRate(
  hk: HealthKitModule,
  workout: unknown,
): Promise<number | null> {
  try {
    const result = await hk.queryQuantitySamples("HKQuantityTypeIdentifierHeartRate", {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filter: { workout: workout as any },
      unit: "count/min",
      limit: 0,
    });
    const samples = Array.isArray(result)
      ? result
      : ((result as { samples?: { quantity: number }[] })?.samples ?? []);
    if (!samples.length) return null;
    const sum = samples.reduce((acc, s) => acc + s.quantity, 0);
    return sum / samples.length;
  } catch {
    return null;
  }
}

/**
 * HealthKit'ten kosu/kurek antrenmanlarini ceker, backend'e gonderir.
 * Desteklenmiyorsa veya izin yoksa null doner.
 */
export async function runHealthSync(): Promise<SyncResult | null> {
  const hk = getHealthKit();
  if (!hk) return null;

  const activityMap: Record<number, CardioType> = {
    [hk.WorkoutActivityType.running]: "running",
    [hk.WorkoutActivityType.rowing]: "rowing",
  };

  let workouts: readonly unknown[];
  try {
    workouts = await hk.queryWorkoutSamples({ limit: QUERY_LIMIT, ascending: false });
  } catch {
    return null;
  }

  const lastSyncAt = await getLastSyncAt();
  const samples = [];
  let scanned = 0;

  for (const raw of workouts) {
    const workout = raw as HealthWorkoutLike & { workoutActivityType: number };
    const cardioType = activityMap[workout.workoutActivityType];
    if (!cardioType) continue;

    const start =
      workout.startDate instanceof Date
        ? workout.startDate
        : new Date(workout.startDate);
    if (lastSyncAt && start <= lastSyncAt) continue;

    scanned += 1;
    const avgHr = await averageHeartRate(hk, raw);
    const sample = toCardioSample(workout, cardioType, avgHr);
    if (sample) samples.push(sample);
  }

  let imported = 0;
  let skippedDuplicates = 0;
  for (const batch of toBatches(samples)) {
    const response = await api.post<HealthSyncResponse>("/api/v1/sync/health", {
      samples: batch,
    });
    imported += response.imported;
    skippedDuplicates += response.skipped_duplicates;
  }

  await setLastSyncAt(new Date());
  return { imported, skippedDuplicates, scanned };
}
