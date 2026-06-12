/**
 * Apple Health senkronunun React baglantisi.
 * - useHealthSyncController: Profil ekranindaki ayar karti icin tam durum.
 * - useAutoHealthSync: acilis + foreground'a donuste sessiz senkron.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import {
  getLastSyncAt,
  isHealthSyncSupported,
  isSyncEnabled,
  requestHealthPermissions,
  runHealthSync,
  setSyncEnabled,
  type SyncResult,
} from "@/features/health-sync/engine";

/** Otomatik senkronlar arasi minimum sure. */
const AUTO_SYNC_THROTTLE_MS = 5 * 60_000;

let lastAutoSyncAt = 0;

type ControllerState = {
  loading: boolean;
  supported: boolean;
  enabled: boolean;
  syncing: boolean;
  lastSyncAt: Date | null;
  lastResult: SyncResult | null;
  error: string | null;
};

export function useHealthSyncController() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ControllerState>({
    loading: true,
    supported: false,
    enabled: false,
    syncing: false,
    lastSyncAt: null,
    lastResult: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [supported, enabled, lastSyncAt] = await Promise.all([
        isHealthSyncSupported(),
        isSyncEnabled(),
        getLastSyncAt(),
      ]);
      if (!cancelled) {
        setState((s) => ({ ...s, loading: false, supported, enabled, lastSyncAt }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const syncNow = useCallback(async () => {
    setState((s) => ({ ...s, syncing: true, error: null }));
    try {
      const result = await runHealthSync();
      if (result && result.imported > 0) {
        void queryClient.invalidateQueries({ queryKey: ["workouts"] });
        void queryClient.invalidateQueries({ queryKey: ["metrics"] });
      }
      const lastSyncAt = await getLastSyncAt();
      setState((s) => ({ ...s, syncing: false, lastResult: result, lastSyncAt }));
    } catch {
      setState((s) => ({
        ...s,
        syncing: false,
        error: "Senkron basarisiz oldu. Baglantinizi kontrol edin.",
      }));
    }
  }, [queryClient]);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        const granted = await requestHealthPermissions();
        if (!granted) {
          setState((s) => ({
            ...s,
            error: "Saglik verisi izni alinamadi.",
          }));
          return;
        }
      }
      await setSyncEnabled(enabled);
      setState((s) => ({ ...s, enabled, error: null }));
      if (enabled) void syncNow();
    },
    [syncNow],
  );

  return { ...state, setEnabled, syncNow };
}

/** Sekme yerlesiminde cagrilir; kullanici fark etmeden senkron yapar. */
export function useAutoHealthSync() {
  const queryClient = useQueryClient();
  const runningRef = useRef(false);

  const maybeSync = useCallback(async () => {
    if (runningRef.current) return;
    if (Date.now() - lastAutoSyncAt < AUTO_SYNC_THROTTLE_MS) return;
    if (!(await isHealthSyncSupported())) return;
    if (!(await isSyncEnabled())) return;

    runningRef.current = true;
    lastAutoSyncAt = Date.now();
    try {
      const result = await runHealthSync();
      if (result && result.imported > 0) {
        void queryClient.invalidateQueries({ queryKey: ["workouts"] });
        void queryClient.invalidateQueries({ queryKey: ["metrics"] });
      }
    } catch {
      // Sessiz senkron: hata kullaniciya gosterilmez, sonraki acilista tekrar denenir
    } finally {
      runningRef.current = false;
    }
  }, [queryClient]);

  useEffect(() => {
    void maybeSync();
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") void maybeSync();
    });
    return () => subscription.remove();
  }, [maybeSync]);
}
