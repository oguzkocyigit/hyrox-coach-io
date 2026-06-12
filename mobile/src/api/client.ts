/**
 * Backend API istemcisi.
 *
 * - Her istekte Supabase oturumundan taze access token alinir
 *   (suresi dolmussa supabase-js otomatik yeniler).
 * - 401'de bir kez session refresh + retry; yine 401 ise oturum kapatilir.
 * - Hatalar ApiError olarak firlatilir (status + backend detail mesaji).
 */

import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Ic kullanim: 401 sonrasi tek retry'i isaretler */
  isRetry?: boolean;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new ApiError(401, "Oturum bulunamadi.");
  }

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && !options.isRetry) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) {
      return request<T>(path, { ...options, isRetry: true });
    }
    await supabase.auth.signOut();
    throw new ApiError(401, "Oturum suresi doldu. Tekrar giris yapin.");
  }

  if (!response.ok) {
    let detail = `Istek basarisiz (${response.status}).`;
    try {
      const payload = (await response.json()) as { detail?: unknown };
      if (typeof payload.detail === "string") detail = payload.detail;
    } catch {
      // govde JSON degil; varsayilan mesaj kalir
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};
