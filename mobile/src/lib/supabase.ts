/**
 * Supabase istemcisi. Oturum tokenlari Secure Store'da saklanir;
 * supabase-js refresh'i otomatik yonetir.
 */

import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";

import { env } from "@/lib/env";

// SecureStore degerleri 2KB siniri asabilir (JWT + refresh token);
// supabase-js v2 buyuk degerleri parcalamaz, ancak pratikte oturum
// nesnesi sinirin altinda kalir. Asarsa konsol uyarisi verir.
const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Uygulama on plandayken token yenilemeyi calistir, arka planda durdur
// (Supabase'in onerdigi RN deseni).
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
