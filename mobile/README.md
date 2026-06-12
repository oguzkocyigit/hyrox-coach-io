# HYROX Coach — Mobil Uygulama

Expo (React Native + TypeScript) istemcisi. Mimari ve faz plani icin
[MOBILE_BLUEPRINT.md](../MOBILE_BLUEPRINT.md), tasarim sistemi icin
[DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md).

## Kurulum

```bash
npm install
cp .env.example .env   # degerleri doldurun
```

`.env` degiskenleri:

- `EXPO_PUBLIC_API_BASE_URL` — backend koku. iOS simulatorde `http://localhost:8000`,
  Android emulatorde `http://10.0.2.2:8000`, gercek cihazda Mac'in LAN IP'si.
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` — backend ile ayni
  Supabase projesi.

## Calistirma

Once backend'i baslatin (repo kokunde):

```bash
.venv/bin/uvicorn app.main:app --reload
```

Sonra uygulamayi:

```bash
npx expo start        # i = iOS simulator, a = Android emulator
```

Faz 1 ozellikleri Expo Go ile calisir. Faz 2 (HealthKit / Health Connect)
native modul gerektirir; o noktada dev build kullanilir:

```bash
npx eas build --profile development --platform ios
```

## Yapi

```
src/
  app/            # Expo Router rotalari: (auth) giris/kayit, (tabs) 5 sekme
  api/            # types.ts (backend sema aynasi), client.ts, hooks.ts (TanStack Query)
  features/       # dashboard (CNS trend, kas barlari), workout-log, account
  lib/            # supabase.ts (Secure Store oturum), auth.tsx, env.ts
  ui/             # tokens.ts (EMBER tasarim sistemi), Screen, Button, TextField
```

## Kontroller

```bash
npx tsc --noEmit                      # tip kontrolu
npx expo export --platform ios        # bundle smoke testi
```
