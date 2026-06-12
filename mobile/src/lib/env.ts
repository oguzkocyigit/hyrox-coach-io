/**
 * Ortam degiskenleri. EXPO_PUBLIC_* degerleri build sirasinda pakete gomulur;
 * yalnizca istemcide tasinmasi guvenli degerler burada yasar.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} tanimli degil. mobile/.env dosyasini olusturun (bkz. .env.example).`,
    );
  }
  return value;
}

export const env = {
  apiBaseUrl: required(
    "EXPO_PUBLIC_API_BASE_URL",
    process.env.EXPO_PUBLIC_API_BASE_URL,
  ),
  supabaseUrl: required(
    "EXPO_PUBLIC_SUPABASE_URL",
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ),
  supabaseAnonKey: required(
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ),
} as const;
